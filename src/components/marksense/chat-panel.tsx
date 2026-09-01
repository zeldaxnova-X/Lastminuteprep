"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarksenseWordmark } from "./wordmark";
import { Markdown } from "@/components/ui/markdown";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Build me a study plan for the next 4 weeks",
  "How do I stop losing marks to guessing?",
  "Give me a routine to fix Data Interpretation",
  "What should I do to cross 140?",
];

/**
 * The MarksenseAI study coach chat. Grounded server-side in the user's profile;
 * strictly scoped to exam prep. Non-streaming, keeps its own message history and
 * sends it each turn.
 */
export function ChatPanel({ persona }: { persona: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, sending]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    setError(null);
    const next = [...msgs, { role: "user" as const, content }];
    setMsgs(next);
    setInput("");
    setSending(true);
    try {
      const r = await fetch("/api/marksense/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const d = await r.json();
      if (d.reply) {
        setMsgs((m) => [...m, { role: "assistant", content: d.reply }]);
      } else {
        setError(
          d.degraded === "no_api_key"
            ? "The coach is not configured yet."
            : "The coach could not reply just now. Try again."
        );
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gold-bright/25 bg-surface shadow-soft">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-hairline bg-gradient-to-r from-gold-soft/40 to-surface px-5 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-bright/15 text-gold ring-1 ring-gold-bright/30">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-bold text-ink">
            <MarksenseWordmark /> study coach
          </p>
          <p className="text-[11px] text-ink-tertiary">Doubts, study plans, and scoring strategy, tuned to your profile.</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-[420px] min-h-[180px] space-y-3 overflow-y-auto px-5 py-4">
        {msgs.length === 0 && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-ink-secondary">
              Ask me anything about your prep{persona ? `, ${persona}` : ""}. I know your last mocks. Try one of these:
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={sending}
                  className="rounded-full border border-hairline bg-bg px-3 py-1.5 text-left text-xs font-medium text-ink-secondary transition-premium hover:border-gold-bright/40 hover:text-ink disabled:opacity-60"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user"
                  ? "whitespace-pre-wrap bg-accent text-white"
                  : "border border-hairline bg-bg text-ink [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
              )}
            >
              {m.role === "user" ? m.content : <Markdown content={m.content} />}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-hairline bg-bg px-3.5 py-2.5 text-sm text-ink-tertiary">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" /> Thinking…
            </div>
          </div>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      {/* Input */}
      <div className="border-t border-hairline p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask about your prep…"
            className="max-h-28 min-h-[42px] flex-1 resize-none rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none transition-premium placeholder:text-ink-tertiary focus:border-gold-bright/50"
          />
          <button
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-lg bg-gold-bright text-white transition-premium hover:bg-gold disabled:opacity-50"
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-ink-tertiary">Study topics only. Not a substitute for your own revision.</p>
      </div>
    </section>
  );
}
