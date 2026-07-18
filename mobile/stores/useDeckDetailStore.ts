import { create } from "zustand";
import { Paths, File, Directory } from "expo-file-system";
import {
  getDeckById,
  getFlashcardsByDeck,
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
  deleteDeck as deleteDeckFromDB,
  updateDeck as updateDeckFromDB,
  updateFlashcardAudioPath,
} from "../lib/database";
import { useVocabularyStore } from "./useVocabularyStore";
import { generateTTS } from "../lib/api";
import type { Flashcard } from "../lib/schema";
import { fillClozeSentence } from "../lib/cloze";

interface FlashcardItem {
  id: string;
  sentence: string;
  sentencePinyin: string;
  answer: string;
  answerPinyin: string;
  context: string | null;
  contextPinyin: string | null;
  cardType: string;
  audioPath: string | null;
}

interface DeckDetailState {
  deckId: string | null;
  deckName: string;
  deckDescription: string | null;
  flashcards: FlashcardItem[];
  isLoading: boolean;
  isGeneratingAudio: boolean;
  isImporting: boolean;

  loadDeck: (deckId: string) => void;
  addFlashcard: (data: {
    sentence: string;
    sentencePinyin?: string;
    answer: string;
    answerPinyin?: string;
    context?: string;
    contextPinyin?: string;
  }) => Promise<void>;
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
  removeDeck: () => void;
  updateDeck: (name: string, description?: string) => void;
  bulkImportCards: () => Promise<{ created: number; errors: string[] } | null>;
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
    audioPath: f.audioPath ?? null,
  };
}

async function saveAudioToFile(flashcardId: string, audioBlob: Blob): Promise<string> {
  const audioDir = new Directory(Paths.document, "audio");
  if (!audioDir.exists) {
    audioDir.create();
  }

  const file = new File(audioDir, `${flashcardId}.mp3`);
  const arrayBuffer = await audioBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const base64 = btoa(
    Array.from(uint8Array)
      .map((b) => String.fromCharCode(b))
      .join("")
  );

  await file.write(base64, { encoding: "base64" });

  return file.uri;
}

export const useDeckDetailStore = create<DeckDetailState>((set, get) => ({
  deckId: null,
  deckName: "",
  deckDescription: null,
  flashcards: [],
  isLoading: false,
  isGeneratingAudio: false,
  isImporting: false,

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

  addFlashcard: async (data) => {
    const { deckId } = get();
    if (!deckId) return;

    const card = createFlashcard({ deckId, ...data });
    if (!card) return;

    const cards = getFlashcardsByDeck(deckId);
    set({ flashcards: cards.map(mapFlashcard) });

    useVocabularyStore.getState().loadLocalData();

    const fullSentence = fillClozeSentence(
      data.sentence || `___${data.answer}`,
      data.answer
    );

    try {
      set({ isGeneratingAudio: true });
      const audioBlob = await generateTTS(fullSentence);
      const filePath = await saveAudioToFile(card.id, audioBlob);
      updateFlashcardAudioPath(card.id, filePath);

      const updatedCards = getFlashcardsByDeck(deckId);
      set({ flashcards: updatedCards.map(mapFlashcard), isGeneratingAudio: false });
    } catch (e) {
      console.warn("TTS generation failed, card saved without audio:", e);
      set({ isGeneratingAudio: false });
    }
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
    useVocabularyStore.getState().loadLocalData();
  },

  removeDeck: () => {
    const { deckId } = get();
    if (!deckId) return;
    deleteDeckFromDB(deckId);
    useVocabularyStore.getState().loadLocalData();
  },

  updateDeck: (name, description) => {
    const { deckId } = get();
    if (!deckId) return;
    updateDeckFromDB(deckId, { name, description: description ?? undefined });
    set({ deckName: name, deckDescription: description ?? null });
    useVocabularyStore.getState().loadLocalData();
  },

  bulkImportCards: async () => {
    const { deckId } = get();
    if (!deckId) return null;

    let DocumentPicker;
    try {
      DocumentPicker = await import("expo-document-picker");
    } catch {
      console.warn("expo-document-picker not available");
      return null;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return null;

      set({ isImporting: true });

      const fileUri = result.assets[0].uri;
      const file = new File(fileUri);
      const text = await file.text();
      const cards = JSON.parse(text);

      if (!Array.isArray(cards)) {
        set({ isImporting: false });
        return null;
      }

      const validCards = cards.filter(
        (c: any) => c.answer && typeof c.answer === "string"
      );
      const beforeCount = getFlashcardsByDeck(deckId).length;

      for (const card of validCards) {
        createFlashcard({
          deckId,
          sentence: card.sentence ?? null,
          sentencePinyin: card.sentence_pinyin ?? card.sentencePinyin ?? null,
          answer: card.answer,
          answerPinyin: card.answer_pinyin ?? card.answerPinyin ?? null,
          context: card.context ?? null,
          contextPinyin: card.context_pinyin ?? card.contextPinyin ?? null,
          imagePath: card.image_path ?? card.imagePath ?? null,
        });
      }

      const cards_after = getFlashcardsByDeck(deckId);
      set({ flashcards: cards_after.map(mapFlashcard), isImporting: false });
      useVocabularyStore.getState().loadLocalData();

      return { created: cards_after.length - beforeCount, errors: [] };
    } catch (e) {
      console.warn("Bulk import failed:", e);
      set({ isImporting: false });
      return null;
    }
  },
}));
