import { describe, expect, it } from 'vitest';
import { deriveTitle, parseInline, parseMarkdown } from './markdown';

describe('parseInline', () => {
  it('reads bold, italic and code', () => {
    expect(parseInline('a **b** c *d* e `f`')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'strong', value: 'b' },
      { type: 'text', value: ' c ' },
      { type: 'em', value: 'd' },
      { type: 'text', value: ' e ' },
      { type: 'code', value: 'f' },
    ]);
  });

  it('keeps Arabic and Bengali intact inside emphasis', () => {
    expect(parseInline('**كِتَاب** মানে বই')).toEqual([
      { type: 'strong', value: 'كِتَاب' },
      { type: 'text', value: ' মানে বই' },
    ]);
  });

  it('makes links only from schemes that cannot execute', () => {
    expect(parseInline('[x](https://example.com)')).toEqual([
      { type: 'link', value: 'x', href: 'https://example.com' },
    ]);
  });

  it('leaves a javascript: link as literal text', () => {
    const result = parseInline('[click](javascript:alert(1))');
    expect(result[0]!.type).toBe('text');
    expect(result.some((token) => token.type === 'link')).toBe(false);
  });

  it('treats raw HTML as text, because the renderer never injects markup', () => {
    const result = parseInline('<script>alert(1)</script>');
    expect(result).toEqual([{ type: 'text', value: '<script>alert(1)</script>' }]);
  });
});

describe('parseMarkdown', () => {
  it('reads headings by level', () => {
    const blocks = parseMarkdown('# One\n## Two\n### Three');
    expect(blocks.map((block) => (block.type === 'heading' ? block.level : null))).toEqual([
      1, 2, 3,
    ]);
  });

  it('joins wrapped lines into one paragraph and splits on a blank line', () => {
    const blocks = parseMarkdown('first line\nsame para\n\nsecond para');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'paragraph' });
  });

  it('reads bulleted and numbered lists', () => {
    const bullets = parseMarkdown('- a\n- b');
    expect(bullets[0]).toMatchObject({ type: 'list', ordered: false });
    expect((bullets[0] as { items: unknown[] }).items).toHaveLength(2);

    const numbered = parseMarkdown('1. a\n2. b');
    expect(numbered[0]).toMatchObject({ type: 'list', ordered: true });
  });

  it('keeps a fenced code block verbatim, markup and all', () => {
    const blocks = parseMarkdown('```\n**not bold**\n```');
    expect(blocks[0]).toEqual({ type: 'code', value: '**not bold**' });
  });

  it('reads quotes and horizontal rules', () => {
    const blocks = parseMarkdown('> quoted\n\n---');
    expect(blocks[0]).toMatchObject({ type: 'quote' });
    expect(blocks[1]).toEqual({ type: 'rule' });
  });

  it('handles a note that mixes all three scripts', () => {
    const blocks = parseMarkdown('## كِتَاب\n\nমানে **বই**. Root: `ك ت ب`');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 2 });
  });

  it('returns nothing for an empty note', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('   \n\n  ')).toEqual([]);
  });
});

describe('deriveTitle', () => {
  it('uses the first real line, without its markup', () => {
    expect(deriveTitle('# কিতাব মানে বই\n\nmore', 'Untitled')).toBe('কিতাব মানে বই');
  });

  it('falls back when the note is empty', () => {
    expect(deriveTitle('\n\n', 'শিরোনামহীন')).toBe('শিরোনামহীন');
  });

  it('truncates a very long first line', () => {
    expect(deriveTitle('x'.repeat(200), 'Untitled')).toHaveLength(71);
  });
});
