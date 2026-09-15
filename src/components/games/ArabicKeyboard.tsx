'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

/**
 * An Arabic keyboard for a learner who does not have one installed.
 *
 * The layout is alphabetical, not the standard Arabic QWERTY. That layout is
 * muscle memory for someone who grew up typing Arabic and a maze for someone
 * learning the alphabet — and this app's learner is squarely the second. The
 * order here is the order they recite: ا ب ت ث ج ح خ.
 *
 * The tashkeel row is separate and always visible. On a phone it is the whole
 * reason the keyboard exists: the system Arabic keyboard hides the vowel marks
 * behind a long press, which is useless when the vowels are the lesson.
 */

const LETTERS = [
  'ا',
  'ب',
  'ت',
  'ث',
  'ج',
  'ح',
  'خ',
  'د',
  'ذ',
  'ر',
  'ز',
  'س',
  'ش',
  'ص',
  'ض',
  'ط',
  'ظ',
  'ع',
  'غ',
  'ف',
  'ق',
  'ك',
  'ل',
  'م',
  'ن',
  'ه',
  'و',
  'ي',
];

/** Seats and variants, kept apart so the core alphabet reads as a block. */
const VARIANTS = ['أ', 'إ', 'آ', 'ء', 'ة', 'ى', 'ؤ', 'ئ'];

const MARKS: { mark: string; key: string }[] = [
  { mark: '\u064E', key: 'fatha' },
  { mark: '\u0650', key: 'kasra' },
  { mark: '\u064F', key: 'damma' },
  { mark: '\u0652', key: 'sukun' },
  { mark: '\u0651', key: 'shadda' },
  { mark: '\u064B', key: 'fathatan' },
];

export function ArabicKeyboard({
  onInsert,
  onBackspace,
  onClear,
  className,
}: {
  onInsert: (character: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  className?: string;
}): ReactNode {
  const t = useTranslations('games.spellingGame');

  return (
    <div className={cn('space-y-2', className)} role="group" aria-label={t('keyboardLabel')}>
      {/* Marks first: they are what this keyboard is for, and putting them at
          the bottom would bury them under the learner's own hand. */}
      <div className="grid grid-cols-6 gap-1.5">
        {MARKS.map(({ mark, key }) => (
          <Key
            key={key}
            label={`\u25CC${mark}`}
            ariaLabel={t(`marks.${key}`)}
            tone="mark"
            onPress={() => {
              onInsert(mark);
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {LETTERS.map((letter) => (
          <Key
            key={letter}
            label={letter}
            onPress={() => {
              onInsert(letter);
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-8 gap-1.5">
        {VARIANTS.map((letter) => (
          <Key
            key={letter}
            label={letter}
            tone="quiet"
            onPress={() => {
              onInsert(letter);
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Key
          label={t('space')}
          tone="quiet"
          onPress={() => {
            onInsert(' ');
          }}
          wide
        />
        <Key label={t('backspace')} tone="quiet" onPress={onBackspace} wide />
        <Key label={t('clear')} tone="quiet" onPress={onClear} wide />
      </div>
    </div>
  );
}

function Key({
  label,
  ariaLabel,
  onPress,
  tone = 'letter',
  wide = false,
}: {
  label: string;
  ariaLabel?: string;
  onPress: () => void;
  tone?: 'letter' | 'mark' | 'quiet';
  wide?: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      // `onPointerDown` rather than `onClick`: a click fires after the pointer
      // lifts, which on a phone is a perceptible lag when typing quickly.
      onPointerDown={(event) => {
        event.preventDefault();
        onPress();
      }}
      aria-label={ariaLabel ?? label}
      className={cn(
        'min-h-touch rounded-ui flex items-center justify-center border',
        'active:bg-nil-wash transition-colors duration-100 select-none',
        wide ? 'text-sm' : 'font-arabic text-xl leading-none',
        tone === 'mark'
          ? 'border-shingraf/40 bg-chuna text-shingraf'
          : tone === 'quiet'
            ? 'border-hairline bg-kagoj text-pathor'
            : 'border-hairline bg-chuna text-dawat',
      )}
    >
      {label}
    </button>
  );
}
