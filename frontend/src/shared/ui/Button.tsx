import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib/cn";

import { buttonVariants } from "./button-variants";

/**
 * 共通 Button コンポーネント。
 * variant/size は class-variance-authority で管理し、`asChild` で
 * Link 等の他要素にスタイルとロール（Radix Slot）を委譲できる。
 */
export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** true の場合、button の代わりに子要素へスタイル・props を委譲する（Radix Slot）。 */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      // Slot に委譲する場合、子要素側で type を制御するため button 要素のときのみ付与する。
      {...(asChild ? {} : { type })}
      {...props}
    />
  );
}
