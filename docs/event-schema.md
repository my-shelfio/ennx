# イベントスキーマ（ステップログ）

アルゴリズムの実行過程を記録する構造化イベントの仕様。過程可視化機能はこの
イベントログを入力として描画する。

本書は 2 つのスキーマを定める。**feature ごとにスキーマを分ける**のは、過程の
進み方が根本的に異なるためである。マッチング（DA・FDA・CA）はラウンド単位の
離散的な提案・受入で進むのに対し、割り当て（PS）は連続時間で全員が同時に
「食べる」過程で進み、時刻を分数で持つ必要がある。共通化すると双方に不要な
フィールドが増え、可視化側の分岐も減らないため、独立させている。

| feature    | 対象        | 実装                                               | JSON Schema                                                  |
| ---------- | ----------- | -------------------------------------------------- | ------------------------------------------------------------ |
| matching   | DA・FDA・CA | `backend/src/features/matching/domain/events.py`   | [event-schema.json](event-schema.json)                       |
| assignment | PS          | `backend/src/features/assignment/domain/events.py` | [assignment-event-schema.json](assignment-event-schema.json) |

## matching（DA・FDA・CA）

### 目的

- アルゴリズムの各ラウンドの状態変化を、後から再生可能な形で記録する
- 3アルゴリズム共通のスキーマとし、可視化側がアルゴリズムごとの分岐を持たずに済むようにする
- イベント列だけから最終マッチング結果を再構成できることを保証する（テストで検証）

### スキーマ

イベントは `MatchingEvent`（frozen dataclass）で表現する。

| フィールド   | 型            | 説明                                                                    |
| ------------ | ------------- | ----------------------------------------------------------------------- |
| `round`      | `int`         | ラウンド番号（1 始まり）。DA・FDA は提案〜受入の1巡、CA は調整の1反復。 |
| `event_type` | `EventType`   | イベント種別（下表）。                                                  |
| `proposer`   | `int \| None` | 対象の提案者（0-indexed）。`cutoff_raise` のみ `None`。                 |
| `receiver`   | `int`         | 対象の受入者（0-indexed）。                                             |
| `reason`     | `str \| None` | 補足説明（拒否理由など）。省略可。                                      |

### イベント種別（`EventType`）

| 値                 | 発生アルゴリズム | 意味                                                                  |
| ------------------ | ---------------- | --------------------------------------------------------------------- |
| `propose`          | DA / FDA / CA    | 提案者が受入者に提案した（CA では需要 D_r(p) に含まれたことを表す）。 |
| `tentative_accept` | DA / FDA / CA    | 受入者が提案者を仮受入した（最終ラウンドでは確定受入）。              |
| `reject`           | DA / FDA / CA    | 受入者が提案者を拒否した（`reason` に理由を記録）。                   |
| `waitlist`         | FDA              | 定員超過の提案者を即時拒否せず待機リストに載せた。                    |
| `promote`          | FDA              | 待機リストの提案者を輪番指名で繰り上げ受入した。                      |
| `cutoff_raise`     | CA               | 制約超過により受入者のカットオフを 1 引き上げた（`proposer=None`）。  |

### 順序の保証

- イベントは実行順に `Result.events` へ追記される
- 同一ラウンド内では「提案 → 受入判定」の順に並ぶ

### 最終結果の再構成ルール

`reconstruct_matching(events, n_proposers, n_receivers)` は次のルールでイベント列を
再生し、最終マッチングを返す。

1. `tentative_accept` / `promote`: 提案者を受入者に割り当てる
   （別の受入者に割り当て済みの場合は付け替える）
2. `reject`: 提案者がその受入者に割り当て済みであれば解除する
3. `propose` / `waitlist` / `cutoff_raise`: 割り当て状態を変化させない

任意の入力に対し、再構成結果はアルゴリズムが返す最終マッチングと一致する
（`backend/tests/features/matching/domain/test_properties.py` の
`test_*_events_reconstruct_result` でプロパティテストとして検証）。

### 例（DA）

提案者 P1・P2 が受入者 R1（定員1）に提案し、P1 が優先されるケース:

