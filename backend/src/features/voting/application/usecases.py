"""投票・合意形成のユースケース群。

各ユースケースは実行冒頭で期限切れセッションの遅延削除
（repository.purge_expired）を行う。トークンは
`secrets.token_urlsafe(24)`（192bit）で生成する。
"""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from features.voting.domain import (
    ApprovalTallyInput,
    ChoiceTallyInput,
    RankingTallyInput,
    RuleResult,
    build_voting_report,
    tally_approval,
    tally_borda,
    tally_condorcet,
    tally_plurality,
)
from features.voting.domain.models import MAX_OPTIONS, MIN_OPTIONS
from features.voting.domain.rules import first_choices
from shared.application.errors import FieldError
from shared.domain.report import ReportItem

from .dto import (
    MAX_LIFETIME_DAYS,
    MAX_OPTION_LENGTH,
    MAX_TITLE_LENGTH,
    MAX_VOTER_NAME_LENGTH,
    VOTING_METHODS,
    AdminSessionView,
    CastBallotRequest,
    CreateVotingSessionRequest,
    ParticipantSessionView,
    VotingResults,
    VotingSessionCreated,
)
from .errors import (
    InvalidVotingInputError,
    VotingClosedError,
    VotingNotClosedError,
    VotingSessionNotFoundError,
)
from .ports import BallotRecord, VotingRepository, VotingSessionRecord

_NOT_FOUND_MESSAGE = "この投票は終了したか、存在しません"


def _now() -> datetime:
    return datetime.now(UTC)


def _is_closed(record: VotingSessionRecord, now: datetime) -> bool:
    return record.closed_at is not None or now >= record.deadline


class CreateVotingSession:
    """投票セッションを作成する。"""

    def __init__(self, repository: VotingRepository) -> None:
        self._repository = repository

    def execute(self, request: CreateVotingSessionRequest) -> VotingSessionCreated:
        now = _now()
        self._repository.purge_expired(now)
        errors = self._validate(request, now)
        if errors:
            raise InvalidVotingInputError(errors)

        expires_at = now + timedelta(days=MAX_LIFETIME_DAYS)
        deadline = request.deadline if request.deadline is not None else expires_at
        record = VotingSessionRecord(
            session_id=str(uuid.uuid4()),
            participant_token=secrets.token_urlsafe(24),
            admin_token=secrets.token_urlsafe(24),
            title=request.title.strip(),
            options=[option.strip() for option in request.options],
            method=request.method,
            deadline=deadline,
            expires_at=expires_at,
            created_at=now,
            closed_at=None,
        )
        self._repository.create_session(record)
        return VotingSessionCreated(
            participant_token=record.participant_token,
            admin_token=record.admin_token,
            deadline=record.deadline,
            expires_at=record.expires_at,
        )

    def _validate(self, request: CreateVotingSessionRequest, now: datetime) -> list[FieldError]:
        errors: list[FieldError] = []
        title = request.title.strip()
        if not title:
            errors.append(FieldError(field="title", message="タイトルを入力してください"))
        elif len(title) > MAX_TITLE_LENGTH:
            errors.append(
                FieldError(
                    field="title",
                    message=f"タイトルは {MAX_TITLE_LENGTH} 文字以内にしてください",
                )
            )
        options = [option.strip() for option in request.options]
        if not MIN_OPTIONS <= len(options) <= MAX_OPTIONS:
            errors.append(
                FieldError(
                    field="options",
                    message=f"選択肢は {MIN_OPTIONS}〜{MAX_OPTIONS} 件にしてください",
                )
            )
        if any(not option for option in options):
            errors.append(FieldError(field="options", message="空の選択肢は指定できません"))
        if any(len(option) > MAX_OPTION_LENGTH for option in options):
            errors.append(
                FieldError(
                    field="options",
                    message=f"選択肢は {MAX_OPTION_LENGTH} 文字以内にしてください",
                )
            )
        if len(set(options)) != len(options):
            errors.append(FieldError(field="options", message="選択肢が重複しています"))
        if request.method not in VOTING_METHODS:
            errors.append(
                FieldError(
                    field="method",
                    message=f"投票方式は {' / '.join(VOTING_METHODS)} から選択してください",
                )
            )
        if request.deadline is not None:
            if request.deadline <= now:
                errors.append(
                    FieldError(field="deadline", message="締切は現在より後にしてください")
                )
            elif request.deadline > now + timedelta(days=MAX_LIFETIME_DAYS):
                errors.append(
                    FieldError(
                        field="deadline",
                        message=f"締切は {MAX_LIFETIME_DAYS} 日以内にしてください",
                    )
                )
        return errors


