"""投票ユースケースのエラー。

presentation 層が HTTP ステータスへマッピングする（404 / 409 / 422 / 503）。
"""

from __future__ import annotations

from shared.application.errors import ApplicationError, FieldError


class VotingError(ApplicationError):
    """投票ユースケースのエラー基底。"""


class VotingUnavailableError(VotingError):
    """保存基盤が構成されておらず投票機能を提供できない（→ 503）。"""


class VotingSessionNotFoundError(VotingError):
    """トークンに対応する投票が存在しない・期限切れ（→ 404）。

    存在有無を区別しない文言でトークン探索を防ぐ。
    """


class VotingClosedError(VotingError):
    """締切済み・集計済みの投票への投票操作（→ 409）。"""


class VotingNotClosedError(VotingError):
    """締切前の結果取得（→ 409）。"""


class InvalidVotingInputError(VotingError):
    """投票入力が不正であることを表すユースケースエラー（→ 422）。"""

    def __init__(self, errors: list[FieldError]) -> None:
        super().__init__("／".join(e.message for e in errors))
        self.errors = errors
