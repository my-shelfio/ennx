"""結果共有ユースケースのエラー。

presentation 層が HTTP ステータスへマッピングする（404 / 413 / 422 / 503）。
"""

from __future__ import annotations

from shared.application.errors import ApplicationError, InvalidInputError


class ResultShareError(ApplicationError):
    """結果共有ユースケースのエラー基底。"""


class ResultShareUnavailableError(ResultShareError):
    """保存基盤が構成されておらず結果共有を提供できない（→ 503）。"""


class ResultShareNotFoundError(ResultShareError):
    """トークンに対応する共有データが存在しない・期限切れ（→ 404）。

    存在有無を区別しない文言でトークン探索を防ぐ。
    """


class ResultShareTooLargeError(ResultShareError):
    """保存する入力が保存上限を超える（→ 413）。"""


class InvalidResultShareInputError(ResultShareError, InvalidInputError):
    """発行の入力が不正であることを表すユースケースエラー（→ 422）。"""
