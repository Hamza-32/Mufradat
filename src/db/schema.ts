import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from 'next-auth/adapters';

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export const partOfSpeechEnum = pgEnum('part_of_speech', [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'particle',
  'phrase',
  'proper_noun',
]);

export const genderEnum = pgEnum('gender', ['masculine', 'feminine', 'both']);

export const pluralTypeEnum = pgEnum('plural_type', [
  'sound_masculine',
  'sound_feminine',
  'broken',
  'dual_only',
  'invariable',
]);

export const difficultyEnum = pgEnum('difficulty', ['beginner', 'intermediate', 'advanced']);

/** Which side of the card is shown first. Configurable per deck, per the brief. */
export const cardDirectionEnum = pgEnum('card_direction', [
  'arabic_to_meaning',
  'meaning_to_arabic',
  'audio_to_meaning',
]);

/** FSRS card states, mirroring ts-fsrs `State`. */
export const cardStateEnum = pgEnum('card_state', ['new', 'learning', 'review', 'relearning']);

/** Coarser buckets for the progress page. Derived, cached on the card row. */
export const masteryEnum = pgEnum('mastery', ['new', 'learning', 'young', 'mature']);

export const reviewSourceEnum = pgEnum('review_source', [
  'review',
  'game_match_pairs',
  'game_multiple_choice',
  'game_listening',
  'game_spelling',
  'game_harakat',
  'game_streak_rush',
]);

export const gameTypeEnum = pgEnum('game_type', [
  'match_pairs',
  'multiple_choice',
  'listening',
  'spelling',
  'harakat',
  'streak_rush',
]);

export const uiLanguageEnum = pgEnum('ui_language', ['bn', 'en']);

/* -------------------------------------------------------------------------- */
/* Auth.js (v5) tables — shape fixed by @auth/drizzle-adapter                  */
/* -------------------------------------------------------------------------- */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true, mode: 'date' }),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /** Set when a guest's local progress has been merged in, so it happens once. */
  guestMigratedAt: timestamp('guest_migrated_at', { withTimezone: true }),
  /** Soft delete marker; the hard delete cascade runs from the account route. */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

/* -------------------------------------------------------------------------- */
/* Content: words, examples, decks                                             */
/* -------------------------------------------------------------------------- */

/**
 * `id` is the stable human-readable key from the YAML content files
 * (e.g. `kitab`). Content-defined ids are what make the seed idempotent and
 * make a bad gloss fixable in a diff.
 */
export const words = pgTable(
  'words',
  {
    id: text('id').primaryKey(),

    /** Fully vowelled, exactly as it should be displayed. */
    arabic: text('arabic').notNull(),
    /** Normalised: tashkeel stripped, hamza/alef/ya/ta-marbuta folded. Indexed. */
    arabicPlain: text('arabic_plain').notNull(),
    transliteration: text('transliteration').notNull(),

    bengaliMeanings: jsonb('bengali_meanings').$type<string[]>().notNull(),
    englishMeanings: jsonb('english_meanings').$type<string[]>().notNull(),

    partOfSpeech: partOfSpeechEnum('part_of_speech').notNull(),

    /** Display form, spaced: "ك ت ب". */
    root: text('root'),
    /** Lookup key: "كتب". Indexed, drives the root-family panel. */
    rootKey: text('root_key'),

    gender: genderEnum('gender'),
    pluralArabic: text('plural_arabic'),
    pluralPlain: text('plural_plain'),
    pluralType: pluralTypeEnum('plural_type'),

    /** Verbs only: form I–X, plus the two forms a learner actually needs. */
    verbForm: smallint('verb_form'),
    presentTense: text('present_tense'),
    masdar: text('masdar'),

    /** Lower is commoner. Sparse on purpose; unranked words sort last. */
    frequencyRank: integer('frequency_rank'),

    /** Relative to NEXT_PUBLIC_AUDIO_BASE_URL or /public. Null = no audio yet. */
    audioPath: text('audio_path'),

    /** Editor's note shown on the word page ("contrast with …", grammar hints). */
    editorNote: text('editor_note'),
    /** Set by the seed when a gloss carries a `TODO: verify` comment. */
    needsReview: boolean('needs_review').notNull().default(false),

    tags: jsonb('tags')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    /** All searchable surfaces folded into one column, indexed with pg_trgm. */
    searchBlob: text('search_blob').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('words_arabic_plain_idx').on(table.arabicPlain),
    index('words_root_key_idx').on(table.rootKey),
    index('words_frequency_rank_idx').on(table.frequencyRank),
    index('words_search_blob_trgm_idx').using('gin', sql`${table.searchBlob} gin_trgm_ops`),
  ],
);

