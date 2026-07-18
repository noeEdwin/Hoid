import { useSettingsStore } from "../useSettingsStore";

function today(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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

afterEach(() => {
  jest.useRealTimers();
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

  it("resets deck completion at local midnight", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 17, 23, 59));
    useSettingsStore.getState().markDeckReviewed("deck-1", ["c1"], true);

    jest.setSystemTime(new Date(2026, 6, 18, 0, 1));

    expect(useSettingsStore.getState().isDeckReviewedToday("deck-1")).toBe(false);
    expect(useSettingsStore.getState().getDeckReviewedCardIdsToday("deck-1")).toEqual([]);
    expect(useSettingsStore.getState().getRemainingDailyReviews("deck-1")).toBe(20);
  });
});

describe("useSettingsStore streak", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("counts consecutive local calendar days", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 18, 0, 1));
    useSettingsStore.setState({ reviewedDates: ["2026-07-16", "2026-07-17", "2026-07-18"] });

    expect(useSettingsStore.getState().getStreak()).toBe(3);
  });

  it("preserves yesterday's streak until today's review", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 18, 12));
    useSettingsStore.setState({ reviewedDates: ["2026-07-16", "2026-07-17"] });

    expect(useSettingsStore.getState().getStreak()).toBe(2);
  });

  it("returns zero after a skipped local calendar day", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 18, 12));
    useSettingsStore.setState({ reviewedDates: ["2026-07-15", "2026-07-16"] });

    expect(useSettingsStore.getState().getStreak()).toBe(0);
  });
});

describe("useSettingsStore date migration", () => {
  function writeSettings(settings: object): void {
    const { File, Directory, Paths } = require("expo-file-system");
    new File(new Directory(Paths.document), "settings.json").write(JSON.stringify(settings));
  }

  it("clears only legacy UTC deck locks", async () => {
    writeSettings({
      dailyReviewLimit: 40,
      drillMode: false,
      deckReviewHistory: {
        "master-deck": { date: today(), reviewedCardIds: ["c1"], exhausted: true },
      },
      reviewedDates: ["2026-07-16", "2026-07-17"],
      lastSyncAt: "2026-07-17T20:00:00.000Z",
    });

    await useSettingsStore.getState().loadSettings();

    const state = useSettingsStore.getState();
    expect(state.deckReviewHistory).toEqual({});
    expect(state.reviewedDates).toEqual(["2026-07-16", "2026-07-17"]);
    expect(state.dailyReviewLimit).toBe(40);
    expect(state.drillMode).toBe(false);
    expect(state.lastSyncAt).toBe("2026-07-17T20:00:00.000Z");
  });

  it("preserves local-date deck locks after migration", async () => {
    writeSettings({
      dailyReviewLimit: 20,
      drillMode: true,
      reviewDateBasis: "local",
      deckReviewHistory: {
        "master-deck": { date: today(), reviewedCardIds: ["c1"], exhausted: true },
      },
      reviewedDates: [today()],
    });

    await useSettingsStore.getState().loadSettings();

    expect(useSettingsStore.getState().isDeckReviewedToday("master-deck")).toBe(true);
  });
});
