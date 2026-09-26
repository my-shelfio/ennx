"""GetSample / ListSamples ユースケース。

デモ用サンプル入力を返す（`GET /api/v1/sample`・`GET /api/v1/samples` に対応）。
手入力なしで結果画面まで到達でき、かつ各サンプルでアルゴリズムの保証する性質
（安定性・地域上限の遵守・NG ペアの分離・定員不足時の未配属）を体感できるよう、
キー付きの複数サンプルを持つ。
"""

from __future__ import annotations

from dataclasses import dataclass

from features.matching.application.dto.requests import ConstraintEntry, MatchingRequest
from features.matching.application.errors import SampleNotFoundError


@dataclass(frozen=True, kw_only=True)
class SampleDefinition:
    """サンプル 1 件（一覧表示用のメタ情報 + 実行可能な入力）。

    Attributes:
        key: サンプルの識別キー（URL のクエリに使う）。
        label: 表示名。
        summary: このサンプルで確認できる現象の概要。
        request: そのまま run に送信可能な入力。
    """

    key: str
    label: str
    summary: str
    request: MatchingRequest


# 既定サンプル（キー省略時・旧 URL "?sample=1" で読み込まれる）。
DEFAULT_SAMPLE_KEY = "residency"

_EMPLOYEE_NAMES_5 = ["青木", "石田", "上田", "江藤", "大野"]

SAMPLES: tuple[SampleDefinition, ...] = (
    SampleDefinition(
        key=DEFAULT_SAMPLE_KEY,
        label="研修医マッチング（安定性）",
        summary=(
            "研修医 6 名 × 病院 3 施設、定員のみ。全員が配属され、"
            "「両者とも得をする入れ替え」が存在しない安定な配属になることを確認できます。"
        ),
        request=MatchingRequest(
            constraint_type="capacity_only",
            capacities=[2, 2, 2],
            department_names=["内科", "外科", "小児科"],
            # 社員（研修医）→ 病院の希望順位。
            proposer_prefs=[
                [1, 2, 3],
                [1, 3, 2],
                [2, 1, 3],
                [2, 3, 1],
                [3, 1, 2],
                [3, 2, 1],
            ],
            # 病院 → 研修医の優先順位（全員を順位付け）。
            receiver_prefs=[
                [1, 2, 3, 4, 5, 6],
                [3, 4, 1, 2, 5, 6],
                [5, 6, 1, 2, 3, 4],
            ],
        ),
    ),
    SampleDefinition(
        key="regional-cap",
        label="地域上限（FDA）",
        summary=(
            "首都圏（東京本社・横浜支社）の受け入れ上限 2 人が効き、"
            "首都圏を希望した社員の一部が大阪支社へ繰り下がる様子を確認できます。"
        ),
        request=MatchingRequest(
            constraint_type="regional_cap",
            capacities=[1, 1, 3],
            max_caps=[2, 2, 3],
            # 東京本社・横浜支社 = 地域 1（首都圏）、大阪支社 = 地域 2。
            regions=[0, 0, 1],
            regional_caps=[2, 3],
            department_names=["東京本社", "横浜支社", "大阪支社"],
            employee_names=list(_EMPLOYEE_NAMES_5),
            proposer_prefs=[
                [1, 2, 3],
                [1, 2, 3],
                [2, 1, 3],
                [1, 3, 2],
                [2, 3, 1],
            ],
            receiver_prefs=[
                [1, 2, 3, 4, 5],
                [2, 3, 1, 5, 4],
                [5, 4, 3, 2, 1],
            ],
        ),
    ),
    SampleDefinition(
        key="ng-pair",
        label="NG ペア（CA）",
        summary=(
            "同じ部署に配属できない社員の組（青木・石田）が同じ企画部を第 1 希望にしており、"
            "企画部のカットオフが引き上げられて 2 人が分離される様子を確認できます。"
        ),
        request=MatchingRequest(
            constraint_type="general",
            capacities=[2, 2, 2],
            department_names=["企画部", "営業部", "開発部"],
            employee_names=list(_EMPLOYEE_NAMES_5),
            constraints=[ConstraintEntry(type="ng_pair", params={"pairs": [[0, 1]]})],
            proposer_prefs=[
                [1, 2, 3],
                [1, 3, 2],
                [2, 1, 3],
                [3, 1, 2],
                [2, 3, 1],
            ],
            receiver_prefs=[
                [1, 3, 4, 5, 2],
                [3, 5, 1, 2, 4],
                [4, 2, 1, 3, 5],
            ],
        ),
    ),
    SampleDefinition(
        key="unmatched",
        label="定員不足（未配属）",
        summary=(
            "社員 6 名に対し定員合計 4 名。安定性を保ったまま、"
            "どの社員が・どの部署でどういう理由で受け入れられず未配属になるかを確認できます。"
        ),
        request=MatchingRequest(
            constraint_type="capacity_only",
            capacities=[1, 2, 1],
            department_names=["企画部", "営業部", "開発部"],
            employee_names=[*_EMPLOYEE_NAMES_5, "加藤"],
            proposer_prefs=[
                [1, 3, 2],
                [1, 2, 3],
                [3, 1, 2],
                [3, 2, 1],
                [1, 3, 2],
                [2, 1, 3],
            ],
            receiver_prefs=[
                [2, 1, 5, 3, 4, 6],
                [6, 2, 4, 1, 3, 5],
                [3, 4, 1, 5, 2, 6],
            ],
        ),
    ),
)

_SAMPLES_BY_KEY: dict[str, SampleDefinition] = {sample.key: sample for sample in SAMPLES}


class ListSamples:
    """サンプルの一覧（表示用メタ情報を含む）を返すユースケース。"""

    def execute(self) -> list[SampleDefinition]:
        """登録順のサンプル一覧を返す（先頭が既定サンプル）。"""
        return list(SAMPLES)


class GetSample:
    """キー指定でサンプル入力を返すユースケース。"""

    def execute(self, key: str | None = None) -> MatchingRequest:
        """サンプル入力を返す。

        Args:
            key: サンプルのキー。省略時は既定サンプル（研修医マッチング風）。

        Raises:
            SampleNotFoundError: 未知のキーが指定された場合。
        """
        sample = _SAMPLES_BY_KEY.get(key if key is not None else DEFAULT_SAMPLE_KEY)
        if sample is None:
            raise SampleNotFoundError(key or "")
        return sample.request
