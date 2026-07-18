import * as SQLite from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { and, eq, desc, gt, or, count, inArray, notInArray } from "drizzle-orm";
import * as crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import {
  deck,
  flashcard,
  userVocabularyState,
  pendingReview,
} from "./schema";

const DB_NAME = "tars.db";
const CURRENT_SCHEMA_VERSION = 6;

let _sqlite: ReturnType<typeof SQLite.openDatabaseSync> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;
let _initialized = false;

function uuid(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value?: string | null, lowercase: boolean = false): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return lowercase ? normalized.toLowerCase() : normalized;
}

function flashcardIdentityKey(data: {
  deckId: string;
  cardType?: string | null;
  sentence?: string | null;
  sentencePinyin?: string | null;
  answer?: string | null;
  answerPinyin?: string | null;
  context?: string | null;
  contextPinyin?: string | null;
}): string {
  return JSON.stringify([
    data.deckId,
    normalizeText(data.cardType) ?? "cloze_deletion",
    normalizeText(data.sentence),
    normalizeText(data.sentencePinyin, true),
    normalizeText(data.answer),
    normalizeText(data.answerPinyin, true),
    normalizeText(data.context),
    normalizeText(data.contextPinyin, true),
  ]);
}

function mergeFlashcardMetadata(
  primary: ReturnType<typeof getFlashcardById>,
  duplicate: ReturnType<typeof getFlashcardById>
) {
  if (!primary || !duplicate) return;
  const updates: Partial<{
    sentence: string;
    sentencePinyin: string;
    answer: string;
    answerPinyin: string;
    context: string;
    contextPinyin: string;
    imagePath: string;
    audioPath: string;
  }> = {};

  if (!primary.sentence && duplicate.sentence) updates.sentence = duplicate.sentence;
  if (!primary.sentencePinyin && duplicate.sentencePinyin) updates.sentencePinyin = duplicate.sentencePinyin;
  if (!primary.answer && duplicate.answer) updates.answer = duplicate.answer;
  if (!primary.answerPinyin && duplicate.answerPinyin) updates.answerPinyin = duplicate.answerPinyin;
  if (!primary.context && duplicate.context) updates.context = duplicate.context;
  if (!primary.contextPinyin && duplicate.contextPinyin) updates.contextPinyin = duplicate.contextPinyin;
  if (!primary.imagePath && duplicate.imagePath) updates.imagePath = duplicate.imagePath;
  if (!primary.audioPath && duplicate.audioPath) updates.audioPath = duplicate.audioPath;

  if (Object.keys(updates).length > 0) {
    updateFlashcard(primary.id, updates);
  }
}

function mergeVocabularyStates(primaryFlashcardId: string, duplicateFlashcardId: string): void {
  const db = getDb();
  const primary = getVocabularyState(primaryFlashcardId);
  const duplicate = getVocabularyState(duplicateFlashcardId);

  if (!duplicate) return;

  if (!primary) {
    db.update(userVocabularyState)
      .set({ flashcardId: primaryFlashcardId, updatedAt: nowIso() })
      .where(eq(userVocabularyState.flashcardId, duplicateFlashcardId))
      .run();
    return;
  }

  const primaryUpdatedAt = primary.updatedAt ?? "";
  const duplicateUpdatedAt = duplicate.updatedAt ?? "";
  const latest = duplicateUpdatedAt > primaryUpdatedAt ? duplicate : primary;

  db.update(userVocabularyState)
    .set({
      srsInterval: Math.max(primary.srsInterval ?? 0, duplicate.srsInterval ?? 0),
      easeFactor: latest.easeFactor ?? primary.easeFactor ?? duplicate.easeFactor ?? 2.5,
      totalReviews: Math.max(primary.totalReviews ?? 0, duplicate.totalReviews ?? 0),
      totalFailures: Math.max(primary.totalFailures ?? 0, duplicate.totalFailures ?? 0),
      consecutiveFailures: latest.consecutiveFailures ?? 0,
      consecutiveCorrect: latest.consecutiveCorrect ?? 0,
      difficultyScore: latest.difficultyScore ?? primary.difficultyScore ?? duplicate.difficultyScore ?? 0,
      updatedAt: latest.updatedAt ?? nowIso(),
    })
    .where(eq(userVocabularyState.flashcardId, primaryFlashcardId))
    .run();

  db.delete(userVocabularyState)
    .where(eq(userVocabularyState.flashcardId, duplicateFlashcardId))
    .run();
}

