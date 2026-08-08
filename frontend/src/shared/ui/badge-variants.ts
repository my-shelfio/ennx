import { cva } from "class-variance-authority";

/**
 * Badge の variant 定義。コンポーネント本体から分離し、
 * react-refresh の「コンポーネントのみを export するファイル」制約を満たす。
 */
export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-slate-100 text-slate-700",
        primary: "bg-primary-100 text-primary-700",
        ok: "bg-ok-100 text-ok-700",
        warning: "bg-warning-100 text-warning-700",
        danger: "bg-danger-100 text-danger-700",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);
