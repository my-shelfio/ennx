---
name: ennx-release-draft
description: ennx の develop→master へのリリース PR を作成する。引数にリリースバージョン（例: 0.2.0）を必ず指定すること。pyproject.toml のバージョンを指定バージョンに更新してコミット・プッシュし、PR とリリースノートドラフトを生成する。使用例: /ennx-release-draft 0.2.0
---

# ennx リリースドラフト

あなたはリリースエンジニアとして以下の手順を順番に実行します。途中でエラーが発生した場合は処理を停止してユーザーに報告してください。

## 停止・確認条件（必ず守る）

- 現在のブランチが `develop` でない、または未コミットの変更がある場合は停止する。
- バージョン更新（pyproject.toml）はユーザーの承認を得てから行う。
- リリースノートはユーザーに提示して確認を得てから GitHub Release（`--draft`）を作成する。
- エラーが発生したら停止してユーザーに報告する。勝手にリカバリーしない。
- **develop への バックマージは行わない**: `develop→master` の一方向フローで `master` への
  直接コミットは発生しないため、リリース後に develop と master が乖離することはない。

> **前提**: このスキルはリポジトリルート（`.claude/` や `CLAUDE.md` がある階層）を作業ディレクトリとして実行することを前提とします。本ドキュメント中のパスはすべてリポジトリルートからの相対パスです。

## 引数

`$ARGUMENTS` にリリースバージョン文字列（例: `0.2.0`）が渡されます。
引数が空の場合は「バージョンを引数に指定してください（例: /ennx-release-draft 0.2.0）」と伝えて処理を停止する。

## 定数

- **新バージョン**: `$ARGUMENTS`
- **アプリリポジトリ**: リポジトリルート（このスキルを実行している作業ディレクトリ）
- **バージョンファイル**: `pyproject.toml`（`[project]` の `version` フィールド）
- **GitHub リポジトリ**: `my-shelfio/ennx`
- **ベースブランチ**: `master`（本番。Render サービス `ennx` が追従）
- **ヘッドブランチ**: `develop`（開発。Render サービス `ennx-dev` が追従）

---

## 手順

### 1. 事前確認

リポジトリルートで以下を実行する。

```bash
git branch --show-current
git status --porcelain
```

- 現在のブランチが `develop` でなければ停止し「`develop` ブランチに切り替えてから実行してください」と伝える
- uncommitted な変更がある場合は停止し、変更内容をリストアップしてユーザーに確認を求める

---

### 2. バージョンの確認

`pyproject.toml` の `version` フィールド（`[project]` テーブル）を読み取り、現在のバージョンを確認する。

ユーザーに次のように確認する:
```
現在のバージョン: <pyproject.toml の version>
新バージョン: $ARGUMENTS

バージョンをこの内容で更新してよいですか？
```

ユーザーの承認を得てから次のステップへ進む。

---

### 3. コミット一覧の取得と分類

```bash
git fetch origin
git log origin/master..origin/develop --oneline
git log origin/master..origin/develop --merges --oneline
```

ennx は Feature Branch Workflow（git-workflow.md）で運用しており、1 コミット単位ではなく
**マージ済み PR 単位**でリリースノートの項目を数える。`git log --merges` で得たマージコミット
（`Merge pull request #NN from my-shelfio/<prefix>/<番号>`）と、squash マージされた単一コミット
（メッセージ末尾に `(#NN)` が付く）の両方から、対象 PR 番号とヘッドブランチの prefix を集める。

分類の正本は `.github/release.yml`（GitHub の自動生成リリースノート設定）である。
同ファイルの `categories` はイシュー／PR のラベルでカテゴリを決めるため、手書きのリリースノートも
**ラベルを基準に**同じカテゴリへ振り分ける。ラベルが取得できない場合のみ、ブランチ prefix
（git-workflow.md のブランチ表）から下表のラベル欄を逆引きして代替する。

| カテゴリ           | ラベル                                       | 対応する prefix        |
| ------------------ | -------------------------------------------- | ---------------------- |
| 👍 機能改修        | `feature` / `ui-ux`                          | `feat/`                |
| 🐛 不具合修正      | `bug`                                        | `fix/` / `hotfix/`     |
| 🔄 改善            | `setup` / `ci` / `infra` / `test` / `nice-to-have` | `chore/`         |
| 📖 ドキュメント    | `docs`                                       | `docs/`                |
| その他の変更       | 上記以外のラベル                             | 上記以外               |

`.github/release.yml` の `exclude.labels`（`duplicate` / `invalid` / `wontfix`）が付いた PR は
リリースノートから除外する。

各項目は「PR タイトル（コミットメッセージ末尾の `（#イシュー番号）` 表記は重複するため除去してよい） + PR 番号」の形で保持する。

ラベルは以下で取得できる。

```bash
gh pr view <PR番号> --repo my-shelfio/ennx --json number,title,labels
```

---