function chooseCanonicalFlashcard(
  cards: ReturnType<typeof getFlashcardsByDeck>
): ReturnType<typeof getFlashcardById> {
  return [...cards].sort((a, b) => {
    const aState = getVocabularyState(a.id);
    const bState = getVocabularyState(b.id);
    const aScore = aState?.totalReviews ?? 0;
    const bScore = bState?.totalReviews ?? 0;
    if (aScore !== bScore) return bScore - aScore;
    const aCreated = a.createdAt ?? "";
    const bCreated = b.createdAt ?? "";
    if (aCreated !== bCreated) return aCreated.localeCompare(bCreated);
    return a.id.localeCompare(b.id);
  })[0];
}

function dedupeDeckFlashcards(deckId: string): number {
  const db = getDb();
  const cards = getFlashcardsByDeck(deckId);
  const groups = new Map<string, ReturnType<typeof getFlashcardsByDeck>>();

  for (const card of cards) {
    const key = flashcardIdentityKey(card);
    const existing = groups.get(key) ?? [];
    existing.push(card);
    groups.set(key, existing);
  }

  let removed = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const canonical = chooseCanonicalFlashcard(group)!;
    for (const duplicate of group) {
      if (duplicate.id === canonical.id) continue;
      mergeFlashcardMetadata(canonical, duplicate);
      mergeVocabularyStates(canonical.id, duplicate.id);
      db.update(pendingReview)
        .set({ flashcardId: canonical.id })
        .where(eq(pendingReview.flashcardId, duplicate.id))
        .run();
      db.delete(flashcard)
        .where(eq(flashcard.id, duplicate.id))
        .run();
      removed += 1;
    }
  }

  return removed;
}

function dedupeDecksByIdentity(): number {
  const db = getDb();
  const groups = new Map<string, ReturnType<typeof getAllDecks>>();

  for (const currentDeck of getAllDecks()) {
    const key = JSON.stringify([
      normalizeText(currentDeck.name, true),
      normalizeText(currentDeck.description, true),
    ]);
    const existing = groups.get(key) ?? [];
    existing.push(currentDeck);
    groups.set(key, existing);
  }

  let removed = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const canonical = [...group].sort((a, b) =>
      (a.createdAt ?? a.id).localeCompare(b.createdAt ?? b.id)
    )[0];

    for (const duplicateDeck of group) {
      if (duplicateDeck.id === canonical.id) continue;
      for (const duplicate of getFlashcardsByDeck(duplicateDeck.id)) {
        const matching = getFlashcardsByDeck(canonical.id).find(
          (card) => flashcardIdentityKey(card) === flashcardIdentityKey(duplicate)
        );
        if (matching) {
          mergeFlashcardMetadata(matching, duplicate);
          mergeVocabularyStates(matching.id, duplicate.id);
          db.update(pendingReview)
            .set({ flashcardId: matching.id })
            .where(eq(pendingReview.flashcardId, duplicate.id))
            .run();
          db.delete(flashcard).where(eq(flashcard.id, duplicate.id)).run();
        } else {
          db.update(flashcard)
            .set({ deckId: canonical.id, updatedAt: nowIso() })
            .where(eq(flashcard.id, duplicate.id))
            .run();
        }
      }
      db.delete(deck).where(eq(deck.id, duplicateDeck.id)).run();
      removed += 1;
    }
  }

  return removed;
}

function getSqlite(): ReturnType<typeof SQLite.openDatabaseSync> {
  if (!_sqlite) {
    _sqlite = SQLite.openDatabaseSync(DB_NAME);
  }
  return _sqlite;
}

