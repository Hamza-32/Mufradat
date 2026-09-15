'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { audioUrl, playableSrc } from '@/lib/audio';
import { PlayIcon } from '@/components/icons';

type Status = 'idle' | 'playing' | 'missing';

/**
 * Pronunciation, with a graceful fallback for the many words that have no
 * recording yet: the button disables itself and says so, rather than throwing
 * a broken-media error at someone mid-review.
 *
 * The audio element is created on first press, so a list of forty words does
 * not open forty media handles on a mid-range phone, and it plays from an
 * in-memory blob rather than the .mp3 URL — see `playableSrc` for why.
 */
export function AudioButton({
  path,
  label,
  missingLabel,
  className,
}: {
  path: string | null;
  label: string;
  missingLabel: string;
  className?: string;
}): ReactNode {
  const [status, setStatus] = useState<Status>(path ? 'idle' : 'missing');
  const audio = useRef<HTMLAudioElement | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      audio.current?.pause();
    };
  }, []);

  const play = useCallback(() => {
    const url = audioUrl(path);
    if (!url) {
      setStatus('missing');
      return;
    }
    setStatus('playing');
    void (async () => {
      try {
        const src = await playableSrc(url);
        // The press may have been on a card that has since been swapped out.
        if (!mounted.current) return;
        const element = (audio.current ??= new Audio());
        // Rewinding before the metadata has loaded throws, so only a genuine
        // replay of the clip already loaded resets the position.
        if (element.src === src) element.currentTime = 0;
        else element.src = src;
        element.onended = () => {
          setStatus('idle');
        };
        element.onerror = () => {
          setStatus('missing');
        };
        await element.play();
      } catch {
        if (mounted.current) setStatus('missing');
      }
    })();
  }, [path]);

  const unavailable = status === 'missing';

  return (
    <button
      type="button"
      onClick={play}
      disabled={unavailable}
      aria-label={unavailable ? missingLabel : label}
      className={cn(
        'size-touch rounded-ui inline-flex items-center justify-center border',
        unavailable
          ? 'border-hairline-soft text-pathor-soft'
          : 'border-hairline text-nil hover:bg-nil-wash',
        status === 'playing' && 'bg-nil-wash',
        className,
      )}
    >
      <PlayIcon width={18} height={18} />
    </button>
  );
}
