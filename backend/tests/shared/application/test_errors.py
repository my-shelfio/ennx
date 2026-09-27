"""入力エラー基底（InvalidInputError）と各 feature の派生エラーのテスト。"""

from __future__ import annotations

from features.assignment.application.errors import InvalidAssignmentInputError
from features.matching.application.errors import InvalidMatchingInputError
from features.voting.application.errors import InvalidVotingInputError, VotingError
from shared.application.errors import ApplicationError, FieldError, InvalidInputError

_ERRORS = [
    FieldError(field="title", message="タイトルを入力してください"),
    FieldError(field=None, message="入力が不正です"),
]


def test_invalid_input_error_keeps_errors_and_joins_messages() -> None:
    """errors を保持し、メッセージは各エラーを「／」で連結する。"""
    exc = InvalidInputError(_ERRORS)

    assert exc.errors == _ERRORS
    assert str(exc) == "タイトルを入力してください／入力が不正です"


def test_feature_input_errors_inherit_base_behavior() -> None:
    """3 feature の入力エラーは基底と同じ保持・連結の挙動を持つ。"""
    for error_type in (
        InvalidMatchingInputError,
        InvalidAssignmentInputError,
        InvalidVotingInputError,
    ):
        exc = error_type(_ERRORS)

        assert isinstance(exc, InvalidInputError)
        assert isinstance(exc, ApplicationError)
        assert exc.errors == _ERRORS
        assert str(exc) == "タイトルを入力してください／入力が不正です"


def test_invalid_voting_input_error_is_also_a_voting_error() -> None:
    """投票の入力エラーは VotingError と入力エラー基底の両方として扱える。"""
    exc = InvalidVotingInputError(_ERRORS)

    assert isinstance(exc, VotingError)
