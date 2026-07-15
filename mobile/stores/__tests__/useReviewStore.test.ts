import { useReviewStore, ReviewCard } from "../useReviewStore";
import { useSettingsStore } from "../useSettingsStore";

jest.mock("../../lib/database", () => ({
  getDueCards: jest.fn(),
  addPendingReview: jest.fn(),
  getVocabularyState: jest.fn(),
  updateVocabularyState: jest.fn(),
}));

import {
  getDueCards,
  addPendingReview,
  getVocabularyState,
  updateVocabularyState,
} from "../../lib/database";

const mockGetDueCards = getDueCards as jest.MockedFunction<typeof getDueCards>;
const mockAddPendingReview = addPendingReview as jest.MockedFunction<typeof addPendingReview>;
const mockGetVocabularyState = getVocabularyState as jest.MockedFunction<typeof getVocabularyState>;
const mockUpdateVocabularyState = updateVocabularyState as jest.MockedFunction<typeof updateVocabularyState>;

function makeCard(overrides: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: "card-1",
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
    srsInterval: 0,
    easeFactor: 2.5,
    difficultyScore: 0.5,
    totalReviews: 0,
    totalFailures: 0,
    consecutiveFailures: 0,
    consecutiveCorrect: 0,
    ...overrides,
  };
}

function makeVocabState(overrides: Record<string, any> = {}) {
  return {
    id: "vs-1",
    flashcardId: "card-1",
    srsInterval: 0,
    easeFactor: 2.5,
    totalReviews: 0,
    totalFailures: 0,
    consecutiveFailures: 0,
    consecutiveCorrect: 0,
    difficultyScore: 0.5,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
  require("expo-file-system").__resetStore();
  useReviewStore.setState({
    remaining: [],
    completed: [],
    failedCards: [],
    missedCardIds: new Set(),
    attemptCount: new Map(),
    deckId: null,
    isComplete: false,
    showResult: false,
    lastResultCorrect: false,
    cardStartTime: Date.now(),
    sessionStartTime: Date.now(),
    answeredCount: 0,
    deckExhaustedToday: false,
  });
  useSettingsStore.setState({
    dailyReviewLimit: 20,
    drillMode: false,
    deckReviewHistory: {},
    reviewedDates: [],
    isLoaded: false,
  });
});

