import { describe, expect, it } from 'vitest';
import {
  buildForecast,
  buildHeatmap,
  levelFor,
  masteryTotal,
  monthLabels,
  retentionRate,
} from './heatmap';

describe('levelFor', () => {
  it('gives an empty day nothing', () => {
    expect(levelFor(0, 50)).toBe(0);
  });

  it('scales against the learner s own busiest day, not a fixed target', () => {
    // Ten reviews is a quiet day for one learner and a full one for another.
    expect(levelFor(10, 100)).toBe(1);
    expect(levelFor(10, 10)).toBe(4);
  });

  it('treats any activity as full when the learner has only ever done one', () => {
    expect(levelFor(1, 1)).toBe(4);
  });
});

describe('buildHeatmap', () => {
  it('always starts its columns on a Sunday', () => {
    const grid = buildHeatmap([], '2026-09-12', 4);
    for (const column of grid) {
      expect(new Date(`${column[0]!.date}T00:00:00Z`).getUTCDay()).toBe(0);
    }
  });

  it('draws the requested number of weeks, seven days each', () => {
    const grid = buildHeatmap([], '2026-09-12', 53);
    expect(grid).toHaveLength(53);
    expect(grid.every((column) => column.length === 7)).toBe(true);
  });

  it('ends on the week containing today', () => {
    const grid = buildHeatmap([], '2026-09-12', 4);
    const lastWeek = grid.at(-1)!.map((cell) => cell.date);
    expect(lastWeek).toContain('2026-09-12');
  });

  it('places a day s count on that exact day', () => {
    const grid = buildHeatmap([{ date: '2026-09-10', count: 12 }], '2026-09-12', 4);
    const cell = grid.flat().find((item) => item.date === '2026-09-10');
    expect(cell).toMatchObject({ count: 12, level: 4 });
  });

  it('leaves days with no activity at zero rather than undefined', () => {
    const grid = buildHeatmap([{ date: '2026-09-10', count: 5 }], '2026-09-12', 2);
    expect(grid.flat().every((cell) => typeof cell.count === 'number')).toBe(true);
  });
});

describe('monthLabels', () => {
  it('marks each column where a new month begins', () => {
    const labels = monthLabels(buildHeatmap([], '2026-09-12', 10));
    expect(labels.length).toBeGreaterThanOrEqual(2);
    expect(labels[0]!.week).toBe(0);
  });
});

describe('retentionRate', () => {
  it('is null rather than zero when nothing has been reviewed', () => {
    expect(retentionRate(0, 0)).toBeNull();
  });

  it('is the share of recalled cards', () => {
    expect(retentionRate(10, 9)).toBe(0.9);
  });
});

describe('buildForecast', () => {
  it('always returns fourteen days, starting today', () => {
    const forecast = buildForecast([], '2026-09-12');
    expect(forecast).toHaveLength(14);
    expect(forecast[0]!.date).toBe('2026-09-12');
    expect(forecast.at(-1)!.date).toBe('2026-09-25');
  });

  it('keeps quiet days in the chart instead of dropping them', () => {
    const forecast = buildForecast([{ date: '2026-09-14', count: 7 }], '2026-09-12');
    expect(forecast[1]!.count).toBe(0);
    expect(forecast[2]!.count).toBe(7);
  });

  it('ignores days beyond the window', () => {
    const forecast = buildForecast([{ date: '2027-01-01', count: 99 }], '2026-09-12');
    expect(forecast.every((day) => day.count === 0)).toBe(true);
  });
});

describe('masteryTotal', () => {
  it('adds the four buckets', () => {
    expect(masteryTotal({ new: 1, learning: 2, young: 3, mature: 4 })).toBe(10);
  });
});
