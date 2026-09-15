import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card } from 'ts-fsrs';

/**
 * The only place FSRS is called. The review API, the games and the guest-mode
 * offline path all schedule through this file, so a learner cannot get one
 * interval on their phone and a different one on their laptop.
 *
 * FSRS, not SM-2: it fits stability and difficulty per card from the actual
 * review history instead of nudging a fixed ease factor, which matters most for
 * exactly the cards a learner keeps failing.
 */

export type CardState = 'new' | 'learning' | 'review' | 'relearning';
export type Mastery = 'new' | 'learning' | 'young' | 'mature';
/** 1 again, 2 hard, 3 good, 4 easy — the four buttons on the card. */
export type Grade = 1 | 2 | 3 | 4;

export interface SchedulerCard {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview: Date | null;
}

export interface GradeOutcome {
  card: SchedulerCard;
  mastery: Mastery;
  /** The card's state *before* the grade, for the append-only log. */
  log: {
    stateBefore: CardState;
    dueBefore: Date | null;
    stabilityBefore: number | null;
    difficultyBefore: number | null;
    elapsedDays: number;
    lastElapsedDays: number;
    scheduledDays: number;
  };
}

const STATE_TO_ENUM: Record<CardState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

const ENUM_TO_STATE: Record<number, CardState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const GRADE_TO_RATING: Record<Grade, Rating> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
};

/** An interval of three weeks or more is the usual line between young and mature. */
const MATURE_DAYS = 21;

export function newCard(now = new Date()): SchedulerCard {
  return fromFsrs(createEmptyCard(now));
}

function toFsrs(card: SchedulerCard): Card {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_ENUM[card.state],
    last_review: card.lastReview ?? undefined,
  } as Card;
}

function fromFsrs(card: Card): SchedulerCard {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: ENUM_TO_STATE[card.state] ?? 'new',
    lastReview: card.last_review ?? null,
  };
}

export function masteryOf(card: SchedulerCard): Mastery {
  if (card.state === 'new') return 'new';
  if (card.state === 'learning' || card.state === 'relearning') return 'learning';
  return card.scheduledDays >= MATURE_DAYS ? 'mature' : 'young';
}

function scheduler(desiredRetention: number) {
  return fsrs(
    generatorParameters({
      request_retention: desiredRetention,
      // Fuzz spreads a day's load, but it also makes the interval preview on
      // the grade buttons a lie. Predictability wins on a learning app.
      enable_fuzz: false,
    }),
  );
}

/**
 * What each of the four buttons would do, so the card can show the real
 * interval under each one before the learner commits.
 */
export function previewIntervals(
  card: SchedulerCard,
  now: Date,
  desiredRetention = 0.9,
): Record<Grade, number> {
  const result = scheduler(desiredRetention).repeat(toFsrs(card), now);
  return {
    1: daysUntil(now, result[Rating.Again].card.due),
    2: daysUntil(now, result[Rating.Hard].card.due),
    3: daysUntil(now, result[Rating.Good].card.due),
    4: daysUntil(now, result[Rating.Easy].card.due),
  };
}

/** Fractional days, rounded up, with a floor of zero for same-session steps. */
function daysUntil(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
}

export function gradeCard(
  card: SchedulerCard,
  grade: Grade,
  now: Date,
  desiredRetention = 0.9,
): GradeOutcome {
  const results = scheduler(desiredRetention).repeat(toFsrs(card), now);
  // `repeat` also exposes a Manual entry; only the four learner-visible grades
  // are ever indexed here, which the Grade type already guarantees.
  const result = results[GRADE_TO_RATING[grade] as Exclude<Rating, Rating.Manual>];
  const next = fromFsrs(result.card);

  return {
    card: next,
    mastery: masteryOf(next),
    log: {
      stateBefore: card.state,
      dueBefore: card.state === 'new' ? null : card.due,
      stabilityBefore: card.state === 'new' ? null : card.stability,
      difficultyBefore: card.state === 'new' ? null : card.difficulty,
      elapsedDays: result.log.elapsed_days,
      lastElapsedDays: result.log.last_elapsed_days,
      scheduledDays: result.log.scheduled_days,
    },
  };
}

/**
 * The learner's local date, in their own timezone. Every streak and heatmap
 * bucket is keyed on this: a 1 a.m. session in Dhaka belongs to the night
 * before, not to a UTC tomorrow.
 */
export function localDateIn(timezone: string, at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(at);
}
