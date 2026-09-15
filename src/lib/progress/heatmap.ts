/**
 * Shaping the progress page's data, as pure functions.
 *
 * All of this is arithmetic over dates, which is exactly the kind of code that
 * is wrong in ways nobody notices for months — an off-by-one in the week
 * alignment, a streak that survives a missed day, a retention rate that
 * silently counts first-ever sightings as failures. It is separated out so it
 * can be tested against known inputs.
 */

export interface DayEntry {
  /** Local date, YYYY-MM-DD, in the learner's own timezone. */
  date: string;
  count: number;
}

export interface HeatmapCell {
  date: string;
  count: number;
  /** 0 for a day with nothing, 1–4 for increasing effort. */
  level: 0 | 1 | 2 | 3 | 4;
}

const DAY_MS = 86_400_000;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday, matching the column layout the heatmap draws. */
function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * Levels are relative to the learner's own busiest day, not to a fixed number
 * of reviews. Someone doing ten a day should see a full-looking year, not a
 * pale one — the heatmap is there to reward the habit, not to rank them
 * against a stranger.
 */
export function levelFor(count: number, peak: number): HeatmapCell['level'] {
  if (count <= 0) return 0;
  if (peak <= 1) return 4;
  const share = count / peak;
  if (share <= 0.25) return 1;
  if (share <= 0.5) return 2;
  if (share <= 0.75) return 3;
  return 4;
}

/**
 * A year as columns of seven days, Sunday at the top, ending on the week that
 * contains today. The grid always starts on a Sunday so the rows line up with
 * the weekday labels.
 */
export function buildHeatmap(
  entries: readonly DayEntry[],
  today: string,
  weeks = 53,
): HeatmapCell[][] {
  const counts = new Map(entries.map((entry) => [entry.date, entry.count]));
  const peak = Math.max(1, ...entries.map((entry) => entry.count));

  const lastColumnStart = addDays(today, -weekday(today));
  const firstDay = addDays(lastColumnStart, -(weeks - 1) * 7);

  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = addDays(firstDay, week * 7 + day);
      const count = counts.get(date) ?? 0;
      return { date, count, level: levelFor(count, peak) };
    }),
  );
}

/** Which months start within the drawn grid, for the column labels. */
export function monthLabels(grid: readonly HeatmapCell[][]): { week: number; month: number }[] {
  const labels: { week: number; month: number }[] = [];
  let previous = -1;
  for (const [index, column] of grid.entries()) {
    const first = column[0];
    if (!first) continue;
    const month = Number(first.date.slice(5, 7));
    if (month !== previous) {
      labels.push({ week: index, month });
      previous = month;
    }
  }
  return labels;
}

/**
 * True retention: of the cards the learner had already learned and was asked to
 * recall, how many came back. Reviews of brand-new cards are excluded — a word
 * seen for the first time cannot be "forgotten", and counting it would drag the
 * number down for exactly the learners who are working hardest.
 */
export function retentionRate(reviewed: number, recalled: number): number | null {
  if (reviewed <= 0) return null;
  return recalled / reviewed;
}

export interface ForecastDay {
  date: string;
  count: number;
}

/**
 * Fourteen days, every one present even when nothing is due, so the chart has a
 * stable width and a quiet week reads as a quiet week rather than a short bar
 * chart.
 */
export function buildForecast(due: readonly DayEntry[], today: string, days = 14): ForecastDay[] {
  const counts = new Map(due.map((entry) => [entry.date, entry.count]));
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index);
    return { date, count: counts.get(date) ?? 0 };
  });
}

export interface MasteryCounts {
  new: number;
  learning: number;
  young: number;
  mature: number;
}

export function masteryTotal(counts: MasteryCounts): number {
  return counts.new + counts.learning + counts.young + counts.mature;
}
