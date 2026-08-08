"""feature 横断のユースケースエラー基底。

各 feature の application 層エラー（matching の InvalidMatchingInputError、
voting の VotingError 系）が共通で継承する基底クラスと、フィールド単位の
入力エラーを表す FieldError を置く。
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, kw_only=True)
class FieldError:
    """入力エラー 1 件。

    Attributes:
        field: エラーの発生フィールド名（リクエスト DTO の属性名）。
            特定フィールドに紐づかないエラー（ドメイン例外由来など）は None。
        message: 利用者向けの日本語エラーメッセージ。
    """

    field: str | None
    message: str


class ApplicationError(Exception):
    """application 層のエラーの基底クラス（feature 共通）。"""
