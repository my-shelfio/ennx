"""GetSample ユースケース。

デモ用サンプルデータを返す（`GET /api/v1/sample` に対応）。
現 Flask 実装の src/app/matching/sample.py を application 層へ再配置したもの。
手入力なしで結果画面まで到達できるようにする。
"""

from __future__ import annotations

from features.matching.application.dto.requests import MatchingRequest


class GetSample:
    """研修医マッチング風のサンプル入力を返すユースケース。"""

    def execute(self) -> MatchingRequest:
        """サンプル入力（定員のみ・全員配属可能）を返す。

        社員（研修医）6 名 × 部署（病院）3 施設、定員は各 2（合計 6 = 社員数）。
        選好は 1-indexed の完全順位。DA で安定なマッチングが得られる。
        """
        return MatchingRequest(
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
        )
