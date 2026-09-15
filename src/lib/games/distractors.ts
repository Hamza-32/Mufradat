export interface DistractorCandidate {
  wordId: string;
  rootKey: string | null;
  tags: readonly string[];
}

/**
 * Choosing the wrong answers is most of the work in a multiple-choice question.
 *
 * Random distractors teach nothing: "book / market / sky / mercy" is answerable
 * from vibes. Distractors that share the target's root or its semantic tag force
 * the learner to actually distinguish — كَتَبَ against كِتَاب and مَكْتَب, or
 * bread against milk and dates.
 *
 * Order of preference: same root, then same tag, then anything, so a question
 * is always filled even in a thin deck.
 */
export function pickDistractors(
  target: DistractorCandidate,
  pool: readonly DistractorCandidate[],
  count: number,
  random: () => number = Math.random,
): string[] {
  const others = pool.filter((item) => item.wordId !== target.wordId);
  const taken = new Set<string>();
  const chosen: string[] = [];

  const take = (candidates: readonly DistractorCandidate[]): void => {
    for (const item of shuffle(candidates, random)) {
      if (chosen.length >= count) return;
      if (taken.has(item.wordId)) continue;
      taken.add(item.wordId);
      chosen.push(item.wordId);
    }
  };

  if (target.rootKey) {
    take(others.filter((item) => item.rootKey !== null && item.rootKey === target.rootKey));
  }
  if (chosen.length < count && target.tags.length > 0) {
    const tags = new Set(target.tags);
    take(others.filter((item) => item.tags.some((tag) => tags.has(tag))));
  }
  if (chosen.length < count) {
    take(others);
  }

  return chosen;
}

/** Fisher–Yates, with the source of randomness injected so tests are stable. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
