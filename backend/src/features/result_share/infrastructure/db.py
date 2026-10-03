"""共有データテーブルのスキーマ定義とエンジン生成。

- 接続先は環境変数 `DATABASE_URL`（Neon の接続文字列）。未設定なら結果共有は
  無効（API は 503 を返す）。`postgres://`・`postgresql://` は psycopg ドライバ
  指定へ正規化する。
- スキーマ管理はマイグレーションツールを使わず `init_result_share_schema`
  （CREATE TABLE IF NOT EXISTS 相当）で行う。既存テーブルへの列追加・主キー変更は
  `create_all` では反映されないため、列追加・主キー構成を変えるスキーマ変更時は、
  変更を含むコードのデプロイ前に本番・開発の Neon DB に対して手動で `ALTER TABLE`
  するか、テーブルを作り直す（保存期間は最長 30 日）。追加する列は NULL 許容
  （または既定値つき）とし、列追加前に作成された行も読めるようにする。
- 型はポータブルなもののみ使う（JSON / String）。テストでは同じスキーマを
  SQLite in-memory に作成できる。
"""

from __future__ import annotations

import os

import sqlalchemy as sa
from sqlalchemy.engine import Engine

_DATABASE_URL_ENV = "DATABASE_URL"

metadata = sa.MetaData()

result_shares = sa.Table(
    "result_shares",
    metadata,
    sa.Column("share_id", sa.String(36), primary_key=True),
    sa.Column("view_token", sa.String(64), nullable=False, unique=True, index=True),
    sa.Column("delete_token", sa.String(64), nullable=False, unique=True, index=True),
    # マッチングの入力（API のリクエストボディと同じ形式の JSON）。結果は保存しない。
    sa.Column("snapshot", sa.JSON(), nullable=False),
    # 日時は UTC の ISO-8601 文字列（固定書式）で保存する。固定書式同士の
    # 文字列比較は時系列順と一致するため、期限判定を SQL の比較で行える
    # （PostgreSQL / SQLite の方言差を避ける）。
    sa.Column("created_at", sa.String(40), nullable=False),
    sa.Column("expires_at", sa.String(40), nullable=False, index=True),
)


def _normalize_url(url: str) -> str:
    """接続 URL を SQLAlchemy + psycopg 用スキームへ正規化する。"""
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


def create_result_share_engine_from_env() -> Engine | None:
    """`DATABASE_URL` からエンジンを生成する（未設定なら None）。"""
    url = os.environ.get(_DATABASE_URL_ENV)
    if not url:
        return None
    # Neon（サーバーレス）は休止から復帰するため、接続前の疎通確認を有効化する。
    return sa.create_engine(_normalize_url(url), pool_pre_ping=True)


def init_result_share_schema(engine: Engine) -> None:
    """共有データテーブルを作成する（存在すれば何もしない）。"""
    metadata.create_all(engine)
