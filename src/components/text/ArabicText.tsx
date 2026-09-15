import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { splitHarakat } from '@/lib/arabic/harakat';
import { stripTashkeel } from '@/lib/arabic/normalize';

/**
 * Every piece of Arabic in the app goes through this component. It exists so
 * that four things can never be forgotten: `lang="ar"`, `dir="rtl"`, the Naskh
 * face, and enough line-height for the harakat to breathe.
 *
 * It is deliberately not a general-purpose typography component. Arabic here is
 * content, not chrome — there is no "small" size below 20px, because vowelled
 * naskh below that is unreadable on the phones this app is built for.
 */

export type ArabicSize = 'sm' | 'base' | 'lg' | 'display';

const SIZE: Record<ArabicSize, string> = {
  sm: 'text-ar-sm',
  base: 'text-ar-base',
  lg: 'text-ar-lg',
  display: 'text-ar-display',
};

export interface ArabicTextProps {
  children: string;
  /** Defaults to `base`. `display` is the flashcard headword and nothing else. */
  size?: ArabicSize;
  as?: ElementType;
  /** Hide the vowel marks — the learner's own toggle, and the harakat games. */
  showHarakat?: boolean;
  /**
   * Set the marks in cinnabar, the way a rubricator added them in a second
   * pass. Off by default: it is an emphasis, and emphasis everywhere is none.
   */
  rubricate?: boolean;
  bold?: boolean;
  className?: string;
  /** Screen readers get the vowelled form even when the eye sees it stripped. */
  srText?: string;
}

export function ArabicText({
  children,
  size = 'base',
  as: Tag = 'span',
  showHarakat = true,
  rubricate = false,
  bold = false,
  className,
  srText,
}: ArabicTextProps): ReactNode {
  const text = showHarakat ? children : stripTashkeel(children);
  // If the eye is shown a stripped word, the ear still gets the vowelled one.
  const spoken = srText ?? (showHarakat ? undefined : children);

  return (
    <Tag
      lang="ar"
      dir="rtl"
      className={cn(
        'font-arabic',
        SIZE[size],
        bold ? 'font-bold' : 'font-normal',
        // Arabic sits on its baseline; stop the browser from letter-spacing or
        // hyphenating it, and never let a headword break mid-word.
        'tracking-normal [text-wrap:nowrap] [hyphens:none]',
        className,
      )}
    >
      {rubricate && showHarakat ? (
        <>
          {splitHarakat(text).map((token, index) => (
            <span
              key={`${index}-${token.text}`}
              className={token.isMark ? 'text-shingraf' : undefined}
            >
              {token.text}
            </span>
          ))}
        </>
      ) : (
        text
      )}
      {spoken === undefined ? null : <span className="sr-only">{spoken}</span>}
    </Tag>
  );
}
