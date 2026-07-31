"use client";

import { create } from "zustand";

export type QuestionStatus = "not_visited" | "not_answered" | "answered" | "marked" | "answered_marked";

interface TestState {
  examId: string | null;
  attemptId: string | null;
  currentSectionIndex: number;
  currentQuestionIndex: number;
  userResponses: Record<string, "A" | "B" | "C" | "D" | null>;
  questionStatuses: Record<string, QuestionStatus>;
  timePerQuestion: Record<string, number>; // questionId -> total seconds
  answerChanges: Record<string, number>; // questionId -> count of changes
  initialOptions: Record<string, "A" | "B" | "C" | "D" | null>;
  timeRemaining: number; // in seconds
  isSubmitted: boolean;
  submittedAt: string | null;
  startTime: number | null;
  lastQuestionEnteredAt: number | null;
  zoomedImage: string | null;
  isFullscreen: boolean;

  // Actions
  initTest: (examId: string, attemptId: string | null, questionIds: string[], timeLimitMinutes: number) => void;
  setSectionIndex: (index: number) => void;
  setQuestionIndex: (index: number) => void;
  selectOption: (questionId: string, optionId: "A" | "B" | "C" | "D") => void;
  clearResponse: (questionId: string) => void;
  saveAndNext: (questionId: string, totalQuestions: number) => void;
  markForReviewAndNext: (questionId: string, totalQuestions: number) => void;
  tickTimer: () => void;
  submitTest: () => Promise<void>;
  resetTest: () => void;
  setZoomedImage: (imageUrl: string | null) => void;
  toggleFullscreen: () => void;
}

const LOCAL_STORAGE_KEY = "lastmileprep_active_test_v2";