```text
round=1 propose          proposer=0 receiver=0
round=1 propose          proposer=1 receiver=0
round=1 tentative_accept proposer=0 receiver=0
round=1 reject           proposer=1 receiver=0 reason="定員超過"
```

## assignment（PS）

PS のイーティング過程は連続時間で進むため、イベントは「時刻の区間」を単位とする。
イベントは `AssignmentEvent`（frozen dataclass）で表現する。

| フィールド         | 型            | 説明                                                                  |
| ------------------ | ------------- | --------------------------------------------------------------------- |
| `step`             | `int`         | 区間番号（1 始まり）。同じ step のイベントは同一の時刻区間に属する。  |
| `event_type`       | `str`         | イベント種別（下表）。                                                |
| `start` / `end`    | `str`         | 区間の開始・終了時刻。API では既約分数の文字列（例: `"1/2"`）で返す。 |
| `employee`         | `int \| None` | 対象の社員（0-indexed）。`consume` のみ。                             |
| `department`       | `int \| None` | 対象の部署（0-indexed）。`-1` は未配属（∅）。制約の飽和では `null`。  |
| `amount`           | `str \| None` | 区間で消費した量（分数の文字列）。`consume` のみ。                    |
| `constraint_index` | `int \| None` | 飽和した上限制約の 0-index。`constraint_saturated` のみ。             |
| `reason`           | `str \| None` | 補足説明。省略可。                                                    |

### イベント種別

| 値                     | 意味                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| `consume`              | 区間 [start, end) で社員が対象（∅ を含む）を一定速度で消費した。 |
| `supply_exhausted`     | 時刻 end で部署の受け入れ人数が消費し尽くされた。                |
| `constraint_saturated` | 時刻 end で追加の上限制約が上限に達した。                        |

### 分数の表現

期待割当・くじの重み・イベントの時刻はすべて `fractions.Fraction` で厳密に計算し、
API では**既約分数の文字列**（`"1/2"`・`"0"`・`"71/96"`）で返す。小数へ丸めるのは
表示側の責務とする。理由は 2 つある。

- PS の期待割当は `71/96` のように分母が大きくなり、小数に丸めると行和が 1 に
  ならず「なぜ合計が合わないのか」という疑問を生む
- ennx は決定の根拠を示すツールであり、期待割当とくじの重みは説明そのもの。
  丸めた値を配布すると再現できない

### 期待割当の再構成ルール

`reconstruct_expected_assignment(events, n_agents, n_objects)` は次のルールで
イベント列を再生し、期待割当行列を返す。

1. `consume`: `amount` を該当セルに加算する
2. `supply_exhausted` / `constraint_saturated`: 割当量を変化させない（過程の説明用）

任意の入力に対し、再構成結果は PS が返す期待割当行列と一致する
（`backend/tests/features/assignment/domain/test_assignment_properties.py` の
`test_events_reconstruct_expected_assignment` でプロパティテストとして検証）。

### くじ（分解結果）を過程に含めない理由

期待割当を純割当のくじに分解する一般化 BvN 分解は、再帰的な二分割であって
「時系列に進む過程」ではない。ステップ再生で 1 手ずつ追体験する対象になり得ないため、
分解の途中経過はイベントログに含めず、結果（抽選 1 回分の `drawn_assignment`、および
全項を列挙できた場合の `lottery[]`）としてのみ返す。

## JSON Schema（API 契約）と互換性確認手順

各スキーマの機械可読な正本は [event-schema.json](event-schema.json)（matching）と
[assignment-event-schema.json](assignment-event-schema.json)（assignment）
（いずれも JSON Schema, draft 2020-12）。`POST /api/v1/matching/run` および `POST /api/v1/assignment/run` のレスポンス `events[]` の各要素は、対応するスキーマに適合する（適合は `backend/tests/test_event_contract.py` が CI で検証する）。

スキーマを変更する場合は、次の手順で互換性を確認する。

1. **本書と対応する JSON Schema を同一 PR で更新する**（ドキュメントとスキーマの乖離を残さない）
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
