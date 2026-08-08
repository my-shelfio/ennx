"""ユースケース入出力 DTO。"""

from features.matching.application.dto.requests import ConstraintEntry, MatchingRequest
from features.matching.application.dto.results import (
    AlgorithmMetaDTO,
    ConstraintTypeMetaDTO,
    MatchingEventDTO,
    MatchingOutcome,
    ValidationOutcome,
)

__all__ = [
    "AlgorithmMetaDTO",
    "ConstraintEntry",
    "ConstraintTypeMetaDTO",
    "MatchingEventDTO",
    "MatchingOutcome",
    "MatchingRequest",
    "ValidationOutcome",
]
