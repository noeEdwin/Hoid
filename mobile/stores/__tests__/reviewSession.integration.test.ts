import { useReviewStore } from "../useReviewStore";
import type { ReviewCard } from "../useReviewStore";

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
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useReviewStore.setState({
    queue: [],
    currentIndex: 0,
    deckId: null,
    isComplete: false,
    showResult: false,
    lastResultCorrect: false,
    cardStartTime: Date.now(),
  });
});

describe("Full review session lifecycle", () => {
  it("complete 3-card session: correct, incorrect, incorrect", () => {
    const cards = [
      makeCard({ id: "c1", difficultyScore: 0.9, answer: "爱" }),
      makeCard({ id: "c2", difficultyScore: 0.5, answer: "朋友" }),
      makeCard({ id: "c3", difficultyScore: 0.2, answer: "喝" }),
    ];
    mockGetDueCards.mockReturnValue(cards);

    useReviewStore.getState().loadQueue("deck-1");

    const state0 = useReviewStore.getState();
    expect(state0.queue).toHaveLength(3);
    expect(state0.currentIndex).toBe(0);
    expect(state0.isComplete).toBe(false);
    expect(state0.getCurrentCard()?.id).toBe("c1");

    mockGetVocabularyState.mockReturnValue({
      id: "vs-1",
      flashcardId: "c1",
      totalReviews: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      difficultyScore: 0.9,
      srsInterval: 0,
      easeFactor: 2.5,
    });

    useReviewStore.getState().submitAnswer(true);

    expect(mockAddPendingReview).toHaveBeenCalledWith("c1", true, expect.any(Number));
    expect(mockUpdateVocabularyState).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ consecutiveFailures: 0, totalReviews: 1 })
    );

    useReviewStore.getState().dismissResult();

    const state1 = useReviewStore.getState();
    expect(state1.currentIndex).toBe(1);
    expect(state1.showResult).toBe(false);
    expect(state1.getCurrentCard()?.id).toBe("c2");

    mockGetVocabularyState.mockReturnValue({
      id: "vs-2",
      flashcardId: "c2",
      totalReviews: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      difficultyScore: 0.5,
      srsInterval: 0,
      easeFactor: 2.5,
    });

    useReviewStore.getState().submitAnswer(false);

    expect(mockAddPendingReview).toHaveBeenCalledWith("c2", false, expect.any(Number));
    expect(mockUpdateVocabularyState).toHaveBeenCalledWith(
      "c2",
      expect.objectContaining({ consecutiveFailures: 1, totalFailures: 1, totalReviews: 1 })
    );

    useReviewStore.getState().dismissResult();

    const state2 = useReviewStore.getState();
    expect(state2.currentIndex).toBe(2);
    expect(state2.getCurrentCard()?.id).toBe("c3");

    mockGetVocabularyState.mockReturnValue({
      id: "vs-3",
      flashcardId: "c3",
      totalReviews: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      difficultyScore: 0.2,
      srsInterval: 0,
      easeFactor: 2.5,
    });

    useReviewStore.getState().submitAnswer(false);

    expect(mockUpdateVocabularyState).toHaveBeenCalledWith(
      "c3",
      expect.objectContaining({ consecutiveFailures: 1, totalFailures: 1, totalReviews: 1 })
    );

    useReviewStore.getState().dismissResult();

    const state3 = useReviewStore.getState();
    expect(state3.isComplete).toBe(true);
    expect(state3.getCurrentCard()).toBeNull();
  });

  it("resetSession reloads queue and resets progress", () => {
    const cards = [makeCard({ id: "c1" })];
    mockGetDueCards.mockReturnValue(cards);
    useReviewStore.getState().loadQueue("deck-1");

    mockGetVocabularyState.mockReturnValue({
      id: "vs-1",
      flashcardId: "c1",
      totalReviews: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      difficultyScore: 0.5,
      srsInterval: 0,
      easeFactor: 2.5,
    });

    useReviewStore.getState().submitAnswer(true);
    useReviewStore.getState().dismissResult();
    expect(useReviewStore.getState().isComplete).toBe(true);

    mockGetDueCards.mockReturnValue([makeCard({ id: "c1" })]);
    useReviewStore.getState().resetSession();

    const state = useReviewStore.getState();
    expect(state.currentIndex).toBe(0);
    expect(state.isComplete).toBe(false);
    expect(state.getCurrentCard()?.id).toBe("c1");
  });
});