export const examples = pgTable(
  'examples',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id, { onDelete: 'cascade' }),
    arabic: text('arabic').notNull(),
    arabicPlain: text('arabic_plain').notNull(),
    bengali: text('bengali').notNull(),
    english: text('english').notNull(),
    /** e.g. "Al-Baqarah 2:2", or null for editor-written sentences. */
    sourceRef: text('source_ref'),
    needsReview: boolean('needs_review').notNull().default(false),
    orderIndex: integer('order_index').notNull().default(0),
  },
  (table) => [index('examples_word_id_idx').on(table.wordId, table.orderIndex)],
);

export const decks = pgTable(
  'decks',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    titleBengali: text('title_bengali').notNull(),
    titleEnglish: text('title_english').notNull(),
    descriptionBengali: text('description_bengali').notNull(),
    descriptionEnglish: text('description_english').notNull(),
    difficulty: difficultyEnum('difficulty').notNull(),
    defaultCardDirection: cardDirectionEnum('default_card_direction')
      .notNull()
      .default('arabic_to_meaning'),
    orderIndex: integer('order_index').notNull().default(0),
    isPublished: boolean('is_published').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('decks_order_idx').on(table.orderIndex)],
);

export const deckWords = pgTable(
  'deck_words',
  {
    deckId: text('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.deckId, table.wordId] }),
    index('deck_words_order_idx').on(table.deckId, table.orderIndex),
    index('deck_words_word_idx').on(table.wordId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Learner state                                                               */
/* -------------------------------------------------------------------------- */

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  uiLanguage: uiLanguageEnum('ui_language').notNull().default('bn'),
  /** Learner-set daily caps. The "you're done" state depends on these. */
  dailyNewLimit: integer('daily_new_limit').notNull().default(10),
  dailyReviewLimit: integer('daily_review_limit').notNull().default(60),
  /** FSRS target retention, 0.7–0.97. */
  desiredRetention: real('desired_retention').notNull().default(0.9),
  /** IANA zone: day boundaries for streaks must be the learner's, not UTC. */
  timezone: text('timezone').notNull().default('Asia/Dhaka'),
  showTransliteration: boolean('show_transliteration').notNull().default(true),
  autoplayAudio: boolean('autoplay_audio').notNull().default(false),
  reducedMotion: boolean('reduced_motion').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per (user, word). Holds live FSRS state only — history lives in
 * `review_logs` and is never overwritten from here.
 */
export const reviewCards = pgTable(
  'review_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id, { onDelete: 'cascade' }),
    /** Deck the card was introduced from; kept for per-deck completion. */
    deckId: text('deck_id').references(() => decks.id, { onDelete: 'set null' }),

    // --- ts-fsrs Card ---
    due: timestamp('due', { withTimezone: true }).notNull().defaultNow(),
    stability: doublePrecision('stability').notNull().default(0),
    difficulty: doublePrecision('difficulty').notNull().default(0),
    elapsedDays: integer('elapsed_days').notNull().default(0),
    scheduledDays: integer('scheduled_days').notNull().default(0),
    learningSteps: smallint('learning_steps').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    state: cardStateEnum('state').notNull().default('new'),
    lastReview: timestamp('last_review', { withTimezone: true }),

    /** Cached bucket for the mastery chart, recomputed on each grade. */
    mastery: masteryEnum('mastery').notNull().default('new'),
    /** Learner-suspended cards drop out of the queue without losing history. */
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('review_cards_user_word_key').on(table.userId, table.wordId),
    /** The due-queue query: user + not suspended + due <= now, ordered by due. */
    index('review_cards_user_due_idx').on(table.userId, table.due),
    index('review_cards_user_state_idx').on(table.userId, table.state),
    index('review_cards_user_deck_idx').on(table.userId, table.deckId),
  ],
);

/**
 * Append-only. Every grading event, from a review session or a game.
 * This is the backbone of the stats page: never update, never delete a row here
 * except by account deletion cascade.
 */
export const reviewLogs = pgTable(
  'review_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id').references(() => reviewCards.id, { onDelete: 'set null' }),
    deckId: text('deck_id').references(() => decks.id, { onDelete: 'set null' }),

    /** 1 again, 2 hard, 3 good, 4 easy. */
    rating: smallint('rating').notNull(),
    source: reviewSourceEnum('source').notNull().default('review'),

    /** FSRS log fields, captured as they were at grading time. */
    stateBefore: cardStateEnum('state_before').notNull(),
    dueBefore: timestamp('due_before', { withTimezone: true }),
    stabilityBefore: doublePrecision('stability_before'),
    difficultyBefore: doublePrecision('difficulty_before'),
    elapsedDays: integer('elapsed_days').notNull().default(0),
    lastElapsedDays: integer('last_elapsed_days').notNull().default(0),
    scheduledDays: integer('scheduled_days').notNull().default(0),

    /** Time from card shown to grade, for the "hesitation" stats and games. */
    elapsedMs: integer('elapsed_ms').notNull().default(0),
    /** Client-generated ULID: makes the offline queue flush idempotent. */
    clientEventId: text('client_event_id').notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull().defaultNow(),
    /** Local date in the learner's timezone — the heatmap's unit. */
    localDate: date('local_date').notNull(),
  },
  (table) => [
    uniqueIndex('review_logs_client_event_key').on(table.userId, table.clientEventId),
    index('review_logs_user_time_idx').on(table.userId, table.reviewedAt),
    index('review_logs_user_date_idx').on(table.userId, table.localDate),
    index('review_logs_word_idx').on(table.wordId),
  ],
);

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Null = standalone notebook entry. */
    wordId: text('word_id').references(() => words.id, { onDelete: 'set null' }),
    /**
     * Client-generated id for notes written offline or as a guest. Makes both
     * the offline flush and the guest migration idempotent: the same note
     * arriving twice updates one row instead of creating two.
     */
    clientId: text('client_id'),
    title: text('title').notNull().default(''),
    /** Markdown. Mixed Arabic/Bengali/English; blocks render with dir="auto". */
    body: text('body').notNull().default(''),
    tags: jsonb('tags')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isPinned: boolean('is_pinned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('notes_user_updated_idx').on(table.userId, table.isPinned, table.updatedAt),
    uniqueIndex('notes_user_client_key').on(table.userId, table.clientId),
    index('notes_user_word_idx').on(table.userId, table.wordId),
    /**
     * Trigram search over title+body. pg_trgm rather than tsvector because
     * Postgres has no Bengali or Arabic text-search configuration, and a note
     * mixes all three scripts in one document.
     */
    index('notes_search_trgm_idx').using(
      'gin',
      sql`(coalesce(${table.title}, '') || ' ' || coalesce(${table.body}, '')) gin_trgm_ops`,
    ),
  ],
);

