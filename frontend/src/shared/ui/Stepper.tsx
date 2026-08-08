import { cn } from "../lib/cn";
import { motion, useReducedMotion } from "../lib/motion";

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  /** 現在アクティブなステップの id。 */
  currentStepId: string;
  className?: string;
}

/**
 * ステップインジケータ。設定ウィザードでの進捗表示に使う。
 * アクティブなステップの強調表示は layout アニメーションで移動させ、
 * `prefers-reduced-motion` 時は即座に切り替える。
 */
export function Stepper({ steps, currentStepId, className }: StepperProps) {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion === true
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 400, damping: 32 };

  return (
    <ol aria-label="ステップ" className={cn("flex w-full items-center", className)}>
      {steps.map((step, index) => {
        const isCompleted = currentIndex >= 0 && index < currentIndex;
        const isCurrent = step.id === currentStepId;

        return (
          <li
            key={step.id}
            aria-current={isCurrent ? "step" : undefined}
            className="flex flex-1 items-center last:flex-none"
          >
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-pill border text-sm font-semibold",
                  isCompleted || isCurrent
                    ? "border-transparent text-white"
                    : "border-slate-300 text-slate-400",
                )}
              >
                {isCurrent && (
                  <motion.span
                    layoutId="stepper-active-indicator"
                    transition={transition}
                    className="absolute inset-0 rounded-pill bg-gradient-brand"
                  />
                )}
                {isCompleted && (
                  <span className="absolute inset-0 rounded-pill bg-primary-400" />
                )}
                <span className="relative">
                  {isCompleted ? "✓" : index + 1}
                </span>
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isCurrent ? "text-primary-700" : "text-slate-500",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-px flex-1",
                  isCompleted ? "bg-primary-400" : "bg-slate-200",
                )}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
