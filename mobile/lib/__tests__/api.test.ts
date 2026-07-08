const mockFetch = jest.fn();
global.fetch = mockFetch as any;

import {
  ApiError,
  fetchDecks,
  fetchFlashcards,
  fetchReviewQueue,
  submitReview,
  fetchDifficultTokens,
  pushSync,
  pullSync,
  createDeckApi,
  deleteDeckApi,
  createFlashcardApi,
  updateFlashcardApi,
  deleteFlashcardApi,
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

function mockAbortError() {
  const error = new Error("Aborted");
  error.name = "AbortError";
  mockFetch.mockRejectedValue(error);
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
  it("sends deck_id as query param", async () => {
    mockJsonResponse({ flashcards: [], total: 0 });

    await fetchFlashcards("deck-123");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/flashcards?deck_id=deck-123",
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

    await expect(fetchReviewQueue("d1")).rejects.toMatchObject({
      code: "network",
    } satisfies Partial<ApiError>);
  });

  it("HTTP error includes status code", async () => {
    mockJsonResponse({ detail: "Validation error" }, false, 422);

    await expect(submitReview("f1", true, 1000)).rejects.toMatchObject({
      code: "http",
      status: 422,
    } satisfies Partial<ApiError>);
  });

  it("timeout error is normalized", async () => {
    mockAbortError();

    await expect(fetchDecks()).rejects.toMatchObject({
      code: "timeout",
    } satisfies Partial<ApiError>);
  });
});

describe("pushSync", () => {
  it("sends POST to /api/sync/push with body", async () => {
    mockJsonResponse({
      decks_upserted: 1,
      flashcards_upserted: 5,
      states_upserted: 5,
      reviews_processed: 3,
      processed_pending_review_ids: ["r1"],
    });

    const result = await pushSync({
      decks: [{ id: "d1", name: "HSK 1", description: null }],
      flashcards: [],
      vocabulary_states: [],
      pending_reviews: [{ id: "r1", flashcard_id: "f1", is_correct: true, response_time_ms: 1000 }],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/sync/push",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          decks: [{ id: "d1", name: "HSK 1", description: null }],
          flashcards: [],
          vocabulary_states: [],
          pending_reviews: [{ id: "r1", flashcard_id: "f1", is_correct: true, response_time_ms: 1000 }],
        }),
      })
    );
    expect(result.decks_upserted).toBe(1);
    expect(result.reviews_processed).toBe(3);
    expect(result.processed_pending_review_ids).toEqual(["r1"]);
  });
});

describe("pullSync", () => {
  it("sends GET to /api/sync/pull", async () => {
    mockJsonResponse({
      decks: [],
      flashcards: [],
      vocabulary_states: [],
      synced_at: "2026-01-01T00:00:00Z",
    });

    await pullSync();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/sync/pull",
      expect.anything()
    );
  });

  it("includes since query param when provided", async () => {
    mockJsonResponse({
      decks: [],
      flashcards: [],
      vocabulary_states: [],
      synced_at: "2026-01-01T00:00:00Z",
    });

    await pullSync("2026-01-01T00:00:00Z");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/sync/pull?since=2026-01-01T00%3A00%3A00Z",
      expect.anything()
    );
  });

  it("returns pull response data", async () => {
    mockJsonResponse({
      decks: [{ id: "d1", name: "HSK 1", description: null }],
      flashcards: [{ id: "f1", deck_id: "d1", sentence: "我___你" }],
      vocabulary_states: [{ flashcard_id: "f1", difficulty_score: 0.5 }],
      synced_at: "2026-01-01T00:00:00Z",
    });

    const result = await pullSync();

    expect(result.decks).toHaveLength(1);
    expect(result.flashcards).toHaveLength(1);
    expect(result.vocabulary_states).toHaveLength(1);
  });
});

describe("createDeckApi", () => {
  it("sends POST with name and description", async () => {
    mockJsonResponse({ id: "d1", name: "HSK 1", description: "Beginner", created_at: "2026-01-01" });

    const result = await createDeckApi("HSK 1", "Beginner");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/decks",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "HSK 1", description: "Beginner" }),
      })
    );
    expect(result.id).toBe("d1");
  });

  it("sends null description when omitted", async () => {
    mockJsonResponse({ id: "d2", name: "Travel", description: null, created_at: "2026-01-01" });

    await createDeckApi("Travel");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/decks",
      expect.objectContaining({
        body: JSON.stringify({ name: "Travel", description: null }),
      })
    );
  });
});

describe("deleteDeckApi", () => {
  it("sends DELETE to /api/decks/{id}", async () => {
    mockJsonResponse({ status: "deleted", deck_id: "d1" });

    await deleteDeckApi("d1");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/decks/d1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("createFlashcardApi", () => {
  it("sends POST with flashcard data", async () => {
    mockJsonResponse({ id: "f1", deck_id: "d1", sentence: "我___你", answer: "爱" });

    const result = await createFlashcardApi({
      deck_id: "d1",
      sentence: "我___你",
      answer: "爱",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/flashcards",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          card_type: "cloze_deletion",
          deck_id: "d1",
          sentence: "我___你",
          answer: "爱",
        }),
      })
    );
    expect(result.id).toBe("f1");
  });
});

describe("updateFlashcardApi", () => {
  it("sends PUT with updated fields", async () => {
    mockJsonResponse({ id: "f1", sentence: "Updated" });

    await updateFlashcardApi("f1", { sentence: "Updated" });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/flashcards/f1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ sentence: "Updated" }),
      })
    );
  });
});

describe("deleteFlashcardApi", () => {
  it("sends DELETE to /api/flashcards/{id}", async () => {
    mockJsonResponse({ status: "deleted", flashcard_id: "f1" });

    await deleteFlashcardApi("f1");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.3.11:8000/api/flashcards/f1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
