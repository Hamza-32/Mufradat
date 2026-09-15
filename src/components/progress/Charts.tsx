import type { ReactNode } from 'react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { cn } from '@/lib/cn';
import { Panel } from '@/components/ui/Panel';
import {
  monthLabels,
  masteryTotal,
  type ForecastDay,
  type HeatmapCell,
  type MasteryCounts,
} from '@/lib/progress/heatmap';

/**
 * Every chart here is server-rendered markup — no charting library, no
 * client-side canvas. A year of squares is 371 divs, which costs less than the
 * JavaScript a chart library would ship, and it stays readable with scripting
 * off.
 *
 * Colour carries only intensity, never category: one hue, four steps. The
 * numbers beside each chart say what the colour says.
 */

const LEVEL_CLASS: Record<HeatmapCell['level'], string> = {
  0: 'bg-hairline-soft',
  1: 'bg-nil/25',
  2: 'bg-nil/50',
  3: 'bg-nil/75',
  4: 'bg-nil',
};

export async function YearHeatmap({
  grid,
  totalDays,
  streak,
}: {
  grid: HeatmapCell[][];
  totalDays: number;
  streak: { current: number; longest: number };
}): Promise<ReactNode> {
  const t = await getTranslations('progress');
  const format = await getFormatter();
  const months = monthLabels(grid);
  const busiest = grid
    .flat()
    .reduce<HeatmapCell | null>(
      (best, cell) => (best === null || cell.count > best.count ? cell : best),
      null,
    );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-base">
          <span className="text-nil font-semibold" data-numeric>
            {t('streakDays', { days: streak.current })}
          </span>
          <span className="text-pathor ms-3 text-sm" data-numeric>
            {t('longestStreak', { days: streak.longest })}
          </span>
        </p>
        <p className="text-pathor text-sm" data-numeric>
          {t('daysStudied', { days: totalDays })}
        </p>
      </div>

      {/* Phone: the year scrolls sideways, most recent week first in reading
          order. Desktop: the whole year fits, which is the point of the width. */}
      <div className="scroll-x -mx-4 px-4 md:mx-0 md:px-0">
        <div
          role="img"
          aria-label={t('heatmapLabel', {
            days: totalDays,
            best: busiest?.count ?? 0,
          })}
          className="inline-flex flex-col gap-1"
        >
          <div className="flex gap-[3px]" aria-hidden="true">
            {grid.map((column, index) => {
              const label = months.find((month) => month.week === index);
              return (
                <span key={index} className="text-2xs text-pathor-soft w-[10px]">
                  {label && index % 4 === 0
                    ? format.dateTime(new Date(2026, label.month - 1, 1), { month: 'short' })
                    : ''}
                </span>
              );
            })}
          </div>

          <div className="flex gap-[3px]" aria-hidden="true">
            {grid.map((column, index) => (
              <div key={index} className="flex flex-col gap-[3px]">
                {column.map((cell) => (
                  <span
                    key={cell.date}
                    title={`${cell.date} · ${cell.count}`}
                    className={cn('rounded-data size-[10px]', LEVEL_CLASS[cell.level])}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* A screen reader gets the shape of the year in one sentence rather than
          371 announcements. */}
      <p className="sr-only">
        {t('heatmapSummary', { days: totalDays, best: busiest?.count ?? 0 })}
      </p>
    </section>
  );
}

export async function MasteryBreakdown({ counts }: { counts: MasteryCounts }): Promise<ReactNode> {
  const t = await getTranslations('progress');
  const total = masteryTotal(counts);

  const rows = [
    { key: 'new', value: counts.new, shade: 'bg-nil/25' },
    { key: 'learning', value: counts.learning, shade: 'bg-nil/50' },
    { key: 'young', value: counts.young, shade: 'bg-nil/75' },
    { key: 'mature', value: counts.mature, shade: 'bg-nil' },
  ] as const;

  return (
    <dl className="space-y-3">
      {rows.map((row) => (
        <div key={row.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-dawat text-sm">{t(`mastery.${row.key}`)}</dt>
            <dd className="text-dawat text-sm font-semibold" data-numeric>
              {row.value}
            </dd>
          </div>
          <div className="rounded-data bg-hairline-soft h-1.5 overflow-hidden">
            <div
              className={cn('h-full', row.shade)}
              style={{ inlineSize: `${total === 0 ? 0 : (row.value / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-pathor pt-1 text-xs">{t('masteryHint')}</p>
    </dl>
  );
}

export async function Forecast({ days }: { days: ForecastDay[] }): Promise<ReactNode> {
  const t = await getTranslations('progress');
  const format = await getFormatter();
  const peak = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <div className="space-y-3">
      <div
        role="img"
        aria-label={t('forecastLabel', { count: total })}
        className="flex h-28 items-end gap-1.5"
      >
        {days.map((day) => (
          <span
            key={day.date}
            title={`${day.date} · ${day.count}`}
            className="flex flex-1 flex-col items-center justify-end gap-1"
          >
            <span
              className={cn('rounded-data w-full', day.count === 0 ? 'bg-hairline-soft' : 'bg-nil')}
              style={{ blockSize: `${Math.max(3, (day.count / peak) * 88)}px` }}
            />
            <span className="text-2xs text-pathor-soft" data-numeric>
              {format.dateTime(new Date(`${day.date}T00:00:00Z`), { day: 'numeric' })}
            </span>
          </span>
        ))}
      </div>
      <p className="text-pathor text-xs" data-numeric>
        {t('forecastTotal', { count: total })}
      </p>
    </div>
  );
}

export async function RetentionCard({
  retention,
  windowDays,
}: {
  retention: number | null;
  windowDays: number;
}): Promise<ReactNode> {
  const t = await getTranslations('progress');
  const format = await getFormatter();

  return (
    <Panel className="space-y-1 p-4">
      <p className="text-pathor text-sm">{t('retention')}</p>
      <p className="text-nil text-3xl font-semibold" data-numeric>
        {retention === null ? '—' : format.number(retention, { style: 'percent' })}
      </p>
      <p className="text-pathor text-xs">
        {retention === null ? t('retentionEmpty') : t('retentionHint', { days: windowDays })}
      </p>
    </Panel>
  );
}