class GetParticipantSession:
    """参加用トークンからセッション公開情報を取得する。"""

    def __init__(self, repository: VotingRepository) -> None:
        self._repository = repository

    def execute(self, participant_token: str) -> ParticipantSessionView:
        now = _now()
        self._repository.purge_expired(now)
        record = self._repository.find_by_participant_token(participant_token)
        if record is None:
            raise VotingSessionNotFoundError(_NOT_FOUND_MESSAGE)
        return ParticipantSessionView(
            title=record.title,
            options=list(record.options),
            method=record.method,
            deadline=record.deadline,
            is_closed=_is_closed(record, now),
        )


class CastBallot:
    """投票を受け付ける（同一ニックネームは上書き）。"""

    def __init__(self, repository: VotingRepository) -> None:
        self._repository = repository

    def execute(self, participant_token: str, request: CastBallotRequest) -> None:
        now = _now()
        self._repository.purge_expired(now)
        record = self._repository.find_by_participant_token(participant_token)
        if record is None:
            raise VotingSessionNotFoundError(_NOT_FOUND_MESSAGE)
        if _is_closed(record, now):
            raise VotingClosedError("この投票は締め切られています")
        content = self._validate_content(record, request)
        # ニックネームは必須入力。前後の空白のみ除去し、それ以外は大文字小文字・
        # 全角半角を区別する厳密一致で重複投票（上書き）を判定する。
        voter_name = request.voter_name.strip()
        if not voter_name:
            raise InvalidVotingInputError(
                [FieldError(field="voter_name", message="ニックネームを入力してください")]
            )
        if len(voter_name) > MAX_VOTER_NAME_LENGTH:
            raise InvalidVotingInputError(
                [
                    FieldError(
                        field="voter_name",
                        message=f"ニックネームは {MAX_VOTER_NAME_LENGTH} 文字以内にしてください",
                    )
                ]
            )
        self._repository.upsert_ballot(
            record.session_id, BallotRecord(voter_name=voter_name, content=content)
        )

    def _validate_content(
        self, record: VotingSessionRecord, request: CastBallotRequest
    ) -> dict[str, object]:
        """方式に応じた投票内容を検証し、保存形式（dict）に変換する。

        検証はドメインモデル（__post_init__）に委譲し、ValueError を
        InvalidVotingInputError へ変換する。
        """
        num_options = len(record.options)
        try:
            if record.method == "plurality":
                if request.choice is None:
                    raise ValueError("choice を指定してください")
                ChoiceTallyInput(num_options=num_options, choices=[request.choice])
                return {"choice": request.choice}
            if record.method == "approval":
                if request.approvals is None:
                    raise ValueError("approvals を指定してください")
                ApprovalTallyInput(num_options=num_options, approvals=[request.approvals])
                return {"approvals": list(request.approvals)}
            if request.ranking is None:
                raise ValueError("ranking を指定してください")
            RankingTallyInput(num_options=num_options, rankings=[request.ranking])
            return {"ranking": list(request.ranking)}
        except ValueError as exc:
            raise InvalidVotingInputError([FieldError(field="content", message=str(exc))]) from exc


class CloseVoting:
    """投票を締め切る（管理用トークン）。"""

    def __init__(self, repository: VotingRepository) -> None:
        self._repository = repository

    def execute(self, admin_token: str) -> None:
        now = _now()
        self._repository.purge_expired(now)
        record = self._repository.find_by_admin_token(admin_token)
        if record is None:
            raise VotingSessionNotFoundError(_NOT_FOUND_MESSAGE)
        if record.closed_at is None:
            self._repository.close_session(record.session_id, now)


