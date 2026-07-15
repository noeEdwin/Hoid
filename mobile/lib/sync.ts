import {
  type ApiErrorCode,
  getApiBase,
  pushSync as apiPushSync,
  pullSync as apiPullSync,
} from "./api";
import {
  getAllDecks,
  getFlashcardsByDeck,
  getVocabularyState,
  getPendingReviews,
  clearPendingReviews,
  getDb,
  dedupeLocalFlashcards,
} from "./database";
import { deck, flashcard, userVocabularyState } from "./schema";
import { eq } from "drizzle-orm";
import * as crypto from "expo-crypto";

export type SyncStatus = "success" | "partial" | "failure";

export interface PerformSyncResult {
  status: SyncStatus;
  message: string;
  pushOk: boolean;
  pullOk: boolean;
  processedPendingReviewIds: string[];
  errorCode?: ApiErrorCode;
  failingStage?: "push" | "pull";
}

function getSyncFailureMessage(
  stage: "push" | "pull",
  error: unknown
): { errorCode: ApiErrorCode; message: string } {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const apiError = error as { code: ApiErrorCode; status?: number };
    if (apiError.code === "timeout") {
      return {
        errorCode: apiError.code,
        message: stage === "push" ? "上传超时（5秒）" : "下载超时（5秒）",
      };
    }

    if (apiError.code === "network") {
      return {
        errorCode: apiError.code,
        message: `无法连接服务器：${getApiBase()}`,
      };
    }

    if (apiError.code === "http") {
      return {
        errorCode: apiError.code,
        message:
          stage === "push"
            ? `上传失败（HTTP ${apiError.status ?? "?"}）`
            : `下载失败（HTTP ${apiError.status ?? "?"}）`,
      };
    }
  }

  return {
    errorCode: "unknown",
    message: stage === "push" ? "上传失败" : "下载失败",
  };
}

export async function performSync(): Promise<PerformSyncResult> {
  let pushOk = false;
  let pullOk = false;
  let processedPendingReviewIds: string[] = [];
  let pushFailure: ReturnType<typeof getSyncFailureMessage> | null = null;
  let pullFailure: ReturnType<typeof getSyncFailureMessage> | null = null;

  try {
    const pushResult = await pushPendingReviews();
    pushOk = true;
    processedPendingReviewIds = pushResult.processedPendingReviewIds;
  } catch (e) {
    console.warn("[sync] push failed:", e);
    pushFailure = getSyncFailureMessage("push", e);
  }
  try {
    await pullUpdates();
    pullOk = true;
  } catch (e) {
    console.warn("[sync] pull failed:", e);
    pullFailure = getSyncFailureMessage("pull", e);
  }

  if (pushOk && pullOk) {
    return {
      status: "success",
      message: processedPendingReviewIds.length > 0
        ? `同步完成，已处理 ${processedPendingReviewIds.length} 条复习记录`
        : "同步完成",
      pushOk,
      pullOk,
      processedPendingReviewIds,
    };
  }

  if (pushOk || pullOk) {
    return {
      status: "partial",
      message: pushOk
        ? `部分同步完成，${pullFailure?.message ?? "下载失败"}`
        : `部分同步完成，${pushFailure?.message ?? "上传失败"}`,
      pushOk,
      pullOk,
      processedPendingReviewIds,
      errorCode: pushOk ? pullFailure?.errorCode : pushFailure?.errorCode,
      failingStage: pushOk ? "pull" : "push",
    };
  }

  return {
    status: "failure",
    message: pullFailure?.message ?? pushFailure?.message ?? "同步失败",
    pushOk,
    pullOk,
    processedPendingReviewIds,
    errorCode: pullFailure?.errorCode ?? pushFailure?.errorCode,
    failingStage: pullFailure ? "pull" : pushFailure ? "push" : undefined,
  };
}

