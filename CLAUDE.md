# CLAUDEオンボーディング用資料

ennx: 企業の問題を経済学を応用して可視化する Web アプリ（MVP）

## 技術スタック

- バックエンド: Python 3.13 / FastAPI + Pydantic v2 / uvicorn。
  feature 単位 + Clean Architecture 構成（各 feature が domain / application / presentation /
  infrastructure の4層を持つ）+ API バージョニング（`/api/v1`）。層依存・
  feature 間独立・バージョン集約層の契約を import-linter で CI 強制
- フロントエンド: Vite + React + TypeScript + Tailwind CSS の SPA（FSD 構成）。
  API 型は OpenAPI から openapi-typescript で自動生成
- 単一サービス構成で uvicorn が API・SPA を配信する
- 投票（voting）機能のみ保存基盤に Neon PostgreSQL（SQLAlchemy Core + psycopg）を使う。
  環境変数 `DATABASE_URL` 未設定時は投票 API が 503 を返す（マッチング API はステートレスを維持）
- パッケージ管理: uv（Python。`uv sync` で開発環境構築、依存追加は `uv add`）/
  npm（frontend。`npm ci` で再現インストール）
- lint/format: ruff・eslint（+ eslint-plugin-boundaries）・steiger、型: mypy **strict**・tsc、
  テスト: pytest（Hypothesis によるプロパティテスト含む）・vitest
- 本番実行時依存は最小限に保つ（上限の目安 10 パッケージ）

## ディレクトリ構成