export const gameSessions = pgTable(
  'game_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deckId: text('deck_id').references(() => decks.id, { onDelete: 'set null' }),
    gameType: gameTypeEnum('game_type').notNull(),
    score: integer('score').notNull().default(0),
    durationMs: integer('duration_ms').notNull().default(0),
    /** 0–1. Stored rather than derived: rounds can be skipped or timed out. */
    accuracy: real('accuracy').notNull().default(0),
    correctCount: integer('correct_count').notNull().default(0),
    totalCount: integer('total_count').notNull().default(0),
    /** Word ids in play order; gradings are in `review_logs`. */
    wordIds: jsonb('word_ids')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    clientEventId: text('client_event_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    localDate: date('local_date').notNull(),
  },
  (table) => [
    uniqueIndex('game_sessions_client_event_key').on(table.userId, table.clientEventId),
    index('game_sessions_user_time_idx').on(table.userId, table.startedAt),
  ],
);

/** One row per learner per local date. Feeds the year heatmap directly. */
export const dailyActivity = pgTable(
  'daily_activity',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date').notNull(),
    reviewCount: integer('review_count').notNull().default(0),
    newCount: integer('new_count').notNull().default(0),
    gameCount: integer('game_count').notNull().default(0),
    noteCount: integer('note_count').notNull().default(0),
    studySeconds: integer('study_seconds').notNull().default(0),
    /** Correct ÷ total for the day, cached for the heatmap tooltip. */
    correctCount: integer('correct_count').notNull().default(0),
    goalMet: boolean('goal_met').notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.localDate] }),
    index('daily_activity_date_idx').on(table.userId, table.localDate),
  ],
);

