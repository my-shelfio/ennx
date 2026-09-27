"""入力エラー基底（InvalidInputError）と各 feature の派生エラーのテスト。"""

from __future__ import annotations

import pytest

from features.assignment.application.errors import InvalidAssignmentInputError
from features.matching.application.errors import InvalidMatchingInputError
from features.voting.application.errors import InvalidVotingInputError, VotingError
from shared.application.errors import FieldError, InvalidInputError

_ERRORS = [
    FieldError(field="title", message="必須です"),
    FieldError(field=None, message="不正です"),
]


@pytest.mark.parametrize(
    "error_type",
    [InvalidMatchingInputError, InvalidAssignmentInputError, InvalidVotingInputError],
)
def test_input_errors_keep_errors_and_join_messages(error_type: type[InvalidInputError]) -> None:
    exc = error_type(_ERRORS)

    assert exc.errors == _ERRORS
    assert str(exc) == "必須です／不正です"


def test_invalid_voting_input_error_is_also_a_voting_error() -> None:
    assert isinstance(InvalidVotingInputError(_ERRORS), VotingError)
