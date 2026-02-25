'use client';

import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'strong', 'em', 'del',
    'ul', 'ol', 'li',
    'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'blockquote', 'sup',
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: ['className'],
  },
};

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-mp-gray-900 mt-4 mb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-mp-gray-900 mt-3 mb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-mp-gray-800 mt-3 mb-1">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-mp-gray-900 mt-3 mb-1">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-sm font-medium text-mp-gray-800 mt-2 mb-1">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-xs font-medium text-mp-gray-700 mt-2 mb-1">{children}</h6>
  ),
  p: ({ children }) => (
    <p className="mt-1 leading-relaxed">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="list-disc ml-4 mt-1 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ml-4 mt-1 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
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

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

export function SafeMarkdown({ content, className }: SafeMarkdownProps) {
  return (
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
}
