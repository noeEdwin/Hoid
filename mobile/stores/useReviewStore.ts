import { create } from "zustand";
import { Paths, File, Directory } from "expo-file-system";
import { getDueCards, addPendingReview, getVocabularyState, updateVocabularyState } from "../lib/database";
import { useSettingsStore } from "./useSettingsStore";

const MAX_ATTEMPTS_PER_CARD = 3;
const SESSION_DIR_NAME = "review-sessions";

function getSessionDir(): Directory {
  const dir = new Directory(Paths.document, SESSION_DIR_NAME);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

function getSessionFile(deckId: string): File {
  return new File(getSessionDir(), `${deckId}.json`);
}

interface SavedSession {
  remaining: ReviewCard[];
  completed: ReviewCard[];
  failedCards: ReviewCard[];
  missedCardIds: string[];
  attemptCountEntries: [string, number][];
  answeredCount: number;
  sessionStartTime: number;
  savedAt: number;
}

function saveSessionToFile(deckId: string, state: {
  remaining: ReviewCard[];
  completed: ReviewCard[];
  failedCards: ReviewCard[];
  missedCardIds: Set<string>;
  attemptCount: Map<string, number>;
  answeredCount: number;
  sessionStartTime: number;
}): void {
  const data: SavedSession = {
    remaining: state.remaining,
    completed: state.completed,
    failedCards: state.failedCards,
    missedCardIds: Array.from(state.missedCardIds),
    attemptCountEntries: Array.from(state.attemptCount.entries()),
    answeredCount: state.answeredCount,
    sessionStartTime: state.sessionStartTime,
    savedAt: Date.now(),
  };
  const file = getSessionFile(deckId);
  file.write(JSON.stringify(data));
}

function loadSessionFromFile(deckId: string): SavedSession | null {
  try {
    const file = getSessionFile(deckId);
    if (!file.exists) return null;
    const content = file.textSync();
    const data = JSON.parse(content) as SavedSession;
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (data.savedAt < oneHourAgo) {
      file.delete();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function deleteSessionFile(deckId: string): void {
  try {
    const file = getSessionFile(deckId);
    if (file.exists) {
      file.delete();
    }
  } catch {}
}

export interface ReviewCard {
  id: string;
  deckId: string;
  cardType: string;
  sentence: string;
  sentencePinyin: string;
  answer: string;
  answerPinyin: string;
  context: string | null;
  contextPinyin: string | null;
  imagePath: string | null;
  audioPath: string | null;
  srsInterval: number;
  easeFactor: number;
  difficultyScore: number;
  totalReviews: number;
  totalFailures: number;
  consecutiveFailures: number;
  consecutiveCorrect: number;
}

interface ReviewState {
  remaining: ReviewCard[];
  completed: ReviewCard[];
  failedCards: ReviewCard[];
  missedCardIds: Set<string>;
  attemptCount: Map<string, number>;
  deckId: string | null;
  isComplete: boolean;
  showResult: boolean;
  lastResultCorrect: boolean;
  cardStartTime: number;
  sessionStartTime: number;
  answeredCount: number;

  loadQueue: (deckId: string) => void;
  injectCard: (card: ReviewCard) => void;
  submitAnswer: (isCorrect: boolean) => void;
  dismissResult: () => void;
  resetSession: () => void;
  saveSession: () => void;
  clearSession: (deckId: string) => void;
  getCurrentCard: () => ReviewCard | null;
  getProgress: () => {
    current: number;
    total: number;
    completedCount: number;
    failedCount: number;
    missedCount: number;
    accuracy: number;
    elapsedSeconds: number;
  };
}

function mapLocalItem(item: any, deckId: string): ReviewCard {
  return {
    id: item.id,
    deckId,
    cardType: item.cardType ?? "cloze_deletion",
    sentence: item.sentence ?? "",
    sentencePinyin: item.sentencePinyin ?? "",
    answer: item.answer ?? "",
    answerPinyin: item.answerPinyin ?? "",
    context: item.context ?? null,
    contextPinyin: item.contextPinyin ?? null,
    imagePath: item.imagePath ?? null,
    audioPath: item.audioPath ?? null,
    srsInterval: item.srsInterval ?? 0,
    easeFactor: item.easeFactor ?? 2.5,
    difficultyScore: item.difficultyScore ?? 0,
    totalReviews: item.totalReviews ?? 0,
    totalFailures: item.totalFailures ?? 0,
    consecutiveFailures: item.consecutiveFailures ?? 0,
    consecutiveCorrect: item.consecutiveCorrect ?? 0,
  };
}

function weightedShuffle(cards: ReviewCard[]): ReviewCard[] {
  const maxDifficulty = Math.max(...cards.map((c) => c.difficultyScore), 1);

  const weighted = cards.map((card) => ({
    card,
    weight: Math.random() * (0.3 + 0.7 * (card.difficultyScore / maxDifficulty)),
  }));

  weighted.sort((a, b) => b.weight - a.weight);

  return weighted.map((w) => w.card);
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  remaining: [],
  completed: [],
  failedCards: [],
  missedCardIds: new Set(),
  attemptCount: new Map(),
  deckId: null,
  isComplete: false,
  showResult: false,
  lastResultCorrect: false,
  cardStartTime: Date.now(),
  sessionStartTime: Date.now(),
  answeredCount: 0,

  loadQueue: (deckId: string) => {
    const now = Date.now();
    const saved = loadSessionFromFile(deckId);
    if (saved && (saved.remaining.length > 0 || saved.completed.length > 0)) {
      set({
        remaining: saved.remaining,
        completed: saved.completed,
        failedCards: saved.failedCards,
        missedCardIds: new Set(saved.missedCardIds ?? []),
        attemptCount: new Map(saved.attemptCountEntries),
        deckId,
        isComplete: saved.remaining.length === 0,
        showResult: false,
        cardStartTime: now,
        sessionStartTime: saved.sessionStartTime ?? saved.savedAt,
        answeredCount: saved.answeredCount ?? 0,
      });
      return;
    }

    const limit = useSettingsStore.getState().dailyReviewLimit;
    const items = getDueCards(deckId, limit);
    const cards = items.map((item) => mapLocalItem(item, deckId));
    const shuffled = weightedShuffle(cards);

    set({
      remaining: shuffled,
      completed: [],
      failedCards: [],
      missedCardIds: new Set(),
      attemptCount: new Map(),
      deckId,
      isComplete: shuffled.length === 0,
      showResult: false,
      cardStartTime: now,
      sessionStartTime: now,
      answeredCount: 0,
    });
  },

  injectCard: (card: ReviewCard) => {
    const { remaining } = get();
    if (remaining.some((c) => c.id === card.id)) return;
    set({ remaining: [...remaining, card], isComplete: false });
  },

  submitAnswer: (isCorrect: boolean) => {
    const { remaining, attemptCount, missedCardIds } = get();
    const card = remaining[0];
    if (!card) return;

    const responseTimeMs = Date.now() - get().cardStartTime;

    addPendingReview(card.id, isCorrect, responseTimeMs);

    const state = getVocabularyState(card.id);
    if (state) {
      const newConsecutive = isCorrect ? 0 : (state.consecutiveFailures ?? 0) + 1;
      const newTotalFailures = isCorrect
        ? (state.totalFailures ?? 0)
        : (state.totalFailures ?? 0) + 1;
      const newConsecutiveCorrect = isCorrect
        ? (state.consecutiveCorrect ?? 0) + 1
        : 0;

      updateVocabularyState(card.id, {
        totalReviews: (state.totalReviews ?? 0) + 1,
        totalFailures: newTotalFailures,
        consecutiveFailures: newConsecutive,
        consecutiveCorrect: newConsecutiveCorrect,
      });
    }

    const currentAttempts = attemptCount.get(card.id) ?? 0;
    const newMissed = new Set(missedCardIds);

    if (!isCorrect) {
      newMissed.add(card.id);
    }

    if (isCorrect) {
      const newAttemptCount = new Map(attemptCount);
      newAttemptCount.delete(card.id);

      set((s) => ({
        remaining: s.remaining.slice(1),
        completed: [...s.completed, card],
        missedCardIds: newMissed,
        attemptCount: newAttemptCount,
        showResult: true,
        lastResultCorrect: true,
        answeredCount: s.answeredCount + 1,
      }));
    } else {
      const newAttempts = currentAttempts + 1;
      const newAttemptCount = new Map(attemptCount);
      newAttemptCount.set(card.id, newAttempts);

      if (newAttempts >= MAX_ATTEMPTS_PER_CARD) {
        set((s) => ({
          remaining: s.remaining.slice(1),
          failedCards: [...s.failedCards, card],
          missedCardIds: newMissed,
          attemptCount: newAttemptCount,
          showResult: true,
          lastResultCorrect: false,
          answeredCount: s.answeredCount + 1,
        }));
      } else {
        const rest = remaining.slice(1);
        const updatedCard = { ...card };
        set((s) => ({
          remaining: [...rest, updatedCard],
          missedCardIds: newMissed,
          attemptCount: newAttemptCount,
          showResult: true,
          lastResultCorrect: false,
          answeredCount: s.answeredCount + 1,
        }));
      }
    }
  },

  dismissResult: () => {
    const { remaining, deckId, completed, failedCards, missedCardIds, attemptCount, answeredCount, sessionStartTime } = get();
    set({
      showResult: false,
      isComplete: remaining.length === 0,
      cardStartTime: Date.now(),
    });
    if (deckId && remaining.length > 0) {
      saveSessionToFile(deckId, { remaining, completed, failedCards, missedCardIds, attemptCount, answeredCount, sessionStartTime });
    }
  },

  resetSession: () => {
    const { deckId } = get();
    if (deckId) {
      deleteSessionFile(deckId);
      get().loadQueue(deckId);
    }
  },

  saveSession: () => {
    const { deckId, remaining, completed, failedCards, missedCardIds, attemptCount, answeredCount, sessionStartTime } = get();
    if (deckId && remaining.length > 0) {
      saveSessionToFile(deckId, { remaining, completed, failedCards, missedCardIds, attemptCount, answeredCount, sessionStartTime });
    }
  },

  clearSession: (deckId: string) => {
    deleteSessionFile(deckId);
  },

  getCurrentCard: () => {
    const { remaining } = get();
    return remaining[0] ?? null;
  },

  getProgress: () => {
    const { completed, failedCards, missedCardIds, remaining, sessionStartTime, answeredCount } = get();
    const total = completed.length + failedCards.length + remaining.length;
    const current = answeredCount;
    const completedCount = completed.length;
    const failedCount = failedCards.length;
    const missedCount = missedCardIds.size;
    const accuracy = current > 0 ? Math.round((completedCount / current) * 100) : 0;
    const elapsedSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
    return { current, total, completedCount, failedCount, missedCount, accuracy, elapsedSeconds };
  },
}));
