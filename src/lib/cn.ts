import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge has to be told about the font sizes this project adds in
 * `@theme`, because `text-*` is ambiguous: it is both the font-size utility and
 * the text-colour utility. Anything tailwind-merge does not recognise as a size
 * it assumes is a colour — so `cn('text-ar-display', 'text-nil')` silently
 * dropped the size and left every Arabic headword at the inherited 16px.
 *
 * Keep this list in step with the `--text-*` tokens in globals.css. The stock
 * scale (xs…3xl) is already known; only the additions go here.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['2xs', 'ar-sm', 'ar-base', 'ar-lg', 'ar-display'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
