jest.mock("expo-sqlite", () => {
  const mockRun = jest.fn();
  const mockGet = jest.fn(() => undefined);
  const mockAll = jest.fn(() => []);
  const mockExec = jest.fn();
  const mockGetFirst = jest.fn(() => ({ user_version: 0 }));

  return {
    openDatabaseSync: jest.fn(() => ({
      execSync: mockExec,
      getFirstSync: mockGetFirst,
      runSync: mockRun,
    })),
  };
});

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "test-uuid-" + Math.random().toString(36).slice(2)),
}));

const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock("drizzle-orm/expo-sqlite", () => ({
  drizzle: jest.fn(() => mockDb),
}));

jest.mock("drizzle-orm", () => ({
  eq: jest.fn((a: any, b: any) => ({ type: "eq", a, b })),
  desc: jest.fn((a: any) => ({ type: "desc", a })),
  gt: jest.fn((a: any, b: any) => ({ type: "gt", a, b })),
  and: jest.fn((...args: any[]) => ({ type: "and", args })),
  or: jest.fn((...args: any[]) => ({ type: "or", args })),
  count: jest.fn(() => ({ type: "count" })),
  inArray: jest.fn((a: any, b: any) => ({ type: "inArray", a, b })),
  notInArray: jest.fn((a: any, b: any) => ({ type: "notInArray", a, b })),
}));

import { getDb } from "../database";

function setupMockChain(result: any) {
  const chain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    get: jest.fn(() => result),
    all: jest.fn(() => (Array.isArray(result) ? result : result ? [result] : [])),
    run: jest.fn(() => ({ changes: 1 })),
    set: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
  };
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.select.mockReturnValue(setupMockChain([]));
  mockDb.insert.mockReturnValue(setupMockChain(undefined));
  mockDb.update.mockReturnValue(setupMockChain(undefined));
  mockDb.delete.mockReturnValue(setupMockChain(undefined));
});

describe("getDb", () => {
  it("returns a database instance", () => {
    const db = getDb();
    expect(db).toBeDefined();
  });
});

describe("getDueCards", () => {
  it("queries with INNER JOIN between flashcard and vocabulary state", () => {
    const chain = setupMockChain([]);
    mockDb.select.mockReturnValue(chain);

    const { getDueCards } = require("../database");
    getDueCards("deck-1", 10);

    expect(mockDb.select).toHaveBeenCalled();
    expect(chain.from).toHaveBeenCalled();
    expect(chain.innerJoin).toHaveBeenCalled();
    expect(chain.where).toHaveBeenCalled();
    expect(chain.orderBy).toHaveBeenCalled();
    expect(chain.limit).not.toHaveBeenCalled();
  });

  it("returns empty array for empty deck", () => {
    const chain = setupMockChain([]);
    mockDb.select.mockReturnValue(chain);

    const { getDueCards } = require("../database");
    const result = getDueCards("deck-empty");

    expect(result).toEqual([]);
  });

  it("returns cards ordered by difficulty DESC", () => {
    const cards = [
      { id: "c1", difficultyScore: 0.9 },
      { id: "c2", difficultyScore: 0.5 },
    ];
    const chain = setupMockChain(cards);
    mockDb.select.mockReturnValue(chain);

    const { getDueCards } = require("../database");
    const result = getDueCards("deck-1");

    expect(result[0].difficultyScore).toBe(0.9);
    expect(result[1].difficultyScore).toBe(0.5);
  });

  it("INNER JOIN excludes cards without vocabulary state", () => {
    const chain = setupMockChain([]);
    mockDb.select.mockReturnValue(chain);

    const { getDueCards } = require("../database");
    getDueCards("deck-1");

    expect(chain.innerJoin).toHaveBeenCalled();
  });

  it("excludes cards already reviewed today", () => {
    const chain = setupMockChain([]);
    mockDb.select.mockReturnValue(chain);

    const { getDueCards } = require("../database");
    getDueCards("deck-1", 10, ["c1", "c2"]);

    expect(chain.where).toHaveBeenCalledWith(
      expect.objectContaining({ type: "and" })
    );
  });

  it("filters future cards before applying the result limit", () => {
    const cards = [
      { id: "future-1", difficultyScore: 1, nextReviewAt: "2026-07-20T00:00:00Z" },
      { id: "future-2", difficultyScore: 0.9, nextReviewAt: "2026-07-19T00:00:00Z" },
      { id: "due-1", difficultyScore: 0.8, nextReviewAt: null },
      { id: "due-2", difficultyScore: 0.7, nextReviewAt: "2026-07-14T00:00:00Z" },
    ];
    const chain = setupMockChain(cards);
    mockDb.select.mockReturnValue(chain);

    const { getDueCards } = require("../database");
    const result = getDueCards("deck-1", 2, [], "2026-07-15T00:00:00Z");

    expect(result.map((card: { id: string }) => card.id)).toEqual(["due-1", "due-2"]);
  });
});

