"""matching ユースケースのエラー。

presentation 層が RFC 9457 の 422 レスポンスへ変換する。
"""

from __future__ import annotations

from shared.application.errors import ApplicationError, InvalidInputError


class InvalidMatchingInputError(InvalidInputError):
    """マッチング入力が不正であることを表すユースケースエラー。

    ドメインモデルの `__post_init__` が送出する ValueError、および
    ユースケース側の構造検証（未知の制約種別・必須フィールド欠落など）を
    本エラーへ変換する。
    """


class SampleNotFoundError(ApplicationError):
    """指定されたキーのサンプルが存在しないことを表すユースケースエラー。

    presentation 層が RFC 9457 の 404 レスポンスへ変換する。
    """

    def __init__(self, key: str) -> None:
        super().__init__(f"サンプル「{key}」は存在しません")
        self.key = key
