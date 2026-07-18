import { create } from "zustand";
import { Paths, File, Directory } from "expo-file-system";
import { getCalendarDayNumber, getLocalDateKey, getPreviousLocalDateKey } from "../lib/local-date";

interface Settings {
  dailyReviewLimit: number;
  drillMode: boolean;
  deckReviewHistory: Record<string, DeckReviewHistoryEntry | string>;
  reviewedDates: string[];
  lastSyncAt?: string;
  reviewDateBasis?: "local";
}

interface DeckReviewHistoryEntry {
  date: string;
  reviewedCardIds: string[];
  exhausted?: boolean;
}

interface SettingsState {
  dailyReviewLimit: number;
  drillMode: boolean;
  deckReviewHistory: Record<string, DeckReviewHistoryEntry>;
  isLoaded: boolean;

  loadSettings: () => Promise<void>;
  setDailyReviewLimit: (limit: number) => void;
  setDrillMode: (enabled: boolean) => void;
  markDeckReviewed: (deckId: string, cardIds: string[], exhausted?: boolean) => void;
  resetDeckReviewed: (deckId: string) => void;
  resetAllDeckReviews: () => void;
  isDeckReviewedToday: (deckId: string) => boolean;
  getDeckReviewedCardIdsToday: (deckId: string) => string[];
  getRemainingDailyReviews: (deckId: string) => number;
  reviewedDates: string[];
  lastSyncAt?: string;
  getStreak : () => number;
  getLastSyncAt: () => string | undefined;
  setLastSyncAt: (timestamp: string) => void;
}

const SETTINGS_FILE = "settings.json";
const REVIEW_DATE_BASIS = "local" as const;

function normalizeDeckReviewHistory(
  history: Settings["deckReviewHistory"] = {}
): Record<string, DeckReviewHistoryEntry> {
  return Object.fromEntries(
    Object.entries(history).map(([deckId, entry]) => {
      if (typeof entry === "string") {
        return [deckId, { date: entry, reviewedCardIds: [] }];
      }
      return [deckId, {
        date: entry.date,
        reviewedCardIds: Array.isArray(entry.reviewedCardIds) ? entry.reviewedCardIds : [],
        exhausted: entry.exhausted ?? false,
      }];
    })
  );
}

function getSettingsFile(): File {
  const dir = new Directory(Paths.document);
  if (!dir.exists) {
    dir.create();
  }
  return new File(dir, SETTINGS_FILE);
}

async function readSettingsFile(): Promise<Settings | null> {
  try {
    const file = getSettingsFile();
    if (!file.exists) return null;
    const content = await file.text();
    return JSON.parse(content) as Settings;
  } catch {
    return null;
  }
}