describe("getVocabularyState", () => {
  it("returns state for existing card", () => {
    const state = { id: "vs-1", flashcardId: "card-1", totalReviews: 5 };
    const chain = setupMockChain(state);
    mockDb.select.mockReturnValue(chain);

    const { getVocabularyState } = require("../database");
    const result = getVocabularyState("card-1");

    expect(result).toEqual(state);
  });

  it("returns undefined for missing card", () => {
    const chain = setupMockChain(undefined);
    mockDb.select.mockReturnValue(chain);

    const { getVocabularyState } = require("../database");
    const result = getVocabularyState("nonexistent");

    expect(result).toBeUndefined();
  });
});

describe("updateVocabularyState", () => {
  it("returns null when state not found", () => {
    const selectChain = setupMockChain(undefined);
    mockDb.select.mockReturnValue(selectChain);

    const { updateVocabularyState } = require("../database");
    const result = updateVocabularyState("card-1", { totalReviews: 1 });

    expect(result).toBeNull();
  });

  it("updates and returns new state when found", () => {
    const existingState = { id: "vs-1", flashcardId: "card-1", totalReviews: 0 };
    const updatedState = { id: "vs-1", flashcardId: "card-1", totalReviews: 1 };

    const firstChain = setupMockChain(existingState);
    const secondChain = setupMockChain(updatedState);
    mockDb.select
      .mockReturnValueOnce(firstChain)
      .mockReturnValueOnce(secondChain);

    const updateChain = setupMockChain(updatedState);
    mockDb.update.mockReturnValue(updateChain);

    const { updateVocabularyState } = require("../database");
    const result = updateVocabularyState("card-1", { totalReviews: 1 });

    expect(result).toEqual(updatedState);
  });
});

describe("addPendingReview", () => {
  it("creates a pending review record", () => {
    const chain = setupMockChain(undefined);
    mockDb.insert.mockReturnValue(chain);

    const { addPendingReview } = require("../database");
    const id = addPendingReview("card-1", true, 2000);

    expect(mockDb.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        flashcardId: "card-1",
        isCorrect: true,
        responseTimeMs: 2000,
      })
    );
    expect(typeof id).toBe("string");
  });
});

describe("clearPendingReviews", () => {
  it("deletes all pending reviews", () => {
    const chain = setupMockChain(undefined);
    mockDb.delete.mockReturnValue(chain);

    const { clearPendingReviews } = require("../database");
    clearPendingReviews();

    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deletes only processed pending reviews when ids are provided", () => {
    const chain = setupMockChain(undefined);
    mockDb.delete.mockReturnValue(chain);

    const { clearPendingReviews } = require("../database");
    clearPendingReviews(["review-1", "review-2"]);

    expect(chain.where).toHaveBeenCalled();
  });
});

describe("createDeck", () => {
  it("creates and returns a deck", () => {
    const deck = { id: "deck-1", name: "Test Deck", description: null };
    const selectChain = setupMockChain(deck);
    mockDb.select.mockReturnValue(selectChain);

    const insertChain = setupMockChain(undefined);
    mockDb.insert.mockReturnValue(insertChain);

    const { createDeck } = require("../database");
    const result = createDeck("Test Deck");

    expect(result).toEqual(deck);
  });

  it("accepts empty name (no validation)", () => {
    const deck = { id: "deck-1", name: "", description: null };
    const selectChain = setupMockChain(deck);
    mockDb.select.mockReturnValue(selectChain);

    const insertChain = setupMockChain(undefined);
    mockDb.insert.mockReturnValue(insertChain);

    const { createDeck } = require("../database");
    const result = createDeck("");

    expect(result).toBeDefined();
  });
});

describe("createFlashcard", () => {
  it("creates and returns a flashcard", () => {
    const card = {
      id: "card-1",
      deckId: "deck-1",
      sentence: "我___你",
      answer: "爱",
      cardType: "cloze_deletion",
    };
    const selectChain = setupMockChain(card);
    mockDb.select.mockReturnValue(selectChain);

    const insertChain = setupMockChain(undefined);
    mockDb.insert.mockReturnValue(insertChain);

    const { createFlashcard } = require("../database");
    const result = createFlashcard({
      deckId: "deck-1",
      sentence: "我___你",
      answer: "爱",
    });

    expect(result).toEqual(card);
  });

  it("returns existing flashcard when content matches", () => {
    const existingCard = {
      id: "card-1",
      deckId: "deck-1",
      sentence: "我___你",
      sentencePinyin: "wǒ ___ nǐ",
      answer: "爱",
      answerPinyin: "ài",
      context: null,
      contextPinyin: null,
      cardType: "cloze_deletion",
    };
    const selectChain = setupMockChain([existingCard]);
    mockDb.select.mockReturnValue(selectChain);
    mockDb.insert.mockReturnValue(setupMockChain(undefined));

    const { createFlashcard } = require("../database");

    const result = createFlashcard({
      deckId: "deck-1",
      sentence: "我___你",
      sentencePinyin: "WǑ ___ NǏ",
      answer: "爱",
      answerPinyin: "ÀI",
    });

    expect(result).toEqual(existingCard);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});

describe("deleteFlashcard", () => {
  it("deletes flashcard and cascades to related tables", () => {
    const chain = setupMockChain(undefined);
    mockDb.delete.mockReturnValue(chain);

    const { deleteFlashcard } = require("../database");
    deleteFlashcard("card-1");

    expect(mockDb.delete).toHaveBeenCalledTimes(3);
  });
});
