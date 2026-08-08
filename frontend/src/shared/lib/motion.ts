/**
 * Framer Motion（motion パッケージ）の共通エントリポイント。
 * `shared/ui` の各コンポーネントはここから import することで、
 * prefers-reduced-motion 対応（useReducedMotion）を含め利用方法を統一する。
 *
 * アプリ全体のモーション設定（reducedMotion="user"）は AppMotionConfig を
 * app 層のルートで使用することで有効化する。
 */
export { AnimatePresence, motion, Reorder, useDragControls, useReducedMotion } from "motion/react";
export { MotionConfig as AppMotionConfig } from "motion/react";
