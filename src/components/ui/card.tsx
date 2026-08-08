import { cn } from "@/lib/utils";

/**
 * Premium-white surface card: white on white with a hairline border
 * and a very soft shadow (§3). Use `interactive` for hover-elevation
 * on clickable cards.
 */
export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-hairline bg-surface shadow-soft",
        interactive &&
          "transition-premium hover:border-hairline-strong hover:shadow-card",
        className
      )}
      {...props}
    />
  );
}