export async function pushPendingReviews(): Promise<{
  processedPendingReviewIds: string[];
}> {
  dedupeLocalFlashcards();
  const allDecks = getAllDecks();
  const allFlashcards = allDecks.flatMap((d) => getFlashcardsByDeck(d.id));
  const pending = getPendingReviews();

  const result = await apiPushSync({
    decks: allDecks.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      created_at: d.createdAt ?? undefined,
      updated_at: d.updatedAt ?? undefined,
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
      updated_at: f.updatedAt ?? undefined,
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
        last_reviewed_at: s!.lastReviewedAt ?? undefined,
        next_review_at: s!.nextReviewAt ?? undefined,
        updated_at: s!.updatedAt ?? undefined,
      })),
    pending_reviews: pending.map((r) => ({
      id: r.id,
      flashcard_id: r.flashcardId,
      is_correct: r.isCorrect,
      response_time_ms: r.responseTimeMs,
      created_at: r.createdAt ?? undefined,
    })),
  });

  clearPendingReviews(result.processed_pending_review_ids);
  return {
    processedPendingReviewIds: result.processed_pending_review_ids,
  };
}

export async function pullUpdates(): Promise<void> {
  const data = await apiPullSync();
  const db = getDb();
  const localDecks = getAllDecks();
  const availableDeckIds = new Set<string>(localDecks.map((d) => d.id));
  const availableFlashcardIds = new Set<string>(
    localDecks.flatMap((d) => getFlashcardsByDeck(d.id).map((f) => f.id))
  );

  for (const d of data.decks) {
    const existing = db.select().from(deck).where(eq(deck.id, d.id)).get();
    availableDeckIds.add(d.id);
    if (existing) {
      if (d.updated_at && existing.updatedAt && d.updated_at <= existing.updatedAt) continue;
      db.update(deck).set({ name: d.name, description: d.description, updatedAt: d.updated_at ?? existing.updatedAt }).where(eq(deck.id, d.id)).run();
    } else {
      db.insert(deck).values({ id: d.id, name: d.name, description: d.description, createdAt: d.created_at, updatedAt: d.updated_at }).run();
    }
  }

  for (const f of data.flashcards) {
    if (!availableDeckIds.has(f.deck_id)) {
      console.warn("[sync] skipping flashcard with missing deck:", f.id, f.deck_id);
      continue;
    }
    const existing = db.select().from(flashcard).where(eq(flashcard.id, f.id)).get();
    if (existing) {
      if (f.updated_at && existing.updatedAt && f.updated_at <= existing.updatedAt) continue;
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
          updatedAt: f.updated_at ?? existing.updatedAt,
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
          createdAt: f.created_at,
          updatedAt: f.updated_at,
        })
        .run();
    }
    availableFlashcardIds.add(f.id);
  }

  for (const vs of data.vocabulary_states) {
    if (!availableFlashcardIds.has(vs.flashcard_id) && !getVocabularyState(vs.flashcard_id)) {
      console.warn("[sync] skipping vocabulary state with missing flashcard:", vs.flashcard_id);
      continue;
    }
    const existing = getVocabularyState(vs.flashcard_id);
    if (existing) {
      if (vs.updated_at && existing.updatedAt && vs.updated_at <= existing.updatedAt) continue;
      db.update(userVocabularyState)
        .set({
          srsInterval: vs.srs_interval,
          easeFactor: vs.ease_factor,
          totalReviews: vs.total_reviews,
          totalFailures: vs.total_failures,
          consecutiveFailures: vs.consecutive_failures,
          consecutiveCorrect: vs.consecutive_correct,
           difficultyScore: vs.difficulty_score,
           lastReviewedAt: vs.last_reviewed_at,
           nextReviewAt: vs.next_review_at,
           updatedAt: vs.updated_at ?? existing.updatedAt,
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
           lastReviewedAt: vs.last_reviewed_at,
           nextReviewAt: vs.next_review_at,
           updatedAt: vs.updated_at,
        })
        .run();
    }
  }

  dedupeLocalFlashcards();
}
