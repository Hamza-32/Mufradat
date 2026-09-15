/**
 * Markdown for the notes editor.
 *
 * This parser returns a block tree, not an HTML string, and the renderer turns
 * that tree into React elements. There is no `dangerouslySetInnerHTML` anywhere
 * in the app, so a note containing `<script>` is text — cross-site scripting is
 * structurally impossible rather than defended against with a sanitiser that
 * has to stay ahead of the attacks.
 *
 * The subset is small on purpose: headings, emphasis, code, lists, quotes,
 * links and rules. A learner writing "کتاب = বই, root ك ت ب" does not need
 * tables and footnotes, and every feature added here is one more thing that has
 * to lay out correctly in three scripts.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; href: string };

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; content: Inline[] }
  | { type: 'paragraph'; content: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; content: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'rule' };

/** Only schemes that cannot execute. `javascript:` never becomes a link. */
const SAFE_SCHEME = /^(https?:\/\/|mailto:)/iu;

const INLINE_PATTERN =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)\s]+\))/gu;

export function parseInline(input: string): Inline[] {
  const out: Inline[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(INLINE_PATTERN)) {
    const index = match.index;
    if (index > lastIndex) out.push({ type: 'text', value: input.slice(lastIndex, index) });
    const token = match[0];

    if (token.startsWith('`')) {
      out.push({ type: 'code', value: token.slice(1, -1) });
    } else if (token.startsWith('**') || token.startsWith('__')) {
      out.push({ type: 'strong', value: token.slice(2, -2) });
    } else if (token.startsWith('[')) {
      const split = token.indexOf('](');
      const text = token.slice(1, split);
      const href = token.slice(split + 2, -1);
      // An unsafe or relative target is kept as plain text rather than
      // silently dropped, so the learner can see what they wrote.
      out.push(
        SAFE_SCHEME.test(href)
          ? { type: 'link', value: text, href }
          : { type: 'text', value: token },
      );
    } else {
      out.push({ type: 'em', value: token.slice(1, -1) });
    }
    lastIndex = index + token.length;
  }

  if (lastIndex < input.length) out.push({ type: 'text', value: input.slice(lastIndex) });
  return out.length > 0 ? out : [{ type: 'text', value: '' }];
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    blocks.push({ type: 'paragraph', content: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;

    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    if (line.startsWith('```')) {
      flushParagraph();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        body.push(lines[i]!);
        i += 1;
      }
      blocks.push({ type: 'code', value: body.join('\n') });
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/u.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        level: heading[1]!.length as 1 | 2 | 3,
        content: parseInline(heading[2]!),
      });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/u.test(line.trim())) {
      flushParagraph();
      blocks.push({ type: 'rule' });
      continue;
    }

    if (line.startsWith('> ')) {
      flushParagraph();
      blocks.push({ type: 'quote', content: parseInline(line.slice(2)) });
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/u.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/u.exec(line);
    if (bullet ?? numbered) {
      flushParagraph();
      const ordered = numbered !== null && bullet === null;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const current = lines[i]!;
        const match = ordered
          ? /^\s*\d+[.)]\s+(.*)$/u.exec(current)
          : /^\s*[-*]\s+(.*)$/u.exec(current);
        if (!match) break;
        items.push(parseInline(match[1]!));
        i += 1;
      }
      i -= 1;
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
}

/** First non-empty line, stripped of markup — used when a note has no title. */
export function deriveTitle(body: string, fallback: string): string {
  const line = body
    .split('\n')
    .map((value) => value.replace(/^[#>\s*\-+]+/u, '').trim())
    .find((value) => value.length > 0);
  if (!line) return fallback;
  const plain = parseInline(line)
    .map((token) => token.value)
    .join('');
  return plain.length > 70 ? `${plain.slice(0, 70)}…` : plain;
}
