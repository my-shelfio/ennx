"""投票ユースケースの DTO（presentation 層との境界データ）。"""

from __future__ import annotations

from dataclasses import dataclass, fields
from datetime import datetime

from features.voting.domain import RuleResult
from shared.domain.report import ReportItem

# 投票方式キー。plurality: 多数決（単一選択）、approval: 承認投票、
# ranking: 順位付け（主結果はボルダ、比較でコンドルセ・多数決も算出）。
VOTING_METHODS = ("plurality", "approval", "ranking")

# 各種入力値の文字数上限。
MAX_TITLE_LENGTH = 100
MAX_OPTION_LENGTH = 50
# 選択肢ごとの補足説明（任意）の文字数上限。
MAX_OPTION_DESCRIPTION_LENGTH = 200
MAX_VOTER_NAME_LENGTH = 50  # 選択肢の文字数上限（MAX_OPTION_LENGTH）と揃える
MAX_LIFETIME_DAYS = 7


@dataclass(frozen=True, kw_only=True)
class CreateVotingSessionRequest:
    """投票セッション作成の入力。deadline 省略時は有効期限（7 日後）を締切とする。

    option_descriptions は選択肢ごとの補足説明（任意）。指定する場合は options と
    同数とし、説明のない選択肢は空文字にする。省略時はすべて説明なしとして扱う。
    """

    title: str
    options: list[str]
    option_descriptions: list[str] | None
    method: str
    deadline: datetime | None
    # 締切後に参加者（参加用トークン）へ集計結果・性質レポートを公開するか。
    publish_results: bool


@dataclass(frozen=True, kw_only=True)
class VotingSessionCreated:
    """投票セッション作成の結果（トークンは 1 度だけ返す）。"""

    participant_token: str
    admin_token: str
    deadline: datetime
    expires_at: datetime
    publish_results: bool


@dataclass(frozen=True, kw_only=True)
class ParticipantSessionView:
    """参加者向けのセッション公開情報。"""

    title: str
    options: list[str]
    # 選択肢ごとの補足説明（options と同数。説明なしは空文字）。
    option_descriptions: list[str]
    method: str
    deadline: datetime
    is_closed: bool
    # 締切済みかつ結果公開の設定がある場合に True（参加用トークンで結果を取得できる）。
    results_available: bool
    # 受け付けた投票数。締切後のみ公開し、締切前は None とする。
    ballot_count: int | None


@dataclass(frozen=True, kw_only=True)
class AdminSessionView:
    """主催者向けのセッション情報。"""

    title: str
    options: list[str]
    # 選択肢ごとの補足説明（options と同数。説明なしは空文字）。
    option_descriptions: list[str]
    method: str
    deadline: datetime
    expires_at: datetime
    is_closed: bool
    publish_results: bool
    ballot_count: int
    participant_token: str
    # 投票済みニックネームの一覧（投票順）。主催者が「誰が投票したか」を
    # 把握できるようにする。
    voters: list[str]


@dataclass(frozen=True, kw_only=True)
class CastBallotRequest:
    """投票 1 件の入力。method に応じていずれかのフィールドを使う。

    voter_name は参加者が入力する必須のニックネーム（本名でなくてよい。社員番号等を
    想定）。同一セッション内で同一ニックネーム（前後空白のみ除去した完全一致）の
    投票は上書きする。
    """

    voter_name: str
    choice: int | None
    ranking: list[int] | None
    approvals: list[int] | None


@dataclass(frozen=True, kw_only=True)
class PublicVotingResults:
    """参加者向けに公開する集計結果（投票者のニックネーム一覧は含めない）。"""

    title: str
    options: list[str]
    # 選択肢ごとの補足説明（options と同数。説明なしは空文字）。
    option_descriptions: list[str]
    method: str
    ballot_count: int
    primary: RuleResult
    comparison: list[RuleResult]
    report: list[ReportItem]


@dataclass(frozen=True, kw_only=True)
class VotingResults(PublicVotingResults):
    """主催者向けの集計結果（公開用の集計結果 + 投票者一覧）。"""

    # 投票済みニックネームの一覧（投票順）。集計結果画面でも
    # 「誰が投票したか」を表示できるようにする。
    voters: list[str]

    @classmethod
    def from_public(cls, public: PublicVotingResults, voters: list[str]) -> VotingResults:
        """公開用の集計結果に投票者一覧を加えて組み立てる。"""
        return cls(**{f.name: getattr(public, f.name) for f in fields(public)}, voters=voters)