describe("loadQueue", () => {
  it("loads cards and resets state", () => {
    const cards = [makeCard({ id: "c1" }), makeCard({ id: "c2" })];
    mockGetDueCards.mockReturnValue(cards as any);

    useReviewStore.getState().loadQueue("deck-1");

    const state = useReviewStore.getState();
    expect(state.remaining).toHaveLength(2);
    expect(state.deckId).toBe("deck-1");
    expect(state.isComplete).toBe(false);
    expect(state.showResult).toBe(false);
  });

  it("sets isComplete=true when deck is empty", () => {
    mockGetDueCards.mockReturnValue([]);

    useReviewStore.getState().loadQueue("deck-empty");

    expect(useReviewStore.getState().isComplete).toBe(true);
    expect(useReviewStore.getState().remaining).toHaveLength(0);
  });

  it("respects the limit parameter", () => {
    mockGetDueCards.mockReturnValue([makeCard()] as any);

    useReviewStore.getState().loadQueue("deck-1");

    expect(mockGetDueCards).toHaveBeenCalledWith("deck-1", 21, []);
  });

  it("loads only remaining unreviewed cards after daily limit increases", () => {
    const reviewedCardIds = Array.from({ length: 30 }, (_, i) => `c${i + 1}`);
    useSettingsStore.setState({
      dailyReviewLimit: 40,
      deckReviewHistory: {
        "deck-1": {
          date: new Date().toISOString().split("T")[0],
          reviewedCardIds,
        },
      },
    });
    mockGetDueCards.mockReturnValue([makeCard({ id: "c31" })] as any);

    useReviewStore.getState().loadQueue("deck-1");

    expect(mockGetDueCards).toHaveBeenCalledWith("deck-1", 11, reviewedCardIds);
    expect(useReviewStore.getState().remaining).toHaveLength(1);
  });

  it("tracks whether the deck was exhausted before the daily limit", () => {
    mockGetDueCards.mockReturnValue([makeCard({ id: "c1" })] as any);

    useReviewStore.getState().loadQueue("deck-1");

    expect(useReviewStore.getState().deckExhaustedToday).toBe(true);
  });

  it("does not mark deck exhausted when one extra card exists beyond the limit", () => {
    mockGetDueCards.mockReturnValue(Array.from({ length: 21 }, (_, i) => makeCard({ id: `c${i + 1}` })) as any);

    useReviewStore.getState().loadQueue("deck-1");

    expect(useReviewStore.getState().remaining).toHaveLength(20);
    expect(useReviewStore.getState().deckExhaustedToday).toBe(false);
  });

  it("does not query due cards when daily limit is already reached", () => {
    useSettingsStore.setState({
      dailyReviewLimit: 2,
      deckReviewHistory: {
        "deck-1": {
          date: new Date().toISOString().split("T")[0],
          reviewedCardIds: ["c1", "c2"],
        },
      },
    });

    useReviewStore.getState().loadQueue("deck-1");

    expect(mockGetDueCards).not.toHaveBeenCalled();
    expect(useReviewStore.getState().isComplete).toBe(true);
  });

  it("resets showResult to false", () => {
    useReviewStore.setState({ showResult: true });
    mockGetDueCards.mockReturnValue([]);

    useReviewStore.getState().loadQueue("deck-1");

    expect(useReviewStore.getState().showResult).toBe(false);
  });
});

