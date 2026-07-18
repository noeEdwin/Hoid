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
  dedupeLocalDecks,
} from "./database";
import { deck, flashcard, userVocabularyState } from "./schema";
import { eq } from "drizzle-orm";
import * as crypto from "expo-crypto";
import { useSettingsStore } from "../stores/useSettingsStore";

export type SyncStatus = "success" | "partial" | "failure";

interface PullUpdatesResult {
  decksApplied: number;
  flashcardsApplied: number;
  statesApplied: number;
  syncedAt: string;
}

export interface PerformSyncResult {
  status: SyncStatus;
  message: string;
  pushOk: boolean;
  pullOk: boolean;
  processedPendingReviewIds: string[];
  changesApplied: number;
  nothingToSync: boolean;
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
          message: stage === "push" ? "Upload timed out (5 seconds)" : "Download timed out (5 seconds)",
      };
    }

    if (apiError.code === "network") {
      return {
        errorCode: apiError.code,
        message: `${stage === "push" ? "Upload" : "Download"} network error: unable to connect to the server. ${
          (error as { message?: string }).message ?? "Unknown network error"
        } (${getApiBase()})`,
      };
    }

    if (apiError.code === "http") {
      return {
        errorCode: apiError.code,
        message:
          stage === "push"
            ? `Upload failed (HTTP ${apiError.status ?? "?"}): ${(error as { message?: string }).message ?? "Server error"}`
            : `Download failed (HTTP ${apiError.status ?? "?"}): ${(error as { message?: string }).message ?? "Server error"}`,
      };
    }
  }

  return {
    errorCode: "unknown",
    message: `${stage === "push" ? "Upload" : "Download"} failed: ${error instanceof Error ? error.message : String(error)}`,
  };
}

let activeSync: Promise<PerformSyncResult> | null = null;

export function performSync(): Promise<PerformSyncResult> {
  if (activeSync) return activeSync;

  activeSync = performSyncInternal().finally(() => {
    activeSync = null;
  });
  return activeSync;
}

async function performSyncInternal(): Promise<PerformSyncResult> {
  let pushOk = false;
  let pullOk = false;
  let processedPendingReviewIds: string[] = [];
  let changesApplied = 0;
  let pushFailure: ReturnType<typeof getSyncFailureMessage> | null = null;
  let pullFailure: ReturnType<typeof getSyncFailureMessage> | null = null;
  let syncedAt: string | null = null;
  const lastSyncAt = useSettingsStore.getState().getLastSyncAt();

  try {
    const pushResult = await pushPendingReviews(lastSyncAt);
    pushOk = true;
    processedPendingReviewIds = pushResult.processedPendingReviewIds;
    changesApplied += pushResult.changesApplied;
  } catch (e) {
    console.warn("[sync] push failed:", e);
    pushFailure = getSyncFailureMessage("push", e);
  }
  try {
    const pullResult = await pullUpdates(lastSyncAt);
    pullOk = true;
    syncedAt = pullResult.syncedAt;
    changesApplied += pullResult.decksApplied + pullResult.flashcardsApplied + pullResult.statesApplied;
  } catch (e) {
    console.warn("[sync] pull failed:", e);
    pullFailure = getSyncFailureMessage("pull", e);
  }

  if (pushOk && pullOk) {
    const nothingToSync = changesApplied === 0 && processedPendingReviewIds.length === 0;
    if (syncedAt) useSettingsStore.getState().setLastSyncAt(syncedAt);
    return {
      status: "success",
      message: nothingToSync
        ? "Nothing to sync"
        : processedPendingReviewIds.length > 0
        ? `Sync complete, processed ${processedPendingReviewIds.length} review record${processedPendingReviewIds.length === 1 ? "" : "s"}`
        : "Sync complete",
      pushOk,
      pullOk,
      processedPendingReviewIds,
      changesApplied,
      nothingToSync,
    };
  }

  if (pushOk || pullOk) {
    return {
      status: "partial",
      message: pushOk
        ? `Sync partially complete: ${pullFailure?.message ?? "Download failed"}`
        : `Sync partially complete: ${pushFailure?.message ?? "Upload failed"}`,
      pushOk,
      pullOk,
      processedPendingReviewIds,
      changesApplied,
      nothingToSync: false,
      errorCode: pushOk ? pullFailure?.errorCode : pushFailure?.errorCode,
      failingStage: pushOk ? "pull" : "push",
    };
  }

  return {
    status: "failure",
    message: pullFailure?.message ?? pushFailure?.message ?? "Sync failed",
    pushOk,
    pullOk,
    processedPendingReviewIds,
    changesApplied,
    nothingToSync: false,
    errorCode: pullFailure?.errorCode ?? pushFailure?.errorCode,
    failingStage: pullFailure ? "pull" : pushFailure ? "push" : undefined,
  };
}

function isChangedSince(updatedAt: string | null | undefined, since?: string): boolean {
  return !since || !updatedAt || updatedAt > since;
}

export async function pushPendingReviews(since?: string): Promise<{
  processedPendingReviewIds: string[];
  changesApplied: number;
}> {
  dedupeLocalDecks?.();
  const allDecks = getAllDecks();
  const changedDecks = allDecks.filter((deckItem) => isChangedSince(deckItem.updatedAt, since));
  const allFlashcards = allDecks.flatMap((d) => getFlashcardsByDeck(d.id));
  const changedFlashcards = allFlashcards.filter((card) => isChangedSince(card.updatedAt, since));
  const pending = getPendingReviews();

  const result = await apiPushSync({
    decks: changedDecks.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      created_at: d.createdAt ?? undefined,
      updated_at: d.updatedAt ?? undefined,
    })),
    flashcards: changedFlashcards.map((f) => ({
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
      .filter((s) => isChangedSince(s!.updatedAt, since))
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
      failure_count: r.failureCount,
      created_at: r.createdAt ?? undefined,
    })),
  });

  clearPendingReviews(result.processed_pending_review_ids);
  return {
    processedPendingReviewIds: result.processed_pending_review_ids,
    changesApplied:
      result.decks_upserted +
      result.flashcards_upserted +
      result.states_upserted +
      result.reviews_processed,
  };
}

export async function pullUpdates(since?: string): Promise<PullUpdatesResult> {
  const data = await apiPullSync(since);
  const db = getDb();
  const applied: PullUpdatesResult = {
    decksApplied: 0,
    flashcardsApplied: 0,
    statesApplied: 0,
    syncedAt: data.synced_at,
  };
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
      applied.decksApplied += 1;
    } else {
      db.insert(deck).values({ id: d.id, name: d.name, description: d.description, createdAt: d.created_at, updatedAt: d.updated_at }).run();
      applied.decksApplied += 1;
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
      applied.flashcardsApplied += 1;
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
      applied.flashcardsApplied += 1;
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
      applied.statesApplied += 1;
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
      applied.statesApplied += 1;
    }
  }

  dedupeLocalDecks?.();
  return applied;
}
