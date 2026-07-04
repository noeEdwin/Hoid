import { create } from "zustand";
import { Paths, File, Directory } from "expo-file-system";

interface Settings {
  dailyReviewLimit: number;
  deckReviewHistory: Record<string, string>;
  reviewedDates: string[];
}

interface SettingsState {
  dailyReviewLimit: number;
  deckReviewHistory: Record<string, string>;
  isLoaded: boolean;

  loadSettings: () => Promise<void>;
  setDailyReviewLimit: (limit: number) => void;
  markDeckReviewed: (deckId: string) => void;
  resetDeckReviewed: (deckId: string) => void;
  resetAllDeckReviews: () => void;
  isDeckReviewedToday: (deckId: string) => boolean;
  reviewedDates: string[];
  getStreak : () => number;
}

const SETTINGS_FILE = "settings.json";

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
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
  file.write(JSON.stringify(settings));
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  dailyReviewLimit: 20,
  deckReviewHistory: {},
  reviewedDates: [],
  isLoaded: false,

  loadSettings: async () => {
    const settings = await readSettingsFile();
    if (settings) {
      set({
        dailyReviewLimit: settings.dailyReviewLimit ?? 20,
        deckReviewHistory: settings.deckReviewHistory ?? {},
        reviewedDates: settings.reviewedDates ?? [],
        isLoaded: true,
      });
    } else {
      set({ isLoaded: true });
    }
  },

  setDailyReviewLimit: (limit: number) => {
    const clamped = Math.max(5, Math.min(100, limit));
    const { deckReviewHistory, reviewedDates } = get();
    set({ dailyReviewLimit: clamped });
    writeSettingsFile({ dailyReviewLimit: clamped, deckReviewHistory, reviewedDates });
  },

  markDeckReviewed: (deckId: string) => {
    const today = getTodayString();
    const { dailyReviewLimit, deckReviewHistory, reviewedDates } = get();
    const updatedHistory = { ...deckReviewHistory, [deckId]: today };
    const updatedDates = reviewedDates.includes(today)
      ? reviewedDates
      : [...reviewedDates, today];
    set({ deckReviewHistory: updatedHistory, reviewedDates: updatedDates });
    writeSettingsFile({ dailyReviewLimit, deckReviewHistory: updatedHistory, reviewedDates: updatedDates });
  },

  resetDeckReviewed: (deckId: string) => {
    const { dailyReviewLimit, deckReviewHistory, reviewedDates } = get();
    const updated = { ...deckReviewHistory };
    delete updated[deckId];
    set({ deckReviewHistory: updated });
    writeSettingsFile({ dailyReviewLimit, deckReviewHistory: updated, reviewedDates });
  },

  resetAllDeckReviews: () => {
    const { dailyReviewLimit } = get();
    set({ deckReviewHistory: {}, reviewedDates: [] });
    writeSettingsFile({ dailyReviewLimit, deckReviewHistory: {}, reviewedDates: [] });
  },

  isDeckReviewedToday: (deckId: string) => {
    const { deckReviewHistory } = get();
    const lastReviewed = deckReviewHistory[deckId];
    if (!lastReviewed) return false;
    return lastReviewed === getTodayString();
  },

  getStreak: () => {
    const { reviewedDates } = get();
    if (reviewedDates.length === 0) return 0;

    const today = getTodayString();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    const unique = [...new Set(reviewedDates)].sort().reverse();

    if (unique[0] !== today && unique[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 0; i < unique.length - 1; i++) {
      const current = new Date(unique[i]);
      const next = new Date(unique[i + 1]);
      const diffDays = (current.getTime() - next.getTime()) / 86400000;
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  },
}));
