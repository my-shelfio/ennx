"""投票・合意形成のドメイン層（純粋関数のみ、他層・フレームワーク非依存）。"""

from .models import ApprovalTallyInput, ChoiceTallyInput, RankingTallyInput, RuleResult
from .properties import build_voting_report
from .rules import (
    condorcet_winner,
    pairwise_matrix,
    tally_approval,
    tally_borda,
    tally_condorcet,
    tally_plurality,
)

__all__ = [
    "ApprovalTallyInput",
    "ChoiceTallyInput",
    "RankingTallyInput",
    "RuleResult",
    "build_voting_report",
    "condorcet_winner",
    "pairwise_matrix",
    "tally_approval",
    "tally_borda",
    "tally_condorcet",
    "tally_plurality",
]
