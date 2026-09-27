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
    MAX_OPTION_DESCRIPTION_LENGTH,
    MAX_OPTION_LENGTH,
    MAX_TITLE_LENGTH,
    MAX_VOTER_NAME_LENGTH,
    VOTING_METHODS,
    AdminSessionView,
    CastBallotRequest,
    CreateVotingSessionRequest,
    ParticipantSessionView,
    PublicVotingResults,
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


def _find_by_participant_token(
    repository: VotingRepository, participant_token: str, now: datetime
) -> VotingSessionRecord:
    """期限切れを削除したうえで参加用トークンのセッションを返す（無ければ未検出）。"""
    repository.purge_expired(now)
    record = repository.find_by_participant_token(participant_token)
    if record is None:
        raise VotingSessionNotFoundError(_NOT_FOUND_MESSAGE)
    return record


def _find_by_admin_token(
    repository: VotingRepository, admin_token: str, now: datetime
) -> VotingSessionRecord:
    """期限切れを削除したうえで管理用トークンのセッションを返す（無ければ未検出）。"""
    repository.purge_expired(now)
    record = repository.find_by_admin_token(admin_token)
    if record is None:
        raise VotingSessionNotFoundError(_NOT_FOUND_MESSAGE)
    return record


def _tally(
    record: VotingSessionRecord, ballots: list[BallotRecord]
) -> tuple[RuleResult, list[RuleResult], list[ReportItem]]:
    """方式に応じて主結果・他ルール比較・性質レポートを算出する。"""
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
        primary = tally_approval(ApprovalTallyInput(num_options=num_options, approvals=approvals))
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
    report = build_voting_report(tally_input, list(record.options), comparison) if rankings else []
    return primary, comparison, report


def _build_public_results(
    record: VotingSessionRecord, ballots: list[BallotRecord]
) -> PublicVotingResults:
    """集計結果（投票者一覧を除く）の DTO を組み立てる。"""
    primary, comparison, report = _tally(record, ballots)
    return PublicVotingResults(
        title=record.title,
        options=list(record.options),
        option_descriptions=list(record.option_descriptions),
        method=record.method,
        ballot_count=len(ballots),
        primary=primary,
        comparison=comparison,
        report=report,
    )


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
        option_descriptions = (
            [description.strip() for description in request.option_descriptions]
            if request.option_descriptions is not None
            else [""] * len(request.options)
        )
        record = VotingSessionRecord(
            session_id=str(uuid.uuid4()),
            participant_token=secrets.token_urlsafe(24),
            admin_token=secrets.token_urlsafe(24),
            title=request.title.strip(),
            options=[option.strip() for option in request.options],
            option_descriptions=option_descriptions,
            method=request.method,
            deadline=deadline,
            expires_at=expires_at,
            created_at=now,
            closed_at=None,
            publish_results=request.publish_results,
        )
        self._repository.create_session(record)
        return VotingSessionCreated(
            participant_token=record.participant_token,
            admin_token=record.admin_token,
            deadline=record.deadline,
            expires_at=record.expires_at,
            publish_results=record.publish_results,
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
        if request.option_descriptions is not None:
            if len(request.option_descriptions) != len(options):
                errors.append(
                    FieldError(
                        field="option_descriptions",
                        message="補足説明は選択肢と同じ件数で指定してください",
                    )
                )
            if any(
                len(description.strip()) > MAX_OPTION_DESCRIPTION_LENGTH
                for description in request.option_descriptions
            ):
                errors.append(
                    FieldError(
                        field="option_descriptions",
                        message=(
                            f"補足説明は {MAX_OPTION_DESCRIPTION_LENGTH} 文字以内にしてください"
                        ),
                    )
                )
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
        record = _find_by_participant_token(self._repository, participant_token, now)
        is_closed = _is_closed(record, now)
        return ParticipantSessionView(
            title=record.title,
            options=list(record.options),
            option_descriptions=list(record.option_descriptions),
            method=record.method,
            deadline=record.deadline,
            is_closed=is_closed,
            results_available=is_closed and record.publish_results,
            ballot_count=(
                len(self._repository.list_ballots(record.session_id)) if is_closed else None
            ),
        )


class CastBallot:
    """投票を受け付ける（同一ニックネームは上書き）。"""

    def __init__(self, repository: VotingRepository) -> None:
        self._repository = repository

    def execute(self, participant_token: str, request: CastBallotRequest) -> None:
        now = _now()
        record = _find_by_participant_token(self._repository, participant_token, now)
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
        record = _find_by_admin_token(self._repository, admin_token, now)
        if record.closed_at is None:
            self._repository.close_session(record.session_id, now)


class GetAdminSession:
    """管理用トークンからセッション情報を取得する。"""

    def __init__(self, repository: VotingRepository) -> None:
        self._repository = repository

    def execute(self, admin_token: str) -> AdminSessionView:
        now = _now()
        record = _find_by_admin_token(self._repository, admin_token, now)
        ballots = self._repository.list_ballots(record.session_id)
        return AdminSessionView(
            title=record.title,
            options=list(record.options),
            option_descriptions=list(record.option_descriptions),
            method=record.method,
            deadline=record.deadline,
            expires_at=record.expires_at,
            is_closed=_is_closed(record, now),
            publish_results=record.publish_results,
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
        record = _find_by_admin_token(self._repository, admin_token, now)
        if not _is_closed(record, now):
            raise VotingNotClosedError("結果は締切後に確認できます")
        ballots = self._repository.list_ballots(record.session_id)
        return VotingResults.from_public(
            _build_public_results(record, ballots), voters=[b.voter_name for b in ballots]
        )


class GetPublicVotingResults:
    """参加用トークンから公開用の集計結果を取得する。

    主催者が作成時に結果公開を選び、かつ締切済みの場合のみ返す。それ以外は
    投票の存在有無を区別しない（存在秘匿の）未検出として扱う。投票者の
    ニックネーム一覧は含めない。
    """

    def __init__(self, repository: VotingRepository) -> None:
        self._repository = repository

    def execute(self, participant_token: str) -> PublicVotingResults:
        now = _now()
        record = _find_by_participant_token(self._repository, participant_token, now)
        if not record.publish_results or not _is_closed(record, now):
            raise VotingSessionNotFoundError(_NOT_FOUND_MESSAGE)
        ballots = self._repository.list_ballots(record.session_id)
        return _build_public_results(record, ballots)


class DeleteVotingSession:
    """投票セッションを即時削除する（管理用トークン）。"""

    def __init__(self, repository: VotingRepository) -> None:
        self._repository = repository

    def execute(self, admin_token: str) -> None:
        now = _now()
        record = _find_by_admin_token(self._repository, admin_token, now)
        self._repository.delete_session(record.session_id)


class CleanupExpiredSessions:
    """期限切れセッションを一括削除する（日次 cron / 遅延削除の保証側）。"""

    def __init__(self, repository: VotingRepository) -> None:
        self._repository = repository

    def execute(self) -> int:
        return self._repository.purge_expired(_now())
