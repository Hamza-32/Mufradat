import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { detectScript } from '@/lib/arabic/normalize';

/**
 * The counterpart to <ArabicText>: everything that is not Arabic. It picks the
 * face and the `lang` from the script rather than from the caller's memory,
 * which matters because a single line in this app can be Bengali, a Latin
 * transliteration, and an Arabic fragment at once.
 *
 * `dir="auto"` on every block is what makes the notes editor work: a paragraph
 * that starts in Arabic lays out right-to-left, the Bengali paragraph under it
 * lays out left-to-right, inside one document.
 */

export type GlossScript = 'bn' | 'en' | 'auto';

export interface GlossTextProps {
  children: ReactNode;
  /** `auto` detects per string — use it for anything the learner typed. */
  script?: GlossScript;
  as?: ElementType;
  className?: string;
  /** Cap the measure at 68ch. On by default for prose, off for labels. */
  measure?: boolean;
}

const SCRIPT_CLASS: Record<'bn' | 'en' | 'ar' | 'unknown', string> = {
  bn: 'font-bengali',
  en: 'font-latin',
  ar: 'font-arabic leading-[2]',
  unknown: 'font-latin',
};

const SCRIPT_LANG: Record<'bn' | 'en' | 'ar' | 'unknown', string | undefined> = {
  bn: 'bn',
  en: 'en',
  ar: 'ar',
  unknown: undefined,
};

function resolve(script: GlossScript, children: ReactNode): 'bn' | 'en' | 'ar' | 'unknown' {
  if (script !== 'auto') return script;
  if (typeof children !== 'string') return 'unknown';
  const detected = detectScript(children);
  if (detected === 'arabic') return 'ar';
  if (detected === 'bengali') return 'bn';
  if (detected === 'latin') return 'en';
  return 'unknown';
}

export function GlossText({
  children,
  script = 'auto',
  as: Tag = 'span',
  className,
  measure = false,
}: GlossTextProps): ReactNode {
  const resolved = resolve(script, children);

  return (
    <Tag
      lang={SCRIPT_LANG[resolved]}
      dir="auto"
      className={cn(SCRIPT_CLASS[resolved], measure && 'measure', className)}
    >
      {children}
    </Tag>
  );
}

/**
 * A word's meanings, in the learner's reading order: Bengali first because it
 * is the language they think in, English second as a check. Separated by a
 * hairline rule rather than a middle dot.
 */
export function MeaningList({
  bengali,
  english,
  className,
}: {
  bengali: readonly string[];
  english: readonly string[];
  className?: string;
}): ReactNode {
  return (
    <dl className={cn('space-y-2', className)}>
      <div>
        <dt className="sr-only" lang="bn">
          বাংলা অর্থ
        </dt>
        <GlossText as="dd" script="bn" className="text-dawat text-lg">
          {bengali.join(', ')}
        </GlossText>
      </div>
      <div className="border-hairline-soft border-t pt-2">
        <dt className="sr-only" lang="en">
          English meaning
        </dt>
        <GlossText as="dd" script="en" className="text-pathor text-sm">
          {english.join(', ')}
        </GlossText>
      </div>
    </dl>
  );
}
