"""割り当て問題（片側選好）のアルゴリズムパッケージ。

Web 層から独立した純粋関数として実装する。外部に公開する入出力データモデルと
アルゴリズム関数をここで再エクスポートする。
"""

from .checks import (
    CheckResult,
    check_envy_free,
    check_equal_treatment,
    check_ordinal_efficiency,
    check_strategy_proofness,
)
from .constraints import (
    ConstraintSet,
    ConstraintStructure,
    build_constraint_structure,
    column_set,
    crosses,
    find_bihierarchy,
    find_odd_cycle,
    is_hierarchy,
    quota_violations,
    row_set,
)
from .events import AssignmentEvent, AssignmentEventType, reconstruct_expected_assignment
from .lottery import (
    MAX_LOTTERY_TERMS,
    DecompositionError,
    decompose,
    ensure_decomposable,
    reconstruct,
    verify,
)
from .models import (
    MAX_AGENTS,
    MAX_OBJECTS,
    MAX_UPPER_CONSTRAINTS,
    AssignmentInput,
    AssignmentResult,
    Cell,
    LotteryResult,
    LotteryTerm,
    UpperConstraint,
    build_rank,
)
from .ps import probabilistic_serial

__all__ = [
    "MAX_AGENTS",
    "MAX_LOTTERY_TERMS",
    "MAX_OBJECTS",
    "MAX_UPPER_CONSTRAINTS",
    "AssignmentEvent",
    "AssignmentEventType",
    "AssignmentInput",
    "AssignmentResult",
    "Cell",
    "CheckResult",
    "ConstraintSet",
    "ConstraintStructure",
    "DecompositionError",
    "LotteryResult",
    "LotteryTerm",
    "UpperConstraint",
    "build_constraint_structure",
    "build_rank",
    "check_envy_free",
    "check_equal_treatment",
    "check_ordinal_efficiency",
    "check_strategy_proofness",
    "column_set",
    "crosses",
    "decompose",
    "ensure_decomposable",
    "find_bihierarchy",
    "find_odd_cycle",
    "is_hierarchy",
    "probabilistic_serial",
    "quota_violations",
    "reconstruct",
    "reconstruct_expected_assignment",
    "row_set",
    "verify",
]
