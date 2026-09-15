import { z } from 'zod';

/**
 * What a guest's device sends when they sign in for the first time.
 *
 * The same schema validates on both sides: the client will not send a batch it
 * cannot build, and the server trusts none of it anyway. Note what is absent —
 * there is no user id in this payload. The account being written to comes from
 * the session, never from the request.
 */

const isoDate = z.string().datetime({ offset: true });
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD');
const wordId = z.string().min(1).max(64);
const clientId = z.string().min(8).max(64);

export const guestCardSchema = z.object({
  wordId,
  deckId: z.string().min(1).max(64).nullable(),
  due: isoDate,
  stability: z.number().finite().min(0),
  difficulty: z.number().finite().min(0),
  elapsedDays: z.number().int().min(0),
  scheduledDays: z.number().int().min(0),
  learningSteps: z.number().int().min(0).max(32),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  state: z.enum(['new', 'learning', 'review', 'relearning']),
  lastReview: isoDate.nullable(),
  mastery: z.enum(['new', 'learning', 'young', 'mature']),
});

export const guestLogSchema = z.object({
  clientEventId: clientId,
  wordId,
  deckId: z.string().min(1).max(64).nullable(),
  rating: z.number().int().min(1).max(4),
  source: z.enum([
    'review',
    'game_match_pairs',
    'game_multiple_choice',
    'game_listening',
    'game_spelling',
    'game_harakat',
    'game_streak_rush',
  ]),
  stateBefore: z.enum(['new', 'learning', 'review', 'relearning']),
  dueBefore: isoDate.nullable(),
  stabilityBefore: z.number().finite().nullable(),
  difficultyBefore: z.number().finite().nullable(),
  elapsedDays: z.number().int().min(0),
  lastElapsedDays: z.number().int().min(0),
  scheduledDays: z.number().int().min(0),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  reviewedAt: isoDate,
  localDate,
});

export const guestGameSchema = z.object({
  clientEventId: clientId,
  deckId: z.string().min(1).max(64).nullable(),
  gameType: z.enum([
    'match_pairs',
    'multiple_choice',
    'listening',
    'spelling',
    'harakat',
    'streak_rush',
  ]),
  score: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  accuracy: z.number().min(0).max(1),
  correctCount: z.number().int().min(0),
  totalCount: z.number().int().min(0),
  wordIds: z.array(wordId).max(60),
  startedAt: isoDate,
  endedAt: isoDate.nullable(),
  localDate,
});

export const guestNoteSchema = z.object({
  clientId,
  wordId: wordId.nullable(),
  title: z.string().max(200),
  body: z.string().max(20_000),
  tags: z.array(z.string().min(1).max(40)).max(20),
  isPinned: z.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const guestSettingsSchema = z.object({
  uiLanguage: z.enum(['bn', 'en']),
  dailyNewLimit: z.number().int().min(0).max(200),
  dailyReviewLimit: z.number().int().min(0).max(2000),
  desiredRetention: z.number().min(0.7).max(0.97),
  timezone: z.string().min(1).max(64),
  showTransliteration: z.boolean(),
  autoplayAudio: z.boolean(),
});

/**
 * Batch caps exist so one enormous request cannot hold a transaction open.
 * The client sends as many batches as it needs; every batch is idempotent, so
 * a retried or duplicated batch changes nothing.
 */
export const BATCH_LIMITS = {
  cards: 500,
  logs: 1000,
  games: 200,
  notes: 200,
} as const;

export const guestMigrationSchema = z.object({
  /** Stable per device. Logged with the migration so a support case is traceable. */
  guestId: clientId,
  /** True on the final batch: only then is the account marked as migrated. */
  final: z.boolean(),
  settings: guestSettingsSchema.nullable(),
  cards: z.array(guestCardSchema).max(BATCH_LIMITS.cards),
  logs: z.array(guestLogSchema).max(BATCH_LIMITS.logs),
  games: z.array(guestGameSchema).max(BATCH_LIMITS.games),
  notes: z.array(guestNoteSchema).max(BATCH_LIMITS.notes),
});

export type GuestCard = z.infer<typeof guestCardSchema>;
export type GuestLog = z.infer<typeof guestLogSchema>;
export type GuestGame = z.infer<typeof guestGameSchema>;
export type GuestNote = z.infer<typeof guestNoteSchema>;
export type GuestSettings = z.infer<typeof guestSettingsSchema>;
export type GuestMigrationPayload = z.infer<typeof guestMigrationSchema>;

export interface MigrationResult {
  cardsWritten: number;
  logsWritten: number;
  gamesWritten: number;
  notesWritten: number;
  /** Words the account already knew better than the guest device did. */
  cardsKept: number;
  completed: boolean;
}
