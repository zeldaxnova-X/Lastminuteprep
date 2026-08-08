import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Real-photo slot. When a `src` is provided it renders an optimized next/image;
 * until then it shows a clean, on-brand placeholder that names the exact
 * Unsplash search term + aspect ratio so a real photo can be dropped in.
 *
 * DROP-IN: save a free-commercial Unsplash/Pexels photo to /public/images/<file>
 * (see /public/images/README.md) and pass `src="/images/<file>"`. Do NOT use
 * CC-BY images that require attribution.
 */
export function ImageSlot({
  src,
  alt,
  term,
  aspect = "4 / 5",
  priority = false,
  sizes = "(max-width: 768px) 100vw, 45vw",
  className,
  rounded = "rounded-3xl",
}: {
  src?: string;
  alt: string;
  /** Unsplash search term, shown in the placeholder for easy sourcing. */
  term: string;
  aspect?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  rounded?: string;
}) {
  if (src) {
    return (
      <div
        className={cn("relative overflow-hidden bg-panel", rounded, className)}
        style={{ aspectRatio: aspect }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "relative flex items-center justify-center overflow-hidden border border-hairline bg-panel",
        rounded,
        className
      )}
      style={{ aspectRatio: aspect }}
    >
      {/* Subtle on-brand wash so the slot reads as intentional, not broken. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,var(--accent-soft),transparent_60%)] opacity-70" />
      <div className="pointer-events-none relative flex flex-col items-center gap-2 px-6 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface text-ink-tertiary">
          <ImageIcon className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-ink-secondary">{alt}</p>
        <p className="font-mono text-[11px] text-ink-tertiary">
          Unsplash “{term}” · {aspect.replace(/\s/g, "").replace("/", ":")}
        </p>
      </div>
    </div>
  );
}
