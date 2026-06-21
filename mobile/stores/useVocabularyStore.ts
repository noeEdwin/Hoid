import { create } from "zustand";
import { getAllDecks, getTotalCardCount, getFlashcardCountByDeck } from "../lib/database";

export interface DeckItem {
  id: string;
  name: string;
  description: string | null;
  cardCount: number;
}

export interface FailingToken {
  id: string;
  sentence: string;
  answer: string;
  answerPinyin: string;
  difficultyScore: number;
  totalReviews: number;
  totalFailures: number;
}

interface VocabularyState {
  decks: DeckItem[];
  failingTokens: FailingToken[];
  totalCards: number;
  isLoading: boolean;

  loadDecks: () => void;
  loadLocalData: () => void;
}

export const useVocabularyStore = create<VocabularyState>((set) => ({
  decks: [],
  failingTokens: [],
  totalCards: 0,
  isLoading: false,

  loadDecks: () => {
    const localDecks = getAllDecks();
    set({
      decks: localDecks.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        cardCount: getFlashcardCountByDeck(d.id),
      })),
    });
  },

  loadLocalData: () => {
    const localDecks = getAllDecks();
    const total = getTotalCardCount();
    set({
      decks: localDecks.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        cardCount: getFlashcardCountByDeck(d.id),
      })),
      totalCards: total,
    });
  },
}));
