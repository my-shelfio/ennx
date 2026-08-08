/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API のベース URL（未設定時は相対パス＝同一オリジン）。 */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
