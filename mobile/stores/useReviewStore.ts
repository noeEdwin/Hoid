import { create } from "zustand";
import { getDueCards, addPendingReview, getVocabularyState, updateVocabularyState } from "../lib/database";

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
}

interface ReviewState {
  queue: ReviewCard[];
  currentIndex: number;
  deckId: string | null;
  isComplete: boolean;
  showResult: boolean;
  lastResultCorrect: boolean;
  cardStartTime: number;

  loadQueue: (deckId: string) => void;
  submitAnswer: (isCorrect: boolean) => void;
  dismissResult: () => void;
  resetSession: () => void;
  getCurrentCard: () => ReviewCard | null;
  getProgress: () => { current: number; total: number };
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
  };
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  deckId: null,
  isComplete: false,
  showResult: false,
  lastResultCorrect: false,
  cardStartTime: Date.now(),

  loadQueue: (deckId: string) => {
    const items = getDueCards(deckId, 20);
    const cards = items.map((item) => mapLocalItem(item, deckId));
    set({
      queue: cards,
      currentIndex: 0,
      deckId,
      isComplete: cards.length === 0,
      showResult: false,
      cardStartTime: Date.now(),
    });
  },

  submitAnswer: (isCorrect: boolean) => {
    const { queue, currentIndex } = get();
    const card = queue[currentIndex];
    if (!card) return;

    const responseTimeMs = Date.now() - get().cardStartTime;

    addPendingReview(card.id, isCorrect, responseTimeMs);

    const state = getVocabularyState(card.id);
    if (state) {
      const newConsecutive = isCorrect ? 0 : (state.consecutiveFailures ?? 0) + 1;
      const newTotalFailures = isCorrect
        ? (state.totalFailures ?? 0)
        : (state.totalFailures ?? 0) + 1;

      updateVocabularyState(card.id, {
        totalReviews: (state.totalReviews ?? 0) + 1,
        totalFailures: newTotalFailures,
        consecutiveFailures: newConsecutive,
      });
    }

    set({
      showResult: true,
      lastResultCorrect: isCorrect,
    });
  },

  dismissResult: () => {
    const { currentIndex, queue } = get();
    const nextIndex = currentIndex + 1;
    set({
      currentIndex: nextIndex,
      showResult: false,
      isComplete: nextIndex >= queue.length,
      cardStartTime: Date.now(),
    });
  },

  resetSession: () => {
    const { deckId } = get();
    if (deckId) {
      get().loadQueue(deckId);
    }
  },

  getCurrentCard: () => {
    const { queue, currentIndex } = get();
    return queue[currentIndex] ?? null;
  },

  getProgress: () => {
    const { queue, currentIndex } = get();
    return { current: currentIndex, total: queue.length };
  },
}));
