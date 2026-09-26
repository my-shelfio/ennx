"""制約種別 → メカニズムのディスパッチ定義と表示メタ情報。

matching 機能と同様に、利用者にはメカニズム名（ps）を意識させず「制約種別」を
選ばせる。表示メタ情報は GetAssignmentMeta ユースケース経由で
`GET /api/v1/meta/assignment-constraint-types` から配信する。
"""

from __future__ import annotations

from dataclasses import dataclass

from features.assignment.application.dto.results import (
    AssignmentConstraintTypeMetaDTO,
    MechanismMetaDTO,
)

MECHANISMS: dict[str, MechanismMetaDTO] = {
    "ps": MechanismMetaDTO(
        key="ps",
        label="PS（同時確率消費方式）",
        summary=(
            "社員だけが希望順位を出し、部署は候補者を順位づけしない配分方式。"
            "全員が同時に希望の高い部署を少しずつ取り合い、公平な確率で配分する。"
        ),
        guaranteed=[
            "順序効率性（確率を融通し合っても誰も得しない）",
            "無羨望性（誰も他人の配分を羨まない）",
            "水平性（同じ希望を出した社員は同じ確率になる）",
        ],
        not_guaranteed=[
            "耐戦略性（希望順位を偽ると得をする社員が存在しうる）",
        ],
    ),
}


@dataclass(frozen=True, kw_only=True)
class _ConstraintTypeDef:
    """制約種別の内部定義（表示メタ + ディスパッチ先メカニズム）。"""

    key: str
    label: str
    summary: str
    mechanism: str


# 設定画面で選ぶ「制約種別」。選択された種別からメカニズムを一意に決定する。
CONSTRAINT_TYPES: dict[str, _ConstraintTypeDef] = {
    "capacity_only": _ConstraintTypeDef(
        key="capacity_only",
        label="受け入れ人数のみ",
        summary="各部署の受け入れ人数だけを制約とする、最もシンプルな設定です。",
        mechanism="ps",
    ),
    "general": _ConstraintTypeDef(
        key="general",
        label="NG ペア・グループ別の人数制限",
        summary=(
            "受け入れ人数に加えて、同じ部署に配属したくない社員の組（NG ペア）や、"
            "特定グループの人数上限を設定できます。"
        ),
        mechanism="ps",
    ),
}

CONSTRAINT_TYPE_KEYS = tuple(CONSTRAINT_TYPES.keys())


def is_valid_constraint_type(key: str) -> bool:
    """制約種別キーが有効か。"""
    return key in CONSTRAINT_TYPES


def mechanism_for_constraint_type(constraint_type: str) -> str:
    """制約種別キーからメカニズムキー（ps）を返す。"""
    return CONSTRAINT_TYPES[constraint_type].mechanism


def allows_extra_constraints(constraint_type: str) -> bool:
    """その制約種別で追加の上限制約を指定できるか。"""
    return constraint_type == "general"


def constraint_type_metas() -> list[AssignmentConstraintTypeMetaDTO]:
    """全制約種別のメタ情報を登録順に返す。"""
    return [
        AssignmentConstraintTypeMetaDTO(
            key=definition.key,
            label=definition.label,
            summary=definition.summary,
            mechanism=MECHANISMS[definition.mechanism],
        )
        for definition in CONSTRAINT_TYPES.values()
    ]
