import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Subtle "Payments secured by Razorpay" trust badge for pricing CTAs and the
 * checkout/upgrade panels. Uses Razorpay's official wordmark asset unmodified
 * (public/images/razorpay-logo.svg) — never recoloured or reconstructed. The
 * navy wordmark is designed for light/neutral surfaces, so place this on light
 * backgrounds only.
 */
export function RazorpayBadge({
  className,
  methods = true,
}: {
  className?: string;
  /** Show the small "UPI · Cards · Net Banking" acceptance note. */
  methods?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5 text-center", className)}>
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-tertiary">
        <ShieldCheck className="h-3.5 w-3.5 text-success" />
        Payments secured by
        {/* Official Razorpay wordmark — used as-is per brand guidelines. */}
        <img
          src="/images/razorpay-logo.svg"
          alt="Razorpay"
          width={72}
          height={15}
          className="ml-0.5 h-3.5 w-auto translate-y-[0.5px]"
        />
      </span>
      {methods && (
        <span className="text-[11px] font-medium text-ink-tertiary/80">
          UPI · Cards · Net Banking accepted
        </span>
      )}
    </div>
  );
}
