const mockPushSync = jest.fn();
const mockPullSync = jest.fn();
const mockGetAllDecks = jest.fn(() => []);
const mockGetFlashcardsByDeck = jest.fn(() => []);
const mockGetVocabularyState = jest.fn(() => undefined);
const mockGetPendingReviews = jest.fn(() => []);
const mockClearPendingReviews = jest.fn();
const mockDedupeLocalFlashcards = jest.fn(() => 0);
const mockGetDb = jest.fn(() => ({
  select: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    get: jest.fn(),
  })),
  update: jest.fn(() => ({
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    run: jest.fn(),
  })),
  insert: jest.fn(() => ({
    values: jest.fn().mockReturnThis(),
    run: jest.fn(),
  })),
}));

class MockApiError extends Error {
  code: "timeout" | "network" | "http" | "unknown";
  status?: number;

  constructor(
    message: string,
    code: "timeout" | "network" | "http" | "unknown",
    status?: number
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

jest.mock("../api", () => ({
  pushSync: (...args: any[]) => mockPushSync(...args),
  pullSync: (...args: any[]) => mockPullSync(...args),
  ApiError: MockApiError,
  getApiBase: () => "http://192.168.3.11:8000",
}));

jest.mock("../database", () => ({
  getAllDecks: (...args: any[]) => mockGetAllDecks(...args),
  getFlashcardsByDeck: (...args: any[]) => mockGetFlashcardsByDeck(...args),
  getVocabularyState: (...args: any[]) => mockGetVocabularyState(...args),
  getPendingReviews: (...args: any[]) => mockGetPendingReviews(...args),
  clearPendingReviews: (...args: any[]) => mockClearPendingReviews(...args),
  dedupeLocalFlashcards: (...args: any[]) => mockDedupeLocalFlashcards(...args),
  getDb: (...args: any[]) => mockGetDb(...args),
}));

jest.mock("../schema", () => ({
  deck: { id: "deck-id" },
  flashcard: { id: "flashcard-id" },
  userVocabularyState: { flashcardId: "flashcard-id" },
}));

jest.mock("drizzle-orm", () => ({
  eq: jest.fn(),
}));

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "uuid"),
}));