### 4. pyproject.toml の更新

#### 4-1. バージョンの書き換え

Edit ツールを使用して `pyproject.toml` の `version` フィールドを `$ARGUMENTS` に書き換える。

#### 4-2. コミット＆プッシュ

リポジトリルートで以下を実行する。

```bash
git add pyproject.toml
git commit -m "chore: バージョンを v$ARGUMENTS に更新"
git push origin develop
```

- pre-commit（ruff / mypy / pytest）が自動実行される。**`--no-verify` は絶対に使わない**（git-workflow.md）。
- pre-commit が失敗した場合は原因を修正してから再コミットする。バージョン変更自体とは無関係な既存の
  lint/型/テスト指摘が出た場合もスキップせず、ユーザーに報告して対応方針を確認する。

---

### 5. PR の作成

[pull_request_template.md](../../../.github/pull_request_template.md) に従い、以下の内容で PR を作成する:

- **タイトル**: `release: v$ARGUMENTS`
- **ベースブランチ**: `master`
- **ヘッドブランチ**: `develop`
- **本文**: 下記テンプレートをコミット内容で埋める

```bash
gh pr create \
  --repo my-shelfio/ennx \
  --base master \
  --head develop \
  --title "release: v$ARGUMENTS" \
  --body "$(cat <<'EOF'
## 変更内容

<ステップ3で分類した PR 一覧を箇条書きで記載（機能改修/不具合修正/改善/ドキュメント/その他の変更を含む）>

## 変更理由

- v$ARGUMENTS のリリース

## 動作確認方法

- develop ブランチ（開発環境 ennx-dev）での動作確認済み

## レビュー観点

- リリース内容に漏れ・誤りがないこと
- バージョンが正しく更新されていること（pyproject.toml: $ARGUMENTS）

## 懸念点

- 

## その他

- マージ後、master への push により本番環境（ennx）へ自動デプロイされる（render.yaml, #20）
EOF
)"
```

---

### 6. リリースノートの確認と GitHub Release ドラフトの作成

ステップ3の分類結果を使って、以下のフォーマットに従いリリースノートを整形する:

```markdown
# 変更一覧

- **リリース日**： YYYY年MM月DD日
- [本番環境](https://ennx.onrender.com)

## 👍 機能改修

### <機能改修リストの各項目> #<PR番号>

## 🐛 不具合修正

### <不具合修正リストの各項目> #<PR番号>

## 🔄 改善

### <改善リストの各項目> #<PR番号>

## 📖 ドキュメント

### <ドキュメントリストの各項目> #<PR番号>

## その他の変更

### <その他リストの各項目> #<PR番号>

## ⚠️注意

- 

## ✍備考

- FastAPI + React SPA（uvicorn 単一サービス、Render Free プラン）
```

- セクションの見出し・並び順は `.github/release.yml` の `categories` と一致させる（`## ⚠️注意` と
  `## ✍備考` はリリース運用上の追記枠であり、`.github/release.yml` には対応するカテゴリを持たない）
- 該当する PR がないセクションは省略する
- `## ✍備考` には運用上の注記があれば追記し、`- FastAPI + React SPA（uvicorn 単一サービス、Render Free プラン）` は末尾に残す
- 実装なしでクローズされたイシュー（他イシューに置き換えられた等）があれば `## ⚠️注意` に記載する

整形したリリースノートをユーザーに提示し、修正の有無を確認する（修正がなければそのまま次へ）。

確認後、以下のコマンドで GitHub Release をドラフト状態で作成する:

```bash
gh release create "v$ARGUMENTS" \
  --repo my-shelfio/ennx \
  --title "v$ARGUMENTS" \
  --target master \
  --notes "<確認済みのリリースノート内容>" \
  --draft
```

- タグは `v$ARGUMENTS`（例: `v0.2.0`）。タグは Release 作成時に `master` を指して作られるものだけを
  運用し、`git tag` による手動作成・付け替えは行わない
- `--draft` フラグで下書き状態にする（公開はしない）
- 作成後、Release の URL を取得して記録する

---

### 7. 完了前チェックリスト

完了報告の前に以下を確認する。1 つでも満たさない場合は該当ステップに戻る。

- [ ] `pyproject.toml` の `version` を更新した
- [ ] PR がタイトル `release: v$ARGUMENTS`・base `master`・head `develop` で作成されている
- [ ] リリースノートをユーザーに提示して確認を得た
- [ ] GitHub Release がタグ `v$ARGUMENTS`・`--draft`（下書き）で作成されている

### 8. 完了報告

以下の情報をまとめてユーザーに報告する:

```
✅ リリース PR と GitHub Release ドラフトを作成しました

バージョン: <旧バージョン> → $ARGUMENTS
PR URL: <作成された PR の URL>
Release URL: <作成された GitHub Release の URL>

--- リリースノートドラフト ---
<ステップ6で確認済みのリリースノート内容>
```
