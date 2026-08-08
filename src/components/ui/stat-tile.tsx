import { cn } from "@/lib/utils";
import { Card } from "./card";

interface StatTileProps {
  label: string;
  /** The value to display. Numbers render in tabular-nums so they don't jitter. */
  value: React.ReactNode;
  /** Shown when there is no data yet — keeps empty states honest (§8). */
  empty?: boolean;
  hint?: string;
  className?: string;
  valueClassName?: string;
}

export function StatTile({
  label,
  value,
  empty = false,
  hint,
  className,
  valueClassName,
}: StatTileProps) {
  return (
    <Card className={cn("p-5", className)}>
      <p className="truncate text-xs font-medium text-ink-tertiary">{label}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tracking-tight tabular",
          empty ? "text-ink-tertiary" : "text-ink",
          valueClassName
        )}
      >
        {empty ? "—" : value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-tertiary">{hint}</p> : null}
    </Card>
  );
}
