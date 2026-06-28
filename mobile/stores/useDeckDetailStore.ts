import { create } from "zustand";
import {
  getDeckById,
  getFlashcardsByDeck,
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
} from "../lib/database";
import type { Flashcard } from "../lib/schema";

interface FlashcardItem {
  id: string;
  sentence: string;
  sentencePinyin: string;
  answer: string;
  answerPinyin: string;
  context: string | null;
  contextPinyin: string | null;
  cardType: string;
}

interface DeckDetailState {
  deckId: string | null;
  deckName: string;
  deckDescription: string | null;
  flashcards: FlashcardItem[];
  isLoading: boolean;

  loadDeck: (deckId: string) => void;
  addFlashcard: (data: {
    sentence: string;
    sentencePinyin?: string;
    answer: string;
    answerPinyin?: string;
    context?: string;
    contextPinyin?: string;
  }) => void;
  editFlashcard: (
    flashcardId: string,
    data: {
      sentence?: string;
      sentencePinyin?: string;
      answer?: string;
      answerPinyin?: string;
      context?: string;
      contextPinyin?: string;
    }
  ) => void;
  removeFlashcard: (flashcardId: string) => void;
}

function mapFlashcard(f: Flashcard): FlashcardItem {
  return {
    id: f.id,
    sentence: f.sentence ?? "",
    sentencePinyin: f.sentencePinyin ?? "",
    answer: f.answer ?? "",
    answerPinyin: f.answerPinyin ?? "",
    context: f.context ?? null,
    contextPinyin: f.contextPinyin ?? null,
    cardType: f.cardType,
  };
}

export const useDeckDetailStore = create<DeckDetailState>((set, get) => ({
  deckId: null,
  deckName: "",
  deckDescription: null,
  flashcards: [],
  isLoading: false,

  loadDeck: (deckId: string) => {
    set({ isLoading: true });
    const deck = getDeckById(deckId);
    const cards = getFlashcardsByDeck(deckId);
    set({
      deckId,
      deckName: deck?.name ?? "",
      deckDescription: deck?.description ?? null,
      flashcards: cards.map(mapFlashcard),
      isLoading: false,
    });
  },

  addFlashcard: (data) => {
    const { deckId } = get();
    if (!deckId) return;
    createFlashcard({ deckId, ...data });
    const cards = getFlashcardsByDeck(deckId);
    set({ flashcards: cards.map(mapFlashcard) });
  },

  editFlashcard: (flashcardId, data) => {
    const { deckId } = get();
    if (!deckId) return;
    updateFlashcard(flashcardId, data);
    const cards = getFlashcardsByDeck(deckId);
    set({ flashcards: cards.map(mapFlashcard) });
  },

  removeFlashcard: (flashcardId) => {
    const { deckId } = get();
    if (!deckId) return;
    deleteFlashcard(flashcardId);
    const cards = getFlashcardsByDeck(deckId);
    set({ flashcards: cards.map(mapFlashcard) });
  },
}));
