"use client";

import { create } from "zustand";

export type QuestionStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked"
  | "answered_marked";

export type Option = "A" | "B" | "C" | "D";

/** Confidence signal captured on Save, the MarksenseAI's key calibration input. */
export type Confidence = "guessed" | "unsure" | "confident";

/**
 * A section is a CONTIGUOUS range over the flat ordered question list. SSC CGL
 * Tier 1 2026 runs four independent 15-minute sectional timers in a fixed order;
 * only the active section's questions are reachable, and when a section's clock
 * hits zero it locks permanently and the next one opens. Unused time is never
 * carried forward.
 */
export interface SectionMeta {
  name: string;
  startIndex: number; // index into orderedIds where this section begins
  count: number;
}

/** Input shape for initTest: each section with its ordered question ids. */
export interface SectionInput {
  name: string;
  questionIds: string[];
}

/** Minutes each section runs, per the 2026 sectional pattern. */
export const SECTION_MINUTES = 15;

interface TestState {
  examId: string | null;
  attemptId: string | null;

  /** Flat, section-contiguous ordered question ids (source of truth for index). */
  orderedIds: string[];
  sections: SectionMeta[];
  activeSectionIndex: number;
  /** Wall-clock deadline (epoch ms) for each section; null until it starts. */
  sectionEndsAt: (number | null)[];
  /** True once a section's time expired or was submitted; never reopens. */
  sectionLocked: boolean[];
  perSectionSeconds: number;

  currentQuestionIndex: number; // GLOBAL index; always within the active section

  userResponses: Record<string, Option | null>;
  savedResponses: Record<string, Option | null>;
  questionStatuses: Record<string, QuestionStatus>;
  confidences: Record<string, Confidence>;
  timePerQuestion: Record<string, number>;
  answerChanges: Record<string, number>;
  initialOptions: Record<string, Option | null>;
  visitOrder: Record<string, number>;

  timeRemaining: number; // seconds left in the ACTIVE section (for display)
  isSubmitted: boolean;
  submittedAt: string | null;
  startTime: number | null;
  lastQuestionEnteredAt: number | null;
  visitCounter: number;
  zoomedImage: string | null;
  isFullscreen: boolean;

  // Actions
  initTest: (
    examId: string,
    attemptId: string | null,
    sections: SectionInput[],
    perSectionMinutes?: number
  ) => void;
  setQuestionIndex: (index: number) => void;
  selectOption: (questionId: string, optionId: Option) => void;
  setConfidence: (questionId: string, confidence: Confidence) => void;
  clearResponse: (questionId: string) => void;
  saveAndNext: (questionId: string) => void;
  markForReviewAndNext: (questionId: string) => void;
  /** Explicit "lock this section now and move on" (forfeits remaining time). */
  lockCurrentSection: () => void;
  tickTimer: () => void;
  submitTest: () => Promise<void>;
  resetTest: () => void;
  setZoomedImage: (imageUrl: string | null) => void;
  toggleFullscreen: () => void;
}

const LOCAL_STORAGE_KEY = "lastmileprep_active_test_v4"; // v4: sectional timers

/** Persist the full serialisable slice for crash recovery. */
function persist(state: Partial<TestState>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Error persisting test state", e);
  }
}

/** Remaining seconds derived from a wall-clock deadline. */
function remainingFrom(endsAt: number | null): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.round((endsAt - Date.now()) / 1000));
}

/** Inclusive [start, end] global index range of a section. */
function rangeOf(sections: SectionMeta[], i: number): { start: number; end: number } {
  const s = sections[i];
  if (!s) return { start: 0, end: 0 };
  return { start: s.startIndex, end: s.startIndex + s.count - 1 };
}

