import { useSettingsStore } from "../useSettingsStore";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

beforeEach(() => {
  require("expo-file-system").__resetStore();
  useSettingsStore.setState({
    dailyReviewLimit: 20,
    deckReviewHistory: {},
    reviewedDates: [],
    isLoaded: false,
  });
});

describe("useSettingsStore review limits", () => {
  it("keeps a deck reviewable when reviewed count is below the current limit", () => {
    useSettingsStore.setState({ dailyReviewLimit: 40 });
    useSettingsStore.getState().markDeckReviewed("deck-1", Array.from({ length: 30 }, (_, i) => `c${i + 1}`));

    expect(useSettingsStore.getState().isDeckReviewedToday("deck-1")).toBe(false);
    expect(useSettingsStore.getState().getRemainingDailyReviews("deck-1")).toBe(10);
  });

  it("marks a deck reviewed when reviewed count reaches the current limit", () => {
    useSettingsStore.setState({ dailyReviewLimit: 40 });
    useSettingsStore.getState().markDeckReviewed("deck-1", Array.from({ length: 40 }, (_, i) => `c${i + 1}`));

    expect(useSettingsStore.getState().isDeckReviewedToday("deck-1")).toBe(true);
    expect(useSettingsStore.getState().getRemainingDailyReviews("deck-1")).toBe(0);
  });

  it("merges reviewed card IDs across sessions on the same day", () => {
    useSettingsStore.getState().markDeckReviewed("deck-1", ["c1", "c2"]);
    useSettingsStore.getState().markDeckReviewed("deck-1", ["c2", "c3"]);

    expect(useSettingsStore.getState().getDeckReviewedCardIdsToday("deck-1")).toEqual(["c1", "c2", "c3"]);
  });

  it("preserves reviewed IDs when increasing the daily limit", () => {
    useSettingsStore.setState({
      dailyReviewLimit: 30,
      deckReviewHistory: {
        "deck-1": { date: today(), reviewedCardIds: Array.from({ length: 30 }, (_, i) => `c${i + 1}`) },
      },
    });

    useSettingsStore.getState().setDailyReviewLimit(40);

    expect(useSettingsStore.getState().getDeckReviewedCardIdsToday("deck-1")).toHaveLength(30);
    expect(useSettingsStore.getState().getRemainingDailyReviews("deck-1")).toBe(10);
  });

  it("marks a deck reviewed when all available cards are exhausted below the limit", () => {
    useSettingsStore.setState({ dailyReviewLimit: 20 });

    useSettingsStore.getState().markDeckReviewed("deck-1", ["c1", "c2"], true);

    expect(useSettingsStore.getState().isDeckReviewedToday("deck-1")).toBe(true);
  });
});
