import { cn } from "@/lib/utils";

/**
 * The MarksenseAI wordmark, the single source of truth for the brand lockup.
 * Mirrors the landing treatment exactly: `font-report` (serif display), "Marksense"
 * in ink (or white on dark), "AI" in the pink->purple->indigo gradient. Use this
 * everywhere the product is named so the brand reads identically across the app.
 */
export function MarksenseWordmark({
  className,
  tone = "ink",
  as: Tag = "span",
}: {
  className?: string;
  /** "ink" for light surfaces, "white" for dark/cinematic surfaces. */
  tone?: "ink" | "white";
  as?: "span" | "h1" | "h2" | "p";
}) {
  return (
    <Tag
      className={cn(
        "font-report font-medium tracking-tight",
        tone === "white" ? "text-white" : "text-ink",
        className
      )}
    >
      Marksense
      <span className="bg-gradient-to-r from-[#f0abfc] via-[#c084fc] to-[#818cf8] bg-clip-text text-transparent">
        AI
      </span>
    </Tag>
  );
}
