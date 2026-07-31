"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface KaTeXRendererProps {
  content: string;
  className?: string;
}

/**
  Parses a text containing inline ($...$) and block ($$...$$) LaTeX expressions
  and renders them safely using KaTeX.
 */
export const KaTeXRenderer: React.FC<KaTeXRendererProps> = ({ content, className = "" }) => {
  const renderedElements = useMemo(() => {
    if (!content) return null;

    // Regex to capture block $$...$$ first, then inline $...$
    const regex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g;
    const parts = content.split(regex);

    return parts.map((part, index) => {
      if (part.startsWith("$$") && part.endsWith("$$")) {
        const latex = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(latex, {
            displayMode: true,
            throwOnError: false,
          });
          return (
            <span
              key={index}
              className="my-2 block text-center overflow-x-auto py-1"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (e) {
          console.error("KaTeX block render error:", e);
          return <code key={index} className="text-red-500 font-mono">{part}</code>;
        }
      } else if (part.startsWith("$") && part.endsWith("$")) {
        const latex = part.slice(1, -1).trim();
        try {
          const html = katex.renderToString(latex, {
            displayMode: false,
            throwOnError: false,
          });
          return (
            <span
              key={index}
              className="inline-block px-0.5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (e) {
          console.error("KaTeX inline render error:", e);
          return <code key={index} className="text-red-500 font-mono">{part}</code>;
        }
      } else {
        return <span key={index}>{part}</span>;
      }
    });
  }, [content]);

  return <div className={`katex-wrapper leading-relaxed ${className}`}>{renderedElements}</div>;
};