| パス                                    | 内容                                                                                                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/`                          | FastAPI アプリ。`api/`（バージョン集約）+ `features/`（機能単位）+ `shared/`（機能横断）構成                                                                                                  |
| `backend/src/api/v1/`                   | API バージョン集約層。feature ごとの presentation ルータを `/api/v1` prefix で集約する。v2 追加時は `api/v2/` を新設し、変更のない feature は v1 ルータを再利用する                           |
| `backend/src/features/<feature>/`       | 機能単位（matching・voting）。内部に `domain / application / presentation / infrastructure` の4層を持つ。presentation 層のルータはバージョン非依存（prefix は `/matching`・`/voting` 等のみ） |
| `backend/src/features/matching/domain/` | マッチングアルゴリズム層。**他層・フレームワークから独立した純粋関数のみ**                                                                                                                    |
| `backend/src/shared/`                   | feature 横断コード（性質レポートの共通データモデル・エラー基底・エラーハンドラ共通部品・SPA配信・セキュリティヘッダ等）。依存は features → shared の一方向のみ                                |
| `backend/tests/`                        | バックエンドの pytest テスト（feature ミラー構成。`features/matching/domain/test_properties.py` = プロパティテスト）                                                                          |
| `frontend/src/`                         | React SPA。FSD 6層（app / pages / widgets / features / entities / shared）                                                                                                                    |
| `docs/system-spec.md`                   | システム仕様書（技術スタック・画面・API・非機能・インフラの要点）                                                                                                                             |
| `docs/event-schema.md`                  | イベントログ（ステップログ）の共通スキーマ仕様（API 契約）                                                                                                                                    |
| `.claude/rules/`                        | 開発ルール（必読）。`.claude/skills/`・`.claude/agents/` = 作業手順とレビュー担当                                                                                                             |

## 品質ゲート（コマンドの正本）

コミット前に以下を**この順で**実行し、全通過させること（CI = .github/workflows/ci.yml の
quality ジョブと同一条件）。

```bash
uv run ruff check --fix .
uv run ruff format .
uv run mypy .
uv run lint-imports
uv run pytest -m "not slow"
```

`frontend/` に変更がある場合は、さらに以下を実行する（CI の frontend ジョブと同一条件）。
backend の API スキーマに影響する変更をした場合は、先に
`uv run python backend/scripts/export_openapi.py frontend/openapi.json` と
`npm run gen:api-types`（frontend/ 内）で型を再生成してから実行する。

```bash
cd frontend
npm run lint
npm run typecheck
npm run test
npm run steiger
npm run build
```

- CI では `uv run pytest`（slow 含む全件）が実行される。プロパティテストに影響しうる変更では
  ローカルでも `uv run pytest` を実行しておくこと
- rules / skills からはこのセクションを「品質ゲート」として参照する（コマンドはここにのみ記載）

## アルゴリズム層の設計原則

アルゴリズム層は `backend/src/features/matching/domain/`。

1. **純粋関数**: print / verbose / グローバル状態を持たない。入力 → 結果（+ イベントログ）のみ
2. **インデックス規約**: 外部入力（選好リスト）は 1-indexed、内部処理と出力は 0-indexed
   （変換は `models.build_rank`）。`proposer_match[i] = -1` は未マッチ
3. **共通データモデル**: 入力は `models.py` の `BaseMatchingInput` 派生（frozen dataclass,
   kw_only）、結果は `MatchingResult` 派生。入力検証は `__post_init__` で ValueError
4. **理論的前提は入力検証で保証**: アルゴリズムが暗黙に仮定する条件（例: FDA の
   「地域内目標定員合計 ≤ 地域上限」、CA の遺伝性制約）は入力バリデーションに落とす
5. **イベントログ**: 実行過程は docs/event-schema.md の共通スキーマで `Result.events` に記録し、
   `reconstruct_matching` で最終結果を再構成できること（テストで保証）
6. **domain 層は他層・フレームワークに依存しない**: 契約は pyproject.toml の
   [tool.importlinter] に定義し、`lint-imports` で検証する（feature 間の
   独立性、各 feature 内の層依存、shared → features 禁止も同じ仕組みで強制する）

## 開発フロー

- ブランチ・イシュー・PR の運用は `.claude/rules/git-workflow.md` に従う（作業ブランチは最新 develop から、ブランチ名 `<prefix>/<イシュー番号>`）。
- 開発着手はスキル ennx-develop-work（イシュー番号からブランチ作成〜実装〜Draft PR〜Ready for review までを一貫実行）
- バックエンド（Clean Architecture）・フロントエンド（FSD）の開発ルールは `.claude/rules/architecture.md`
- アルゴリズムの移植・追加は `.claude/rules/algorithm-port.md`（スキル: ennx-algorithm-port）
- バグ対応は `.claude/rules/testing.md` とスキル ennx-bugfix
- リポジトリに存在しない外部資料への言及禁止は `.claude/rules/documentation.md`
- 実装・品質ゲート通過後はコミット・プッシュして Draft PR を作成し、その後にスキル ennx-review（ennx-reviewer エージェント）でセルフレビューする。指摘は PR のレビューコメントとして残し、対応後に Ready for review へ変更する（詳細は git-workflow.md「PR・レビュールール」）
- リリース（develop→master の PR・GitHub Release ドラフト作成）はスキル ennx-release-draft

## コーディング規約

- ソースコード（`backend/**/*.py`・`frontend/src/**/*.ts`・`*.tsx` の docstring・コメント）には、
  ドキュメントファイル名（`*.md`。例: `docs/event-schema.md`、`.claude/rules/*.md`）・GitHub イシュー
  番号（`#NN`）を一切記述しない。ドキュメント構成の変更・イシューのクローズのたびに参照が
  陳腐化するため、実装側は自己完結した説明のみを記載する。
- ソースコード・GitHub イシュー（`.github/ISSUE_TEMPLATE/` を含む）・PR 本文からドキュメント
  ファイルへの参照は行わない。ドキュメント・イシューとの対応関係の追跡はコミット
  メッセージで行う。
- リポジトリに存在しない外部資料（ADR・ユースケース記述・プロダクト仕様書等）への言及は、
  ソースコードに限らずリポジトリ内のどのファイルにも一切記述しない
  （`.claude/rules/documentation.md`）。