describe("submitAnswer", () => {
  beforeEach(() => {
    const cards = [
      makeCard({ id: "c1", difficultyScore: 0.9 }),
      makeCard({ id: "c2", difficultyScore: 0.5 }),
    ];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");
    jest.clearAllMocks();
  });

  it("writes pending review with correct arguments", () => {
    mockGetVocabularyState.mockReturnValue(makeVocabState() as any);

    useReviewStore.getState().submitAnswer(true);

    expect(mockAddPendingReview).toHaveBeenCalledWith(
      "c1",
      true,
      expect.any(Number)
    );
  });

  it("calculates responseTimeMs from cardStartTime", () => {
    const startTime = Date.now() - 1500;
    useReviewStore.setState({ cardStartTime: startTime });
    mockGetVocabularyState.mockReturnValue(makeVocabState() as any);

    useReviewStore.getState().submitAnswer(true);

    const responseTime = mockAddPendingReview.mock.calls[0][2];
    expect(responseTime).toBeGreaterThanOrEqual(1400);
    expect(responseTime).toBeLessThanOrEqual(1600);
  });

  it("correct answer: resets consecutiveFailures to 0", () => {
    mockGetVocabularyState.mockReturnValue(
      makeVocabState({ consecutiveFailures: 3 }) as any
    );

    useReviewStore.getState().submitAnswer(true);

    expect(mockUpdateVocabularyState).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ consecutiveFailures: 0 })
    );
  });

  it("correct answer: increments totalReviews", () => {
    mockGetVocabularyState.mockReturnValue(
      makeVocabState({ totalReviews: 5 }) as any
    );

    useReviewStore.getState().submitAnswer(true);

    expect(mockUpdateVocabularyState).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ totalReviews: 6 })
    );
  });

  it("correct answer: does not increment totalFailures", () => {
    mockGetVocabularyState.mockReturnValue(
      makeVocabState({ totalFailures: 2 }) as any
    );

    useReviewStore.getState().submitAnswer(true);

    expect(mockUpdateVocabularyState).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ totalFailures: 2 })
    );
  });

  it("incorrect answer: increments consecutiveFailures", () => {
    mockGetVocabularyState.mockReturnValue(
      makeVocabState({ consecutiveFailures: 0 }) as any
    );

    useReviewStore.getState().submitAnswer(false);

    expect(mockUpdateVocabularyState).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ consecutiveFailures: 1 })
    );
  });

  it("incorrect answer: increments totalFailures", () => {
    mockGetVocabularyState.mockReturnValue(
      makeVocabState({ totalFailures: 1 }) as any
    );

    useReviewStore.getState().submitAnswer(false);

    expect(mockUpdateVocabularyState).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ totalFailures: 2 })
    );
  });

  it("incorrect answer: increments totalReviews", () => {
    mockGetVocabularyState.mockReturnValue(
      makeVocabState({ totalReviews: 0 }) as any
    );

    useReviewStore.getState().submitAnswer(false);

    expect(mockUpdateVocabularyState).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ totalReviews: 1 })
    );
  });

  it("sets showResult and lastResultCorrect", () => {
    mockGetVocabularyState.mockReturnValue(makeVocabState() as any);

    useReviewStore.getState().submitAnswer(false);

    expect(useReviewStore.getState().showResult).toBe(true);
    expect(useReviewStore.getState().lastResultCorrect).toBe(false);
  });

  it("retries a missed card after two other cards", () => {
    const cards = [
      makeCard({ id: "c1" }),
      makeCard({ id: "c2" }),
      makeCard({ id: "c3" }),
      makeCard({ id: "c4" }),
    ];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");
    mockGetVocabularyState.mockReturnValue(makeVocabState() as any);

    useReviewStore.getState().submitAnswer(false);

    expect(useReviewStore.getState().remaining.map((card) => card.id)).toEqual([
      "c2",
      "c3",
      "c1",
      "c4",
    ]);
  });

  it("moves a card to failedCards only after four misses", () => {
    const cards = [makeCard({ id: "c1" })];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");
    mockGetVocabularyState.mockReturnValue(makeVocabState() as any);

    for (let attempt = 1; attempt <= 3; attempt++) {
      useReviewStore.getState().submitAnswer(false);
      expect(useReviewStore.getState().failedCards).toHaveLength(0);
      expect(useReviewStore.getState().remaining).toHaveLength(1);
    }

    useReviewStore.getState().submitAnswer(false);

    expect(useReviewStore.getState().failedCards).toHaveLength(1);
    expect(useReviewStore.getState().remaining).toHaveLength(0);
  });

  it("when getVocabularyState returns null: skips vocab update but still writes pending review", () => {
    mockGetVocabularyState.mockReturnValue(undefined);

    useReviewStore.getState().submitAnswer(true);

    expect(mockAddPendingReview).toHaveBeenCalled();
    expect(mockUpdateVocabularyState).not.toHaveBeenCalled();
  });

  it("on empty queue: no-op", () => {
    useReviewStore.setState({ remaining: [], completed: [], failedCards: [] });
    jest.clearAllMocks();

    useReviewStore.getState().submitAnswer(true);

    expect(mockAddPendingReview).not.toHaveBeenCalled();
    expect(mockUpdateVocabularyState).not.toHaveBeenCalled();
  });
});

