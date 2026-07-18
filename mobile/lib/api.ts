import Constants from "expo-constants";

const configuredApiBase = Constants.expoConfig?.extra?.apiBaseUrl;
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.3.11:8000";
const EFFECTIVE_API_BASE = configuredApiBase ?? API_BASE;
const DEFAULT_TIMEOUT_MS = 5000;

export type ApiErrorCode = "timeout" | "network" | "http" | "unknown";

export class ApiError extends Error {
  code: ApiErrorCode;
  status?: number;
  url: string;

  constructor(message: string, code: ApiErrorCode, status?: number, url: string = EFFECTIVE_API_BASE) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.url = url;
  }
}

interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export function getApiBase(): string {
  return EFFECTIVE_API_BASE;
}

export interface ApiDeck {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface ApiFlashcard {
  id: string;
  deck_id: string;
  card_type: string;
  sentence: string | null;
  sentence_pinyin: string | null;
  answer: string | null;
  answer_pinyin: string | null;
  context: string | null;
  context_pinyin: string | null;
  image_path: string | null;
  audio_path: string | null;
  created_at: string;
}

export interface ApiReviewQueueItem {
  flashcard_id: string;
  sentence: string;
  sentence_pinyin: string;
  answer: string;
  answer_pinyin: string;
  card_type: string;
  srs_interval: number;
  ease_factor: number;
  difficulty_score: number;
  total_reviews: number;
  total_failures: number;
  consecutive_failures: number;
}

export interface ApiDifficultToken {
  flashcard_id: string;
  sentence: string;
  answer: string;
  answer_pinyin: string;
  card_type: string;
  difficulty_score: number;
  total_reviews: number;
  total_failures: number;
}

export interface ApiSrsHealthCard {
  flashcard_id: string;
  answer: string;
  sentence: string;
  difficulty_score: number;
  total_reviews: number;
  total_failures: number;
  srs_interval: number;
  last_reviewed_at: string | null;
  next_review_at: string | null;
}

export interface ApiSrsHealth {
  timezone: string;
  now: string;
  scheduled_cards: number;
  unscheduled_reviewed_cards: number;
  new_cards: number;
  due_today: number;
  due_tomorrow: number;
  hardest_due: ApiSrsHealthCard[];
  recently_reviewed: ApiSrsHealthCard[];
}

async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${EFFECTIVE_API_BASE}${path}`;

  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
      signal: controller.signal,
    });
    let responseText: string | undefined;
    let responseJson: unknown;
    if (typeof res.text === "function") {
      responseText = await res.text();
      if (responseText) {
        try {
          responseJson = JSON.parse(responseText);
        } catch {
          responseJson = undefined;
        }
      }
    } else {
      responseJson = await res.json();
    }
    if (!res.ok) {
      const detail = (responseText ?? formatResponseBody(responseJson))
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 300);
      throw new ApiError(
        `API error: ${res.status}${detail ? `: ${detail}` : ""}`,
        "http",
        res.status,
        url
      );
    }
    if (responseJson !== undefined) {
      return responseJson as T;
    }
    if (!responseText?.trim()) {
      throw new ApiError(
        "Invalid JSON response (empty response)",
        "unknown",
        undefined,
        url
      );
    }
    throw new ApiError(
      `Invalid JSON response: ${responseText.trim().slice(0, 200)}`,
      "unknown",
      undefined,
      url
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(`Request timeout after ${timeoutMs}ms`, "timeout", undefined, url);
    }
    if (error instanceof Error) {
      throw new ApiError(error.message || "Failed to fetch", "network", undefined, url);
    }
    throw new ApiError(`Unknown API error: ${String(error)}`, "unknown", undefined, url);
  } finally {
    clearTimeout(timeout);
  }
}

function formatResponseBody(body: unknown): string {
  if (typeof body === "string") return body;
  if (body === undefined) return "";
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

export async function fetchDecks(): Promise<ApiDeck[]> {
  const data = await apiFetch<{ decks: ApiDeck[] }>("/api/decks");
  return data.decks;
}

export async function fetchFlashcards(deckId: string): Promise<ApiFlashcard[]> {
  const data = await apiFetch<{ flashcards: ApiFlashcard[]; total: number }>(
    `/api/flashcards?deck_id=${deckId}`
  );
  return data.flashcards;
}

export async function fetchReviewQueue(
  deckId: string,
  limit: number = 20
): Promise<ApiReviewQueueItem[]> {
  const data = await apiFetch<{ queue: ApiReviewQueueItem[]; total_pending: number }>(
    `/api/decks/${deckId}/review?limit=${limit}`
  );
  return data.queue;
}

export async function submitReview(
  flashcardId: string,
  isCorrect: boolean,
  responseTimeMs: number
): Promise<{ new_srs_interval: number; new_difficulty_score: number }> {
  const data = await apiFetch<{
    status: string;
    flashcard_id: string;
    new_srs_interval: number;
    new_difficulty_score: number;
  }>(`/api/flashcards/${flashcardId}/review`, {
    method: "POST",
    body: JSON.stringify({
      flashcard_id: flashcardId,
      is_correct: isCorrect,
      response_time_ms: responseTimeMs,
    }),
  });
  return {
    new_srs_interval: data.new_srs_interval,
    new_difficulty_score: data.new_difficulty_score,
  };
}

export async function fetchDifficultTokens(
  n: number = 10
): Promise<ApiDifficultToken[]> {
  const data = await apiFetch<{ difficult_tokens: ApiDifficultToken[] }>(
    `/api/vocabulary/difficulty?n=${n}`
  );
  return data.difficult_tokens;
}

export async function fetchSrsHealth(): Promise<ApiSrsHealth> {
  return apiFetch<ApiSrsHealth>("/api/vocabulary/srs-health");
}

export async function createDeckApi(
  name: string,
  description?: string
): Promise<ApiDeck> {
  return apiFetch<ApiDeck>("/api/decks", {
    method: "POST",
    body: JSON.stringify({ name, description: description ?? null }),
  });
}

export async function deleteDeckApi(deckId: string): Promise<void> {
  await apiFetch(`/api/decks/${deckId}`, { method: "DELETE" });
}

export async function createFlashcardApi(data: {
  deck_id: string;
  sentence: string;
  sentence_pinyin?: string;
  answer: string;
  answer_pinyin?: string;
  context?: string;
  context_pinyin?: string;
}): Promise<ApiFlashcard> {
  return apiFetch<ApiFlashcard>("/api/flashcards", {
    method: "POST",
    body: JSON.stringify({ card_type: "cloze_deletion", ...data }),
  });
}

export async function updateFlashcardApi(
  flashcardId: string,
  data: {
    sentence?: string;
    sentence_pinyin?: string;
    answer?: string;
    answer_pinyin?: string;
    context?: string;
    context_pinyin?: string;
  }
): Promise<ApiFlashcard> {
  return apiFetch<ApiFlashcard>(`/api/flashcards/${flashcardId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteFlashcardApi(flashcardId: string): Promise<void> {
  await apiFetch(`/api/flashcards/${flashcardId}`, { method: "DELETE" });
}

export interface BulkFlashcardItem {
  sentence?: string;
  sentence_pinyin?: string;
  answer: string;
  answer_pinyin?: string;
  context?: string;
  context_pinyin?: string;
  image_path?: string;
}

export async function bulkCreateFlashcardsApi(
  deckId: string,
  flashcards: BulkFlashcardItem[]
): Promise<{ created: number; errors: string[] }> {
  return apiFetch<{ created: number; errors: string[] }>(
    `/api/decks/${deckId}/flashcards/bulk`,
    {
      method: "POST",
      body: JSON.stringify({ flashcards }),
    }
  );
}

export interface SyncDeckItem {
  id: string;
  name: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SyncFlashcardItem {
  id: string;
  deck_id: string;
  card_type: string;
  sentence: string | null;
  sentence_pinyin: string | null;
  answer: string | null;
  answer_pinyin: string | null;
  context: string | null;
  context_pinyin: string | null;
  image_path: string | null;
  audio_path: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SyncVocabStateItem {
  flashcard_id: string;
  srs_interval: number;
  ease_factor: number;
  total_reviews: number;
  total_failures: number;
  consecutive_failures: number;
  consecutive_correct: number;
  difficulty_score: number;
  last_reviewed_at?: string;
  next_review_at?: string;
  updated_at?: string;
}

export interface SyncPendingReviewItem {
  id: string;
  flashcard_id: string;
  is_correct: boolean;
  response_time_ms: number;
  failure_count?: number;
  created_at?: string;
}

export interface SyncPushRequest {
  last_sync_at?: string;
  decks: SyncDeckItem[];
  flashcards: SyncFlashcardItem[];
  vocabulary_states: SyncVocabStateItem[];
  pending_reviews: SyncPendingReviewItem[];
}

export interface SyncPushResponse {
  decks_upserted: number;
  flashcards_upserted: number;
  states_upserted: number;
  reviews_processed: number;
  processed_pending_review_ids: string[];
}

export interface SyncPullResponse {
  decks: SyncDeckItem[];
  flashcards: SyncFlashcardItem[];
  vocabulary_states: SyncVocabStateItem[];
  synced_at: string;
}

export async function pushSync(data: SyncPushRequest): Promise<SyncPushResponse> {
  return apiFetch<SyncPushResponse>("/api/sync/push", {
    method: "POST",
    body: JSON.stringify(data),
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
}

export async function pullSync(since?: string): Promise<SyncPullResponse> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiFetch<SyncPullResponse>(`/api/sync/pull${query}`, {
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
}

export async function generateTTS(text: string): Promise<Blob> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${EFFECTIVE_API_BASE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`TTS error: ${res.status}`);
    return res.blob();
  } finally {
    clearTimeout(timeout);
  }
}
