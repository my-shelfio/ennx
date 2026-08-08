"""機能単位（feature）のパッケージ群。

各 feature（matching / voting）は内部で Clean Architecture の 4 層
（domain / application / presentation / infrastructure）を持ち、依存方向は
presentation / infrastructure → application → domain の一方向とする
（import-linter で機械的に強制）。feature 間の import も禁止する。
"""