class GetAdminSession:
    """管理用トークンからセッション情報を取得する。"""

    def __init__(self, repository: VotingRepository) -> None:
        self._repository = repository

    def execute(self, admin_token: str) -> AdminSessionView:
        now = _now()
        self._repository.purge_expired(now)
        record = self._repository.find_by_admin_token(admin_token)
        if record is None:
            raise VotingSessionNotFoundError(_NOT_FOUND_MESSAGE)
        ballots = self._repository.list_ballots(record.session_id)
        return AdminSessionView(
            title=record.title,
            options=list(record.options),
            method=record.method,
            deadline=record.deadline,
            expires_at=record.expires_at,
            is_closed=_is_closed(record, now),
            ballot_count=len(ballots),
            participant_token=record.participant_token,
            voters=[b.voter_name for b in ballots],
        )


class GetVotingResults:
    """集計結果と性質レポートを取得する（締切後のみ）。"""

    def __init__(self, repository: VotingRepository) -> None:
        self._repository = repository

    def execute(self, admin_token: str) -> VotingResults:
        now = _now()
        self._repository.purge_expired(now)
        record = self._repository.find_by_admin_token(admin_token)
        if record is None:
            raise VotingSessionNotFoundError(_NOT_FOUND_MESSAGE)
        if not _is_closed(record, now):
            raise VotingNotClosedError("結果は締切後に確認できます")
        ballots = self._repository.list_ballots(record.session_id)
        primary, comparison, report = self._tally(record, ballots)
        return VotingResults(
            title=record.title,
            options=list(record.options),
            method=record.method,
            ballot_count=len(ballots),
            primary=primary,
            comparison=comparison,
            report=report,
            voters=[b.voter_name for b in ballots],
        )

    def _tally(
        self, record: VotingSessionRecord, ballots: list[BallotRecord]
    ) -> tuple[RuleResult, list[RuleResult], list[ReportItem]]:
        num_options = len(record.options)
        if record.method == "plurality":
            choices = [
                choice
                for choice in (b.content.get("choice") for b in ballots)
                if isinstance(choice, int)
            ]
            primary = tally_plurality(ChoiceTallyInput(num_options=num_options, choices=choices))
            return primary, [primary], []
        if record.method == "approval":
            approvals = [
                [int(v) for v in a]
                for a in (b.content.get("approvals") for b in ballots)
                if isinstance(a, list)
            ]
            primary = tally_approval(
                ApprovalTallyInput(num_options=num_options, approvals=approvals)
            )
            return primary, [primary], []
        rankings = [
            [int(v) for v in r]
            for r in (b.content.get("ranking") for b in ballots)
            if isinstance(r, list)
        ]
        tally_input = RankingTallyInput(num_options=num_options, rankings=rankings)
        primary = tally_borda(tally_input)
        comparison = [
            tally_plurality(first_choices(tally_input)),
            primary,
            tally_condorcet(tally_input),
        ]
        report = (
            build_voting_report(tally_input, list(record.options), comparison) if rankings else []
        )
        return primary, comparison, report


class DeleteVotingSession:
    """投票セッションを即時削除する（管理用トークン）。"""

    def __init__(self, repository: VotingRepository) -> None:
        self._repository = repository

    def execute(self, admin_token: str) -> None:
        now = _now()
        self._repository.purge_expired(now)
        record = self._repository.find_by_admin_token(admin_token)
        if record is None:
            raise VotingSessionNotFoundError(_NOT_FOUND_MESSAGE)
        self._repository.delete_session(record.session_id)


class CleanupExpiredSessions:
    """期限切れセッションを一括削除する（日次 cron / 遅延削除の保証側）。"""

    def __init__(self, repository: VotingRepository) -> None:
        self._repository = repository

    def execute(self) -> int:
        return self._repository.purge_expired(_now())
