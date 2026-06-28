jest.mock("../../lib/database", () => ({
  getDeckById: jest.fn(),
  getFlashcardsByDeck: jest.fn(),
  createFlashcard: jest.fn(),
  updateFlashcard: jest.fn(),
  deleteFlashcard: jest.fn(),
}));

import { useDeckDetailStore } from "../useDeckDetailStore";
import {
  getDeckById,
  getFlashcardsByDeck,
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
} from "../../lib/database";

const mockGetDeckById = getDeckById as jest.MockedFunction<typeof getDeckById>;
const mockGetFlashcardsByDeck = getFlashcardsByDeck as jest.MockedFunction<typeof getFlashcardsByDeck>;
const mockCreateFlashcard = createFlashcard as jest.MockedFunction<typeof createFlashcard>;
const mockUpdateFlashcard = updateFlashcard as jest.MockedFunction<typeof updateFlashcard>;
const mockDeleteFlashcard = deleteFlashcard as jest.MockedFunction<typeof deleteFlashcard>;

beforeEach(() => {
  jest.clearAllMocks();
  useDeckDetailStore.setState({
    deckId: null,
    deckName: "",
    deckDescription: null,
    flashcards: [],
    isLoading: false,
  });
});

function makeFlashcard(overrides: Record<string, any> = {}) {
  return {
    id: "fc-1",
    deckId: "deck-1",
    cardType: "cloze_deletion",
    sentence: "我___你",
    sentencePinyin: "wǒ ài nǐ",
    answer: "爱",
    answerPinyin: "ài",
    context: null,
    contextPinyin: null,
    imagePath: null,
    audioPath: null,
    createdAt: "2026-01-01",
    ...overrides,
  };
}

describe("loadDeck", () => {
  it("loads deck info and flashcards", () => {
    mockGetDeckById.mockReturnValue({
      id: "deck-1",
      name: "HSK 1",
      description: "Beginner",
      createdAt: "2026-01-01",
    } as any);
    mockGetFlashcardsByDeck.mockReturnValue([makeFlashcard()]);

    useDeckDetailStore.getState().loadDeck("deck-1");

    const state = useDeckDetailStore.getState();
    expect(state.deckName).toBe("HSK 1");
    expect(state.deckDescription).toBe("Beginner");
    expect(state.flashcards).toHaveLength(1);
    expect(state.flashcards[0].answer).toBe("爱");
  });

  it("handles missing deck gracefully", () => {
    mockGetDeckById.mockReturnValue(undefined);
    mockGetFlashcardsByDeck.mockReturnValue([]);

    useDeckDetailStore.getState().loadDeck("nonexistent");

    const state = useDeckDetailStore.getState();
    expect(state.deckName).toBe("");
    expect(state.flashcards).toHaveLength(0);
  });
});

describe("addFlashcard", () => {
  it("creates flashcard and refreshes list", () => {
    mockGetDeckById.mockReturnValue({ id: "deck-1", name: "HSK 1" } as any);
    useDeckDetailStore.getState().loadDeck("deck-1");

    mockCreateFlashcard.mockReturnValue(makeFlashcard({ id: "fc-new" }) as any);
    mockGetFlashcardsByDeck.mockReturnValue([
      makeFlashcard(),
      makeFlashcard({ id: "fc-new", answer: "好" }),
    ]);

    useDeckDetailStore.getState().addFlashcard({
      sentence: "你好",
      answer: "好",
    });

    expect(mockCreateFlashcard).toHaveBeenCalledWith({
      deckId: "deck-1",
      sentence: "你好",
      answer: "好",
    });
    expect(useDeckDetailStore.getState().flashcards).toHaveLength(2);
  });

  it("does nothing if deckId is null", () => {
    useDeckDetailStore.getState().addFlashcard({
      sentence: "test",
      answer: "test",
    });
    expect(mockCreateFlashcard).not.toHaveBeenCalled();
  });
});

describe("editFlashcard", () => {
  it("updates flashcard and refreshes list", () => {
    mockGetDeckById.mockReturnValue({ id: "deck-1", name: "HSK 1" } as any);
    mockGetFlashcardsByDeck.mockReturnValue([makeFlashcard()]);
    useDeckDetailStore.getState().loadDeck("deck-1");

    mockUpdateFlashcard.mockReturnValue(makeFlashcard({ sentence: "Updated" }) as any);
    mockGetFlashcardsByDeck.mockReturnValue([makeFlashcard({ sentence: "Updated" })]);

    useDeckDetailStore.getState().editFlashcard("fc-1", {
      sentence: "Updated",
    });

    expect(mockUpdateFlashcard).toHaveBeenCalledWith("fc-1", {
      sentence: "Updated",
    });
    expect(useDeckDetailStore.getState().flashcards[0].sentence).toBe("Updated");
  });
});

describe("removeFlashcard", () => {
  it("deletes flashcard and refreshes list", () => {
    mockGetDeckById.mockReturnValue({ id: "deck-1", name: "HSK 1" } as any);
    mockGetFlashcardsByDeck.mockReturnValue([makeFlashcard()]);
    useDeckDetailStore.getState().loadDeck("deck-1");

    mockGetFlashcardsByDeck.mockReturnValue([]);

    useDeckDetailStore.getState().removeFlashcard("fc-1");

    expect(mockDeleteFlashcard).toHaveBeenCalledWith("fc-1");
    expect(useDeckDetailStore.getState().flashcards).toHaveLength(0);
  });
});
