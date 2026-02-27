'use client';

import { type ReactNode, createContext, useContext, Children, isValidElement, cloneElement } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { SourceTooltip } from '@/components/learning/SourceTooltip';

// --- Source context for passing sources/onSeek deep into markdown components ---

interface SourceContextValue {
  sources: SourceData[];
  onSourceSeek: (seconds: number) => void;
  disableSourceLinks: boolean;
}

interface SourceData {
  id: string;
  content: string;
  timecodeFormatted: string;
  timecode_start: number;
  timecode_end: number;
}

const SourceContext = createContext<SourceContextValue | null>(null);

// --- Text processing: replace [N] patterns with SourceTooltip ---

const SOURCE_REF_REGEX = /\[(\d+)\]/g;

function processTextWithSources(
  text: string,
  ctx: SourceContextValue,
): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  SOURCE_REF_REGEX.lastIndex = 0;

  while ((match = SOURCE_REF_REGEX.exec(text)) !== null) {
    const beforeText = text.slice(lastIndex, match.index);
    if (beforeText) parts.push(beforeText);

    const refNum = parseInt(match[1], 10);
    const source = ctx.sources[refNum - 1];

    if (source) {
      parts.push(
        <SourceTooltip
          key={`src-${match.index}-${refNum}`}
          index={refNum}
          source={source}
          onSeek={ctx.onSourceSeek}
          disabled={ctx.disableSourceLinks}
        />
      );
    } else {
      // No matching source — render as plain text
      parts.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) parts.push(remaining);

  return parts;
}

/**
 * Recursively walk React children and replace string nodes containing [N]
 * with SourceTooltip components when source context is available.
 */
function processChildren(children: ReactNode, ctx: SourceContextValue | null): ReactNode {
  if (!ctx) return children;

  return Children.map(children, (child) => {
    if (typeof child === 'string') {
      if (SOURCE_REF_REGEX.test(child)) {
        return <>{processTextWithSources(child, ctx)}</>;
      }
      return child;
    }

    if (isValidElement(child) && child.props.children) {
      return cloneElement(child, {
        ...child.props,
        children: processChildren(child.props.children, ctx),
      });
    }

    return child;
  });
}

// --- Wrapper that applies source processing to markdown element children ---

function SourceAwareWrapper({ children }: { children: ReactNode }) {
  const ctx = useContext(SourceContext);
  return <>{processChildren(children, ctx)}</>;
}

// --- Sanitize schema ---

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'strong', 'em', 'del',
    'ul', 'ol', 'li',
    'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'blockquote', 'sup', 'a',
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: ['className'],
    a: ['href', 'title'],
  },
};

// --- Markdown components ---

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-mp-gray-900 mt-4 mb-2">
      <SourceAwareWrapper>{children}</SourceAwareWrapper>
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-mp-gray-900 mt-3 mb-1">
      <SourceAwareWrapper>{children}</SourceAwareWrapper>
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-mp-gray-800 mt-3 mb-1">
      <SourceAwareWrapper>{children}</SourceAwareWrapper>
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-mp-gray-900 mt-3 mb-1">
      <SourceAwareWrapper>{children}</SourceAwareWrapper>
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-sm font-medium text-mp-gray-800 mt-2 mb-1">
      <SourceAwareWrapper>{children}</SourceAwareWrapper>
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-xs font-medium text-mp-gray-700 mt-2 mb-1">
      <SourceAwareWrapper>{children}</SourceAwareWrapper>
    </h6>
  ),
  p: ({ children }) => (
    <p className="mt-1 leading-relaxed">
      <SourceAwareWrapper>{children}</SourceAwareWrapper>
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">
      <SourceAwareWrapper>{children}</SourceAwareWrapper>
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic">
      <SourceAwareWrapper>{children}</SourceAwareWrapper>
    </em>
  ),
  ul: ({ children }) => (
    <ul className="list-disc ml-4 mt-1 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ml-4 mt-1 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">
      <SourceAwareWrapper>{children}</SourceAwareWrapper>
    </li>
  ),
  code: ({ children, className }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-mp-gray-100 text-mp-gray-800 rounded px-1 py-0.5 text-[0.85em] font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className={className}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-mp-gray-100 rounded-lg p-3 overflow-x-auto text-sm font-mono mt-2">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-mp-blue-300 pl-4 italic text-mp-gray-600 mt-2">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mt-2">
      <table className="min-w-full border border-mp-gray-200 text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-mp-gray-50">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-mp-gray-200 px-3 py-1.5 text-left font-medium text-mp-gray-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-mp-gray-200 px-3 py-1.5 text-mp-gray-700">
      {children}
    </td>
  ),
  sup: ({ children }) => (
    <sup className="text-mp-blue-600">{children}</sup>
  ),
};

// --- SafeMarkdown component ---

interface SafeMarkdownProps {
  content: string;
  className?: string;
  sources?: SourceData[];
  onSourceSeek?: (seconds: number) => void;
  disableSourceLinks?: boolean;
}

export function SafeMarkdown({
  content,
  className,
  sources,
  onSourceSeek,
  disableSourceLinks = false,
}: SafeMarkdownProps) {
  const sourceCtx: SourceContextValue | null = sources && onSourceSeek
    ? { sources, onSourceSeek, disableSourceLinks }
    : null;

  const markdown = (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        allowedElements={sanitizeSchema.tagNames}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );

  if (sourceCtx) {
    return (
      <SourceContext.Provider value={sourceCtx}>
        {markdown}
      </SourceContext.Provider>
    );
  }

  return markdown;
}