export const useTestStore = create<TestState>((set, get) => ({
  examId: null,
  attemptId: null,
  orderedIds: [],
  sections: [],
  activeSectionIndex: 0,
  sectionEndsAt: [],
  sectionLocked: [],
  perSectionSeconds: SECTION_MINUTES * 60,
  currentQuestionIndex: 0,
  userResponses: {},
  savedResponses: {},
  questionStatuses: {},
  confidences: {},
  timePerQuestion: {},
  answerChanges: {},
  initialOptions: {},
  visitOrder: {},
  timeRemaining: SECTION_MINUTES * 60,
  isSubmitted: false,
  submittedAt: null,
  startTime: null,
  lastQuestionEnteredAt: null,
  visitCounter: 0,
  zoomedImage: null,
  isFullscreen: false,

  initTest: (examId, attemptId, sectionInputs, perSectionMinutes = SECTION_MINUTES) => {
    const perSectionSeconds = perSectionMinutes * 60;

    // Resume an in-progress attempt for this exam, if one is saved.
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as TestState;
          if (parsed.examId === examId && !parsed.isSubmitted && parsed.sections?.length) {
            set({ ...parsed, lastQuestionEnteredAt: Date.now() });
            // Fast-forward any sections whose wall-clock expired while away.
            advanceExpiredSections(get, set);
            if (!get().isSubmitted) {
              set({ timeRemaining: remainingFrom(get().sectionEndsAt[get().activeSectionIndex]) });
            }
            return;
          }
        }
      } catch (e) {
        console.error("Error reading saved test state", e);
      }
    }

    // Fresh start: flatten sections (in order) into the global ordered list.
    const orderedIds: string[] = [];
    const sections: SectionMeta[] = [];
    for (const sec of sectionInputs) {
      sections.push({ name: sec.name, startIndex: orderedIds.length, count: sec.questionIds.length });
      orderedIds.push(...sec.questionIds);
    }

    const userResponses: Record<string, Option | null> = {};
    const savedResponses: Record<string, Option | null> = {};
    const questionStatuses: Record<string, QuestionStatus> = {};
    const confidences: Record<string, Confidence> = {};
    const timePerQuestion: Record<string, number> = {};
    const answerChanges: Record<string, number> = {};
    const initialOptions: Record<string, Option | null> = {};
    const visitOrder: Record<string, number> = {};

    orderedIds.forEach((id, idx) => {
      userResponses[id] = null;
      savedResponses[id] = null;
      questionStatuses[id] = idx === 0 ? "not_answered" : "not_visited";
      confidences[id] = "unsure";
      timePerQuestion[id] = 0;
      answerChanges[id] = 0;
      initialOptions[id] = null;
    });
    if (orderedIds[0]) visitOrder[orderedIds[0]] = 1;

    const now = Date.now();
    // Only section 0's clock starts now; the rest start when they open.
    const sectionEndsAt = sections.map((_, i) => (i === 0 ? now + perSectionSeconds * 1000 : null));
    const sectionLocked = sections.map(() => false);

    const newState = {
      examId,
      attemptId: attemptId || examId,
      orderedIds,
      sections,
      activeSectionIndex: 0,
      sectionEndsAt,
      sectionLocked,
      perSectionSeconds,
      currentQuestionIndex: 0,
      userResponses,
      savedResponses,
      questionStatuses,
      confidences,
      timePerQuestion,
      answerChanges,
      initialOptions,
      visitOrder,
      timeRemaining: perSectionSeconds,
      isSubmitted: false,
      submittedAt: null,
      startTime: now,
      lastQuestionEnteredAt: now,
      visitCounter: 1,
      zoomedImage: null,
      isFullscreen: false,
    };

    set(newState);
    persist(newState);
  },

  setQuestionIndex: (index) => {
    const state = get();
    const { start, end } = rangeOf(state.sections, state.activeSectionIndex);
    // Only the active section is reachable; ignore out-of-section jumps.
    if (index < start || index > end) return;

    const now = Date.now();
    const currentQId = state.orderedIds[state.currentQuestionIndex];
    const targetQId = state.orderedIds[index];

    const timePerQuestion = { ...state.timePerQuestion };
    if (currentQId && state.lastQuestionEnteredAt) {
      const elapsed = Math.round((now - state.lastQuestionEnteredAt) / 1000);
      timePerQuestion[currentQId] = (timePerQuestion[currentQId] || 0) + Math.max(0, elapsed);
    }

    // Jumping does NOT save: discard any unsaved selection on the question left.
    const userResponses = { ...state.userResponses };
    if (currentQId) userResponses[currentQId] = state.savedResponses[currentQId] ?? null;

    const questionStatuses = { ...state.questionStatuses };
    const visitOrder = { ...state.visitOrder };
    let visitCounter = state.visitCounter;
    if (targetQId && questionStatuses[targetQId] === "not_visited") {
      questionStatuses[targetQId] = "not_answered";
    }
    if (targetQId && visitOrder[targetQId] === undefined) {
      visitCounter += 1;
      visitOrder[targetQId] = visitCounter;
    }

    const newState = {
      ...state,
      currentQuestionIndex: index,
      userResponses,
      questionStatuses,
      timePerQuestion,
      visitOrder,
      visitCounter,
      lastQuestionEnteredAt: now,
    };
    set(newState);
    persist(newState);

    if (state.attemptId && currentQId) {
      syncAnswer(state.attemptId, currentQId, {
        selected: state.savedResponses[currentQId] ?? null,
        status: questionStatuses[currentQId],
        confidence: state.confidences[currentQId],
        timeSpent: timePerQuestion[currentQId] || 0,
        visitOrder: visitOrder[currentQId],
      });
    }
  },

  selectOption: (questionId, optionId) => {
    const state = get();
    const prev = state.userResponses[questionId];
    const changeCount =
      prev !== null && prev !== optionId
        ? (state.answerChanges[questionId] || 0) + 1
        : state.answerChanges[questionId] || 0;
    const initialOpt = state.initialOptions[questionId] ?? optionId;

    set({
      userResponses: { ...state.userResponses, [questionId]: optionId },
      answerChanges: { ...state.answerChanges, [questionId]: changeCount },
      initialOptions: { ...state.initialOptions, [questionId]: initialOpt },
    });
  },

  setConfidence: (questionId, confidence) => {
    const state = get();
    const confidences = { ...state.confidences, [questionId]: confidence };
    set({ confidences });
    persist({ ...state, confidences });
    const status = state.questionStatuses[questionId];
    if (
      state.attemptId &&
      (status === "answered" || status === "answered_marked" || status === "marked")
    ) {
      syncAnswer(state.attemptId, questionId, {
        selected: state.savedResponses[questionId] ?? null,
        status,
        confidence,
        timeSpent: state.timePerQuestion[questionId] || 0,
        visitOrder: state.visitOrder[questionId],
      });
    }
  },

  clearResponse: (questionId) => {
    const state = get();
    const current = state.questionStatuses[questionId];
    const newStatus: QuestionStatus =
      current === "marked" || current === "answered_marked" ? "marked" : "not_answered";

    const userResponses = { ...state.userResponses, [questionId]: null };
    const savedResponses = { ...state.savedResponses, [questionId]: null };
    const questionStatuses = { ...state.questionStatuses, [questionId]: newStatus };

    const newState = { ...state, userResponses, savedResponses, questionStatuses };
    set(newState);
    persist(newState);

    if (state.attemptId) {
      syncAnswer(state.attemptId, questionId, {
        selected: null,
        status: newStatus,
        confidence: state.confidences[questionId],
        timeSpent: state.timePerQuestion[questionId] || 0,
        visitOrder: state.visitOrder[questionId],
      });
    }
  },

  saveAndNext: (questionId) => {
    commitAndAdvance(get, set, questionId, "save");
  },

  markForReviewAndNext: (questionId) => {
    commitAndAdvance(get, set, questionId, "mark");
  },

  lockCurrentSection: () => {
    advanceSection(get, set);
  },

  tickTimer: () => {
    const state = get();
    if (state.isSubmitted) return;
    const timeRemaining = remainingFrom(state.sectionEndsAt[state.activeSectionIndex]);

    const currentQId = state.orderedIds[state.currentQuestionIndex];
    let timePerQuestion = state.timePerQuestion;
    if (currentQId) {
      timePerQuestion = {
        ...state.timePerQuestion,
        [currentQId]: (state.timePerQuestion[currentQId] || 0) + 1,
      };
    }

    if (timeRemaining <= 0) {
      set({ timeRemaining: 0, timePerQuestion });
      advanceSection(get, set); // lock this section; open next, or submit if last
    } else {
      set({ timeRemaining, timePerQuestion });
    }
  },

  submitTest: async () => {
    const state = get();
    if (state.isSubmitted) return;
    const newState = {
      ...state,
      isSubmitted: true,
      submittedAt: new Date().toISOString(),
    };
    set(newState);
    persist(newState);

    if (state.attemptId) {
      try {
        await fetch(`/api/cbt/exams/${state.attemptId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Error submitting test to API", e);
      }
    }
  },

  resetTest: () => {
    set({
      examId: null,
      attemptId: null,
      orderedIds: [],
      sections: [],
      activeSectionIndex: 0,
      sectionEndsAt: [],
      sectionLocked: [],
      perSectionSeconds: SECTION_MINUTES * 60,
      currentQuestionIndex: 0,
      userResponses: {},
      savedResponses: {},
      questionStatuses: {},
      confidences: {},
      timePerQuestion: {},
      answerChanges: {},
      initialOptions: {},
      visitOrder: {},
      timeRemaining: SECTION_MINUTES * 60,
      isSubmitted: false,
      submittedAt: null,
      startTime: null,
      lastQuestionEnteredAt: null,
      visitCounter: 0,
      zoomedImage: null,
      isFullscreen: false,
    });
    if (typeof window !== "undefined") localStorage.removeItem(LOCAL_STORAGE_KEY);
  },

  setZoomedImage: (imageUrl) => set({ zoomedImage: imageUrl }),

  toggleFullscreen: () => {
    if (typeof window === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      set({ isFullscreen: true });
    } else {
      document.exitFullscreen?.().catch(() => {});
      set({ isFullscreen: false });
    }
  },
}));

/**
 * Lock the active section and open the next one (fresh 15-minute clock), or
 * submit the whole test if the active section was the last. Used by both the
 * timer expiry and the explicit "lock this section now" action. Unused time on
 * the section being left is forfeited, never carried forward.
 */
function advanceSection(get: () => TestState, set: (partial: Partial<TestState>) => void) {
  const state = get();
  if (state.isSubmitted) return;
  const active = state.activeSectionIndex;
  const sectionLocked = [...state.sectionLocked];
  sectionLocked[active] = true;

  const isLast = active >= state.sections.length - 1;
  if (isLast) {
    set({ sectionLocked });
    void get().submitTest();
    return;
  }

  const now = Date.now();
  const next = active + 1;
  const sectionEndsAt = [...state.sectionEndsAt];
  sectionEndsAt[next] = now + state.perSectionSeconds * 1000;
  const { start } = rangeOf(state.sections, next);

  const questionStatuses = { ...state.questionStatuses };
  const visitOrder = { ...state.visitOrder };
  let visitCounter = state.visitCounter;
  const firstId = state.orderedIds[start];
  if (firstId && questionStatuses[firstId] === "not_visited") questionStatuses[firstId] = "not_answered";
  if (firstId && visitOrder[firstId] === undefined) {
    visitCounter += 1;
    visitOrder[firstId] = visitCounter;
  }

  const newState = {
    ...state,
    sectionLocked,
    sectionEndsAt,
    activeSectionIndex: next,
    currentQuestionIndex: start,
    questionStatuses,
    visitOrder,
    visitCounter,
    timeRemaining: state.perSectionSeconds,
    lastQuestionEnteredAt: now,
  };
  set(newState);
  persist(newState);
}

/**
 * On resume, fast-forward through any sections whose wall-clock deadline already
 * passed while the tab was closed. A section that expired is locked; the next
 * one opens with a fresh clock (it legitimately had not started). If the last
 * section expired, the test submits.
 */
function advanceExpiredSections(get: () => TestState, set: (partial: Partial<TestState>) => void) {
  let guard = 0;
  while (guard++ < 8) {
    const s = get();
    if (s.isSubmitted) return;
    const remaining = remainingFrom(s.sectionEndsAt[s.activeSectionIndex]);
    if (remaining > 0) return;
    advanceSection(get, set);
  }
}

/**
 * Commit the current question's transient selection, set its status, then
 * advance WITHIN the active section (never across a section boundary).
 */
function commitAndAdvance(
  get: () => TestState,
  set: (partial: Partial<TestState>) => void,
  questionId: string,
  action: "save" | "mark"
) {
  const state = get();
  const now = Date.now();
  const selected = state.userResponses[questionId] ?? null;

  const newStatus: QuestionStatus =
    action === "save"
      ? selected
        ? "answered"
        : "not_answered"
      : selected
      ? "answered_marked"
      : "marked";

  const { end } = rangeOf(state.sections, state.activeSectionIndex);
  const nextIndex = Math.min(state.currentQuestionIndex + 1, end); // clamp to section
  const nextQId = state.orderedIds[nextIndex];

  const elapsed = state.lastQuestionEnteredAt
    ? Math.round((now - state.lastQuestionEnteredAt) / 1000)
    : 0;
  const timePerQuestion = {
    ...state.timePerQuestion,
    [questionId]: (state.timePerQuestion[questionId] || 0) + Math.max(0, elapsed),
  };

  const savedResponses = { ...state.savedResponses, [questionId]: selected };
  const questionStatuses = { ...state.questionStatuses, [questionId]: newStatus };
  const visitOrder = { ...state.visitOrder };
  let visitCounter = state.visitCounter;

  if (nextQId && questionStatuses[nextQId] === "not_visited") {
    questionStatuses[nextQId] = "not_answered";
  }
  if (nextQId && visitOrder[nextQId] === undefined) {
    visitCounter += 1;
    visitOrder[nextQId] = visitCounter;
  }

  const newState = {
    ...state,
    savedResponses,
    questionStatuses,
    timePerQuestion,
    visitOrder,
    visitCounter,
    currentQuestionIndex: nextIndex,
    lastQuestionEnteredAt: now,
  };
  set(newState);
  persist(newState);

  if (state.attemptId) {
    syncAnswer(state.attemptId, questionId, {
      selected,
      status: newStatus,
      confidence: state.confidences[questionId] ?? "unsure",
      timeSpent: timePerQuestion[questionId],
      visitOrder: visitOrder[questionId],
    });
  }
}

/** Persist a single committed answer to Supabase (best-effort, non-blocking). */
async function syncAnswer(
  attemptId: string,
  questionId: string,
  data: {
    selected: Option | null;
    status: QuestionStatus;
    confidence: Confidence | undefined;
    timeSpent: number;
    visitOrder: number | undefined;
  }
) {
  try {
    await fetch(`/api/cbt/exams/${attemptId}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: questionId,
        selected_option: data.selected,
        is_marked_for_review:
          data.status === "marked" || data.status === "answered_marked",
        is_visited: data.status !== "not_visited",
        confidence: data.confidence ?? "unsure",
        time_spent_seconds: data.timeSpent,
        visit_order: data.visitOrder ?? null,
      }),
    });
  } catch (e) {
    console.error("Auto-save sync error", e);
  }
}
