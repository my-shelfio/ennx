// steiger（FSD 公式 linter）の設定。
// FSD 推奨ルール一式を有効化し、層・スライス構造の違反を CI で検出する。
import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ["src/entities/matching/**", "src/entities/assignment/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // features/validate-input は現時点では widgets/setup-wizard からのみ参照されるが、
    // 選好入力画面等の他スライスからも再利用される想定の独立
    // フィーチャーとして意図的に分離している。「参照元が1つのみ」の誤検知を抑制する。
    files: ["src/features/validate-input/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // widgets/setup-wizard は pages/setup からのみ参照されるが、
    // widgets/pages 分離方針（pages は合成のみでロジックを持たない）に基づく意図的な設計。
    files: ["src/widgets/setup-wizard/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // widgets/preference-matrix は pages/preferences からのみ参照されるが、
    // widgets/setup-wizard と同様に widgets/pages 分離方針に基づく意図的な設計。
    files: ["src/widgets/preference-matrix/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // features/run-matching は現時点では pages/preferences からのみ参照されるが、
    // features/validate-input と同様、他スライスからの再利用を想定した独立フィーチャーとして
    // 意図的に分離している。
    files: ["src/features/run-matching/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // widgets/result-summary・widgets/assignment-map は pages/result からのみ
    // 参照されるが、widgets/setup-wizard 等と同様に widgets/pages 分離方針に基づく意図的な設計。
    files: ["src/widgets/result-summary/**", "src/widgets/assignment-map/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // widgets/step-playerは pages/result からのみ参照されるが、
    // 同様に widgets/pages 分離方針に基づく意図的な設計。
    files: ["src/widgets/step-player/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // features/load-sample は現時点では pages/setup からのみ参照されるが、
    // features/validate-input 等と同様、他スライスからの再利用を想定した独立フィーチャーとして
    // 意図的に分離している。
    files: ["src/features/load-sample/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // features/export-result は現時点では pages/result からのみ参照されるが、
    // 同様に独立フィーチャーとして意図的に分離している。
    files: ["src/features/export-result/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // features/clear-dataは app/layout（全ページ共通ヘッダー）からのみ参照される。
    // セキュリティ要件「入力データをクリア」導線を全ページ共通で「常設」するための
    // 意図的な配置であり、widgets/pages 分離方針と同種の設計判断。
    files: ["src/features/clear-data/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // widgets/global-nav は app/layout（全ページ共通ヘッダー）からのみ参照される。
    // 将来モジュール化に備えたグローバルナビを全ページ共通で「常設」するための
    // 意図的な配置であり、features/clear-data と同種の設計判断（#114）。
    files: ["src/widgets/global-nav/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // features/voting-create は現時点では widgets/voting-create-form からのみ参照されるが、
    // features/export-result 等と同様、他スライスからの再利用を想定した独立フィーチャーとして
    // 意図的に分離している（#129）。
    files: ["src/features/voting-create/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // features/voting-participate は現時点では pages/voting-participate からのみ参照されるが、
    // 同様に独立フィーチャーとして意図的に分離している（#129）。
    files: ["src/features/voting-participate/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // features/voting-manage は現時点では pages/voting-manage からのみ参照されるが、
    // 同様に独立フィーチャーとして意図的に分離している（#129）。
    files: ["src/features/voting-manage/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // features/export-voting-results は現時点では widgets/voting-results-panel からのみ
    // 参照されるが、features/export-result と同様に独立フィーチャーとして意図的に分離している
    // （#129）。
    files: ["src/features/export-voting-results/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // widgets/voting-create-form は pages/voting-create からのみ参照されるが、
    // widgets/setup-wizard 等と同様に widgets/pages 分離方針に基づく意図的な設計（#129）。
    files: ["src/widgets/voting-create-form/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // widgets/voting-ballot-form は pages/voting-participate からのみ参照されるが、
    // 同様に widgets/pages 分離方針に基づく意図的な設計（#129）。
    files: ["src/widgets/voting-ballot-form/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // widgets/voting-results-panel は pages/voting-manage からのみ参照されるが、
    // 同様に widgets/pages 分離方針に基づく意図的な設計（#129）。
    files: ["src/widgets/voting-results-panel/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // features/run-assignment は現時点では pages/assignment からのみ参照されるが、
    // features/run-matching と同様、他スライスからの再利用を想定した独立フィーチャーとして
    // 意図的に分離している。
    files: ["src/features/run-assignment/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // widgets/assignment-form・assignment-result・assignment-step-player は
    // pages/assignment からのみ参照されるが、widgets/setup-wizard 等と同様に
    // widgets/pages 分離方針（pages は合成のみでロジックを持たない）に基づく意図的な設計。
    files: [
      "src/widgets/assignment-form/**",
      "src/widgets/assignment-result/**",
      "src/widgets/assignment-step-player/**",
    ],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
  {
    // features/ca-constraint-meta は現時点では widgets/setup-wizard からのみ参照されるが、
    // features/validate-input 等と同様、他スライスからの再利用を想定した独立フィーチャーとして
    // 意図的に分離している（#124）。
    files: ["src/features/ca-constraint-meta/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
]);
