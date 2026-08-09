# ennx

企業の問題を経済学を応用して可視化する Web アプリ（MVP）です。

## アプリ概要

社員側・部署側の双方が希望順位を申告し、その希望と各部署の定員（および必要に応じた追加制約）から、以下のいずれかのアルゴリズムで配属を決定します。画面上ではアルゴリズム名の代わりに「制約種別」を選択します（内部的な対応は自動で決まります）。

| 制約種別（画面表示）                   | 内部アルゴリズム                         | 対象                                                                       | 保証される主な性質                                             |
| -------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 定員のみ                               | DA（Deferred Acceptance / 受入保留方式） | 各部署の定員のみを制約とする基本ケース                                     | 安定性（ブロッキングペアなし）、社員側最適性、社員側の耐戦略性 |
| 地域（部署グループ）ごとの受け入れ上限 | FDA（Flexible Deferred Acceptance）      | 定員に加え、部署グループ単位の受け入れ上限がある場合（研修医マッチング等） | 弱安定性、地域上限の充足、社員側の耐戦略性                     |
| NG ペアなどの個別制約                  | CA（Cutoff Adjustment / カットオフ調整） | 定員に加え、NG ペア分離など一般の上限制約がある場合                        | 制約充足、提案者最適な公平マッチング、社員側の耐戦略性         |

- **安定性**: どの社員・部署のペアも「今の配属を崩して互いに移りたい」と思わない状態のこと。安定なマッチングは事後的に覆される（引き抜き・転属の交渉が起きる）リスクが低いとされます。
- **耐戦略性（社員側）**: 社員がどんな希望を申告しても、正直な希望順位を申告することが（弱い意味で）最も有利になる性質です。虚偽申告によるゲーミングの誘因を減らします。

このほか、複数案から 1 つを選ぶ場面向けの**投票・合意形成**モジュールを提供します。主催者が案と投票ルール（多数決・ボルダ・承認投票・コンドルセ方式）を設定して匿名参加 URL を配布し、参加者の投票をルール別の集計結果と性質レポートとして可視化します。投票データは完全匿名で、最長 7 日でサーバーから自動削除されます。

### 参考文献

- Gale, D. and L. S. Shapley (1962) "College Admissions and the Stability of Marriage," *American Mathematical Monthly*, 69(1), pp.9-15.
- Roth, A. E. (1986) "On the Allocation of Residents to Rural Hospitals," *Econometrica*, 54(2), pp.425-427.
- Kamada, Y. and F. Kojima (2015) "Efficient Matching under Distributional Constraints: Theory and Applications," *American Economic Review*, 105(1), pp.67-99.（FDA）
- Kamada, Y. and F. Kojima (2024) "Fair Matching under Constraints: Theory and Applications," *Review of Economic Studies*, 91(2), pp.1162-1199.（CA）

## 技術構成