function writeSettingsFile(settings: Settings): void {
  const file = getSettingsFile();
  file.write(JSON.stringify({ ...settings, reviewDateBasis: REVIEW_DATE_BASIS }));
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  dailyReviewLimit: 20,
  drillMode: true,
  deckReviewHistory: {},
  reviewedDates: [],
  isLoaded: false,

  loadSettings: async () => {
    const settings = await readSettingsFile();
    if (settings) {
      const deckReviewHistory = settings.reviewDateBasis === REVIEW_DATE_BASIS
        ? normalizeDeckReviewHistory(settings.deckReviewHistory)
        : {};
      set({
        dailyReviewLimit: settings.dailyReviewLimit ?? 20,
        drillMode: settings.drillMode ?? true,
        deckReviewHistory,
        reviewedDates: settings.reviewedDates ?? [],
        lastSyncAt: settings.lastSyncAt,
        isLoaded: true,
      });
      if (settings.reviewDateBasis !== REVIEW_DATE_BASIS) {
        writeSettingsFile({
          ...settings,
          dailyReviewLimit: settings.dailyReviewLimit ?? 20,
          drillMode: settings.drillMode ?? true,
          deckReviewHistory,
          reviewedDates: settings.reviewedDates ?? [],
        });
      }
    } else {
      set({ isLoaded: true, lastSyncAt: undefined });
    }
  },

  setDailyReviewLimit: (limit: number) => {
    const clamped = Math.max(5, Math.min(100, limit));
    const { deckReviewHistory, reviewedDates } = get();
    set({ dailyReviewLimit: clamped });
    writeSettingsFile({ dailyReviewLimit: clamped, drillMode: get().drillMode, deckReviewHistory, reviewedDates, lastSyncAt: get().lastSyncAt });
  },

  setDrillMode: (enabled: boolean) => {
    const { dailyReviewLimit, deckReviewHistory, reviewedDates } = get();
    set({ drillMode: enabled });
    writeSettingsFile({ dailyReviewLimit, drillMode: enabled, deckReviewHistory, reviewedDates, lastSyncAt: get().lastSyncAt });
  },

  markDeckReviewed: (deckId: string, cardIds: string[], exhausted: boolean = false) => {
    const today = getLocalDateKey();
    const { dailyReviewLimit, deckReviewHistory, reviewedDates } = get();
    const existing = deckReviewHistory[deckId];
    const existingCardIds = existing?.date === today ? existing.reviewedCardIds : [];
    const wasExhausted = existing?.date === today ? existing.exhausted ?? false : false;
    const reviewedCardIds = Array.from(new Set([...existingCardIds, ...cardIds]));
    const updatedHistory = { ...deckReviewHistory, [deckId]: { date: today, reviewedCardIds, exhausted: wasExhausted || exhausted } };
    const updatedDates = reviewedDates.includes(today)
      ? reviewedDates
      : [...reviewedDates, today];
    set({ deckReviewHistory: updatedHistory, reviewedDates: updatedDates });
    writeSettingsFile({ dailyReviewLimit, drillMode: get().drillMode, deckReviewHistory: updatedHistory, reviewedDates: updatedDates, lastSyncAt: get().lastSyncAt });
  },

  resetDeckReviewed: (deckId: string) => {
    const { dailyReviewLimit, deckReviewHistory, reviewedDates } = get();
    const updated = { ...deckReviewHistory };
    delete updated[deckId];
    set({ deckReviewHistory: updated });
    writeSettingsFile({ dailyReviewLimit, drillMode: get().drillMode, deckReviewHistory: updated, reviewedDates, lastSyncAt: get().lastSyncAt });
  },

  resetAllDeckReviews: () => {
    const { dailyReviewLimit } = get();
    set({ deckReviewHistory: {}, reviewedDates: [] });
    writeSettingsFile({ dailyReviewLimit, drillMode: get().drillMode, deckReviewHistory: {}, reviewedDates: [], lastSyncAt: get().lastSyncAt });
  },

  isDeckReviewedToday: (deckId: string) => {
    const { deckReviewHistory } = get();
    const lastReviewed = deckReviewHistory[deckId];
    if (!lastReviewed) return false;
    return lastReviewed.date === getLocalDateKey()
      && (lastReviewed.reviewedCardIds.length >= get().dailyReviewLimit || lastReviewed.exhausted === true);
  },

  getDeckReviewedCardIdsToday: (deckId: string) => {
    const lastReviewed = get().deckReviewHistory[deckId];
    if (!lastReviewed || lastReviewed.date !== getLocalDateKey()) return [];
    return lastReviewed.reviewedCardIds;
  },

  getRemainingDailyReviews: (deckId: string) => {
    const reviewedCount = get().getDeckReviewedCardIdsToday(deckId).length;
    return Math.max(0, get().dailyReviewLimit - reviewedCount);
  },

  getStreak: () => {
    const { reviewedDates } = get();
    if (reviewedDates.length === 0) return 0;

    const today = getLocalDateKey();
    const yesterday = getPreviousLocalDateKey();

    const unique = [...new Set(reviewedDates)].sort().reverse();

    if (unique[0] !== today && unique[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 0; i < unique.length - 1; i++) {
      const current = getCalendarDayNumber(unique[i]);
      const next = getCalendarDayNumber(unique[i + 1]);
      if (current === null || next === null) break;
      const diffDays = current - next;
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  },

  getLastSyncAt: () => get().lastSyncAt,

  setLastSyncAt: (timestamp: string) => {
    const { dailyReviewLimit, deckReviewHistory, reviewedDates, drillMode } = get();
    set({ lastSyncAt: timestamp });
    writeSettingsFile({ dailyReviewLimit, drillMode, deckReviewHistory, reviewedDates, lastSyncAt: timestamp });
  },
}));
