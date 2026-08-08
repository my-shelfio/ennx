"""application 層（ユースケース層）。

1 ユースケース = 1 クラス（`execute()`）でアプリケーションの操作単位を表す。
制約種別 → アルゴリズムのディスパッチはこの層に置く。domain のみに依存し、
presentation / infrastructure に依存してはならない。

- `application/usecases/`: RunMatching / ValidateInput / GetSample / GetConstraintMeta
- `application/dto/`: ユースケース入出力 DTO
"""
