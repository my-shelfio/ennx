"""API バージョニング集約層。

feature ごとの presentation 層ルータ（バージョン非依存）を `/api/vN` 配下に
prefix 付きで集約する。api は各 feature の presentation 層と shared のみに
依存でき、features・shared から api への依存は禁止する
（api が最外殻。import-linter で機械的に強制）。
"""
