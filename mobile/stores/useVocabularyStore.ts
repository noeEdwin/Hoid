import { create } from "zustand";
import {
  getAllDecks,
  getTotalCardCount,
  getFlashcardCountByDeck,
  getFailingTokens,
  deleteDeck as deleteDeckFromDB,
  updateDeck as updateDeckFromDB,
} from "../lib/database";

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
  deleteDeck: (deckId: string) => void;
  updateDeck: (deckId: string, name: string, description?: string) => void;
}

export const useVocabularyStore = create<VocabularyState>((set, get) => ({
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
    const failing = getFailingTokens();
    set({
      decks: localDecks.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        cardCount: getFlashcardCountByDeck(d.id),
      })),
      totalCards: total,
      failingTokens: failing,
    });
  },

  deleteDeck: (deckId: string) => {
    deleteDeckFromDB(deckId);
    get().loadLocalData();
  },

  updateDeck: (deckId: string, name: string, description?: string) => {
    updateDeckFromDB(deckId, { name, description: description ?? undefined });
    get().loadLocalData();
  },
}));