function ensureInitialized(): void {
  if (_initialized) return;
  const sqlite = getSqlite();

  sqlite.execSync("PRAGMA foreign_keys = ON");

  const versionRow = sqlite.getFirstSync<{ user_version: number }>(
    "PRAGMA user_version"
  );
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion === 5) {
    sqlite.execSync("ALTER TABLE pending_review ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0");
    sqlite.execSync(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
  } else if (currentVersion === 4) {
    sqlite.execSync("ALTER TABLE user_vocabulary_state ADD COLUMN last_reviewed_at TEXT");
    sqlite.execSync("ALTER TABLE user_vocabulary_state ADD COLUMN next_review_at TEXT");
    sqlite.execSync("ALTER TABLE pending_review ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0");
    sqlite.execSync(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
  } else if (currentVersion < 4) {
    sqlite.execSync("DROP TABLE IF EXISTS pending_review");
    sqlite.execSync("DROP TABLE IF EXISTS user_vocabulary_state");
    sqlite.execSync("DROP TABLE IF EXISTS flashcard");
    sqlite.execSync("DROP TABLE IF EXISTS deck");

    sqlite.execSync(`
      CREATE TABLE deck (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      );
    `);

    sqlite.execSync(`
      CREATE TABLE flashcard (
        id TEXT PRIMARY KEY,
        deck_id TEXT NOT NULL,
        card_type TEXT NOT NULL DEFAULT 'cloze_deletion',
        sentence TEXT,
        sentence_pinyin TEXT,
        answer TEXT,
        answer_pinyin TEXT,
        context TEXT,
        context_pinyin TEXT,
        image_path TEXT,
        audio_path TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT,
        FOREIGN KEY (deck_id) REFERENCES deck(id)
      );
    `);

    sqlite.execSync(`
      CREATE TABLE user_vocabulary_state (
        id TEXT PRIMARY KEY,
        flashcard_id TEXT UNIQUE NOT NULL,
        srs_interval INTEGER DEFAULT 0,
        ease_factor REAL DEFAULT 2.5,
        total_reviews INTEGER DEFAULT 0,
        total_failures INTEGER DEFAULT 0,
        consecutive_failures INTEGER DEFAULT 0,
        consecutive_correct INTEGER DEFAULT 0,
        difficulty_score REAL DEFAULT 0.0,
        last_reviewed_at TEXT,
        next_review_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (flashcard_id) REFERENCES flashcard(id)
      );
    `);

    sqlite.execSync(`
      CREATE TABLE pending_review (
        id TEXT PRIMARY KEY,
        flashcard_id TEXT NOT NULL,
        is_correct INTEGER NOT NULL,
        response_time_ms INTEGER NOT NULL,
        failure_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (flashcard_id) REFERENCES flashcard(id)
      );
    `);

    sqlite.execSync(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
  }
  sqlite.execSync(
    "UPDATE user_vocabulary_state " +
    "SET srs_interval = 365, " +
    "next_review_at = datetime(COALESCE(last_reviewed_at, updated_at, CURRENT_TIMESTAMP), '+365 days') " +
    "WHERE srs_interval > 365"
  );
  // Older synced cards encoded the two blanks as one repeated answer.
  sqlite.execSync(
    "UPDATE flashcard " +
    "SET answer = '又', answer_pinyin = 'yòu', audio_path = NULL, updated_at = CURRENT_TIMESTAMP " +
    "WHERE answer = '又...又...' OR answer_pinyin = 'yòu...yòu...'"
  );
  _initialized = true;
}

export function initDatabase(): void {
  ensureInitialized();
}

export function getDb() {
  ensureInitialized();
  if (!_db) {
    _db = drizzle(getSqlite());
  }
  return _db;
}

export function getAllDecks() {
  const db = getDb();
  return db.select().from(deck).all();
}

export function getDeckById(id: string) {
  const db = getDb();
  return db.select().from(deck).where(eq(deck.id, id)).get();
}

export function createDeck(name: string, description?: string) {
  const db = getDb();
  const id = uuid();
  const now = nowIso();
  db.insert(deck)
    .values({ id, name, description: description ?? null, createdAt: now, updatedAt: now })
    .run();
  return getDeckById(id);
}

export function getFlashcardsByDeck(deckId: string) {
  const db = getDb();
  return db
    .select()
    .from(flashcard)
    .where(eq(flashcard.deckId, deckId))
    .all();
}

export function getFlashcardById(id: string) {
  const db = getDb();
  return db.select().from(flashcard).where(eq(flashcard.id, id)).get();
}

export function createFlashcard(data: {
  deckId: string;
  cardType?: string;
  sentence: string;
  sentencePinyin?: string;
  answer: string;
  answerPinyin?: string;
  context?: string;
  contextPinyin?: string;
  imagePath?: string;
  audioPath?: string;
}) {
  const existing = getFlashcardsByDeck(data.deckId).find(
    (card) => flashcardIdentityKey(card) === flashcardIdentityKey(data)
  );
  if (existing) {
    return existing;
  }

  const db = getDb();
  const id = uuid();
  const now = nowIso();
  db.insert(flashcard)
    .values({
      id,
      deckId: data.deckId,
      cardType: data.cardType ?? "cloze_deletion",
      sentence: data.sentence,
      sentencePinyin: data.sentencePinyin ?? null,
      answer: data.answer,
      answerPinyin: data.answerPinyin ?? null,
      context: data.context ?? null,
      contextPinyin: data.contextPinyin ?? null,
      imagePath: data.imagePath ?? null,
      audioPath: data.audioPath ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  db.insert(userVocabularyState)
    .values({ id: uuid(), flashcardId: id, updatedAt: now })
    .run();
  return getFlashcardById(id);
}

export function updateFlashcard(
  id: string,
  updates: Partial<{
    sentence: string;
    sentencePinyin: string;
    answer: string;
    answerPinyin: string;
    context: string;
    contextPinyin: string;
    imagePath: string;
    audioPath: string;
  }>
) {
  const db = getDb();
  db.update(flashcard)
    .set({ ...updates, updatedAt: nowIso() })
    .where(eq(flashcard.id, id))
    .run();
  return getFlashcardById(id);
}

export function deleteFlashcard(id: string) {
  const db = getDb();
  const card = getFlashcardById(id);
  if (card?.audioPath) {
    try {
      const file = new File(Paths.document, card.audioPath.replace("file://", ""));
      if (file.exists) file.delete();
    } catch {}
  }
  db.delete(pendingReview)
    .where(eq(pendingReview.flashcardId, id))
    .run();
  db.delete(userVocabularyState)
    .where(eq(userVocabularyState.flashcardId, id))
    .run();
  db.delete(flashcard)
    .where(eq(flashcard.id, id))
    .run();
}

export function deleteDeck(id: string) {
  const db = getDb();
  const cards = getFlashcardsByDeck(id);
  for (const card of cards) {
    deleteFlashcard(card.id);
  }
  db.delete(deck).where(eq(deck.id, id)).run();
}

export function updateDeck(
  id: string,
  updates: Partial<{ name: string; description: string }>
) {
  const db = getDb();
  db.update(deck)
    .set({ ...updates, updatedAt: nowIso() })
    .where(eq(deck.id, id))
    .run();
  return getDeckById(id);
}

export function updateFlashcardAudioPath(id: string, audioPath: string) {
  const db = getDb();
  db.update(flashcard)
    .set({ audioPath, updatedAt: nowIso() })
    .where(eq(flashcard.id, id))
    .run();
  return getFlashcardById(id);
}

export function getVocabularyState(flashcardId: string) {
  const db = getDb();
  return db
    .select()
    .from(userVocabularyState)
    .where(eq(userVocabularyState.flashcardId, flashcardId))
    .get();
}

export function updateVocabularyState(
  flashcardId: string,
  updates: Partial<{
    srsInterval: number;
    easeFactor: number;
    totalReviews: number;
    totalFailures: number;
    consecutiveFailures: number;
    consecutiveCorrect: number;
    difficultyScore: number;
    lastReviewedAt: string;
    nextReviewAt: string;
  }>
) {
  const db = getDb();
  const state = getVocabularyState(flashcardId);
  if (!state) return null;

  db.update(userVocabularyState)
    .set({ ...updates, updatedAt: nowIso() })
    .where(eq(userVocabularyState.flashcardId, flashcardId))
    .run();

  return getVocabularyState(flashcardId);
}

export function getDueCards(
  deckId: string,
  limit: number = 20,
  excludeCardIds: string[] = [],
  dueBefore: string = new Date().toISOString()
) {
  const db = getDb();
  const conditions = excludeCardIds.length > 0
    ? and(eq(flashcard.deckId, deckId), notInArray(flashcard.id, excludeCardIds))
    : eq(flashcard.deckId, deckId);
  const dueBeforeMs = new Date(dueBefore).getTime();
  return db
    .select({
      id: flashcard.id,
      deckId: flashcard.deckId,
      cardType: flashcard.cardType,
      sentence: flashcard.sentence,
      sentencePinyin: flashcard.sentencePinyin,
      answer: flashcard.answer,
      answerPinyin: flashcard.answerPinyin,
      context: flashcard.context,
      contextPinyin: flashcard.contextPinyin,
      imagePath: flashcard.imagePath,
      audioPath: flashcard.audioPath,
      srsInterval: userVocabularyState.srsInterval,
      easeFactor: userVocabularyState.easeFactor,
      difficultyScore: userVocabularyState.difficultyScore,
      lastReviewedAt: userVocabularyState.lastReviewedAt,
      nextReviewAt: userVocabularyState.nextReviewAt,
      totalReviews: userVocabularyState.totalReviews,
      totalFailures: userVocabularyState.totalFailures,
      consecutiveFailures: userVocabularyState.consecutiveFailures,
      consecutiveCorrect: userVocabularyState.consecutiveCorrect,
    })
    .from(flashcard)
    .innerJoin(
      userVocabularyState,
      eq(flashcard.id, userVocabularyState.flashcardId)
    )
    .where(conditions)
    .orderBy(desc(userVocabularyState.difficultyScore))
    .all()
    .filter((card) => !card.nextReviewAt || new Date(card.nextReviewAt).getTime() <= dueBeforeMs)
    .slice(0, limit);
}

export function addPendingReview(
  flashcardId: string,
  isCorrect: boolean,
  responseTimeMs: number,
  failureCount: number = isCorrect ? 0 : 1,
) {
  const db = getDb();
  const id = uuid();
  db.insert(pendingReview)
    .values({
      id,
      flashcardId,
      isCorrect,
      responseTimeMs,
      failureCount,
    })
    .run();
  return id;
}

export function getPendingReviews() {
  const db = getDb();
  return db.select().from(pendingReview).all();
}

export function clearPendingReviews(reviewIds?: string[]) {
  const db = getDb();
  if (reviewIds && reviewIds.length > 0) {
    db.delete(pendingReview)
      .where(inArray(pendingReview.id, reviewIds))
      .run();
    return;
  }
  if (!reviewIds) {
    db.delete(pendingReview).run();
  }
}

export function dedupeLocalFlashcards(): number {
  return getAllDecks().reduce((removed, currentDeck) => {
    return removed + dedupeDeckFlashcards(currentDeck.id);
  }, 0);
}

export function dedupeLocalDecks(): number {
  const removedDecks = dedupeDecksByIdentity();
  dedupeLocalFlashcards();
  return removedDecks;
}

export function getTotalCardCount() {
  const db = getDb();
  const result = db.select({ value: count() }).from(flashcard).all();
  return result[0]?.value ?? 0;
}

export function getFlashcardCountByDeck(deckId: string): number {
  const db = getDb();
  const result = db
    .select({ value: count() })
    .from(flashcard)
    .where(eq(flashcard.deckId, deckId))
    .all();
  return result[0]?.value ?? 0;
}

export function getFailingTokens() {
  const db = getDb();
  return db
    .select({
      id: flashcard.id,
      sentence: flashcard.sentence,
      answer: flashcard.answer,
      answerPinyin: flashcard.answerPinyin,
      difficultyScore: userVocabularyState.difficultyScore,
      totalReviews: userVocabularyState.totalReviews,
      totalFailures: userVocabularyState.totalFailures,
    })
    .from(flashcard)
    .innerJoin(
      userVocabularyState,
      eq(flashcard.id, userVocabularyState.flashcardId)
    )
    .where(
      or(
        gt(userVocabularyState.consecutiveFailures, 0),
        gt(userVocabularyState.difficultyScore, 0.5)
      )
    )
    .orderBy(desc(userVocabularyState.difficultyScore))
    .limit(20)
    .all();
}

export function getTomorrowDueCards(deckId?: string) {
  const now = Date.now();
  const tomorrowEnd = new Date(now);
  tomorrowEnd.setHours(23, 59, 59, 999);
  const dueBefore = tomorrowEnd.toISOString();
  return deckId
    ? getDueCards(deckId, 1000, [], dueBefore)
    : getAllDecks().flatMap((d) => getDueCards(d.id, 1000, [], dueBefore));
}
