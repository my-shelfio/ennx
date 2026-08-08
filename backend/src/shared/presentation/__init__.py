"""feature 横断の FastAPI 部品。

- `shared/presentation/health.py`: ヘルスチェック（/healthz、非バージョン）
- `shared/presentation/schemas.py`: FieldErrorSchema・ReportItemSchema（境界変換の共通部品）
- `shared/presentation/errors.py`: RFC 9457 の共通部品
  （ProblemDetail・RequestValidationError ハンドラ）
- `shared/presentation/security.py`: セキュリティヘッダ
- `shared/presentation/spa.py`: SPA 配信
"""
