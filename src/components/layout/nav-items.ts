import type { ComponentType, SVGProps } from 'react';
import { GamesIcon, NotesIcon, ProgressIcon, ReviewIcon, WordsIcon } from '@/components/icons';

export interface NavItem {
  href: string;
  /** Key into the `nav` namespace of the message catalogue. */
  key: 'review' | 'words' | 'games' | 'notes' | 'progress';
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * Five destinations, in the order a learner uses them: review first because
 * that is why they opened the app, progress last because it is a reward, not a
 * task. The same array drives the phone's bottom bar and the desktop sidebar —
 * two layouts, one information architecture.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', key: 'review', Icon: ReviewIcon },
  { href: '/words', key: 'words', Icon: WordsIcon },
  { href: '/games', key: 'games', Icon: GamesIcon },
  { href: '/notes', key: 'notes', Icon: NotesIcon },
  { href: '/progress', key: 'progress', Icon: ProgressIcon },
];

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}
