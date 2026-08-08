import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Ghosted background image with an ink overlay so text on top stays legible and
 * the photo reads cinematic, not touristy. Decorative by default (empty alt).
 */
export function GhostImage({
  src,
  alt = "",
  sizes = "100vw",
  priority = false,
  overlay = "strong",
  position = "center",
  className,
}: {
  src: string;
  alt?: string;
  sizes?: string;
  priority?: boolean;
  overlay?: "strong" | "soft" | "veil";
  position?: string;
  className?: string;
}) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)} aria-hidden={alt === ""}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className="object-cover [filter:grayscale(0.4)_contrast(1.03)]"
        style={{ objectPosition: position }}
      />
      <div
        className={cn(
          "absolute inset-0",
          overlay === "strong" &&
            "bg-[linear-gradient(to_top,rgba(10,10,10,0.94),rgba(10,10,10,0.55))]",
          overlay === "soft" &&
            "bg-[linear-gradient(to_top,rgba(10,10,10,0.72),rgba(10,10,10,0.22))]",
          overlay === "veil" && "bg-panel-dark/60"
        )}
      />
    </div>
  );
}

/**
 * Duotone treatment (ink → emerald → gold). Tames a neon/high-saturation source
 * so it reads as premium AI rather than hacker-Matrix. Used low-opacity behind
 * the dark AI-Mentor panel.
 */
export function Duotone({
  src,
  alt = "",
  sizes = "100vw",
  opacity = 0.42,
  position = "center 30%",
  className,
}: {
  src: string;
  alt?: string;
  sizes?: string;
  opacity?: number;
  position?: string;
  className?: string;
}) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)} aria-hidden>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        loading="lazy"
        className="object-cover [filter:grayscale(1)_contrast(1.15)_brightness(0.78)]"
        style={{ opacity, objectPosition: position }}
      />
      {/* recolor the mono image toward emerald, then warm it with gold */}
      <div className="absolute inset-0 bg-[#065f46] opacity-70 mix-blend-color" />
      <div className="absolute inset-0 mix-blend-screen bg-[radial-gradient(60%_55%_at_85%_8%,rgba(217,119,6,0.32),transparent_62%)]" />
      <div className="absolute inset-0 bg-panel-dark/55" />
    </div>
  );
}

/**
 * A framed content photo (real subject) with an emerald ring — used in feature
 * rows and how-it-works steps. Content-bearing, so it takes descriptive alt.
 */
export function Framed({
  src,
  alt,
  sizes = "(max-width: 1024px) 100vw, 45vw",
  aspect = "4 / 3",
  priority = false,
  position = "center",
  className,
}: {
  src: string;
  alt: string;
  sizes?: string;
  aspect?: string;
  priority?: boolean;
  position?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl bg-panel ring-1 ring-hairline shadow-soft", className)}
      style={{ aspectRatio: aspect }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className="object-cover"
        style={{ objectPosition: position }}
      />
    </div>
  );
}
