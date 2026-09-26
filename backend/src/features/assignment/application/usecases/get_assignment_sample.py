"""GetAssignmentSample ユースケース。

デモ用のサンプル入力を返す（`GET /api/v1/assignment/sample` に対応）。
初見の利用者が入力なしで結果画面まで到達できるようにする。
"""

from __future__ import annotations

from features.assignment.application.dto.requests import AssignmentRequest, ConstraintEntry


class GetAssignmentSample:
    """サンプル入力を返すユースケース。"""

    def execute(self) -> AssignmentRequest:
        """社内の案件アサインを模したサンプル入力を返す。

        受け入れ人数に余裕がある一方で希望が第 1 案件に集中しており、
        さらに「相性の悪い 2 人を同じ案件に入れない」制約が入るため、
        期待割当が分数になり、くじへの分解が意味を持つ例になっている。
        """
        return AssignmentRequest(
            constraint_type="general",
            capacities=[2, 2, 1],
            agent_prefs=[
                [1, 2, 3],
                [1, 2, 3],
                [1, 2, 3],
                [2, 1, 3],
                [2, 3, 1],
            ],
            employee_names=["佐藤", "鈴木", "高橋", "田中", "伊藤"],
            department_names=["案件A", "案件B", "案件C"],
            constraints=[ConstraintEntry(type="ng_pair", params={"pairs": [[1, 2]]})],
        )
