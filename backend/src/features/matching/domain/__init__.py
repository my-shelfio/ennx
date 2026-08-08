"""マッチングアルゴリズムパッケージ。

Web 層（app/main）から独立した純粋関数として実装する。
外部に公開する入出力データモデルとアルゴリズム関数をここで再エクスポートする。
"""

from .ca import (
    all_constraints,
    budget_constraint,
    capacity_constraint,
    collision_avoidance_constraint,
    combined_constraint,
    cutoff_adjustment,
)
from .checks import (
    CheckResult,
    check_capacity_compliance,
    check_fairness,
    check_individual_rationality,
    check_no_blocking_pair,
    check_stability,
    check_weak_stability,
)
from .da import deferred_acceptance
from .events import EventType, MatchingEvent, reconstruct_matching
from .fda import flexible_deferred_acceptance
from .models import (
    BaseMatchingInput,
    CAInput,
    CAResult,
    Constraint,
    DAInput,
    FDAInput,
    MatchingResult,
    build_rank,
)

__all__ = [
    "BaseMatchingInput",
    "CAInput",
    "CAResult",
    "Constraint",
    "CheckResult",
    "DAInput",
    "EventType",
    "FDAInput",
    "MatchingEvent",
    "MatchingResult",
    "all_constraints",
    "budget_constraint",
    "build_rank",
    "capacity_constraint",
    "check_capacity_compliance",
    "check_fairness",
    "check_individual_rationality",
    "check_no_blocking_pair",
    "check_stability",
    "check_weak_stability",
    "collision_avoidance_constraint",
    "combined_constraint",
    "cutoff_adjustment",
    "deferred_acceptance",
    "flexible_deferred_acceptance",
    "reconstruct_matching",
]