describe("SRS scheduling behavior", () => {
  it("cards not hidden after review - remain in queue", () => {
    const cards = [
      makeCard({ id: "c1", difficultyScore: 0.8 }),
      makeCard({ id: "c2", difficultyScore: 0.3 }),
    ];
    mockGetDueCards.mockReturnValue(cards);
    useReviewStore.getState().loadQueue("deck-1");

    mockGetVocabularyState.mockReturnValue({
      id: "vs-1",
      flashcardId: "c1",
      totalReviews: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      difficultyScore: 0.8,
      srsInterval: 0,
      easeFactor: 2.5,
    });

    useReviewStore.getState().submitAnswer(true);

    expect(useReviewStore.getState().queue).toHaveLength(2);
  });

  it("difficulty ordering preserved across turns", () => {
    const cards = [
      makeCard({ id: "c1", difficultyScore: 0.9 }),
      makeCard({ id: "c2", difficultyScore: 0.5 }),
      makeCard({ id: "c3", difficultyScore: 0.1 }),
    ];
    mockGetDueCards.mockReturnValue(cards);
    useReviewStore.getState().loadQueue("deck-1");

    mockGetVocabularyState.mockReturnValue({
      id: "vs",
      flashcardId: "c1",
      totalReviews: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      difficultyScore: 0.9,
      srsInterval: 0,
      easeFactor: 2.5,
    });

    useReviewStore.getState().submitAnswer(true);
    useReviewStore.getState().dismissResult();

    expect(useReviewStore.getState().getCurrentCard()?.id).toBe("c2");

    useReviewStore.getState().submitAnswer(true);
    useReviewStore.getState().dismissResult();

    expect(useReviewStore.getState().getCurrentCard()?.id).toBe("c3");
  });

  it("high-difficulty cards always surface first", () => {
    const cards = [
      makeCard({ id: "hard", difficultyScore: 0.95 }),
      makeCard({ id: "easy", difficultyScore: 0.1 }),
    ];
    mockGetDueCards.mockReturnValue(cards);
    useReviewStore.getState().loadQueue("deck-1");

    expect(useReviewStore.getState().getCurrentCard()?.id).toBe("hard");
  });

  it("streak tracking across multiple reviews", () => {
    const cards = [
      makeCard({ id: "c1" }),
      makeCard({ id: "c2" }),
      makeCard({ id: "c3" }),
      makeCard({ id: "c4" }),
    ];
    mockGetDueCards.mockReturnValue(cards);
    useReviewStore.getState().loadQueue("deck-1");

    const states = [
      { consecutiveFailures: 0, totalFailures: 0, totalReviews: 0 },
      { consecutiveFailures: 1, totalFailures: 1, totalReviews: 1 },
      { consecutiveFailures: 2, totalFailures: 2, totalReviews: 2 },
      { consecutiveFailures: 0, totalFailures: 2, totalReviews: 3 },
    ];

    const answers = [false, false, false, true];

    for (let i = 0; i < 4; i++) {
      mockGetVocabularyState.mockReturnValue({
        id: `vs-${i}`,
        flashcardId: `c${i + 1}`,
        ...states[i],
        difficultyScore: 0.5,
        srsInterval: 0,
        easeFactor: 2.5,
      });

      useReviewStore.getState().submitAnswer(answers[i]);
      useReviewStore.getState().dismissResult();
    }

    const calls = mockUpdateVocabularyState.mock.calls;
    expect(calls[0][1].consecutiveFailures).toBe(1);
    expect(calls[1][1].consecutiveFailures).toBe(2);
    expect(calls[2][1].consecutiveFailures).toBe(3);
    expect(calls[3][1].consecutiveFailures).toBe(0);
  });
});
