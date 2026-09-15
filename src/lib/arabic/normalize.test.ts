import { describe, expect, it } from 'vitest';
import {
  buildSearchBlob,
  detectScript,
  formatRoot,
  normalizeArabic,
  normalizeLatin,
  normalizeQuery,
  normalizeRoot,
  stripTashkeel,
} from './normalize';

describe('stripTashkeel', () => {
  it('removes harakat but keeps letters', () => {
    expect(stripTashkeel('كِتَاب')).toBe('كتاب');
    expect(stripTashkeel('مُحَمَّد')).toBe('محمد');
  });

  it('removes tatweel', () => {
    expect(stripTashkeel('كــتــاب')).toBe('كتاب');
  });

  it('removes the superscript alef used in Quranic orthography', () => {
    expect(stripTashkeel('صَلٰوة')).toBe('صلوة');
  });
});

describe('normalizeArabic letter foldings', () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ['أ → ا', 'أَرْض', 'ارض'],
    ['إ → ا', 'إِيمَان', 'ايمان'],
    ['آ → ا', 'آخِرَة', 'اخره'],
    ['ٱ → ا', 'ٱللَّه', 'الله'],
    ['ى → ي', 'عَلَى', 'علي'],
    ['ة → ه', 'رَحْمَة', 'رحمه'],
    ['ؤ → و', 'مُؤْمِن', 'مومن'],
    ['ئ → ي', 'قَائِل', 'قايل'],
  ];

  for (const [name, input, expected] of cases) {
    it(name, () => {
      expect(normalizeArabic(input)).toBe(expected);
    });
  }

  it('is idempotent', () => {
    const once = normalizeArabic('ٱلْمَرْأَة');
    expect(normalizeArabic(once)).toBe(once);
  });

  it('folds Arabic-Indic digits', () => {
    expect(normalizeArabic('٢٠٢٦')).toBe('2026');
  });

  it('makes diacritised and undiacritised input compare equal', () => {
    expect(normalizeArabic('كِتَاب')).toBe(normalizeArabic('كتاب'));
    expect(normalizeArabic('اِمْرَأَة')).toBe(normalizeArabic('امراه'));
  });
});

describe('normalizeLatin', () => {
  it('strips macrons and dots so plain typing matches', () => {
    expect(normalizeLatin('kitāb')).toBe('kitab');
    expect(normalizeLatin('ṣalāh')).toBe('salah');
  });

  it('strips the ayn and hamza modifier letters', () => {
    expect(normalizeLatin('ʿilm')).toBe('ilm');
    expect(normalizeLatin('qaraʾa')).toBe('qaraa');
  });
});

describe('detectScript', () => {
  it('identifies the three scripts the app mixes', () => {
    expect(detectScript('كتاب')).toBe('arabic');
    expect(detectScript('বই')).toBe('bengali');
    expect(detectScript('book')).toBe('latin');
    expect(detectScript('123')).toBe('unknown');
  });
});

describe('normalizeQuery', () => {
  it('routes each script to its own normaliser', () => {
    expect(normalizeQuery('كِتَاب')).toEqual({ script: 'arabic', value: 'كتاب' });
    expect(normalizeQuery('  Kitāb ')).toEqual({ script: 'latin', value: 'kitab' });
    expect(normalizeQuery('বই')).toEqual({ script: 'bengali', value: 'বই' });
  });
});

describe('roots', () => {
  it('reduces a spaced root to a lookup key', () => {
    expect(normalizeRoot('ك ت ب')).toBe('كتب');
    expect(normalizeRoot('ك-ت-ب')).toBe('كتب');
  });

  it('formats a root key back for display', () => {
    expect(formatRoot('كتب')).toBe('ك ت ب');
  });
});

describe('buildSearchBlob', () => {
  it('contains every surface a learner might type', () => {
    const blob = buildSearchBlob({
      arabic: 'كِتَاب',
      transliteration: 'kitāb',
      bengali: ['বই', 'কিতাব'],
      english: ['book'],
      root: 'ك ت ب',
      tags: ['quran'],
    });

    expect(blob).toContain('كتاب');
    expect(blob).toContain('kitab');
    expect(blob).toContain('বই');
    expect(blob).toContain('book');
    expect(blob).toContain('كتب');
    expect(blob).not.toContain('كِتَاب');
  });
});
