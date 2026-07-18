import { create } from "zustand";
import { Paths, File, Directory } from "expo-file-system";
import { getDueCards, addPendingReview, getFlashcardsByDeck, getVocabularyState, updateVocabularyState } from "../lib/database";
import { useSettingsStore } from "./useSettingsStore";
import { getLocalDateKey } from "../lib/local-date";
import {
  calculateReviewOutcome,
  formatPracticeDelay,
  formatReviewInterval,
  practiceDelayMs,
  requiredCorrectChecks,
} from "../lib/srs";

const SESSION_DIR_NAME = "review-sessions";
const LEGACY_MAX_ATTEMPTS = 4;
const LEGACY_RETRY_GAP = 2;

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
  drillCorrectEntries?: [string, number][];
  failureCountEntries?: [string, number][];
  answeredCount: number;
  sessionStartTime: number;
  deckExhaustedToday: boolean;
  savedAt: number;
  savedDate?: string;
}

export type ReviewMode = "srs" | "practice";

function saveSessionToFile(deckId: string, state: {
  remaining: ReviewCard[];
  completed: ReviewCard[];
  failedCards: ReviewCard[];
  missedCardIds: Set<string>;
  attemptCount: Map<string, number>;
  drillCorrectCount: Map<string, number>;
  failureCount: Map<string, number>;
  answeredCount: number;
  sessionStartTime: number;
  deckExhaustedToday: boolean;
}): void {
  const data: SavedSession = {
    remaining: state.remaining,
    completed: state.completed,
    failedCards: state.failedCards,
    missedCardIds: Array.from(state.missedCardIds),
    attemptCountEntries: Array.from(state.attemptCount.entries()),
    drillCorrectEntries: Array.from(state.drillCorrectCount.entries()),
    failureCountEntries: Array.from(state.failureCount.entries()),
    answeredCount: state.answeredCount,
    sessionStartTime: state.sessionStartTime,
    deckExhaustedToday: state.deckExhaustedToday,
    savedAt: Date.now(),
    savedDate: getLocalDateKey(),
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
    const savedDate = data.savedDate ?? getLocalDateKey(new Date(data.savedAt));
    if (savedDate !== getLocalDateKey()) {
      file.delete();
      return null;
    }
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (data.savedAt < oneHourAgo) {
      file.delete();
      return null;
    }
    return {
      ...data,
      remaining: data.remaining.map(normalizeLegacyCard),
      completed: data.completed.map(normalizeLegacyCard),
      failedCards: data.failedCards.map(normalizeLegacyCard),
    };
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
  nextReviewAt?: string | null;
  retryDueAt?: number;
}

function normalizeLegacyCard(card: ReviewCard): ReviewCard {
  if (card.answer !== "又...又..." && card.answerPinyin !== "yòu...yòu...") {
    return card;
  }
  return { ...card, answer: "又", answerPinyin: "yòu", audioPath: null };
}

interface ReviewState {
  remaining: ReviewCard[];
  completed: ReviewCard[];
  failedCards: ReviewCard[];
  missedCardIds: Set<string>;
  attemptCount: Map<string, number>;
  drillCorrectCount: Map<string, number>;
  failureCount: Map<string, number>;
  deckId: string | null;
  isComplete: boolean;
  showResult: boolean;
  lastResultCorrect: boolean;
  cardStartTime: number;
  sessionStartTime: number;
  answeredCount: number;
  deckExhaustedToday: boolean;
  resultMessage: string;
  resultSchedule: string;
  reviewMode: ReviewMode;

  loadQueue: (deckId: string, mode?: ReviewMode) => void;
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
  return normalizeLegacyCard({
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
    nextReviewAt: item.nextReviewAt ?? null,
  });
}

function mapPracticeItem(item: any, deckId: string): ReviewCard {
  const state = getVocabularyState(item.id);
  return mapLocalItem({
    ...item,
    srsInterval: state?.srsInterval ?? item.srsInterval,
    easeFactor: state?.easeFactor ?? item.easeFactor,
    difficultyScore: state?.difficultyScore ?? item.difficultyScore,
    totalReviews: state?.totalReviews ?? item.totalReviews,
    totalFailures: state?.totalFailures ?? item.totalFailures,
    consecutiveFailures: state?.consecutiveFailures ?? item.consecutiveFailures,
    consecutiveCorrect: state?.consecutiveCorrect ?? item.consecutiveCorrect,
    nextReviewAt: state?.nextReviewAt ?? item.nextReviewAt,
  }, deckId);
}

function prioritizeQueue(cards: ReviewCard[], now: number = Date.now()): ReviewCard[] {
  if (cards.length < 2) return cards;
  let nextIndex = cards.findIndex((card) => !card.retryDueAt || card.retryDueAt <= now);
  if (nextIndex === -1) {
    nextIndex = cards.reduce(
      (earliest, card, index) => (card.retryDueAt ?? Infinity) < (cards[earliest].retryDueAt ?? Infinity) ? index : earliest,
      0,
    );
  }
  if (nextIndex === 0) return cards;
  return [cards[nextIndex], ...cards.slice(0, nextIndex), ...cards.slice(nextIndex + 1)];
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
  drillCorrectCount: new Map(),
  failureCount: new Map(),
  deckId: null,
  isComplete: false,
  showResult: false,
  lastResultCorrect: false,
  cardStartTime: Date.now(),
  sessionStartTime: Date.now(),
  answeredCount: 0,
  deckExhaustedToday: false,
  resultMessage: "",
  resultSchedule: "",
  reviewMode: "srs",

  loadQueue: (deckId: string, mode: ReviewMode = "srs") => {
    const now = Date.now();
    const saved = mode === "srs" ? loadSessionFromFile(deckId) : null;
    if (saved && (saved.remaining.length > 0 || saved.completed.length > 0)) {
      set({
        remaining: saved.remaining,
        completed: saved.completed,
        failedCards: saved.failedCards,
        missedCardIds: new Set(saved.missedCardIds ?? []),
        attemptCount: new Map(saved.attemptCountEntries),
        drillCorrectCount: new Map(saved.drillCorrectEntries ?? []),
        failureCount: new Map(saved.failureCountEntries ?? []),
        deckId,
        isComplete: saved.remaining.length === 0,
        showResult: false,
        cardStartTime: now,
        sessionStartTime: saved.sessionStartTime ?? saved.savedAt,
        answeredCount: saved.answeredCount ?? 0,
        deckExhaustedToday: saved.deckExhaustedToday ?? false,
        resultMessage: "",
        resultSchedule: "",
        reviewMode: mode,
      });
      return;
    }

    if (mode === "practice") {
      const cards = weightedShuffle(getFlashcardsByDeck(deckId).map((item) => mapPracticeItem(item, deckId)));
      set({
        remaining: cards,
        completed: [],
        failedCards: [],
        missedCardIds: new Set(),
        attemptCount: new Map(),
        drillCorrectCount: new Map(),
        failureCount: new Map(),
        deckId,
        isComplete: cards.length === 0,
        showResult: false,
        cardStartTime: now,
        sessionStartTime: now,
        answeredCount: 0,
        deckExhaustedToday: true,
        resultMessage: "",
        resultSchedule: "",
        reviewMode: mode,
      });
      return;
    }

    const settings = useSettingsStore.getState();
    const limit = settings.getRemainingDailyReviews(deckId);
    const reviewedCardIds = settings.getDeckReviewedCardIdsToday(deckId);

    if (limit <= 0) {
      set({
        remaining: [],
        completed: [],
        failedCards: [],
        missedCardIds: new Set(),
        attemptCount: new Map(),
        drillCorrectCount: new Map(),
        failureCount: new Map(),
        deckId,
        isComplete: true,
        showResult: false,
        cardStartTime: now,
        sessionStartTime: now,
        answeredCount: 0,
        deckExhaustedToday: false,
        resultMessage: "",
        resultSchedule: "",
        reviewMode: mode,
      });
      return;
    }

    const items = getDueCards(deckId, limit + 1, reviewedCardIds);
    const cards = items.slice(0, limit).map((item) => mapLocalItem(item, deckId));
    const shuffled = weightedShuffle(cards);

    set({
      remaining: shuffled,
      completed: [],
      failedCards: [],
      missedCardIds: new Set(),
      attemptCount: new Map(),
      drillCorrectCount: new Map(),
      failureCount: new Map(),
      deckId,
      isComplete: shuffled.length === 0,
      showResult: false,
      cardStartTime: now,
      sessionStartTime: now,
      answeredCount: 0,
      deckExhaustedToday: items.length <= limit,
      resultMessage: "",
      resultSchedule: "",
      reviewMode: mode,
    });
  },

  injectCard: (card: ReviewCard) => {
    const { remaining } = get();
    if (remaining.some((c) => c.id === card.id)) return;
    set({ remaining: [...remaining, card], isComplete: false });
  },

  submitAnswer: (isCorrect: boolean) => {
    const { remaining, attemptCount, drillCorrectCount, failureCount, missedCardIds, reviewMode } = get();
    const card = remaining[0];
    if (!card) return;

    const responseTimeMs = Date.now() - get().cardStartTime;

    const state = getVocabularyState(card.id);
    const currentAttempts = attemptCount.get(card.id) ?? 0;
    const drillMode = useSettingsStore.getState().drillMode;

    if (reviewMode === "practice") {
      const practiceState = state ?? card;
      const failures = (failureCount.get(card.id) ?? 0) + (isCorrect ? 0 : 1);
      const newMissed = new Set(missedCardIds);
      if (!isCorrect) newMissed.add(card.id);

      const correctStreak = isCorrect ? (drillCorrectCount.get(card.id) ?? 0) + 1 : 0;
      const newDrillCorrectCount = new Map(drillCorrectCount);
      newDrillCorrectCount.set(card.id, correctStreak);
      const newFailureCount = new Map(failureCount);
      newFailureCount.set(card.id, failures);
      const requiredChecks = requiredCorrectChecks(
        practiceState.srsInterval ?? 0,
        practiceState.consecutiveCorrect ?? 0,
        failures,
      );

      if (isCorrect && correctStreak >= requiredChecks) {
        const newAttemptCount = new Map(attemptCount);
        newAttemptCount.delete(card.id);
        newFailureCount.delete(card.id);
        newDrillCorrectCount.delete(card.id);
        set((s) => ({
          remaining: s.remaining.slice(1),
          completed: [...s.completed, { ...card, retryDueAt: undefined }],
          missedCardIds: newMissed,
          attemptCount: newAttemptCount,
          drillCorrectCount: newDrillCorrectCount,
          failureCount: newFailureCount,
          showResult: true,
          lastResultCorrect: true,
          answeredCount: s.answeredCount + 1,
          resultMessage: failures > 0 ? "Practice recovered" : "Practice complete",
          resultSchedule: "Practice only - no schedule changes",
        }));
      } else {
        const newAttempts = currentAttempts + 1;
        const newAttemptCount = new Map(attemptCount);
        newAttemptCount.set(card.id, newAttempts);
        const delay = practiceDelayMs(newAttempts);
        const rest = remaining.slice(1);
        const hasOtherCard = rest.some((queuedCard) => !queuedCard.retryDueAt || queuedCard.retryDueAt <= Date.now());
        const updatedCard = { ...card, retryDueAt: Date.now() + delay };
        const checksRemaining = requiredChecks - correctStreak;
        set((s) => ({
          remaining: prioritizeQueue([...rest, updatedCard]),
          missedCardIds: newMissed,
          attemptCount: newAttemptCount,
          drillCorrectCount: newDrillCorrectCount,
          failureCount: newFailureCount,
          showResult: true,
          lastResultCorrect: isCorrect,
          answeredCount: s.answeredCount + 1,
          resultMessage: `${checksRemaining} correct check${checksRemaining === 1 ? "" : "s"} remaining`,
          resultSchedule: hasOtherCard
            ? `Next check in ${formatPracticeDelay(delay)}`
            : `Review again now (preferred spacing: ${formatPracticeDelay(delay)})`,
        }));
      }
      return;
    }

    if (!drillMode) {
      addPendingReview(card.id, isCorrect, responseTimeMs);
      let reviewedCard = card;
      if (state) {
        const outcome = calculateReviewOutcome({
          currentInterval: state.srsInterval ?? 0,
          failureCount: isCorrect ? 0 : 1,
          responseTimeMs,
          consecutiveCorrect: state.consecutiveCorrect ?? 0,
          difficultyScore: state.difficultyScore ?? 0,
        });
        const reviewedAt = new Date().toISOString();
        const nextReviewAt = new Date(Date.now() + outcome.intervalDays * 86_400_000).toISOString();
        updateVocabularyState(card.id, {
          totalReviews: (state.totalReviews ?? 0) + 1,
          totalFailures: (state.totalFailures ?? 0) + (isCorrect ? 0 : 1),
          consecutiveFailures: isCorrect ? 0 : (state.consecutiveFailures ?? 0) + 1,
          consecutiveCorrect: outcome.consecutiveCorrect,
          difficultyScore: outcome.difficultyScore,
          easeFactor: isCorrect
            ? Math.min(3, (state.easeFactor ?? 2.5) + 0.05)
            : Math.max(1.3, (state.easeFactor ?? 2.5) - 0.2),
          srsInterval: outcome.intervalDays,
          lastReviewedAt: reviewedAt,
          nextReviewAt,
        });
        reviewedCard = { ...card, srsInterval: outcome.intervalDays, nextReviewAt };
      }

      const newMissed = new Set(missedCardIds);
      if (!isCorrect) newMissed.add(card.id);
      if (isCorrect) {
        const newAttemptCount = new Map(attemptCount);
        newAttemptCount.delete(card.id);
        set((s) => ({
          remaining: s.remaining.slice(1),
          completed: [...s.completed, reviewedCard],
          missedCardIds: newMissed,
          attemptCount: newAttemptCount,
          showResult: true,
          lastResultCorrect: true,
          answeredCount: s.answeredCount + 1,
          resultMessage: "Review complete",
          resultSchedule: `Next review in ${formatReviewInterval(reviewedCard.srsInterval)}`,
        }));
      } else {
        const newAttempts = currentAttempts + 1;
        const newAttemptCount = new Map(attemptCount);
        newAttemptCount.set(card.id, newAttempts);
        if (newAttempts >= LEGACY_MAX_ATTEMPTS) {
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
          const retryIndex = Math.min(LEGACY_RETRY_GAP, rest.length);
          set((s) => ({
            remaining: [...rest.slice(0, retryIndex), card, ...rest.slice(retryIndex)],
            missedCardIds: newMissed,
            attemptCount: newAttemptCount,
            showResult: true,
            lastResultCorrect: false,
            answeredCount: s.answeredCount + 1,
          }));
        }
      }
      return;
    }

    if (!state) return;

    const failures = (failureCount.get(card.id) ?? 0) + (isCorrect ? 0 : 1);
    const newMissed = new Set(missedCardIds);

    if (!isCorrect) {
      newMissed.add(card.id);
    }

    const correctStreak = isCorrect ? (drillCorrectCount.get(card.id) ?? 0) + 1 : 0;
    const newDrillCorrectCount = new Map(drillCorrectCount);
    newDrillCorrectCount.set(card.id, correctStreak);
    const newFailureCount = new Map(failureCount);
    newFailureCount.set(card.id, failures);
    const requiredChecks = requiredCorrectChecks(
      state.srsInterval ?? 0,
      state.consecutiveCorrect ?? 0,
      failures,
    );

    if (isCorrect && correctStreak >= requiredChecks) {
      const outcome = calculateReviewOutcome({
        currentInterval: state.srsInterval ?? 0,
        failureCount: failures,
        responseTimeMs,
        consecutiveCorrect: state.consecutiveCorrect ?? 0,
        difficultyScore: state.difficultyScore ?? 0,
      });
      const reviewedAt = new Date().toISOString();
      const nextReviewAt = new Date(Date.now() + outcome.intervalDays * 86_400_000).toISOString();
      addPendingReview(card.id, failures === 0, responseTimeMs, failures);
      updateVocabularyState(card.id, {
        totalReviews: (state.totalReviews ?? 0) + 1,
        totalFailures: (state.totalFailures ?? 0) + failures,
        consecutiveFailures: outcome.consecutiveFailures,
        consecutiveCorrect: outcome.consecutiveCorrect,
        difficultyScore: outcome.difficultyScore,
        easeFactor: failures === 0
          ? Math.min(3, (state.easeFactor ?? 2.5) + 0.05)
          : Math.max(1.3, (state.easeFactor ?? 2.5) - 0.2),
        srsInterval: outcome.intervalDays,
        lastReviewedAt: reviewedAt,
        nextReviewAt,
      });
      const newAttemptCount = new Map(attemptCount);
      newAttemptCount.delete(card.id);
      newFailureCount.delete(card.id);
      newDrillCorrectCount.delete(card.id);
      const completedCard = { ...card, srsInterval: outcome.intervalDays, nextReviewAt, retryDueAt: undefined };

      set((s) => ({
        remaining: s.remaining.slice(1),
        completed: [...s.completed, completedCard],
        missedCardIds: newMissed,
        attemptCount: newAttemptCount,
        drillCorrectCount: newDrillCorrectCount,
        failureCount: newFailureCount,
        showResult: true,
        lastResultCorrect: true,
        answeredCount: s.answeredCount + 1,
        resultMessage: failures > 0 ? "Relearning complete" : "Review complete",
        resultSchedule: `Next review in ${formatReviewInterval(outcome.intervalDays)}`,
      }));
    } else {
      const newAttempts = currentAttempts + 1;
      const newAttemptCount = new Map(attemptCount);
      newAttemptCount.set(card.id, newAttempts);
      const delay = practiceDelayMs(newAttempts);
      const rest = remaining.slice(1);
      const hasOtherCard = rest.some((queuedCard) => !queuedCard.retryDueAt || queuedCard.retryDueAt <= Date.now());
      const updatedCard = { ...card, retryDueAt: Date.now() + delay };
      const checksRemaining = requiredChecks - correctStreak;
      set((s) => ({
        remaining: prioritizeQueue([...rest, updatedCard]),
        missedCardIds: newMissed,
        attemptCount: newAttemptCount,
        drillCorrectCount: newDrillCorrectCount,
        failureCount: newFailureCount,
        showResult: true,
        lastResultCorrect: isCorrect,
        answeredCount: s.answeredCount + 1,
        resultMessage: `${checksRemaining} correct check${checksRemaining === 1 ? "" : "s"} remaining`,
        resultSchedule: hasOtherCard
          ? `Next check in ${formatPracticeDelay(delay)}`
          : `Review again now (preferred spacing: ${formatPracticeDelay(delay)})`,
      }));
    }
  },

  dismissResult: () => {
    const { remaining, deckId, completed, failedCards, missedCardIds, attemptCount, drillCorrectCount, failureCount, answeredCount, sessionStartTime, deckExhaustedToday, reviewMode } = get();
    set({
      showResult: false,
      isComplete: remaining.length === 0,
      cardStartTime: Date.now(),
    });
    if (reviewMode === "srs" && deckId && remaining.length > 0) {
      saveSessionToFile(deckId, { remaining, completed, failedCards, missedCardIds, attemptCount, drillCorrectCount, failureCount, answeredCount, sessionStartTime, deckExhaustedToday });
    }
  },

  resetSession: () => {
    const { deckId, reviewMode } = get();
    if (deckId) {
      deleteSessionFile(deckId);
      get().loadQueue(deckId, reviewMode);
    }
  },

  saveSession: () => {
    const { deckId, remaining, completed, failedCards, missedCardIds, attemptCount, drillCorrectCount, failureCount, answeredCount, sessionStartTime, deckExhaustedToday, reviewMode } = get();
    if (reviewMode === "srs" && deckId && remaining.length > 0) {
      saveSessionToFile(deckId, { remaining, completed, failedCards, missedCardIds, attemptCount, drillCorrectCount, failureCount, answeredCount, sessionStartTime, deckExhaustedToday });
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
