"""OpenAPI スキーマを JSON ファイルへ書き出す。

フロントエンドの型生成（openapi-typescript、frontend/package.json の
`gen:api-types`）の入力として使う。バックエンドのスキーマ変更が
フロントエンドの型エラーとして検出できるよう、生成物はコミットせず
都度このスクリプトで再生成する運用とする。

使用例:
    uv run python backend/scripts/export_openapi.py frontend/openapi.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from main import create_app


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: export_openapi.py <output-path>", file=sys.stderr)
        return 1

    output_path = Path(argv[1])
    output_path.parent.mkdir(parents=True, exist_ok=True)

    schema = create_app().openapi()
    output_path.write_text(
        json.dumps(schema, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
