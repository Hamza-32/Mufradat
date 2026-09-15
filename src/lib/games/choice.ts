import { pickDistractors, shuffle } from './distractors';
import type { QueueResponseItem } from '@/lib/review/server';

/**
 * Building a multiple-choice question, once, for the two games that ask them.
 *
 * Extracted when the second game needed it rather than guessed at in advance —
 * but now that both "pick the meaning" and "streak rush" depend on distractors
 * coming from the target's own root, the rule lives in one place and cannot
 * drift between them.
 */

export interface ChoiceQuestion {
  target: QueueResponseItem;
  options: QueueResponseItem[];
}

export function buildChoiceQuestion(
  target: QueueResponseItem,
  pool: readonly QueueResponseItem[],
  optionCount: number,
): ChoiceQuestion {
  const distractorIds = pickDistractors(
    { wordId: target.wordId, rootKey: target.rootKey, tags: target.tags },
    pool.map((word) => ({ wordId: word.wordId, rootKey: word.rootKey, tags: word.tags })),
    optionCount - 1,
  );

  const distractors = distractorIds.flatMap((id) => {
    const word = pool.find((item) => item.wordId === id);
    return word ? [word] : [];
  });

  return { target, options: shuffle([target, ...distractors]) };
}
