"use client";

import { create } from "zustand";

export type QuestionStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked"
  | "answered_marked";

export type Option = "A" | "B" | "C" | "D";

/** Confidence signal captured on Save, the AI Mentor's key calibration input (§4). */
export type Confidence = "guessed" | "unsure" | "confident";

interface TestState {
  examId: string | null;
  attemptId: string | null;
  currentSectionIndex: number;
  currentQuestionIndex: number;

  /**
   * Transient per-question selection (what radio is highlighted). This is NOT
   * the committed answer, selecting an option does not save it (§4). It is
   * reset to the saved value when the user navigates away without saving.
   */
  userResponses: Record<string, Option | null>;
  /**
   * Committed answers, the ONLY values that are persisted and evaluated. Set
   * exclusively by Save & Next / Mark for Review & Next / Clear Response.
   */
  savedResponses: Record<string, Option | null>;

  questionStatuses: Record<string, QuestionStatus>;
  /** Per-question confidence; defaults to "unsure" so it never blocks flow. */
  confidences: Record<string, Confidence>;
  timePerQuestion: Record<string, number>; // questionId -> total seconds
  answerChanges: Record<string, number>; // questionId -> count of changes
  initialOptions: Record<string, Option | null>;
  visitOrder: Record<string, number>; // questionId -> 1-based order first visited

  timeRemaining: number; // seconds (derived from endsAt for display)
  endsAt: number | null; // epoch ms when the exam expires, wall-clock source of truth
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
    questionIds: string[],
    timeLimitMinutes: number
  ) => void;
  setSectionIndex: (index: number) => void;
  setQuestionIndex: (index: number) => void;
  selectOption: (questionId: string, optionId: Option) => void;
  setConfidence: (questionId: string, confidence: Confidence) => void;
  clearResponse: (questionId: string) => void;
  saveAndNext: (questionId: string, totalQuestions: number) => void;
  markForReviewAndNext: (questionId: string, totalQuestions: number) => void;
  tickTimer: () => void;
  submitTest: () => Promise<void>;
  resetTest: () => void;
  setZoomedImage: (imageUrl: string | null) => void;
  toggleFullscreen: () => void;
}

const LOCAL_STORAGE_KEY = "lastmileprep_active_test_v3";

/** Persist the full serialisable slice for crash recovery. */
function persist(state: Partial<TestState>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Error persisting test state", e);
  }
}

/** Remaining seconds derived from the wall-clock deadline. */
function remainingFrom(endsAt: number | null): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.round((endsAt - Date.now()) / 1000));
}

