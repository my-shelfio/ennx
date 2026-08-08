"""投票 API の Pydantic スキーマ（境界変換専用）。

選択肢・投票内容の番号は 0-indexed（選択肢配列の位置）。
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from features.voting.application.dto import (
    AdminSessionView,
    CastBallotRequest,
    CreateVotingSessionRequest,
    ParticipantSessionView,
    VotingResults,
    VotingSessionCreated,
)
from features.voting.domain import RuleResult
from shared.presentation.schemas import ReportItemSchema


class VotingSessionCreateSchema(BaseModel):
    """投票セッション作成のリクエストボディ。"""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(description="投票のタイトル", max_length=200)
    options: list[str] = Field(description="選択肢（2〜10 件）", min_length=1, max_length=20)
    method: str = Field(description="投票方式（plurality / approval / ranking）")
    deadline: datetime | None = Field(default=None, description="締切（省略時は作成から 7 日後）")

    def to_dto(self) -> CreateVotingSessionRequest:
        """application 層の DTO へ変換する。"""
        return CreateVotingSessionRequest(
            title=self.title,
            options=list(self.options),
            method=self.method,
            deadline=self.deadline,
        )


class VotingSessionCreatedSchema(BaseModel):
    """投票セッション作成のレスポンス（トークンはこの応答でのみ返す）。"""

    participant_token: str = Field(description="参加用 URL トークン")
    admin_token: str = Field(description="管理用 URL トークン")
    deadline: datetime = Field(description="投票の締切（UTC）")
    expires_at: datetime = Field(description="データの自動削除日時（UTC、作成から 7 日）")

    @classmethod
    def from_dto(cls, dto: VotingSessionCreated) -> VotingSessionCreatedSchema:
        """application 層の DTO から組み立てる。"""
        return cls(
            participant_token=dto.participant_token,
            admin_token=dto.admin_token,
            deadline=dto.deadline,
            expires_at=dto.expires_at,
        )


class ParticipantSessionSchema(BaseModel):
    """参加者向けのセッション公開情報。"""

    title: str
    options: list[str]
    method: str
    deadline: datetime
    is_closed: bool = Field(description="締切済み（投票不可）かどうか")

    @classmethod
    def from_dto(cls, dto: ParticipantSessionView) -> ParticipantSessionSchema:
        """application 層の DTO から組み立てる。"""
        return cls(
            title=dto.title,
            options=dto.options,
            method=dto.method,
            deadline=dto.deadline,
            is_closed=dto.is_closed,
        )


class AdminSessionSchema(BaseModel):
    """主催者向けのセッション情報。"""

    title: str
    options: list[str]
    method: str
    deadline: datetime
    expires_at: datetime
    is_closed: bool
    ballot_count: int = Field(description="受け付けた投票数")
    participant_token: str = Field(description="参加用 URL トークン（再表示用）")
    voters: list[str] = Field(description="投票済みニックネームの一覧（投票順）")

    @classmethod
    def from_dto(cls, dto: AdminSessionView) -> AdminSessionSchema:
        """application 層の DTO から組み立てる。"""
        return cls(
            title=dto.title,
            options=dto.options,
            method=dto.method,
            deadline=dto.deadline,
            expires_at=dto.expires_at,
            is_closed=dto.is_closed,
            ballot_count=dto.ballot_count,
            participant_token=dto.participant_token,
            voters=list(dto.voters),
        )


class BallotSchema(BaseModel):
    """投票のリクエストボディ。方式に応じたフィールドのみ指定する。"""

    model_config = ConfigDict(extra="forbid")

    voter_name: str = Field(
        description=(
            "投票者のニックネーム（本名でなくてよい。社員番号等を想定）。必須。"
            "同一セッション内で同一ニックネーム（前後空白のみ除去した完全一致）の"
            "投票は上書きする。"
        ),
        min_length=1,
        max_length=50,
    )
    choice: int | None = Field(default=None, description="plurality: 選んだ選択肢（0-indexed）")
    ranking: list[int] | None = Field(
        default=None, description="ranking: 好ましい順の選択肢番号の完全順列（0-indexed）"
    )
    approvals: list[int] | None = Field(
        default=None, description="approval: 承認する選択肢番号（0-indexed）"
    )

    def to_dto(self) -> CastBallotRequest:
        """application 層の DTO へ変換する。"""
        return CastBallotRequest(
            voter_name=self.voter_name,
            choice=self.choice,
            ranking=list(self.ranking) if self.ranking is not None else None,
            approvals=list(self.approvals) if self.approvals is not None else None,
        )


class RuleResultSchema(BaseModel):
    """投票ルール 1 つの集計結果。"""

    rule: str = Field(description="ルールキー（plurality / borda / approval / condorcet）")
    scores: list[float] = Field(description="選択肢ごとのスコア（0-indexed）")
    ranking: list[int] = Field(description="スコア降順の選択肢番号列")
    winners: list[int] = Field(description="最高スコアの選択肢番号（同点含む）")

    @classmethod
    def from_domain(cls, result: RuleResult) -> RuleResultSchema:
        """ドメインの RuleResult から組み立てる。"""
        return cls(
            rule=result.rule,
            scores=result.scores,
            ranking=result.ranking,
            winners=result.winners,
        )


class VotingResultsSchema(BaseModel):
    """集計結果のレスポンス（主結果 + 他ルール比較 + 性質レポート）。"""

    title: str
    options: list[str]
    method: str
    ballot_count: int
    primary: RuleResultSchema
    comparison: list[RuleResultSchema]
    report: list[ReportItemSchema]
    voters: list[str] = Field(description="投票済みニックネームの一覧（投票順）")

    @classmethod
    def from_dto(cls, dto: VotingResults) -> VotingResultsSchema:
        """application 層の DTO から組み立てる。"""
        return cls(
            title=dto.title,
            options=dto.options,
            method=dto.method,
            ballot_count=dto.ballot_count,
            primary=RuleResultSchema.from_domain(dto.primary),
            comparison=[RuleResultSchema.from_domain(r) for r in dto.comparison],
            report=[
                ReportItemSchema(label=item.label, status=item.status, detail=item.detail)
                for item in dto.report
            ],
            voters=list(dto.voters),
        )


class CleanupResponseSchema(BaseModel):
    """期限切れ削除のレスポンス。"""

    deleted: int = Field(description="削除した投票セッション数")
