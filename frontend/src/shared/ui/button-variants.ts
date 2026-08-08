import { cva } from "class-variance-authority";

/**
 * Button の variant/size 定義。
 * コンポーネント本体（Button.tsx）から分離し、react-refresh の
 * 「コンポーネントのみを export するファイル」制約を満たす。
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium " +
    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 " +
    "focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-gradient-brand text-white shadow-control hover:brightness-110",
        secondary: "bg-primary-50 text-primary-700 hover:bg-primary-100",
        outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        ghost: "text-slate-700 hover:bg-slate-100",
        danger: "bg-danger-600 text-white hover:bg-danger-700",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);
