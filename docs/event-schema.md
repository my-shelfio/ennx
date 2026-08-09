# イベントスキーマ（ステップログ）

マッチングアルゴリズム（DA・FDA・CA）の実行過程を記録する構造化イベントの仕様。
過程可視化機能（M4: #11, #12）はこのイベントログを入力として描画する。

実装: `backend/src/features/matching/domain/events.py`（イシュー #9）

## 目的

- アルゴリズムの各ラウンドの状態変化を、後から再生可能な形で記録する
- 3アルゴリズム共通のスキーマとし、可視化側がアルゴリズムごとの分岐を持たずに済むようにする
- イベント列だけから最終マッチング結果を再構成できることを保証する（テストで検証）

## スキーマ

イベントは `MatchingEvent`（frozen dataclass）で表現する。

| フィールド   | 型            | 説明                                                                    |
| ------------ | ------------- | ----------------------------------------------------------------------- |
| `round`      | `int`         | ラウンド番号（1 始まり）。DA・FDA は提案〜受入の1巡、CA は調整の1反復。 |
| `event_type` | `EventType`   | イベント種別（下表）。                                                  |
| `proposer`   | `int \| None` | 対象の提案者（0-indexed）。`cutoff_raise` のみ `None`。                 |
| `receiver`   | `int`         | 対象の受入者（0-indexed）。                                             |
| `reason`     | `str \| None` | 補足説明（拒否理由など）。省略可。                                      |

## イベント種別（`EventType`）

| 値                 | 発生アルゴリズム | 意味                                                                  |
| ------------------ | ---------------- | --------------------------------------------------------------------- |
| `propose`          | DA / FDA / CA    | 提案者が受入者に提案した（CA では需要 D_r(p) に含まれたことを表す）。 |
| `tentative_accept` | DA / FDA / CA    | 受入者が提案者を仮受入した（最終ラウンドでは確定受入）。              |
| `reject`           | DA / FDA / CA    | 受入者が提案者を拒否した（`reason` に理由を記録）。                   |
| `waitlist`         | FDA              | 定員超過の提案者を即時拒否せず待機リストに載せた。                    |
| `promote`          | FDA              | 待機リストの提案者を輪番指名で繰り上げ受入した。                      |
| `cutoff_raise`     | CA               | 制約超過により受入者のカットオフを 1 引き上げた（`proposer=None`）。  |

## 順序の保証

- イベントは実行順に `Result.events` へ追記される
- 同一ラウンド内では「提案 → 受入判定」の順に並ぶ

## 最終結果の再構成ルール

`reconstruct_matching(events, n_proposers, n_receivers)` は次のルールでイベント列を
再生し、最終マッチングを返す。

1. `tentative_accept` / `promote`: 提案者を受入者に割り当てる
   （別の受入者に割り当て済みの場合は付け替える）
2. `reject`: 提案者がその受入者に割り当て済みであれば解除する
3. `propose` / `waitlist` / `cutoff_raise`: 割り当て状態を変化させない

任意の入力に対し、再構成結果はアルゴリズムが返す最終マッチングと一致する
（`backend/tests/features/matching/domain/test_properties.py` の
`test_*_events_reconstruct_result` でプロパティテストとして検証）。

## 例（DA）

提案者 P1・P2 が受入者 R1（定員1）に提案し、P1 が優先されるケース:

```text
round=1 propose          proposer=0 receiver=0
round=1 propose          proposer=1 receiver=0
round=1 tentative_accept proposer=0 receiver=0
round=1 reject           proposer=1 receiver=0 reason="定員超過"
```

## JSON Schema（API 契約）と互換性確認手順

本スキーマの機械可読な正本は [event-schema.json](event-schema.json)（JSON Schema, draft 2020-12）。`POST /api/v1/matching/run` のレスポンス `events[]` の各要素はこのスキーマに適合する（本スキーマは API 契約に昇格。適合は `backend/tests/test_event_contract.py` が CI で検証する）。

スキーマを変更する場合は、次の手順で互換性を確認する。

1. **本書と event-schema.json を同一 PR で更新する**（ドキュメントとスキーマの乖離を残さない）
2. **変更の互換性を分類する**。フィールド・イベント種別の「追加」は後方互換（非破壊）。
   フィールドの削除・改名・型変更・イベント種別の削除・意味変更は**破壊的変更**
3. **破壊的変更の場合はフロントエンドへの影響を確認する**。イベントログの利用箇所
   （entities/matching のイベントログパーサ #28、ステップ再生ビューア #33）を
   同一 PR またはマージ順を明記したスタック PR で追従させる
4. **契約テストを更新して CI 通過を確認する**。イベント種別を追加した場合は、
   その種別が出現する入力を test_event_contract.py のフィクスチャに追加する
   （3 入力の合計で全イベント種別が出現することをテストが強制している）。
   `reconstruct_matching` の再構成ルールに影響する変更では、本書の
   「最終結果の再構成ルール」と再構成整合テストも同時に更新する
