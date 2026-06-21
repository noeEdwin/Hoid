import { useVocabularyStore } from "../useVocabularyStore";

jest.mock("../../lib/database", () => ({
  getAllDecks: jest.fn(),
  getTotalCardCount: jest.fn(),
  getFlashcardCountByDeck: jest.fn(),
}));

import {
  getAllDecks,
  getTotalCardCount,
  getFlashcardCountByDeck,
} from "../../lib/database";

const mockGetAllDecks = getAllDecks as jest.MockedFunction<typeof getAllDecks>;
const mockGetTotalCardCount = getTotalCardCount as jest.MockedFunction<typeof getTotalCardCount>;
const mockGetFlashcardCountByDeck = getFlashcardCountByDeck as jest.MockedFunction<typeof getFlashcardCountByDeck>;

beforeEach(() => {
  jest.clearAllMocks();
  useVocabularyStore.setState({
    decks: [],
    failingTokens: [],
    totalCards: 0,
    isLoading: false,
  });
});

describe("loadDecks", () => {
  it("populates decks with card counts", () => {
    mockGetAllDecks.mockReturnValue([
      { id: "d1", name: "HSK 1", description: "Beginner", createdAt: "" },
      { id: "d2", name: "Travel", description: null, createdAt: "" },
    ] as any);
    mockGetFlashcardCountByDeck.mockImplementation((id: string) => {
      return id === "d1" ? 10 : 5;
    });

    useVocabularyStore.getState().loadDecks();

    const state = useVocabularyStore.getState();
    expect(state.decks).toHaveLength(2);
    expect(state.decks[0]).toEqual({
      id: "d1",
      name: "HSK 1",
      description: "Beginner",
      cardCount: 10,
    });
    expect(state.decks[1]).toEqual({
      id: "d2",
      name: "Travel",
      description: null,
      cardCount: 5,
    });
  });

  it("with empty database: empty array", () => {
    mockGetAllDecks.mockReturnValue([]);

    useVocabularyStore.getState().loadDecks();

    expect(useVocabularyStore.getState().decks).toEqual([]);
  });

  it("maps nullable description correctly", () => {
    mockGetAllDecks.mockReturnValue([
      { id: "d1", name: "Deck", description: null, createdAt: "" },
    ] as any);
    mockGetFlashcardCountByDeck.mockReturnValue(0);

    useVocabularyStore.getState().loadDecks();

    expect(useVocabularyStore.getState().decks[0].description).toBeNull();
  });

  it("does not update totalCards", () => {
    mockGetAllDecks.mockReturnValue([]);
    mockGetTotalCardCount.mockReturnValue(5);

    useVocabularyStore.getState().loadDecks();

    expect(useVocabularyStore.getState().totalCards).toBe(0);
  });
});

describe("loadLocalData", () => {
  it("sets totalCards", () => {
    mockGetAllDecks.mockReturnValue([]);
    mockGetTotalCardCount.mockReturnValue(25);

    useVocabularyStore.getState().loadLocalData();

    expect(useVocabularyStore.getState().totalCards).toBe(25);
  });

  it("populates decks and totalCards together", () => {
    mockGetAllDecks.mockReturnValue([
      { id: "d1", name: "HSK 1", description: "Beginner", createdAt: "" },
    ] as any);
    mockGetFlashcardCountByDeck.mockReturnValue(8);
    mockGetTotalCardCount.mockReturnValue(8);

    useVocabularyStore.getState().loadLocalData();

    const state = useVocabularyStore.getState();
    expect(state.decks).toHaveLength(1);
    expect(state.decks[0].cardCount).toBe(8);
    expect(state.totalCards).toBe(8);
  });

  it("with no decks: totalCards = 0", () => {
    mockGetAllDecks.mockReturnValue([]);
    mockGetTotalCardCount.mockReturnValue(0);

    useVocabularyStore.getState().loadLocalData();

    expect(useVocabularyStore.getState().totalCards).toBe(0);
    expect(useVocabularyStore.getState().decks).toEqual([]);
  });

  it("totalCards reflects actual count", () => {
    mockGetAllDecks.mockReturnValue([]);
    mockGetTotalCardCount.mockReturnValue(42);

    useVocabularyStore.getState().loadLocalData();

    expect(useVocabularyStore.getState().totalCards).toBe(42);
  });
});

describe("dead state", () => {
  it("failingTokens remains empty array", () => {
    expect(useVocabularyStore.getState().failingTokens).toEqual([]);
  });

  it("isLoading never changes", () => {
    expect(useVocabularyStore.getState().isLoading).toBe(false);

    useVocabularyStore.getState().loadDecks();

    expect(useVocabularyStore.getState().isLoading).toBe(false);
  });
});
