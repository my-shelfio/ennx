"""割り当て問題（片側選好）のアルゴリズムパッケージ。

Web 層から独立した純粋関数として実装する。外部に公開する入出力データモデルと
アルゴリズム関数をここで再エクスポートする。
"""

# check_strategy_proofness は意図的に再エクスポートしない。全ての虚偽申告を列挙して
# メカニズムを再実行するためコストが極端に大きく、テストからの利用のみを想定している
# （必要な場合は checks モジュールから直接 import する）。
from .checks import (
    CheckResult,
    check_envy_free,
    check_equal_treatment,
    check_ordinal_efficiency,
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
    LotteryPlan,
    LotteryTooLargeError,
    decompose,
    ensure_decomposable,
    plan_lottery,
    reconstruct,
    sample_pure_assignment,
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
    "LotteryTooLargeError",
    "LotteryPlan",
    "LotteryResult",
    "LotteryTerm",
    "UpperConstraint",
    "build_constraint_structure",
    "build_rank",
    "check_envy_free",
    "check_equal_treatment",
    "check_ordinal_efficiency",
    "column_set",
    "crosses",
    "decompose",
    "ensure_decomposable",
    "find_bihierarchy",
    "find_odd_cycle",
    "is_hierarchy",
    "plan_lottery",
    "probabilistic_serial",
    "quota_violations",
    "reconstruct",
    "sample_pure_assignment",
    "reconstruct_expected_assignment",
    "row_set",
    "verify",
]
