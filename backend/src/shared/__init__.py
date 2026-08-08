"""feature 横断の共通コード（shared）。

依存は features → shared の一方向のみ許可する（shared は features に依存しない、
import-linter で機械的に強制）。

- `shared/domain/`: feature 横断のドメイン概念（性質レポートの共通データモデルなど）
- `shared/application/`: feature 横断のユースケースエラー基底
- `shared/presentation/`: feature 横断の FastAPI 部品（ヘルスチェック・エラーハンドラの
  共通部品・セキュリティヘッダ・SPA 配信）
"""
