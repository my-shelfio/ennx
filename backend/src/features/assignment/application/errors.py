"""assignment ユースケースのエラー。

presentation 層が RFC 9457 の 422 レスポンスへ変換する。
"""

from __future__ import annotations

from shared.application.errors import ApplicationError, FieldError


class InvalidAssignmentInputError(ApplicationError):
    """割り当て入力が不正であることを表すユースケースエラー。

    ドメインモデルの `__post_init__` が送出する ValueError、分解可能性の検証
    （bihierarchy）で送出される DecompositionError、およびユースケース側の
    構造検証（未知の制約種別・パラメータ不足など）を本エラーへ変換する。
    """

    def __init__(self, errors: list[FieldError]) -> None:
        super().__init__("／".join(e.message for e in errors))
        self.errors = errors
