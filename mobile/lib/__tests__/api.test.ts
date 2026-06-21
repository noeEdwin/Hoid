const mockFetch = jest.fn();
global.fetch = mockFetch as any;

import {
  fetchDecks,
  fetchFlashcards,
  fetchReviewQueue,
  submitReview,
  fetchDifficultTokens,
} from "../api";

beforeEach(() => {
  jest.clearAllMocks();
});

function mockJsonResponse(data: any, ok = true, status = 200) {
  mockFetch.mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

function mockNetworkError() {
  mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
}

describe("fetchDecks", () => {
  it("returns deck array from response", async () => {
    mockJsonResponse({ decks: [{ id: "d1", name: "HSK 1" }] });

    const result = await fetchDecks();

    expect(result).toEqual([{ id: "d1", name: "HSK 1" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/decks",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } })
    );
  });

  it("throws on network error", async () => {
    mockNetworkError();

    await expect(fetchDecks()).rejects.toThrow("Failed to fetch");
  });

  it("throws on 4xx response", async () => {
    mockJsonResponse({ detail: "Not found" }, false, 404);

    await expect(fetchDecks()).rejects.toThrow("API error: 404");
  });

  it("throws on 5xx response", async () => {
    mockJsonResponse({ detail: "Server error" }, false, 500);

    await expect(fetchDecks()).rejects.toThrow("API error: 500");
  });
});

describe("fetchFlashcards", () => {
  it("interpolates deckId in URL", async () => {
    mockJsonResponse({ flashcards: [], total: 0 });

    await fetchFlashcards("deck-123");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/decks/deck-123/flashcards",
      expect.anything()
    );
  });

  it("returns flashcard array", async () => {
    mockJsonResponse({
      flashcards: [{ id: "f1", sentence: "我___你" }],
      total: 1,
    });

    const result = await fetchFlashcards("d1");

    expect(result).toEqual([{ id: "f1", sentence: "我___你" }]);
  });
});

describe("fetchReviewQueue", () => {
  it("includes limit query param", async () => {
    mockJsonResponse({ queue: [], total_pending: 0 });

    await fetchReviewQueue("deck-1", 5);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/decks/deck-1/review?limit=5",
      expect.anything()
    );
  });

  it("default limit of 20", async () => {
    mockJsonResponse({ queue: [], total_pending: 0 });

    await fetchReviewQueue("deck-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/decks/deck-1/review?limit=20",
      expect.anything()
    );
  });

  it("returns queue array", async () => {
    mockJsonResponse({
      queue: [{ flashcard_id: "f1", answer: "爱" }],
      total_pending: 1,
    });

    const result = await fetchReviewQueue("d1");

    expect(result).toEqual([{ flashcard_id: "f1", answer: "爱" }]);
  });
});

describe("submitReview", () => {
  it("sends POST with correct body", async () => {
    mockJsonResponse({
      status: "success",
      flashcard_id: "f1",
      new_srs_interval: 3,
      new_difficulty_score: 0.5,
    });

    await submitReview("f1", true, 2000);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/flashcards/f1/review",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          flashcard_id: "f1",
          is_correct: true,
          response_time_ms: 2000,
        }),
      })
    );
  });

  it("returns interval and difficulty score", async () => {
    mockJsonResponse({
      status: "success",
      flashcard_id: "f1",
      new_srs_interval: 7,
      new_difficulty_score: 0.3,
    });

    const result = await submitReview("f1", true, 1500);

    expect(result).toEqual({
      new_srs_interval: 7,
      new_difficulty_score: 0.3,
    });
  });
});

describe("fetchDifficultTokens", () => {
  it("includes n query param", async () => {
    mockJsonResponse({ difficult_tokens: [] });

    await fetchDifficultTokens(5);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/vocabulary/difficulty?n=5",
      expect.anything()
    );
  });

  it("default n of 10", async () => {
    mockJsonResponse({ difficult_tokens: [] });

    await fetchDifficultTokens();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/vocabulary/difficulty?n=10",
      expect.anything()
    );
  });

  it("returns difficult tokens array", async () => {
    mockJsonResponse({
      difficult_tokens: [{ flashcard_id: "f1", difficulty_score: 0.9 }],
    });

    const result = await fetchDifficultTokens();

    expect(result).toEqual([{ flashcard_id: "f1", difficulty_score: 0.9 }]);
  });
});

describe("error handling", () => {
  it("network error propagates", async () => {
    mockNetworkError();

    await expect(fetchReviewQueue("d1")).rejects.toThrow();
  });

  it("HTTP error includes status code", async () => {
    mockJsonResponse({ detail: "Validation error" }, false, 422);

    await expect(submitReview("f1", true, 1000)).rejects.toThrow("422");
  });
});
