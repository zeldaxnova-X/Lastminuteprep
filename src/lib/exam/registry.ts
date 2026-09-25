/**
 * Exam registry — the single server-side map from an `exam_code` (as stored on
 * exam_attempts / analytics / the content namespace) to that exam's config and
 * content schema. Adding an exam = one entry here + its `exams.config` row +
 * its content schema. Nothing exam-specific is hardcoded in the scorer/engine.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SSC_CGL_TIER1_CONFIG, SBI_CLERK_PRELIMS_CONFIG, type ExamConfig } from "./exam-config";

export interface ExamRegistryEntry {
  /** Canonical short code, e.g. "ssc-cgl". Stored on exam_attempts.exam_code. */
  code: string;
  /** The `exams.slug` row that holds the ExamConfig jsonb. */
  slug: string;
  /** Postgres schema that holds this exam's content (papers/questions/...). */
  contentSchema: string;
  /** Built-in config, a last-resort fallback if the DB row is missing (kept in
   *  sync with the DB seed). */
  builtinConfig: ExamConfig;
}

/**
 * The registry. SSC CGL is the only live exam today; SBI/IBPS/etc. are added
 * here as they launch (with their own schema + exams.config row).
 */
export const EXAM_REGISTRY: Record<string, ExamRegistryEntry> = {
  "ssc-cgl": {
    code: "ssc-cgl",
    slug: "ssc-cgl-tier-1",
    contentSchema: "ssc_cgl",
    builtinConfig: SSC_CGL_TIER1_CONFIG,
  },
  "sbi-clerk": {
    code: "sbi-clerk",
    slug: "sbi-clerk-prelims",
    contentSchema: "sbi_clerk",
    builtinConfig: SBI_CLERK_PRELIMS_CONFIG,
  },
};

/** The default exam while only SSC is live (and the safe fallback). */
export const DEFAULT_EXAM_CODE = "ssc-cgl";

export function getExamEntry(examCode: string | null | undefined): ExamRegistryEntry {
  return EXAM_REGISTRY[examCode ?? ""] ?? EXAM_REGISTRY[DEFAULT_EXAM_CODE];
}

/** Postgres schema holding an exam's content. */
export function contentSchemaFor(examCode: string | null | undefined): string {
  return getExamEntry(examCode).contentSchema;
}

/**
 * Resolve an exam's ExamConfig. Reads the authoritative `exams.config` jsonb by
 * slug; falls back to the built-in config only if the row is missing. This is the
 * ONLY sanctioned way for the scorer/engine to obtain marking numbers.
 */
export async function loadExamConfig(
  supabase: SupabaseClient,
  examCode: string | null | undefined
): Promise<ExamConfig> {
  const entry = getExamEntry(examCode);
  const { data } = await supabase.from("exams").select("config").eq("slug", entry.slug).maybeSingle();
  if (data?.config) return data.config as ExamConfig;
  return entry.builtinConfig;
}
