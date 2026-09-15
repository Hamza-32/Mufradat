import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { GlossText } from '@/components/text/GlossText';
import { parseMarkdown, type Block, type Inline } from '@/lib/notes/markdown';

/**
 * Renders the block tree as React elements. Nothing here builds an HTML string,
 * so a note cannot inject markup no matter what the learner types.
 *
 * Every block carries `dir="auto"`, which is what lets one note hold an Arabic
 * line, a Bengali line and an English line, each laying out the right way round
 * without the writer marking anything up.
 */
function renderInline(content: Inline[]): ReactNode[] {
  return content.map((token, index) => {
    switch (token.type) {
      case 'strong':
        return <strong key={index}>{token.value}</strong>;
      case 'em':
        return <em key={index}>{token.value}</em>;
      case 'code':
        return (
          <code key={index} className="rounded-data bg-kagoj font-latin px-1 text-[0.9em]">
            {token.value}
          </code>
        );
      case 'link':
        return (
          <a
            key={index}
            href={token.href}
            rel="noopener noreferrer nofollow"
            target="_blank"
            className="text-nil underline underline-offset-2"
          >
            {token.value}
          </a>
        );
      default:
        return <span key={index}>{token.value}</span>;
    }
  });
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = (['h2', 'h3', 'h4'] as const)[block.level - 1] ?? 'h4';
      const size = ['text-xl', 'text-lg', 'text-base'][block.level - 1] ?? 'text-base';
      return (
        <Tag key={index} dir="auto" className={cn(size, 'mt-4 font-semibold first:mt-0')}>
          {renderInline(block.content)}
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p key={index} dir="auto" className="measure">
          {renderInline(block.content)}
        </p>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag
          key={index}
          dir="auto"
          className={cn('measure ps-5', block.ordered ? 'list-decimal' : 'list-disc')}
        >
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex} dir="auto">
              {renderInline(item)}
            </li>
          ))}
        </Tag>
      );
    }
    case 'quote':
      return (
        <blockquote
          key={index}
          dir="auto"
          className="measure border-hairline text-pathor border-s-2 ps-3"
        >
          {renderInline(block.content)}
        </blockquote>
      );
    case 'code':
      return (
        <pre
          key={index}
          dir="ltr"
          className="rounded-ui border-hairline bg-kagoj font-latin overflow-x-auto border p-3 text-sm"
        >
          <code>{block.value}</code>
        </pre>
      );
    default:
      return <hr key={index} className="border-hairline" />;
  }
}

export function Markdown({ source, className }: { source: string; className?: string }): ReactNode {
  const blocks = parseMarkdown(source);
  return (
    <GlossText as="div" script="auto" className={cn('space-y-3 text-base', className)}>
      {blocks.map(renderBlock)}
    </GlossText>
  );
}