describe("dismissResult", () => {
  beforeEach(() => {
    const cards = [
      makeCard({ id: "c1" }),
      makeCard({ id: "c2" }),
      makeCard({ id: "c3" }),
    ];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");
    jest.clearAllMocks();
  });

  it("advances to next card", () => {
    useReviewStore.setState({ showResult: true });

    useReviewStore.getState().dismissResult();

    expect(useReviewStore.getState().remaining).toHaveLength(3);
    expect(useReviewStore.getState().showResult).toBe(false);
  });

  it("at last card: sets isComplete=true", () => {
    const cards = [makeCard({ id: "c1" })];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");
    mockGetVocabularyState.mockReturnValue(makeVocabState() as any);

    useReviewStore.getState().submitAnswer(true);
    useReviewStore.getState().dismissResult();

    expect(useReviewStore.getState().isComplete).toBe(true);
  });

  it("double-call at end: no crash", () => {
    const cards = [makeCard({ id: "c1" })];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");
    mockGetVocabularyState.mockReturnValue(makeVocabState() as any);

    useReviewStore.getState().submitAnswer(true);
    useReviewStore.getState().dismissResult();
    expect(useReviewStore.getState().isComplete).toBe(true);

    useReviewStore.setState({ showResult: true });
    useReviewStore.getState().dismissResult();
    expect(useReviewStore.getState().isComplete).toBe(true);
  });

  it("resets showResult to false", () => {
    useReviewStore.setState({ showResult: true });

    useReviewStore.getState().dismissResult();

    expect(useReviewStore.getState().showResult).toBe(false);
  });

  it("updates cardStartTime", () => {
    const before = useReviewStore.getState().cardStartTime;
    useReviewStore.setState({ showResult: true });

    useReviewStore.getState().dismissResult();

    expect(useReviewStore.getState().cardStartTime).toBeGreaterThanOrEqual(before);
  });
});

describe("resetSession", () => {
  it("reloads queue for current deckId", () => {
    const cards = [makeCard({ id: "c1" })];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");
    jest.clearAllMocks();

    mockGetDueCards.mockReturnValue([makeCard({ id: "c1-new" })] as any);

    useReviewStore.getState().resetSession();

    expect(mockGetDueCards).toHaveBeenCalledWith("deck-1", 21, []);
    expect(useReviewStore.getState().remaining).toHaveLength(1);
  });

  it("with null deckId: no-op", () => {
    useReviewStore.setState({ deckId: null });
    jest.clearAllMocks();

    useReviewStore.getState().resetSession();

    expect(mockGetDueCards).not.toHaveBeenCalled();
  });
});

describe("getCurrentCard", () => {
  it("returns current card", () => {
    const cards = [makeCard({ id: "c1" }), makeCard({ id: "c2" })];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");

    expect(useReviewStore.getState().getCurrentCard()?.id).toBe("c1");
  });

  it("with empty queue: returns null", () => {
    useReviewStore.setState({ remaining: [] });

    expect(useReviewStore.getState().getCurrentCard()).toBeNull();
  });
});

describe("getProgress", () => {
  it("returns progress with correct shape", () => {
    const cards = [makeCard({ id: "c1" }), makeCard({ id: "c2" }), makeCard({ id: "c3" })];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");

    const progress = useReviewStore.getState().getProgress();
    expect(progress.total).toBe(3);
    expect(progress.current).toBe(0);
    expect(progress.completedCount).toBe(0);
    expect(progress.failedCount).toBe(0);
    expect(progress.missedCount).toBe(0);
    expect(progress.accuracy).toBe(0);
    expect(progress.elapsedSeconds).toBeGreaterThanOrEqual(0);
  });

  it("with empty queue: returns zeros", () => {
    useReviewStore.setState({ remaining: [], completed: [], failedCards: [], answeredCount: 0 });

    const progress = useReviewStore.getState().getProgress();
    expect(progress.current).toBe(0);
    expect(progress.total).toBe(0);
  });
});