export const streaks = pgTable('streaks', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastActiveDate: date('last_active_date'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Decks a learner has started, with their own card-direction override. */
export const deckSubscriptions = pgTable(
  'deck_subscriptions',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deckId: text('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    cardDirection: cardDirectionEnum('card_direction'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.deckId] })],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                   */
/* -------------------------------------------------------------------------- */

export const wordsRelations = relations(words, ({ many }) => ({
  examples: many(examples),
  deckWords: many(deckWords),
  reviewCards: many(reviewCards),
  notes: many(notes),
}));

export const examplesRelations = relations(examples, ({ one }) => ({
  word: one(words, { fields: [examples.wordId], references: [words.id] }),
}));

export const decksRelations = relations(decks, ({ many }) => ({
  deckWords: many(deckWords),
  subscriptions: many(deckSubscriptions),
}));

export const deckWordsRelations = relations(deckWords, ({ one }) => ({
  deck: one(decks, { fields: [deckWords.deckId], references: [decks.id] }),
  word: one(words, { fields: [deckWords.wordId], references: [words.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
  streak: one(streaks, { fields: [users.id], references: [streaks.userId] }),
  reviewCards: many(reviewCards),
  reviewLogs: many(reviewLogs),
  notes: many(notes),
  gameSessions: many(gameSessions),
}));

export const reviewCardsRelations = relations(reviewCards, ({ one, many }) => ({
  user: one(users, { fields: [reviewCards.userId], references: [users.id] }),
  word: one(words, { fields: [reviewCards.wordId], references: [words.id] }),
  logs: many(reviewLogs),
}));

export const reviewLogsRelations = relations(reviewLogs, ({ one }) => ({
  card: one(reviewCards, { fields: [reviewLogs.cardId], references: [reviewCards.id] }),
  word: one(words, { fields: [reviewLogs.wordId], references: [words.id] }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  user: one(users, { fields: [notes.userId], references: [users.id] }),
  word: one(words, { fields: [notes.wordId], references: [words.id] }),
}));

/* -------------------------------------------------------------------------- */
/* Inferred types                                                              */
/* -------------------------------------------------------------------------- */

export type Word = typeof words.$inferSelect;
export type NewWord = typeof words.$inferInsert;
export type Example = typeof examples.$inferSelect;
export type NewExample = typeof examples.$inferInsert;
export type Deck = typeof decks.$inferSelect;
export type NewDeck = typeof decks.$inferInsert;
export type ReviewCard = typeof reviewCards.$inferSelect;
export type ReviewLog = typeof reviewLogs.$inferSelect;
export type NewReviewLog = typeof reviewLogs.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type GameSession = typeof gameSessions.$inferSelect;
export type DailyActivity = typeof dailyActivity.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