- バックエンド: Python 3.13 / FastAPI + Pydantic v2 / uvicorn。feature 単位 + Clean Architecture 構成（各 feature が domain / application / presentation / infrastructure の4層を持つ）+ API バージョニング（`/api/v1`）。層依存・feature 間独立を import-linter で CI 強制
- フロントエンド: Vite + React + TypeScript + Tailwind CSS の SPA（Feature-Sliced Design 構成）。API 型は OpenAPI から openapi-typescript で自動生成
- 配信構成: 単一サービス。Docker multi-stage で SPA をビルドし、FastAPI（uvicorn）が API と SPA を同一オリジンで配信する（本番・開発を別サービスとして分離、[#20](https://github.com/my-shelfio/ennx/issues/20)）
- 状態保持: マッチング API はステートレスで、入力・結果はクライアント側（localStorage）に保持する。投票（voting）機能のみ Neon PostgreSQL（SQLAlchemy Core + psycopg）に匿名・期限付き（最長 7 日）で保存する

本番実行時依存は最小限に保ちます（低コスト運用・依存最小化の方針）。

## セットアップ（ローカル開発）

バックエンドは [uv](https://docs.astral.sh/uv/)、フロントエンドは npm を使用します。

```bash
# バックエンド依存関係のインストール（Python 3.13 の環境を自動構築）
uv sync

# フロントエンド依存関係のインストール
cd frontend && npm ci && cd ..

# API 型生成（backend の OpenAPI スキーマから frontend の型を生成。backend のスキーマを変更した場合は毎回再生成する。）
uv run python backend/scripts/export_openapi.py frontend/openapi.json
cd frontend && npm run gen:api-types && cd ..
```

API はステートレスで同一オリジン配信を前提とするため（CORS 未設定）、ローカルでは次のいずれかの方法で起動してください。

**a. 本番相当（SPA + API を同一オリジンで起動）**

```bash
cd frontend && npm run build && cd ..
ENNX_SPA_DIST=frontend/dist uv run uvicorn main:create_app --factory --app-dir backend/src
```

`http://127.0.0.1:8000/` にアクセスすると、マッチングを開始できるトップページが表示されます。ヘルスチェックは `/healthz`（`200 ok`）です。フロントエンドを変更するたびに `npm run build` が必要です。

**b. フロントエンドの UI 単体開発（ホットリロード）**

```bash
cd frontend && npm run dev
```

`http://127.0.0.1:5173/` で起動します。CORS は未設定（API・SPA は同一オリジン運用が前提）のため、この方法では API 呼び出しが失敗します。レイアウト・スタイルなど見た目のみを素早く確認したい場合に使い、API 連携を含む動作確認は a. を使ってください。

画面の流れは「設定（部署数・社員数・制約種別・定員）→ 選好順位入力（社員側・部署側）→ 結果表示（配属・性質レポート・実行過程の可視化）」です。トップページの「サンプルデータで試す」から、研修医マッチング風のサンプル（研修医 6 名・病院 3 施設）で一連の流れをすぐに試せます。トップページからは投票・合意形成（投票の作成 → 匿名参加 URL の配布 → 集計結果の確認）も利用できます（ローカルで投票機能を使う場合は環境変数 `DATABASE_URL` に PostgreSQL の接続文字列を設定してください。未設定の場合、投票 API は 503 を返します）。

## 品質チェック（lint / 型 / テスト）

設定は `pyproject.toml`（backend）・`frontend/package.json`（frontend）に集約しています。コマンドの正本は [CLAUDE.md](CLAUDE.md)「品質ゲート」です。ローカルでは以下を実行できます。

```bash
# backend
uv run ruff check --fix .   # Lint
uv run ruff format .        # フォーマット
uv run mypy .                # 型チェック
uv run lint-imports          # 層依存契約
uv run pytest -m "not slow"  # テスト（slow マーカーを除外。全件は CI で実行）
```

```bash
# frontend（変更がある場合。backend の API スキーマを変更した場合は先に型を再生成する）
cd frontend
npm run lint
npm run typecheck
npm run test
npm run steiger   # FSD 構造検査
npm run build
```

コミット時に backend の lint・型・テストを自動実行する pre-commit を用意しています。クローン後に一度だけ有効化してください。

```bash
uv run pre-commit install
```

以降、`git commit` のたびに ruff・mypy・import-linter・pytest が実行されます（CI と同一のツール・設定。ただし pytest は `slow` マーカーのテストを除外し、全件は CI で実行します）。**`--no-verify` によるスキップは禁止です。** これらのチェックと frontend の lint / 型 / テスト / E2E スモークは CI（`.github/workflows/ci.yml`）でも push / PR 時に自動実行されます。

## 本番起動（Docker）

本番は uvicorn で起動します。Docker イメージは multi-stage 構成で SPA をビルドし、FastAPI が API と SPA を同一オリジンで配信します。

```bash
docker build -t ennx .
docker run --rm -p 8080:8080 ennx
```

マッチング API はステートレスのため、起動に必須の環境変数はありません（投票機能を有効にする場合のみ `DATABASE_URL` を設定します。任意で `ENNX_GA_MEASUREMENT_ID`（GA4 計測、本番のみ）・`ENNX_CLEANUP_KEY`（投票クリーンアップ API の保護）を設定できます）。`http://127.0.0.1:8080/` で確認できます。コンテナは環境変数 `PORT`（既定 8080）を尊重するため、Render / Cloud Run など `$PORT` を注入する環境にそのままデプロイできます。

```bash
# 例: ポートを変えて起動
docker run --rm -e PORT=9000 -p 9000:9000 ennx
```

## デプロイ手順（Render）

本番と開発を別サービスとして [Render](https://render.com/) の Free プランで運用します（[#20](https://github.com/my-shelfio/ennx/issues/20)）。リポジトリ直下の [`render.yaml`](render.yaml)（Render Blueprint 定義）に、両サービスの構成を Infrastructure as Code としてまとめています。

| 環境 | サービス名 | 追従ブランチ | デプロイトリガー                  | URL（例）                       |
| ---- | ---------- | ------------ | --------------------------------- | ------------------------------- |
| 本番 | `ennx`     | `master`     | リリース PR の `master` マージ    | `https://ennx.onrender.com`     |
| 開発 | `ennx-dev` | `develop`    | 通常の機能 PR の `develop` マージ | `https://ennx-dev.onrender.com` |

開発環境にアクセス制限は設けていません（フォーム入力のみで実データを扱わず、API もステートレスなため）。

### 初回接続手順

1. [Render ダッシュボード](https://dashboard.render.com/) にログインし、「New +」→「Blueprint」を選択する
2. このリポジトリ（GitHub 連携）を接続する。Render が `render.yaml` を検出し、内容に従って 2 つの Web Service（本番・開発）を自動作成する
3. 既存サービスを転用する場合（例: 元々 `develop` を追従していたサービスを本番に切り替える）は、対象サービスの Settings → Branch を該当ブランチへ変更する
4. Blueprint 適用後、Render が各サービスの URL を発行する

### 自動デプロイ

`render.yaml` は本番サービスに `branch: master`、開発サービスに `branch: develop` を指定し、いずれも `autoDeploy: true` としています（[.claude/rules/git-workflow.md](.claude/rules/git-workflow.md) のブランチ運用に対応）。以降は該当ブランチへの push をトリガーに、それぞれ自動でビルド・デプロイされます。手動でのビルド操作は不要です。

投票機能用の環境変数（`DATABASE_URL`・`ENNX_CLEANUP_KEY`）と GA4 計測 ID（`ENNX_GA_MEASUREMENT_ID`、本番のみ）は `render.yaml` に含めず、Render ダッシュボードで各サービスに設定します。期限切れの投票データは GitHub Actions の日次 cron（`.github/workflows/voting-cleanup.yml`）が `/api/v1/voting/cleanup` を呼び出して削除します。

### デプロイ後の確認

各環境の URL に対して以下を確認します。

- `/healthz` が `200 ok` を返すこと
- 「ホーム →（サンプルデータで試す、または）設定ウィザード → 選好順位入力 → 結果表示（「実行過程を見る」でのステップ再生を含む）」の一連の画面遷移が実際のブラウザで完了すること
- レスポンスヘッダに `Content-Security-Policy` / `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy` / `Strict-Transport-Security` が付与されていること（`backend/src/shared/presentation/security.py`、#35 のセキュリティ最低限対応。API はステートレスのため Cookie は発行しない）

Free プランはアクセスが一定時間ないとスリープし、次回アクセス時にコールドスタートが発生します（低コスト運用上のトレードオフとして許容しています）。

## ディレクトリ構成

FastAPI（backend）+ React SPA（frontend）構成です。

```
backend/
  src/
    api/
      v1/               # API バージョン集約層。feature のルータを /api/v1 prefix で集約
    features/           # 機能単位（matching / voting）。各 feature が以下の4層を持つ
      matching/
        domain/         # 最内層。マッチングアルゴリズム（DA/FDA/CA）等の純粋関数のみ
        application/    # ユースケースと DTO
        presentation/   # FastAPI ルータ（バージョン非依存）・Pydantic スキーマ・エラーハンドラ
        infrastructure/ # （マッチングは外部依存なし）
      voting/           # 投票・合意形成（infrastructure = Neon PostgreSQL 実装）
    shared/             # feature 横断（性質レポート・エラー基底・SPA 配信・セキュリティヘッダ）
    main.py             # アプリケーションファクトリ（合成ルート）
  tests/                # バックエンドのテスト（feature ミラー構成。
                        #   features/matching/domain/test_properties.py = プロパティテスト）
  scripts/              # OpenAPI スキーマ出力等
frontend/
  src/                  # React SPA（FSD: app / pages / widgets / features / entities / shared）
  e2e/                  # E2E スモークテスト（Playwright、#43）
docs/
  system-spec.md        # システム仕様書
  event-schema.md       # イベントログ（ステップログ）の共通スキーマ
render.yaml             # Render Blueprint 定義（本番・開発 2 サービスの構成）
Dockerfile              # 本番用イメージ（multi-stage: SPA ビルド → uvicorn 起動）
```

マッチングアルゴリズムは他層から独立した純粋関数として `backend/src/features/matching/domain/` に実装します。開発フロー・ブランチ運用は [CLAUDE.md](CLAUDE.md) と `.claude/rules/` を参照してください。
