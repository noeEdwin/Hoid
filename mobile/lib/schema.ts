import { sqliteTable, text, integer, real, integer as bool } from "drizzle-orm/sqlite-core";

export const deck = sqliteTable("deck", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at"),
});

export const flashcard = sqliteTable("flashcard", {
  id: text("id").primaryKey(),
  deckId: text("deck_id")
    .notNull()
    .references(() => deck.id),
  cardType: text("card_type").notNull().default("cloze_deletion"),
  sentence: text("sentence"),
  sentencePinyin: text("sentence_pinyin"),
  answer: text("answer"),
  answerPinyin: text("answer_pinyin"),
  context: text("context"),
  contextPinyin: text("context_pinyin"),
  imagePath: text("image_path"),
  audioPath: text("audio_path"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at"),
});

export const userVocabularyState = sqliteTable("user_vocabulary_state", {
  id: text("id").primaryKey(),
  flashcardId: text("flashcard_id")
    .unique()
    .notNull()
    .references(() => flashcard.id),
  srsInterval: integer("srs_interval").default(0),
  easeFactor: real("ease_factor").default(2.5),
  totalReviews: integer("total_reviews").default(0),
  totalFailures: integer("total_failures").default(0),
  consecutiveFailures: integer("consecutive_failures").default(0),
  consecutiveCorrect: integer("consecutive_correct").default(0),
  difficultyScore: real("difficulty_score").default(0.0),
  lastReviewedAt: text("last_reviewed_at"),
  nextReviewAt: text("next_review_at"),
  updatedAt: text("updated_at"),
});

export const pendingReview = sqliteTable("pending_review", {
  id: text("id").primaryKey(),
  flashcardId: text("flashcard_id")
    .notNull()
    .references(() => flashcard.id),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
  responseTimeMs: integer("response_time_ms").notNull(),
  failureCount: integer("failure_count").notNull().default(0),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export type Deck = typeof deck.$inferSelect;
export type NewDeck = typeof deck.$inferInsert;
export type Flashcard = typeof flashcard.$inferSelect;
export type NewFlashcard = typeof flashcard.$inferInsert;
export type VocabularyState = typeof userVocabularyState.$inferSelect;
export type NewVocabularyState = typeof userVocabularyState.$inferInsert;
export type PendingReview = typeof pendingReview.$inferSelect;
export type NewPendingReview = typeof pendingReview.$inferInsert;