export const useTestStore = create<TestState>((set, get) => ({
  examId: null,
  attemptId: null,
  currentSectionIndex: 0,
  currentQuestionIndex: 0,
  userResponses: {},
  savedResponses: {},
  questionStatuses: {},
  confidences: {},
  timePerQuestion: {},
  answerChanges: {},
  initialOptions: {},
  visitOrder: {},
  timeRemaining: 3600,
  endsAt: null,
  isSubmitted: false,
  submittedAt: null,
  startTime: null,
  lastQuestionEnteredAt: null,
  visitCounter: 0,
  zoomedImage: null,
  isFullscreen: false,

  initTest: (examId, attemptId, questionIds, timeLimitMinutes) => {
    // Resume an in-progress attempt for this exam, if one is saved.
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as TestState;
          if (parsed.examId === examId && !parsed.isSubmitted) {
            // Recompute remaining time from the persisted wall-clock deadline so
            // a refresh/crash resumes correctly, time keeps running while away.
            const endsAt = parsed.endsAt ?? Date.now() + parsed.timeRemaining * 1000;
            const timeRemaining = remainingFrom(endsAt);
            set({
              ...parsed,
              endsAt,
              timeRemaining,
              lastQuestionEnteredAt: Date.now(),
            });
            if (timeRemaining <= 0) get().submitTest();
            return;
          }
        }
      } catch (e) {
        console.error("Error reading saved test state", e);
      }
    }

    const userResponses: Record<string, Option | null> = {};
    const savedResponses: Record<string, Option | null> = {};
    const questionStatuses: Record<string, QuestionStatus> = {};
    const confidences: Record<string, Confidence> = {};
    const timePerQuestion: Record<string, number> = {};
    const answerChanges: Record<string, number> = {};
    const initialOptions: Record<string, Option | null> = {};
    const visitOrder: Record<string, number> = {};

    questionIds.forEach((id, idx) => {
      userResponses[id] = null;
      savedResponses[id] = null;
      questionStatuses[id] = idx === 0 ? "not_answered" : "not_visited";
      confidences[id] = "unsure";
      timePerQuestion[id] = 0;
      answerChanges[id] = 0;
      initialOptions[id] = null;
    });
    if (questionIds[0]) visitOrder[questionIds[0]] = 1;

    const now = Date.now();
    const newState = {
      examId,
      attemptId: attemptId || examId,
      currentSectionIndex: 0,
      currentQuestionIndex: 0,
      userResponses,
      savedResponses,
      questionStatuses,
      confidences,
      timePerQuestion,
      answerChanges,
      initialOptions,
      visitOrder,
      timeRemaining: timeLimitMinutes * 60,
      endsAt: now + timeLimitMinutes * 60 * 1000,
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

  setSectionIndex: (index) => set({ currentSectionIndex: index }),

  setQuestionIndex: (index) => {
    const state = get();
    const now = Date.now();
    const qIds = Object.keys(state.questionStatuses);
    const currentQId = qIds[state.currentQuestionIndex];
    const targetQId = qIds[index];

    // Accumulate time on the question being left.
    const timePerQuestion = { ...state.timePerQuestion };
    if (currentQId && state.lastQuestionEnteredAt) {
      const elapsed = Math.round((now - state.lastQuestionEnteredAt) / 1000);
      timePerQuestion[currentQId] = (timePerQuestion[currentQId] || 0) + Math.max(0, elapsed);
    }

    // Jumping does NOT save (§4): discard any unsaved selection on the question
    // being left by resetting its transient value back to the committed one.
    const userResponses = { ...state.userResponses };
    if (currentQId) userResponses[currentQId] = state.savedResponses[currentQId] ?? null;

    // Mark the target visited (grey -> red) and record first-visit order.
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

    // Sync the committed state of the question we left (time, saved answer).
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

    // Transient only, committing happens on Save / Mark (§4).
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
    // If already committed, propagate the updated confidence to the DB.
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

  saveAndNext: (questionId, totalQuestions) => {
    commitAndAdvance(get, set, questionId, totalQuestions, "save");
  },

  markForReviewAndNext: (questionId, totalQuestions) => {
    commitAndAdvance(get, set, questionId, totalQuestions, "mark");
  },

  tickTimer: () => {
    const state = get();
    if (state.isSubmitted) return;
    const timeRemaining = remainingFrom(state.endsAt);

    // Accrue time on the current question for pacing analytics.
    const qIds = Object.keys(state.questionStatuses);
    const currentQId = qIds[state.currentQuestionIndex];
    let timePerQuestion = state.timePerQuestion;
    if (currentQId) {
      timePerQuestion = {
        ...state.timePerQuestion,
        [currentQId]: (state.timePerQuestion[currentQId] || 0) + 1,
      };
    }

    if (timeRemaining <= 0) {
      set({ timeRemaining: 0, timePerQuestion });
      get().submitTest();
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
      currentSectionIndex: 0,
      currentQuestionIndex: 0,
      userResponses: {},
      savedResponses: {},
      questionStatuses: {},
      confidences: {},
      timePerQuestion: {},
      answerChanges: {},
      initialOptions: {},
      visitOrder: {},
      timeRemaining: 3600,
      endsAt: null,
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
 * Commit the current question's transient selection, set its status, then
 * advance. This is the ONLY path (besides Clear) that writes savedResponses, * enforcing "selecting an option does not save it" (§4). "Answered & Marked"
 * IS a committed, evaluable answer.
 */
function commitAndAdvance(
  get: () => TestState,
  set: (partial: Partial<TestState>) => void,
  questionId: string,
  totalQuestions: number,
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

  const qIds = Object.keys(state.questionStatuses);
  const nextIndex = Math.min(state.currentQuestionIndex + 1, totalQuestions - 1);
  const nextQId = qIds[nextIndex];

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
