import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Four intents, one hue. The palette spends its boldness on the Arabic
 * headword, so buttons stay quiet: a filled indigo for the one thing you came
 * to do, a hairline for everything else.
 *
 * Every size clears 44px on the touch axis. `lg` is the phone's primary action
 * and is meant to sit in the lower third of the screen.
 */

type Variant = 'primary' | 'secondary' | 'quiet' | 'rubric';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-nil text-chuna border border-nil hover:bg-nil-deep hover:border-nil-deep active:bg-nil-deep',
  secondary:
    'bg-chuna text-dawat border border-hairline hover:bg-nil-wash hover:border-nil-soft active:bg-nil-wash',
  quiet: 'bg-transparent text-nil border border-transparent hover:bg-nil-wash',
  rubric:
    'bg-transparent text-shingraf border border-shingraf/40 hover:bg-shingraf-wash hover:border-shingraf',
};

const SIZE: Record<Size, string> = {
  sm: 'min-h-touch px-3 text-sm gap-1.5',
  md: 'min-h-touch px-4 text-base gap-2',
  lg: 'min-h-14 px-6 text-lg gap-2.5',
};

export interface ButtonStyleOptions {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
}

/**
 * Shared with `ButtonLink` below, so a link that looks like the primary action
 * cannot drift from the button that is one. Before this existed the same long
 * class string was copied into eight files.
 */
export function buttonStyles({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    'inline-flex items-center justify-center rounded-ui font-semibold',
    'transition-colors duration-150',
    'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent',
    VARIANT[variant],
    SIZE[size],
    fullWidth && 'w-full',
    className,
  );
}

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>, ButtonStyleOptions {
  /** Rendered before the label; flips side automatically in RTL. */
  icon?: ReactNode;
}

export function Button({
  variant,
  size,
  fullWidth,
  icon,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps): ReactNode {
  return (
    <button
      type={type}
      className={buttonStyles({
        ...(variant ? { variant } : {}),
        ...(size ? { size } : {}),
        ...(fullWidth === undefined ? {} : { fullWidth }),
        ...(className ? { className } : {}),
      })}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends ButtonStyleOptions {
  href: string;
  children: ReactNode;
  'aria-label'?: string;
  /** Set for outbound links; internal navigation never needs it. */
  target?: '_blank';
  rel?: string;
}

/**
 * A link that looks like a button. It is a link — it navigates, it opens in a
 * new tab on a middle click, it works with scripting off — and only its
 * appearance is borrowed.
 */
export function ButtonLink({
  href,
  variant,
  size,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps): ReactNode {
  return (
    <Link
      href={href}
      className={buttonStyles({
        ...(variant ? { variant } : {}),
        ...(size ? { size } : {}),
        ...(fullWidth === undefined ? {} : { fullWidth }),
        ...(className ? { className } : {}),
      })}
      {...rest}
    >
      {children}
    </Link>
  );
}
