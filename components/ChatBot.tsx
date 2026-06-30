"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
};

const SUGGESTIONS = [
  "What's the cost of the next ashwagandha bulk order?",
  "How much ashwagandha is planned in the system?",
  "When is magnesium bulk arriving?",
  "Which SKUs are critically low on stock?",
  "What open purchase orders do we have?",
  "What's planned for packing this week?",
];

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;

    setInput("");
    const userMsg: Message = { role: "user", content: q };
    const assistantPlaceholder: Message = { role: "assistant", content: "", loading: true };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setLoading(true);

    const history = [...messages, userMsg];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: `Error: ${err.error ?? res.statusText}` },
        ]);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: accumulated, loading: false },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Network error — please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-copper text-white shadow-xl flex items-center justify-center hover:bg-[#c9612e] transition-all hover:scale-105 active:scale-95"
        title="Ask about your data"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 4L16 16M16 4L4 16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[420px] max-h-[600px] flex flex-col bg-white rounded-2xl shadow-2xl border border-[#e4ddd4] overflow-hidden">
          {/* Header */}
          <div className="bg-cream border-b border-[#e4ddd4] px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-copper flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="font-medium text-charcoal text-sm">Wild Dash Assistant</p>
              <p className="text-xs text-text-muted">Live data · Ask anything</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.length === 0 ? (
              <div>
                <p className="text-text-muted text-sm text-center mb-4 mt-2">
                  Ask me anything about your inventory, production, costs, or planning data.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-xs text-charcoal px-3 py-2.5 rounded-xl bg-cream hover:bg-[#ede6db] transition-colors border border-[#e4ddd4]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-copper text-white rounded-br-sm"
                        : "bg-cream text-charcoal rounded-bl-sm border border-[#e4ddd4]"
                    }`}
                  >
                    {m.loading ? (
                      <span className="inline-flex gap-1 items-center py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : (
                      <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[#e4ddd4] px-3 py-3 bg-white">
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                placeholder="Ask about costs, stock, dates…"
                disabled={loading}
                className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-[#e4ddd4] bg-cream placeholder-text-muted focus:outline-none focus:border-copper transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-xl bg-copper text-white flex items-center justify-center hover:bg-[#c9612e] transition-colors disabled:opacity-40 flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
