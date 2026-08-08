import type { VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

import { badgeVariants } from "./badge-variants";

/**
 * 共通 Badge コンポーネント。
 * 性質レポートの充足/違反表示など、状態を色分けするために使う。
 */
export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
