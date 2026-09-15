import type { ReactNode, SVGProps } from 'react';

/**
 * Icons are drawn at 24px on a 1.5px stroke with square joins, to match the
 * hairline rules everywhere else. Emoji are never used as interface icons:
 * beside Naskh and Bengali serif they read cheap, and they do not inherit
 * colour, so an active state could not be expressed.
 *
 * Every icon is decorative. The label beside it carries the meaning, on the
 * phone's bottom bar as well as the desktop sidebar, so nothing here needs a
 * title element.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps & { children: ReactNode }): ReactNode {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Review: two cards, the front one lifted off the stack. */
export function ReviewIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <rect x="6" y="3.5" width="14" height="11" rx="1" />
      <path d="M16 17.5H4.5V7" />
    </Svg>
  );
}

/** Words: a spread, ruled. */
export function WordsIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M3.5 5.5h7v14h-7z" />
      <path d="M13.5 5.5h7v14h-7z" />
      <path d="M5.5 9.5h3M15.5 9.5h3M5.5 13h3M15.5 13h3" />
    </Svg>
  );
}

/** Games: the match-the-pairs board. */
export function GamesIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" />
      <rect x="13.5" y="3.5" width="7" height="7" />
      <rect x="3.5" y="13.5" width="7" height="7" />
      <rect x="13.5" y="13.5" width="7" height="7" />
    </Svg>
  );
}

/** Notes: a sheet with a reed pen across it. */
export function NotesIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M5.5 3.5h9l5 5v12h-14z" />
      <path d="M14.5 3.5v5h5" />
      <path d="M8 12.5h6M8 16h4" />
    </Svg>
  );
}

/** Progress: three columns of a bar chart, not a heatmap — that would repeat. */
export function ProgressIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M4 20.5V14M12 20.5V4M20 20.5V10" />
      <path d="M2.5 20.5h19" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props} strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </Svg>
  );
}

export function PlayIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M7.5 4.5l12 7.5-12 7.5z" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M12 4.5v15M4.5 12h15" />
    </Svg>
  );
}
