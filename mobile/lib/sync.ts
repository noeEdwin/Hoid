import { pushSync as apiPushSync, pullSync as apiPullSync } from "./api";
import {
  getAllDecks,
  getFlashcardsByDeck,
  getVocabularyState,
  getPendingReviews,
  clearPendingReviews,
  getDb,
} from "./database";
import { deck, flashcard, userVocabularyState } from "./schema";
import { eq } from "drizzle-orm";
import * as crypto from "expo-crypto";

export async function performSync(): Promise<void> {
  try {
    await pushPendingReviews();
  } catch {
    // offline or server unreachable — continue to pull
  }
  try {
    await pullUpdates();
  } catch {
    // offline or server unreachable — silently ignore
  }
}

export async function pushPendingReviews(): Promise<void> {
  const allDecks = getAllDecks();
  const allFlashcards = allDecks.flatMap((d) => getFlashcardsByDeck(d.id));
  const pending = getPendingReviews();

  await apiPushSync({
    decks: allDecks.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      created_at: d.createdAt ?? undefined,
    })),
    flashcards: allFlashcards.map((f) => ({
      id: f.id,
      deck_id: f.deckId,
      card_type: f.cardType,
      sentence: f.sentence,
      sentence_pinyin: f.sentencePinyin,
      answer: f.answer,
      answer_pinyin: f.answerPinyin,
      context: f.context,
      context_pinyin: f.contextPinyin,
      image_path: f.imagePath,
      audio_path: f.audioPath,
      created_at: f.createdAt ?? undefined,
    })),
    vocabulary_states: allFlashcards
      .map((f) => getVocabularyState(f.id))
      .filter(Boolean)
      .map((s) => ({
        flashcard_id: s!.flashcardId,
        srs_interval: s!.srsInterval ?? 0,
        ease_factor: s!.easeFactor ?? 2.5,
        total_reviews: s!.totalReviews ?? 0,
        total_failures: s!.totalFailures ?? 0,
        consecutive_failures: s!.consecutiveFailures ?? 0,
        consecutive_correct: (s as any).consecutiveCorrect ?? 0,
        difficulty_score: s!.difficultyScore ?? 0,
      })),
    pending_reviews: pending.map((r) => ({
      flashcard_id: r.flashcardId,
      is_correct: r.isCorrect,
      response_time_ms: r.responseTimeMs,
      created_at: r.createdAt ?? undefined,
    })),
  });

  clearPendingReviews();
}

export async function pullUpdates(): Promise<void> {
  const data = await apiPullSync();
  const db = getDb();

  for (const d of data.decks) {
    const existing = db.select().from(deck).where(eq(deck.id, d.id)).get();
    if (existing) {
      db.update(deck).set({ name: d.name, description: d.description }).where(eq(deck.id, d.id)).run();
    } else {
      db.insert(deck).values({ id: d.id, name: d.name, description: d.description }).run();
    }
  }

  for (const f of data.flashcards) {
    const existing = db.select().from(flashcard).where(eq(flashcard.id, f.id)).get();
    if (existing) {
      db.update(flashcard)
        .set({
          sentence: f.sentence,
          sentencePinyin: f.sentence_pinyin,
          answer: f.answer,
          answerPinyin: f.answer_pinyin,
          context: f.context,
          contextPinyin: f.context_pinyin,
          imagePath: f.image_path,
          audioPath: f.audio_path,
          cardType: f.card_type,
        })
        .where(eq(flashcard.id, f.id))
        .run();
    } else {
      db.insert(flashcard)
        .values({
          id: f.id,
          deckId: f.deck_id,
          cardType: f.card_type,
          sentence: f.sentence,
          sentencePinyin: f.sentence_pinyin,
          answer: f.answer,
          answerPinyin: f.answer_pinyin,
          context: f.context,
          contextPinyin: f.context_pinyin,
          imagePath: f.image_path,
          audioPath: f.audio_path,
        })
        .run();
    }
  }

  for (const vs of data.vocabulary_states) {
    const existing = getVocabularyState(vs.flashcard_id);
    if (existing) {
      db.update(userVocabularyState)
        .set({
          srsInterval: vs.srs_interval,
          easeFactor: vs.ease_factor,
          totalReviews: vs.total_reviews,
          totalFailures: vs.total_failures,
          consecutiveFailures: vs.consecutive_failures,
          consecutiveCorrect: vs.consecutive_correct,
          difficultyScore: vs.difficulty_score,
        })
        .where(eq(userVocabularyState.flashcardId, vs.flashcard_id))
        .run();
    } else {
      db.insert(userVocabularyState)
        .values({
          id: crypto.randomUUID(),
          flashcardId: vs.flashcard_id,
          srsInterval: vs.srs_interval,
          easeFactor: vs.ease_factor,
          totalReviews: vs.total_reviews,
          totalFailures: vs.total_failures,
          consecutiveFailures: vs.consecutive_failures,
          consecutiveCorrect: vs.consecutive_correct,
          difficultyScore: vs.difficulty_score,
        })
        .run();
    }
  }
}
