import * as SQLite from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { eq, desc, gt, or, count } from "drizzle-orm";
import * as crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import hskCourse from "../data/hsk-course.json";
import {
  deck,
  flashcard,
  userVocabularyState,
  pendingReview,
} from "./schema";

const DB_NAME = "tars.db";
const CURRENT_SCHEMA_VERSION = 4;

let _sqlite: ReturnType<typeof SQLite.openDatabaseSync> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;
let _initialized = false;

function uuid(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
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

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (flashcard_id) REFERENCES flashcard(id)
      );
    `);

    sqlite.execSync(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
  }
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

export function seedHSKCourse(): void {
  const db = getDb();

  for (const [topic, cards] of Object.entries(hskCourse)) {
    const existing = db.select().from(deck).where(eq(deck.name, topic)).get();
    if (existing) continue;

    const deckId = uuid();
    db.insert(deck)
      .values({ id: deckId, name: topic, description: `HSK vocabulary: ${topic}` })
      .run();

    for (const card of cards) {
      const cardId = uuid();
      db.insert(flashcard)
        .values({
          id: cardId,
          deckId,
          cardType: "cloze_deletion",
          sentence: card.sentence,
          sentencePinyin: card.sentence_pinyin,
          answer: card.answer,
          answerPinyin: card.answer_pinyin,
          context: card.context,
          contextPinyin: card.context_pinyin,
          imagePath: card.image_path,
        })
        .run();
      db.insert(userVocabularyState)
        .values({ id: uuid(), flashcardId: cardId })
        .run();
    }
  }
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

export function getDueCards(deckId: string, limit: number = 20) {
  const db = getDb();
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
    .where(eq(flashcard.deckId, deckId))
    .orderBy(desc(userVocabularyState.difficultyScore))
    .limit(limit)
    .all();
}

export function addPendingReview(
  flashcardId: string,
  isCorrect: boolean,
  responseTimeMs: number
) {
  const db = getDb();
  const id = uuid();
  db.insert(pendingReview)
    .values({
      id,
      flashcardId,
      isCorrect,
      responseTimeMs,
    })
    .run();
  return id;
}

export function getPendingReviews() {
  const db = getDb();
  return db.select().from(pendingReview).all();
}

export function clearPendingReviews() {
  const db = getDb();
  db.delete(pendingReview).run();
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
