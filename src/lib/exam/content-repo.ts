/**
 * Exam content repository — the ONLY sanctioned way to read a specific exam's
 * content. Every query it hands back is bound to exactly one exam, so a caller
 * cannot accidentally read across exams: there is no method that returns an
 * unscoped question set.
 *
 * Isolation model: each exam's content lives in its own Postgres schema
 * (ssc_cgl, sbi_clerk, …). The app reads through per-exam objects in the public
 * schema (so PostgREST needs no per-schema exposure):
 *   - SSC CGL (the default/first exam) uses the base names (questions, papers,
 *     cbt_valid_questions, …), which are public views over ssc_cgl.*.
 *   - Every later exam gets its own public views named `<code>__<object>` over
 *     its schema (created by the parameterised ingestion). Each such view selects
 *     from exactly one schema, so it can never contain another exam's rows.
 *
 * GUARDRAIL: no other module may name a content schema (ssc_cgl./sbi_clerk./…)
 * or a `<code>__` content view. The `no-cross-exam` test fails the build if one
 * does. New multi-exam content reads MUST go through this module.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getExamEntry, DEFAULT_EXAM_CODE } from "./registry";

export type ContentObject =
  | "questions"
  | "papers"
  | "validated_questions"
  | "cbt_valid_questions"
  | "question_assets"
  | "excluded_questions";

/**
 * Resolve the public object name for an exam's content object. The default exam
 * uses the base names (its public shims); others use `<code>__<object>` views.
 * Exported so the ingestion + guardrail can agree on the naming.
 */
export function contentObjectName(examCode: string, object: ContentObject): string {
  const entry = getExamEntry(examCode);
  if (entry.code === DEFAULT_EXAM_CODE) return object;
  return `${entry.code.replace(/-/g, "_")}__${object}`;
}

/**
 * An exam-scoped content accessor. Each method returns a Supabase query builder
 * already pointed at THIS exam's object — callers add filters/columns as usual.
 */
export function examContent(supabase: SupabaseClient, examCode: string) {
  const code = getExamEntry(examCode).code; // normalise / validate
  const from = (object: ContentObject) => supabase.from(contentObjectName(code, object));
  return {
    examCode: code,
    /** Exam-eligible questions for a scored test (the cbt_valid_questions view). */
    validQuestions: () => from("cbt_valid_questions"),
    /** All validated questions for the exam. */
    validatedQuestions: () => from("validated_questions"),
    /** Raw canonical questions (rich content, answer key). Server-only. */
    questions: () => from("questions"),
    /** Papers (PYP metadata). */
    papers: () => from("papers"),
    /** Extracted question assets. */
    questionAssets: () => from("question_assets"),
    /** Retired-question registry. */
    excludedQuestions: () => from("excluded_questions"),
  };
}

export type ExamContent = ReturnType<typeof examContent>;
