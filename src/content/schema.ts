import { z } from 'zod';

/**
 * Every content file is validated before it can reach the database. A bad gloss
 * should fail `npm run content:check` in CI, not appear on a learner's card.
 */

const ARABIC_ONLY = /^[\u0600-\u06FF\u0750-\u077F\s.،؛؟!:"'()\-]+$/u;
const BENGALI_TEXT = /[\u0980-\u09FF]/u;

const contentId = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, 'ids are lowercase kebab-case, e.g. "imra-ah"');

const arabicText = z
  .string()
  .min(1)
  .refine((value) => ARABIC_ONLY.test(value), {
    message: 'must be Arabic script (no Latin letters left in the field)',
  });

const bengaliText = z
  .string()
  .min(1)
  .refine((value) => BENGALI_TEXT.test(value), {
    message: 'must contain Bengali script — did an English gloss land in a Bengali field?',
  });

export const partOfSpeechSchema = z.enum([
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

export const exampleSchema = z.object({
  arabic: arabicText,
  bn: bengaliText,
  en: z.string().min(1),
  /** e.g. "Al-Baqarah 2:2". Omit for editor-written sentences. */
  source: z.string().min(2).optional(),
  /** Set true when the Bengali phrasing still needs a native-speaker pass. */
  needsReview: z.boolean().default(false),
});

export const wordSchema = z
  .object({
    id: contentId,
    /** Fully vowelled. The app never displays unvowelled Arabic as the headword. */
    arabic: arabicText,
    transliteration: z.string().min(1),
    pos: partOfSpeechSchema,
    bn: z.array(bengaliText).min(1),
    en: z.array(z.string().min(1)).min(1),
    root: z.string().optional(),
    gender: z.enum(['masculine', 'feminine', 'both']).optional(),
    plural: z
      .object({
        arabic: arabicText,
        type: z.enum(['sound_masculine', 'sound_feminine', 'broken', 'dual_only', 'invariable']),
      })
      .optional(),
    verb: z
      .object({
        form: z.number().int().min(1).max(10),
        present: arabicText,
        masdar: arabicText.optional(),
      })
      .optional(),
    frequencyRank: z.number().int().positive().optional(),
    audio: z
      .string()
      .regex(/^audio\/[\w/-]+\.mp3$/u, 'audio paths look like audio/words/kitab.mp3')
      .optional(),
    editorNote: z.string().optional(),
    tags: z.array(z.string().min(1)).default([]),
    examples: z.array(exampleSchema).default([]),
    /** True while any Bengali gloss on this word is still unverified. */
    needsReview: z.boolean().default(false),
  })
  .strict()
  .superRefine((word, ctx) => {
    if (word.pos === 'verb' && !word.verb) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verb'],
        message: 'verbs need form + present tense so the learner can conjugate them',
      });
    }
    if (word.pos === 'noun' && !word.gender) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gender'],
        message: 'nouns need a gender — it changes agreement and the learner needs it',
      });
    }
  });

export const wordFileSchema = z.object({
  $schema: z.string().optional(),
  words: z.array(wordSchema).min(1),
});

export const deckSchema = z
  .object({
    id: contentId,
    slug: contentId,
    title: z.object({ bn: bengaliText, en: z.string().min(1) }),
    description: z.object({ bn: bengaliText, en: z.string().min(1) }),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    defaultCardDirection: z
      .enum(['arabic_to_meaning', 'meaning_to_arabic', 'audio_to_meaning'])
      .default('arabic_to_meaning'),
    order: z.number().int().min(0).default(0),
    published: z.boolean().default(true),
    /** Ordered word ids. Order is the introduction order in the queue. */
    words: z.array(contentId).min(1),
  })
  .strict();

export const deckFileSchema = z.object({
  $schema: z.string().optional(),
  decks: z.array(deckSchema).min(1),
});

export type ContentWord = z.infer<typeof wordSchema>;
export type ContentExample = z.infer<typeof exampleSchema>;
export type ContentDeck = z.infer<typeof deckSchema>;
