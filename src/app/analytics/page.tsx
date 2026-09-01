import { redirect } from "next/navigation";

/**
 * The old slate/blue analytics page was off-brand and is retired. Its role is
 * now the on-brand MarksenseAI intelligence report. Redirect any lingering links.
 */
export default function AnalyticsRedirect() {
  redirect("/marksense/profile");
}
