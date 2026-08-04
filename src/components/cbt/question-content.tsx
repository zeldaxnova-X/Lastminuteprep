"use client";

import React from "react";
import { KaTeXRenderer } from "@/components/katex-renderer";
import { sanitizeQuestionText } from "@/lib/clean-text";
import { ZoomIn } from "lucide-react";
import type { QuestionContentBlock } from "@/types/database.types";

interface QuestionContentProps {
  blocks: QuestionContentBlock[];
  /** Called with an image URL when the user wants a full-screen view. */
  onZoom?: (url: string) => void;
  /** Extra classes for text blocks (controls prose size). */
  textClassName?: string;
  /** Max height utility class for images (e.g. "max-h-72"). */
  imageMaxHeight?: string;
  className?: string;
}

/**
 * Renders an ordered list of v2 `QuestionContentBlock`s — prose (with inline/
 * block LaTeX), figures (zoomable), and tables — preserving document order.
 * Used for both question stems and image-based options so rendering stays
 * consistent everywhere.
 */
export const QuestionContent: React.FC<QuestionContentProps> = ({
  blocks,
  onZoom,
  textClassName = "",
  imageMaxHeight = "max-h-80",
  className = "",
}) => {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, i) => {
        if (block.kind === "text" && block.text) {
          return (
            <div key={i} className={textClassName}>
              <KaTeXRenderer content={sanitizeQuestionText(block.text)} />
            </div>
          );
        }

        if (block.kind === "math" && block.latex) {
          return (
            <div key={i} className={textClassName}>
              <KaTeXRenderer content={`$$${block.latex}$$`} />
            </div>
          );
        }

        if (block.kind === "image" && block.url) {
          return (
            <figure key={i} className="group relative inline-block max-w-full">
              <img
                src={block.url}
                alt="Question figure"
                loading="lazy"
                onClick={() => onZoom?.(block.url!)}
                className={`${imageMaxHeight} w-auto max-w-full rounded-xl border border-slate-200 bg-white object-contain dark:border-slate-700 dark:bg-slate-100 ${
                  onZoom ? "cursor-zoom-in" : ""
                }`}
              />
              {onZoom && (
                <button
                  type="button"
                  onClick={() => onZoom(block.url!)}
                  aria-label="View figure full screen"
                  className="absolute right-2 top-2 hidden rounded-lg border border-slate-200 bg-white/90 p-1.5 text-slate-600 shadow-sm backdrop-blur transition hover:bg-white group-hover:flex dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-300"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              )}
            </figure>
          );
        }

        if (block.kind === "table" && block.rows && block.rows.length > 0) {
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td
                          key={c}
                          className="border border-slate-200 px-3 py-1.5 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                        >
                          <KaTeXRenderer content={sanitizeQuestionText(cell)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
