import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A washed panel laid on paper. Note the inversion: the page ground (kagoj) is
 * darker than the panel (chuna), so a surface reads as lime wash on paper
 * rather than as a card floating over white. No shadow — the only shadow in the
 * app is on the bottom sheet, which genuinely floats.
 */

export interface PanelStyleOptions {
  interactive?: boolean;
  /** `data` for tables, heatmaps and rows; `ui` for anything you press. */
  radius?: 'data' | 'ui';
  className?: string;
}

/**
 * Exported separately so a link or a button can wear the panel surface without
 * Panel having to become a polymorphic component with untypeable props.
 */
export function panelStyles({
  interactive = false,
  radius = 'ui',
  className,
}: PanelStyleOptions = {}): string {
  return cn(
    'border border-hairline bg-chuna',
    radius === 'ui' ? 'rounded-ui' : 'rounded-data',
    interactive && 'transition-colors duration-150 hover:border-nil-soft hover:bg-nil-wash/40',
    className,
  );
}

export function Panel({
  children,
  as: Tag = 'div',
  ...options
}: PanelStyleOptions & { children: ReactNode; as?: ElementType }): ReactNode {
  return <Tag className={panelStyles(options)}>{children}</Tag>;
}
