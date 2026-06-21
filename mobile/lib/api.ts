const API_BASE = "http://192.168.3.11:8000";

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
    `/api/decks/${deckId}/flashcards`
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