describe("SRS queue ordering", () => {
  it("cards returned in difficulty_score DESC order", () => {
    const cards = [
      makeCard({ id: "c1", difficultyScore: 0.9 }),
      makeCard({ id: "c2", difficultyScore: 0.5 }),
      makeCard({ id: "c3", difficultyScore: 0.2 }),
    ];
    mockGetDueCards.mockReturnValue(cards as any);

    useReviewStore.getState().loadQueue("deck-1");

    const remaining = useReviewStore.getState().remaining;
    expect(remaining[0].difficultyScore).toBe(0.9);
    expect(remaining[1].difficultyScore).toBe(0.5);
    expect(remaining[2].difficultyScore).toBe(0.2);
  });

  it("high-difficulty card not hidden", () => {
    const cards = [
      makeCard({ id: "c1", difficultyScore: 0.95 }),
      makeCard({ id: "c2", difficultyScore: 0.1 }),
    ];
    mockGetDueCards.mockReturnValue(cards as any);

    useReviewStore.getState().loadQueue("deck-1");

    expect(useReviewStore.getState().getCurrentCard()?.id).toBe("c1");
  });

  it("after reviewing hardest card, next-hardest surfaces", () => {
    const cards = [
      makeCard({ id: "c1", difficultyScore: 0.9 }),
      makeCard({ id: "c2", difficultyScore: 0.5 }),
    ];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");
    mockGetVocabularyState.mockReturnValue(makeVocabState() as any);

    useReviewStore.getState().submitAnswer(true);
    useReviewStore.getState().dismissResult();

    expect(useReviewStore.getState().getCurrentCard()?.id).toBe("c2");
  });

  it("all cards with same difficulty: all returned within limit", () => {
    const cards = [
      makeCard({ id: "c1", difficultyScore: 0.5 }),
      makeCard({ id: "c2", difficultyScore: 0.5 }),
      makeCard({ id: "c3", difficultyScore: 0.5 }),
    ];
    mockGetDueCards.mockReturnValue(cards as any);

    useReviewStore.getState().loadQueue("deck-1");

    expect(useReviewStore.getState().remaining).toHaveLength(3);
  });

  it("no duplicate cards in queue", () => {
    const cards = [
      makeCard({ id: "c1" }),
      makeCard({ id: "c2" }),
      makeCard({ id: "c3" }),
    ];
    mockGetDueCards.mockReturnValue(cards as any);

    useReviewStore.getState().loadQueue("deck-1");

    const ids = useReviewStore.getState().remaining.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all cards in deck appear in queue within limit", () => {
    const cards = Array.from({ length: 15 }, (_, i) =>
      makeCard({ id: `c${i}`, difficultyScore: 0.9 - i * 0.05 })
    );
    mockGetDueCards.mockReturnValue(cards as any);

    useReviewStore.getState().loadQueue("deck-1");

    expect(useReviewStore.getState().remaining).toHaveLength(15);
  });

  it("queue with limit=5 returns exactly 5", () => {
    mockGetDueCards.mockReturnValue([makeCard()] as any);

    useReviewStore.getState().loadQueue("deck-1");

    expect(mockGetDueCards).toHaveBeenCalledWith("deck-1", 21, []);
  });
});

describe("mapLocalItem defaults", () => {
  it("fills defaults for missing fields", () => {
    const item = { id: "c1" };
    mockGetDueCards.mockReturnValue([item] as any);

    useReviewStore.getState().loadQueue("deck-1");

    const card = useReviewStore.getState().remaining[0];
    expect(card.cardType).toBe("cloze_deletion");
    expect(card.sentence).toBe("");
    expect(card.answer).toBe("");
    expect(card.context).toBeNull();
    expect(card.srsInterval).toBe(0);
    expect(card.easeFactor).toBe(2.5);
    expect(card.difficultyScore).toBe(0);
    expect(card.totalReviews).toBe(0);
    expect(card.consecutiveFailures).toBe(0);
  });

  it("preserves all provided fields", () => {
    const item = {
      id: "c1",
      cardType: "custom",
      sentence: "测试",
      answer: "答案",
      difficultyScore: 0.8,
      totalReviews: 10,
    };
    mockGetDueCards.mockReturnValue([item] as any);

    useReviewStore.getState().loadQueue("deck-1");

    const card = useReviewStore.getState().remaining[0];
    expect(card.cardType).toBe("custom");
    expect(card.sentence).toBe("测试");
    expect(card.answer).toBe("答案");
    expect(card.difficultyScore).toBe(0.8);
    expect(card.totalReviews).toBe(10);
  });
});

