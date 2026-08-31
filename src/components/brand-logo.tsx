import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand lockup: the real LMP mark (indigo→violet, whitespace-trimmed) plus a
 * crisp text wordmark. The wordmark collapses below `sm`, leaving the compact
 * mark alone on mobile. Used in every nav + footer so the logo, nav and page
 * all agree on the brand hue.
 */
export function BrandLogo({
  href = "/",
  className,
  priority = false,
}: {
  href?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="LastMilePrep, home"
      className={cn("flex items-center gap-2.5", className)}
    >
      <Image
        src="/images/lmp-mark.png"
        alt="LastMilePrep"
        width={863}
        height={348}
        priority={priority}
        className="h-7 w-auto"
      />
      <span className="hidden text-[15px] font-semibold tracking-tight text-ink sm:inline">
        LastMile<span className="text-accent">Prep</span>
      </span>
    </Link>
  );
}
