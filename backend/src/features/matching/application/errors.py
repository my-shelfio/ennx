"""matching ユースケースのエラー。

presentation 層が RFC 9457 の 422 レスポンスへ変換する。
"""

from __future__ import annotations

from shared.application.errors import ApplicationError, FieldError


class InvalidMatchingInputError(ApplicationError):
    """マッチング入力が不正であることを表すユースケースエラー。

    ドメインモデルの `__post_init__` が送出する ValueError、および
    ユースケース側の構造検証（未知の制約種別・必須フィールド欠落など）を
    本エラーへ変換する。presentation 層は `errors` を RFC 9457 の
    `errors[]` へそのままマッピングできる。
    """

    def __init__(self, errors: list[FieldError]) -> None:
        super().__init__("／".join(e.message for e in errors))
        self.errors = errors