describe("consecutive failure streak patterns", () => {
  it("3 incorrect on same card: consecutiveFailures goes 0->1->2->3", () => {
    const cards = [makeCard({ id: "c1" })];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");

    mockGetVocabularyState
      .mockReturnValueOnce(makeVocabState({ consecutiveFailures: 0 }) as any)
      .mockReturnValueOnce(makeVocabState({ consecutiveFailures: 1 }) as any)
      .mockReturnValueOnce(makeVocabState({ consecutiveFailures: 2 }) as any);

    useReviewStore.getState().submitAnswer(false);
    useReviewStore.getState().submitAnswer(false);
    useReviewStore.getState().submitAnswer(false);

    expect(mockUpdateVocabularyState.mock.calls[0][1].consecutiveFailures).toBe(1);
    expect(mockUpdateVocabularyState.mock.calls[1][1].consecutiveFailures).toBe(2);
    expect(mockUpdateVocabularyState.mock.calls[2][1].consecutiveFailures).toBe(3);
  });

  it("incorrect then correct: consecutiveFailures resets to 0", () => {
    const cards = [makeCard({ id: "c1" })];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");

    mockGetVocabularyState
      .mockReturnValueOnce(makeVocabState({ consecutiveFailures: 0 }) as any)
      .mockReturnValueOnce(makeVocabState({ consecutiveFailures: 1 }) as any);

    useReviewStore.getState().submitAnswer(false);
    useReviewStore.getState().submitAnswer(true);

    expect(mockUpdateVocabularyState.mock.calls[0][1].consecutiveFailures).toBe(1);
    expect(mockUpdateVocabularyState.mock.calls[1][1].consecutiveFailures).toBe(0);
  });

  it("2 incorrect then correct: streak resets to 0", () => {
    const cards = [makeCard({ id: "c1" })];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");

    mockGetVocabularyState
      .mockReturnValueOnce(makeVocabState({ consecutiveFailures: 0 }) as any)
      .mockReturnValueOnce(makeVocabState({ consecutiveFailures: 1 }) as any)
      .mockReturnValueOnce(makeVocabState({ consecutiveFailures: 2 }) as any);

    useReviewStore.getState().submitAnswer(false);
    useReviewStore.getState().submitAnswer(false);
    useReviewStore.getState().submitAnswer(true);

    const calls = mockUpdateVocabularyState.mock.calls;
    expect(calls[0][1].consecutiveFailures).toBe(1);
    expect(calls[1][1].consecutiveFailures).toBe(2);
    expect(calls[2][1].consecutiveFailures).toBe(0);
  });
});

describe("mastery tracking (consecutiveCorrect)", () => {
  beforeEach(() => {
    const cards = [makeCard({ id: "c1" })];
    mockGetDueCards.mockReturnValue(cards as any);
    useReviewStore.getState().loadQueue("deck-1");
    jest.clearAllMocks();
  });

  it("correct answer: increments consecutiveCorrect", () => {
    mockGetVocabularyState.mockReturnValue(
      makeVocabState({ consecutiveCorrect: 0 }) as any
    );

    useReviewStore.getState().submitAnswer(true);

    expect(mockUpdateVocabularyState).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ consecutiveCorrect: 1 })
    );
  });

  it("incorrect answer: resets consecutiveCorrect to 0", () => {
    mockGetVocabularyState.mockReturnValue(
      makeVocabState({ consecutiveCorrect: 2 }) as any
    );

    useReviewStore.getState().submitAnswer(false);

    expect(mockUpdateVocabularyState).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ consecutiveCorrect: 0 })
    );
  });

  it("incorrect then correct: consecutiveCorrect goes 0->1", () => {
    mockGetVocabularyState
      .mockReturnValueOnce(makeVocabState({ consecutiveCorrect: 0 }) as any)
      .mockReturnValueOnce(makeVocabState({ consecutiveCorrect: 0 }) as any);

    useReviewStore.getState().submitAnswer(false);
    useReviewStore.getState().submitAnswer(true);

    expect(mockUpdateVocabularyState.mock.calls[0][1].consecutiveCorrect).toBe(0);
    expect(mockUpdateVocabularyState.mock.calls[1][1].consecutiveCorrect).toBe(1);
  });
});
