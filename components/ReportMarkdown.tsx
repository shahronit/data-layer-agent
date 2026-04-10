"use client";

import ReactMarkdown from "react-markdown";

export function ReportMarkdown({ content }: { content: string }) {
  return (
    <div className="markdown-body text-sm leading-relaxed text-white/80">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="mt-6 mb-2 font-display text-lg font-semibold text-white first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-1.5 font-medium text-cyan-200/90">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-3 text-white/60 [&:last-child]:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="text-white/75">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-xs text-cyan-200/90">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
