"use client";

import React from "react";
import { KaTeXRenderer } from "@/components/katex-renderer";
import { sanitizeQuestionText } from "@/lib/clean-text";
import type { QuestionContentBlock } from "@/types/database.types";

interface QuestionContentProps {
  blocks: QuestionContentBlock[];
  /** Called with an image URL when the user wants a full-screen view. */
  onZoom?: (url: string) => void;
  /** Extra classes for text blocks (controls prose size). */
  textClassName?: string;
  /** Max height utility class for images (e.g. "max-h-72"). */
  imageMaxHeight?: string;
  /** Show a "Tap image to enlarge" hint under zoomable figures (stem only). */
  showZoomHint?: boolean;
  className?: string;
}

/**
 * Renders an ordered list of v2 `QuestionContentBlock`s, prose (with inline/
 * block LaTeX), figures (zoomable), and tables, preserving document order.
 * Used for both question stems and image-based options so rendering stays
 * consistent everywhere.
 */
export const QuestionContent: React.FC<QuestionContentProps> = ({
  blocks,
  onZoom,
  textClassName = "",
  imageMaxHeight = "max-h-80",
  showZoomHint = false,
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
          // Click the figure itself to zoom, no overlay controls, so nothing
          // can be mistaken for a correctness indicator during an exam.
          // Sizing: never distort (object-contain + h-auto/w-auto), never overflow
          // the column (max-w-full), and stay legible on a phone (a generous
          // height cap that scales with the viewport). Centered so narrow figures
          // don't hug the edge.
          return (
            <figure key={i} className="flex max-w-full flex-col items-center">
              <img
                src={block.url}
                alt="Question figure"
                loading="lazy"
                onClick={onZoom ? () => onZoom(block.url!) : undefined}
                className={`${imageMaxHeight} h-auto w-auto max-w-full rounded-xl border border-slate-200 bg-white object-contain dark:border-slate-700 dark:bg-slate-100 ${
                  onZoom ? "cursor-zoom-in" : ""
                }`}
              />
              {onZoom && showZoomHint && (
                <figcaption className="mt-1.5 select-none text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  Tap image to enlarge
                </figcaption>
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
