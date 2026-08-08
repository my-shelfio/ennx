"""制約種別 → 内部アルゴリズムのディスパッチ定義と表示メタ情報。

利用者にはアルゴリズム名（da / fda / ca）を意識させず「制約種別」を選ばせる。
現 Flask 実装の src/app/matching/algorithms_meta.py を application 層へ再配置したもの。
表示メタ情報は GetConstraintMeta ユースケース経由で `GET /api/v1/meta/constraint-types`
から配信する。
"""

from __future__ import annotations

from dataclasses import dataclass

from features.matching.application.dto.results import AlgorithmMetaDTO, ConstraintTypeMetaDTO

ALGORITHMS: dict[str, AlgorithmMetaDTO] = {
    "da": AlgorithmMetaDTO(
        key="da",
        label="DA（受入保留方式）",
        summary="各部署の定員のみを制約とする基本アルゴリズム。",
        properties=[
            "安定性（ブロッキングペアが存在しない）",
            "提案者（社員）最適性",
            "社員側の耐戦略性（正直な申告が最適）",
        ],
    ),
    "fda": AlgorithmMetaDTO(
        key="fda",
        label="FDA（柔軟な受入保留方式）",
        summary="定員に加えて、地域（部署グループ）ごとの受け入れ上限を課す。",
        properties=[
            "弱安定性",
            "地域上限の充足（各地域の配属数が上限以下）",
            "定員（目標）をなるべく尊重した配属",
        ],
    ),
    "ca": AlgorithmMetaDTO(
        key="ca",
        label="CA（カットオフ調整方式）",
        summary="定員に加えて、NG ペアの分離など一般の上限制約（遺伝性を満たす制約）に対応。",
        properties=[
            "制約の充足（各部署の配属が実行可能）",
            "提案者最適な公平マッチング",
            "最終カットオフによる説明可能性",
        ],
    ),
}


@dataclass(frozen=True, kw_only=True)
class _ConstraintTypeDef:
    """制約種別の内部定義（表示メタ + ディスパッチ先アルゴリズム）。"""

    key: str
    label: str
    summary: str
    algorithm: str


# 設定画面で選ぶ「制約種別」。選択された種別から内部アルゴリズムを一意に決定する。
CONSTRAINT_TYPES: dict[str, _ConstraintTypeDef] = {
    "capacity_only": _ConstraintTypeDef(
        key="capacity_only",
        label="定員のみ",
        summary="各部署の定員だけを制約とする、最もシンプルな設定です。",
        algorithm="da",
    ),
    "regional_cap": _ConstraintTypeDef(
        key="regional_cap",
        label="地域（部署グループ）ごとの受け入れ上限",
        summary="定員に加えて、地域（部署グループ）単位の受け入れ上限を設定できます。",
        algorithm="fda",
    ),
    "general": _ConstraintTypeDef(
        key="general",
        label="NG ペアなどの個別制約",
        summary="定員に加えて、同じ部署に配属したくない社員の組（NG ペア）などを設定できます。",
        algorithm="ca",
    ),
}

CONSTRAINT_TYPE_KEYS = tuple(CONSTRAINT_TYPES.keys())


def is_valid_constraint_type(key: str) -> bool:
    """制約種別キーが有効か。"""
    return key in CONSTRAINT_TYPES


def algorithm_for_constraint_type(constraint_type: str) -> str:
    """制約種別キーから内部アルゴリズムキー（da / fda / ca）を返す。"""
    return CONSTRAINT_TYPES[constraint_type].algorithm


def constraint_type_metas() -> list[ConstraintTypeMetaDTO]:
    """全制約種別のメタ情報を登録順に返す（GetConstraintMeta 用）。"""
    return [
        ConstraintTypeMetaDTO(
            key=definition.key,
            label=definition.label,
            summary=definition.summary,
            algorithm=ALGORITHMS[definition.algorithm],
        )
        for definition in CONSTRAINT_TYPES.values()
    ]