import { performSync, pullUpdates } from "../sync";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  mockPullSync.mockResolvedValue({
    decks: [],
    flashcards: [],
    vocabulary_states: [],
    synced_at: "2026-01-01T00:00:00Z",
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("performSync", () => {
  it("returns success when push and pull succeed", async () => {
    mockPushSync.mockResolvedValue({
      decks_upserted: 0,
      flashcards_upserted: 0,
      states_upserted: 0,
      reviews_processed: 1,
      processed_pending_review_ids: ["review-1"],
    });

    const result = await performSync();

    expect(result.status).toBe("success");
    expect(result.pushOk).toBe(true);
    expect(result.pullOk).toBe(true);
    expect(result.nothingToSync).toBe(false);
    expect(result.changesApplied).toBe(1);
    expect(result.processedPendingReviewIds).toEqual(["review-1"]);
    expect(mockClearPendingReviews).toHaveBeenCalledWith(["review-1"]);
  });

  it("returns a no-op success message when nothing changed", async () => {
    mockPushSync.mockResolvedValue({
      decks_upserted: 0,
      flashcards_upserted: 0,
      states_upserted: 0,
      reviews_processed: 0,
      processed_pending_review_ids: [],
    });

    const result = await performSync();

    expect(result.status).toBe("success");
    expect(result.nothingToSync).toBe(true);
    expect(result.changesApplied).toBe(0);
    expect(result.message).toBe("Nothing to sync");
  });

  it("returns partial when push fails and pull succeeds", async () => {
    mockPushSync.mockRejectedValue(new MockApiError("timeout", "timeout"));

    const result = await performSync();

    expect(result.status).toBe("partial");
    expect(result.pushOk).toBe(false);
    expect(result.pullOk).toBe(true);
    expect(result.nothingToSync).toBe(false);
    expect(result.errorCode).toBe("timeout");
    expect(result.message).toContain("Upload timed out");
  });

  it("returns partial when push succeeds and pull fails", async () => {
    mockPushSync.mockResolvedValue({
      decks_upserted: 0,
      flashcards_upserted: 0,
      states_upserted: 0,
      reviews_processed: 0,
      processed_pending_review_ids: [],
    });
    mockPullSync.mockRejectedValue(new MockApiError("network", "network"));

    const result = await performSync();

    expect(result.status).toBe("partial");
    expect(result.pushOk).toBe(true);
    expect(result.pullOk).toBe(false);
    expect(result.nothingToSync).toBe(false);
    expect(result.errorCode).toBe("network");
    expect(result.message).toContain("unable to connect to the server");
  });

  it("returns failure when push and pull fail", async () => {
    mockPushSync.mockRejectedValue(new MockApiError("http fail", "http", 503));
    mockPullSync.mockRejectedValue(new MockApiError("timeout", "timeout"));

    const result = await performSync();

    expect(result.status).toBe("failure");
    expect(result.pushOk).toBe(false);
    expect(result.pullOk).toBe(false);
    expect(result.nothingToSync).toBe(false);
    expect(result.errorCode).toBe("timeout");
    expect(result.failingStage).toBe("pull");
    expect(result.message).toBe("Download timed out (5 seconds)");
  });
});

describe("pullUpdates", () => {
  it("does not skip flashcards when the local parent deck already exists", async () => {
    const insertRun = jest.fn();
    const flashcardInsertValues = jest.fn(() => ({ run: insertRun }));
    const flashcardInsert = jest.fn(() => ({ values: flashcardInsertValues }));
    const deckSelectGet = jest
      .fn()
      .mockReturnValueOnce({
        id: "deck-1",
        updatedAt: "2026-07-08T21:00:00Z",
      })
      .mockReturnValueOnce(undefined);
    const selectBuilder = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      get: deckSelectGet,
    };
    const db = {
      select: jest.fn(() => selectBuilder),
      update: jest.fn(() => ({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        run: jest.fn(),
      })),
      insert: jest.fn(() => ({
        values: flashcardInsertValues,
      })),
    };

    mockGetDb.mockReturnValue(db);
    mockGetAllDecks.mockReturnValue([
      {
        id: "deck-1",
        name: "Existing Deck",
        description: null,
        updatedAt: "2026-07-08T21:00:00Z",
      },
    ]);
    mockGetFlashcardsByDeck.mockReturnValue([]);
    mockPullSync.mockResolvedValue({
      decks: [
        {
          id: "deck-1",
          name: "Existing Deck",
          description: null,
          created_at: "2026-07-08T20:00:00Z",
          updated_at: "2026-07-08T21:00:00Z",
        },
      ],
      flashcards: [
        {
          id: "card-1",
          deck_id: "deck-1",
          card_type: "cloze_deletion",
          sentence: "我___你",
          sentence_pinyin: "wǒ ___ nǐ",
          answer: "爱",
          answer_pinyin: "ài",
          context: null,
          context_pinyin: null,
          image_path: null,
          audio_path: null,
          created_at: "2026-07-08T20:00:00Z",
          updated_at: "2026-07-08T21:00:00Z",
        },
      ],
      vocabulary_states: [],
      synced_at: "2026-07-08T21:30:00Z",
    });

    const result = await pullUpdates();

    expect(console.warn).not.toHaveBeenCalledWith(
      "[sync] skipping flashcard with missing deck:",
      "card-1",
      "deck-1"
    );
    expect(flashcardInsertValues).toHaveBeenCalled();
    expect(insertRun).toHaveBeenCalled();
    expect(result.flashcardsApplied).toBe(1);
  });

  it("reports no applied pull changes for an empty response", async () => {
    const result = await pullUpdates();

    expect(result).toEqual({
      decksApplied: 0,
      flashcardsApplied: 0,
      statesApplied: 0,
      syncedAt: "2026-01-01T00:00:00Z",
    });
  });
});
