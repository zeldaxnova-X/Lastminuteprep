import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth/api-guard";

/**
 * Server-side gate for every /admin/* route. Non-admins (including signed-out
 * visitors) get a 404 — we don't reveal that an admin area exists. This runs on
 * the server before any admin page renders; the DB-level RLS on admin/staging
 * tables (see 20260810000000_security_hardening.sql) is the backstop.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) notFound();
  return <>{children}</>;
}
