"""投票テーブルのスキーマ定義とエンジン生成。

- 接続先は環境変数 `DATABASE_URL`（Neon の接続文字列）。未設定なら投票機能は
  無効（API は 503 を返す）。`postgres://`・`postgresql://` は psycopg ドライバ
  指定へ正規化する。
- スキーマ管理はマイグレーションツールを使わず `init_voting_schema`
  （CREATE TABLE IF NOT EXISTS 相当）で行う（テーブル数が増えたら再検討する）。
  既存テーブルへの列追加・主キー変更は `create_all` では反映されないため、
  主キー構成を変えるスキーマ変更時は本番 Neon DB に対して手動で `ALTER TABLE`
  するか、保存期間が最長7日と短いことを踏まえてテーブルを作り直す。
- 型はポータブルなもののみ使う（JSON / String / DateTime）。テストでは同じ
  スキーマを SQLite in-memory に作成できる。
"""

from __future__ import annotations

import os

import sqlalchemy as sa
from sqlalchemy.engine import Engine

_DATABASE_URL_ENV = "DATABASE_URL"

metadata = sa.MetaData()

voting_sessions = sa.Table(
    "voting_sessions",
    metadata,
    sa.Column("session_id", sa.String(36), primary_key=True),
    sa.Column("participant_token", sa.String(64), nullable=False, unique=True, index=True),
    sa.Column("admin_token", sa.String(64), nullable=False, unique=True, index=True),
    sa.Column("title", sa.String(200), nullable=False),
    sa.Column("options", sa.JSON(), nullable=False),
    sa.Column("method", sa.String(20), nullable=False),
    # 日時は UTC の ISO-8601 文字列（固定書式）で保存する。固定書式同士の
    # 文字列比較は時系列順と一致するため、期限判定を SQL の比較で行える
    # （PostgreSQL / SQLite の方言差を避ける。データ量は小さい）。
    sa.Column("deadline", sa.String(40), nullable=False),
    sa.Column("expires_at", sa.String(40), nullable=False, index=True),
    sa.Column("created_at", sa.String(40), nullable=False),
    sa.Column("closed_at", sa.String(40), nullable=True),
)

voting_ballots = sa.Table(
    "voting_ballots",
    metadata,
    sa.Column(
        "session_id",
        sa.String(36),
        sa.ForeignKey("voting_sessions.session_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    # 重複投票の判定キーは端末生成の匿名キー（voter_key）ではなく、参加者が
    # 入力する必須のニックネーム（voter_name）とする。同一セッション内で同一
    # ニックネーム（前後空白のみ除去した完全一致）の投票は上書きする（別端末・
    # 別ブラウザからでも上書き対象になる）。
    sa.Column("voter_name", sa.String(50), primary_key=True),
    sa.Column("content", sa.JSON(), nullable=False),
    sa.Column("created_at", sa.String(40), nullable=False),
)


def _normalize_url(url: str) -> str:
    """接続 URL を SQLAlchemy + psycopg 用スキームへ正規化する。"""
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


def create_voting_engine_from_env() -> Engine | None:
    """`DATABASE_URL` からエンジンを生成する（未設定なら None）。"""
    url = os.environ.get(_DATABASE_URL_ENV)
    if not url:
        return None
    # Neon（サーバーレス）は休止から復帰するため、接続前の疎通確認を有効化する。
    return sa.create_engine(_normalize_url(url), pool_pre_ping=True)


def init_voting_schema(engine: Engine) -> None:
    """投票テーブルを作成する（存在すれば何もしない）。"""
    metadata.create_all(engine)
