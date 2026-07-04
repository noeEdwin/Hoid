const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.3.11:8000";

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

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
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
  updated_at?: string;
}

export interface SyncPendingReviewItem {
  flashcard_id: string;
  is_correct: boolean;
  response_time_ms: number;
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
  });
}

export async function pullSync(since?: string): Promise<SyncPullResponse> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiFetch<SyncPullResponse>(`/api/sync/pull${query}`);
}

export async function generateTTS(text: string): Promise<Blob> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${API_BASE}/api/tts`, {
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
