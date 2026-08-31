import React from "react";

/**
 * Minimal, safe Markdown renderer for the AI-Mentor narrative, no dependency.
 * Handles the subset the coach prompt emits: ## / ### headings, - / * bullet
 * lists, **bold**, and paragraphs. Renders text nodes only (no raw HTML), so
 * model output can't inject markup.
 */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  // Split on **bold** spans.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={`${keyBase}-b${i}`} className="font-semibold text-ink">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyBase}-t${i}`}>{p}</React.Fragment>;
  });
}

export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length === 0) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={`ul-${key++}`} className="my-2 space-y-1.5 pl-1">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-secondary">
            <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-accent" />
            <span>{renderInline(it, `li-${key}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      flushList();
      blocks.push(
        <h3 key={`h3-${key++}`} className="mt-5 mb-1.5 text-sm font-semibold uppercase tracking-wide text-accent first:mt-0">
          {line.replace(/^###\s+/, "")}
        </h3>
      );
    } else if (/^##\s+/.test(line)) {
      flushList();
      blocks.push(
        <h2 key={`h2-${key++}`} className="mt-6 mb-2 text-lg font-semibold text-ink first:mt-0">
          {line.replace(/^##\s+/, "")}
        </h2>
      );
    } else if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      blocks.push(
        <p key={`p-${key++}`} className="my-2 text-sm leading-relaxed text-ink-secondary">
          {renderInline(line, `p-${key}`)}
        </p>
      );
    }
  }
  flushList();

  return <div className="font-report-body">{blocks}</div>;
}
