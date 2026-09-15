'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { CloseIcon, PlusIcon } from '@/components/icons';
import { SearchField } from '@/components/ui/SearchField';
import { Chip } from '@/components/ui/Chip';
import { Markdown } from './Markdown';
import { deriveTitle } from '@/lib/notes/markdown';
import { guestNotes, newClientId, serverNotes, type NotesAdapter } from '@/lib/notes/adapters';
import type { NoteRecord } from '@/lib/notes/queries';

interface Draft {
  clientId: string;
  wordId: string | null;
  title: string;
  body: string;
  tags: string[];
  isPinned: boolean;
}

const AUTOSAVE_MS = 900;

/**
 * Two designed layouts sharing one component. Under 1024px the list fills the
 * screen and opening a note covers it entirely — a phone has no room for a
 * two-pane editor, and a cramped one is worse than a full-screen one. From
 * 1024px the list and the editor sit side by side.
 *
 * Saving is automatic and keyed on the note's own client id, so a learner who
 * closes the tab mid-sentence loses nothing and never sees a save button.
 */
export function NotesWorkspace({
  signedIn,
  initialWordId,
  startNew,
}: {
  signedIn: boolean;
  initialWordId?: string | undefined;
  startNew?: boolean | undefined;
}): ReactNode {
  const t = useTranslations('notes');
  const adapter: NotesAdapter = useMemo(
    () => (signedIn ? serverNotes() : guestNotes()),
    [signedIn],
  );

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [activeTag, setActiveTag] = useState('');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input.trim());
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [input]);

  const load = useCallback(async () => {
    try {
      const result = await adapter.list({
        ...(query ? { query } : {}),
        ...(activeTag ? { tag: activeTag } : {}),
      });
      setNotes(result.notes);
      setTags(result.tags);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [activeTag, adapter, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const startDraft = useCallback((wordId: string | null) => {
    setDraft({
      clientId: newClientId(),
      wordId,
      title: '',
      body: '',
      tags: wordId ? ['word'] : [],
      isPinned: false,
    });
    setPreview(false);
  }, []);

  // Arriving from a word page with "add a note" opens straight into an editor
  // attached to that word.
  useEffect(() => {
    if (bootstrapped.current || !startNew) return;
    bootstrapped.current = true;
    startDraft(initialWordId ?? null);
  }, [initialWordId, startDraft, startNew]);

  const persist = useCallback(
    (next: Draft) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void adapter
          .save({
            clientId: next.clientId,
            wordId: next.wordId,
            title: next.title || deriveTitle(next.body, ''),
            body: next.body,
            tags: next.tags,
            isPinned: next.isPinned,
          })
          .then(() => {
            setSaveFailed(false);
            void load();
          })
          .catch(() => {
            setSaveFailed(true);
          });
      }, AUTOSAVE_MS);
    },
    [adapter, load],
  );

  const edit = useCallback(
    (patch: Partial<Draft>) => {
      setDraft((current) => {
        if (!current) return current;
        const next = { ...current, ...patch };
        // An empty note is not worth a row; it is saved once there is content.
        if (next.body.trim() !== '' || next.title.trim() !== '') persist(next);
        return next;
      });
    },
    [persist],
  );

  const remove = useCallback(
    async (clientId: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setDraft(null);
      await adapter.remove(clientId).catch(() => {
        setSaveFailed(true);
      });
      await load();
    },
    [adapter, load],
  );

  const open = useCallback((note: NoteRecord) => {
    setDraft({
      clientId: note.clientId ?? note.id,
      wordId: note.wordId,
      title: note.title,
      body: note.body,
      tags: note.tags,
      isPinned: note.isPinned,
    });
    setPreview(false);
  }, []);

  return (
    <div className="lg:grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-6">
      {/* ---- list pane ---- */}
      <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pe-1">
        <div className="flex gap-2">
          <SearchField
            value={input}
            onChange={setInput}
            placeholder={t('searchPlaceholder')}
            label={t('searchLabel')}
          />
          <Button
            variant="primary"
            onClick={() => {
              startDraft(null);
            }}
            icon={<PlusIcon width={18} height={18} />}
          >
            {t('newNote')}
          </Button>
        </div>

        {tags.length > 0 ? (
          <ul className="scroll-x flex gap-2 pb-1">
            {[{ tag: '', count: 0 }, ...tags].map(({ tag, count }) => (
              <li key={tag || 'all'}>
                <Chip
                  active={activeTag === tag}
                  onClick={() => {
                    setActiveTag(tag);
                  }}
                >
                  {tag === '' ? t('allNotes') : `${tag} ${count}`}
                </Chip>
              </li>
            ))}
          </ul>
        ) : null}

        {status === 'loading' ? (
          <ul className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <li key={index} className="rounded-ui border-hairline bg-chuna space-y-2 border p-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </li>
            ))}
          </ul>
        ) : status === 'error' ? (
          <ErrorState
            title={t('errorTitle')}
            body={t('errorBody')}
            retryLabel={t('retry')}
            onRetry={() => void load()}
          />
        ) : notes.length === 0 ? (
          <EmptyState
            title={query || activeTag ? t('noMatchesTitle') : t('emptyTitle')}
            body={query || activeTag ? t('noMatchesBody') : t('emptyBody')}
            // Its own label, not a second "new note": two controls with the
            // same accessible name on one screen is ambiguous to a screen
            // reader, and this one is an invitation rather than a toolbar item.
            action={{
              label: t('firstNote'),
              onClick: () => {
                startDraft(null);
              },
            }}
          />
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => {
                    open(note);
                  }}
                  className={cn(
                    'rounded-ui w-full border p-3 text-start transition-colors duration-150',
                    draft?.clientId === (note.clientId ?? note.id)
                      ? 'border-nil bg-nil-wash'
                      : 'border-hairline bg-chuna hover:border-nil-soft',
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span dir="auto" className="truncate text-base font-semibold">
                      {note.title || deriveTitle(note.body, t('untitled'))}
                    </span>
                    {note.isPinned ? (
                      <span className="text-2xs text-shingraf shrink-0">{t('pinned')}</span>
                    ) : null}
                  </span>
                  <span dir="auto" className="text-pathor mt-1 line-clamp-2 block text-sm">
                    {note.body.slice(0, 160)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- editor pane ---- */}
      {draft ? (
        <section
          aria-label={t('editorLabel')}
          className={cn(
            // Phone: the editor covers the screen. Desktop: it is the second pane.
            'bg-kagoj fixed inset-0 z-40 flex flex-col gap-3 p-4',
            'lg:static lg:z-auto lg:min-h-0 lg:p-0',
          )}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(null);
              }}
              aria-label={t('closeEditor')}
              className="size-touch rounded-ui text-pathor hover:bg-nil-wash hover:text-nil inline-flex shrink-0 items-center justify-center lg:hidden"
            >
              <CloseIcon width={20} height={20} />
            </button>
            <input
              value={draft.title}
              onChange={(event) => {
                edit({ title: event.target.value });
              }}
              placeholder={t('titlePlaceholder')}
              aria-label={t('titleLabel')}
              dir="auto"
              className="min-h-touch rounded-ui placeholder:text-pathor-soft focus-visible:border-hairline w-full border border-transparent bg-transparent px-2 text-lg font-semibold"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={draft.isPinned}
              onClick={() => {
                edit({ isPinned: !draft.isPinned });
              }}
              className={cn(
                'min-h-touch rounded-ui border px-3 text-sm',
                draft.isPinned
                  ? 'border-shingraf bg-shingraf-wash text-shingraf'
                  : 'border-hairline bg-chuna text-pathor',
              )}
            >
              {draft.isPinned ? t('unpin') : t('pin')}
            </button>
            <button
              type="button"
              aria-pressed={preview}
              onClick={() => {
                setPreview((value) => !value);
              }}
              className="min-h-touch rounded-ui border-hairline bg-chuna text-pathor border px-3 text-sm"
            >
              {preview ? t('write') : t('preview')}
            </button>
            <input
              value={draft.tags.join(', ')}
              onChange={(event) => {
                edit({
                  tags: event.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .slice(0, 20),
                });
              }}
              placeholder={t('tagsPlaceholder')}
              aria-label={t('tagsLabel')}
              className="min-h-touch rounded-ui border-hairline bg-chuna flex-1 border px-3 text-sm"
            />
            <Button variant="rubric" size="sm" onClick={() => void remove(draft.clientId)}>
              {t('delete')}
            </Button>
          </div>

          {saveFailed ? (
            <p role="status" className="border-shingraf bg-shingraf-wash/50 border-s-2 p-2 text-xs">
              {t('saveFailed')}
            </p>
          ) : null}

          {preview ? (
            <div className="rounded-ui border-hairline bg-chuna min-h-0 flex-1 overflow-y-auto border p-4">
              <Markdown source={draft.body} />
            </div>
          ) : (
            <textarea
              value={draft.body}
              onChange={(event) => {
                edit({ body: event.target.value });
              }}
              placeholder={t('bodyPlaceholder')}
              aria-label={t('bodyLabel')}
              // dir="auto" on the field itself: a note that opens in Arabic
              // types right to left, one that opens in Bengali left to right.
              dir="auto"
              spellCheck={false}
              className="rounded-ui border-hairline bg-chuna focus-visible:border-nil min-h-0 flex-1 resize-none border p-4 text-base leading-relaxed"
            />
          )}

          <p className="text-2xs text-pathor-soft">{t('autosaveHint')}</p>
        </section>
      ) : (
        <div className="hidden lg:flex lg:items-center lg:justify-center">
          <p className="measure text-pathor text-center text-base">{t('pickOrCreate')}</p>
        </div>
      )}
    </div>
  );
}