export const useTestStore = create<TestState>((set, get) => ({
  examId: null,
  attemptId: null,
  currentSectionIndex: 0,
  currentQuestionIndex: 0,
  userResponses: {},
  questionStatuses: {},
  timePerQuestion: {},
  answerChanges: {},
  initialOptions: {},
  timeRemaining: 3600,
  isSubmitted: false,
  submittedAt: null,
  startTime: null,
  lastQuestionEnteredAt: null,
  zoomedImage: null,
  isFullscreen: false,

  initTest: (examId: string, attemptId: string | null, questionIds: string[], timeLimitMinutes: number) => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.examId === examId && !parsed.isSubmitted) {
            set({
              ...parsed,
              lastQuestionEnteredAt: Date.now(),
            });
            return;
          }
        }
      } catch (e) {
        console.error("Error reading saved test state", e);
      }
    }

    const initialResponses: Record<string, "A" | "B" | "C" | "D" | null> = {};
    const initialStatuses: Record<string, QuestionStatus> = {};
    const initialTime: Record<string, number> = {};
    const initialChanges: Record<string, number> = {};
    const initialOpts: Record<string, "A" | "B" | "C" | "D" | null> = {};

    questionIds.forEach((id, idx) => {
      initialResponses[id] = null;
      initialStatuses[id] = idx === 0 ? "not_answered" : "not_visited";
      initialTime[id] = 0;
      initialChanges[id] = 0;
      initialOpts[id] = null;
    });

    const newState = {
      examId,
      attemptId: attemptId || examId,
      currentSectionIndex: 0,
      currentQuestionIndex: 0,
      userResponses: initialResponses,
      questionStatuses: initialStatuses,
      timePerQuestion: initialTime,
      answerChanges: initialChanges,
      initialOptions: initialOpts,
      timeRemaining: timeLimitMinutes * 60,
      isSubmitted: false,
      submittedAt: null,
      startTime: Date.now(),
      lastQuestionEnteredAt: Date.now(),
      zoomedImage: null,
      isFullscreen: false,
    };

    set(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
    }
  },

  setSectionIndex: (index: number) => {
    set({ currentSectionIndex: index });
  },

  setQuestionIndex: (index: number) => {
    const state = get();
    const now = Date.now();
    const qIds = Object.keys(state.questionStatuses);
    const currentQId = qIds[state.currentQuestionIndex];
    const targetQId = qIds[index];

    const updatedTime = { ...state.timePerQuestion };
    if (currentQId && state.lastQuestionEnteredAt) {
      const elapsedSec = Math.round((now - state.lastQuestionEnteredAt) / 1000);
      updatedTime[currentQId] = (updatedTime[currentQId] || 0) + Math.max(0, elapsedSec);
    }

    const updatedStatuses = { ...state.questionStatuses };
    if (targetQId && updatedStatuses[targetQId] === "not_visited") {
      updatedStatuses[targetQId] = "not_answered";
    }

    const newState = {
      ...state,
      currentQuestionIndex: index,
      questionStatuses: updatedStatuses,
      timePerQuestion: updatedTime,
      lastQuestionEnteredAt: now,
    };

    set(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
    }

    if (state.attemptId && currentQId) {
      syncAnswerToApi(state.attemptId, currentQId, state.userResponses[currentQId], updatedStatuses[currentQId], updatedTime[currentQId]);
    }
  },

  selectOption: (questionId: string, optionId: "A" | "B" | "C" | "D") => {
    const state = get();
    const prevOption = state.userResponses[questionId];
    const changeCount = prevOption !== null && prevOption !== optionId
      ? (state.answerChanges[questionId] || 0) + 1
      : (state.answerChanges[questionId] || 0);

    const initialOpt = state.initialOptions[questionId] || optionId;

    const newResponses = { ...state.userResponses, [questionId]: optionId };
    const newChanges = { ...state.answerChanges, [questionId]: changeCount };
    const newInitial = { ...state.initialOptions, [questionId]: initialOpt };

    set({
      userResponses: newResponses,
      answerChanges: newChanges,
      initialOptions: newInitial,
    });
  },

  clearResponse: (questionId: string) => {
    const state = get();
    const currentStatus = state.questionStatuses[questionId];
    let newStatus: QuestionStatus = "not_answered";
    if (currentStatus === "marked" || currentStatus === "answered_marked") {
      newStatus = "marked";
    }

    const newResponses = { ...state.userResponses, [questionId]: null };
    const newStatuses = { ...state.questionStatuses, [questionId]: newStatus };

    const newState = {
      ...state,
      userResponses: newResponses,
      questionStatuses: newStatuses,
    };

    set(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
    }

    if (state.attemptId) {
      syncAnswerToApi(state.attemptId, questionId, null, newStatus, state.timePerQuestion[questionId] || 0);
    }
  },

  saveAndNext: (questionId: string, totalQuestions: number) => {
    const state = get();
    const now = Date.now();
    const currentSelected = state.userResponses[questionId];
    const newStatus: QuestionStatus = currentSelected ? "answered" : "not_answered";

    const nextIndex = Math.min(state.currentQuestionIndex + 1, totalQuestions - 1);
    const qIds = Object.keys(state.questionStatuses);
    const nextQId = qIds[nextIndex];

    const elapsedSec = state.lastQuestionEnteredAt ? Math.round((now - state.lastQuestionEnteredAt) / 1000) : 0;
    const updatedTime = {
      ...state.timePerQuestion,
      [questionId]: (state.timePerQuestion[questionId] || 0) + Math.max(0, elapsedSec),
    };

    const updatedStatuses = {
      ...state.questionStatuses,
      [questionId]: newStatus,
    };

    if (nextQId && updatedStatuses[nextQId] === "not_visited") {
      updatedStatuses[nextQId] = "not_answered";
    }

    const newState = {
      ...state,
      questionStatuses: updatedStatuses,
      timePerQuestion: updatedTime,
      currentQuestionIndex: nextIndex,
      lastQuestionEnteredAt: now,
    };

    set(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
    }

    if (state.attemptId) {
      syncAnswerToApi(state.attemptId, questionId, currentSelected, newStatus, updatedTime[questionId]);
    }
  },

  markForReviewAndNext: (questionId: string, totalQuestions: number) => {
    const state = get();
    const now = Date.now();
    const currentSelected = state.userResponses[questionId];
    const newStatus: QuestionStatus = currentSelected ? "answered_marked" : "marked";

    const nextIndex = Math.min(state.currentQuestionIndex + 1, totalQuestions - 1);
    const qIds = Object.keys(state.questionStatuses);
    const nextQId = qIds[nextIndex];

    const elapsedSec = state.lastQuestionEnteredAt ? Math.round((now - state.lastQuestionEnteredAt) / 1000) : 0;
    const updatedTime = {
      ...state.timePerQuestion,
      [questionId]: (state.timePerQuestion[questionId] || 0) + Math.max(0, elapsedSec),
    };

    const updatedStatuses = {
      ...state.questionStatuses,
      [questionId]: newStatus,
    };

    if (nextQId && updatedStatuses[nextQId] === "not_visited") {
      updatedStatuses[nextQId] = "not_answered";
    }

    const newState = {
      ...state,
      questionStatuses: updatedStatuses,
      timePerQuestion: updatedTime,
      currentQuestionIndex: nextIndex,
      lastQuestionEnteredAt: now,
    };

    set(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
    }

    if (state.attemptId) {
      syncAnswerToApi(state.attemptId, questionId, currentSelected, newStatus, updatedTime[questionId]);
    }
  },

  tickTimer: () => {
    const state = get();
    if (state.isSubmitted || state.timeRemaining <= 0) return;
    const newTime = state.timeRemaining - 1;
    
    const qIds = Object.keys(state.questionStatuses);
    const currentQId = qIds[state.currentQuestionIndex];
    let updatedTime = state.timePerQuestion;
    if (currentQId) {
      updatedTime = {
        ...state.timePerQuestion,
        [currentQId]: (state.timePerQuestion[currentQId] || 0) + 1,
      };
    }

    if (newTime <= 0) {
      get().submitTest();
    } else {
      set({ timeRemaining: newTime, timePerQuestion: updatedTime });
    }
  },

  submitTest: async () => {
    const state = get();
    const newState = {
      ...state,
      isSubmitted: true,
      submittedAt: new Date().toISOString(),
    };
    set(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
    }

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
      questionStatuses: {},
      timePerQuestion: {},
      answerChanges: {},
      initialOptions: {},
      timeRemaining: 3600,
      isSubmitted: false,
      submittedAt: null,
      startTime: null,
      lastQuestionEnteredAt: null,
      zoomedImage: null,
      isFullscreen: false,
    });
    if (typeof window !== "undefined") {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  },

  setZoomedImage: (imageUrl: string | null) => {
    set({ zoomedImage: imageUrl });
  },

  toggleFullscreen: () => {
    if (typeof window !== "undefined") {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        set({ isFullscreen: true });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        set({ isFullscreen: false });
      }
    }
  },
}));

async function syncAnswerToApi(
  attemptId: string,
  questionId: string,
  selectedOption: "A" | "B" | "C" | "D" | null,
  status: QuestionStatus,
  timeSpentSeconds: number
) {
  try {
    await fetch(`/api/cbt/exams/${attemptId}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: questionId,
        selected_option: selectedOption,
        is_marked_for_review: status === "marked" || status === "answered_marked",
        is_visited: status !== "not_visited",
        time_spent_seconds: timeSpentSeconds,
      }),
    });
  } catch (e) {
    console.error("Auto-save sync error", e);
  }
}
