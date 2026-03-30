"use client";

import { useState, useRef, useEffect } from "react";
import { Bug, Send, X, Check } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

function capturePageContext(): Record<string, string> {
  const ctx: Record<string, string> = {};

  // Capture all select filters (by data-testid containing "filter")
  document.querySelectorAll<HTMLSelectElement>("select[data-testid*='filter']").forEach((el) => {
    const label = el.dataset.testid || "filter";
    const selected = el.options[el.selectedIndex];
    if (selected && selected.value) {
      ctx[label] = selected.textContent?.trim() || selected.value;
    }
  });

  // Capture search inputs
  document.querySelectorAll<HTMLInputElement>("input[data-testid*='search']").forEach((el) => {
    if (el.value.trim()) {
      ctx[el.dataset.testid || "search"] = el.value.trim();
    }
  });

  // Capture page heading (first h1 or h2 in main)
  const heading = document.querySelector("main h1, main h2");
  if (heading?.textContent?.trim()) {
    ctx["page_heading"] = heading.textContent.trim();
  }

  // Capture detail page info: all status badges
  const badges = document.querySelectorAll("[data-testid^='status-']");
  if (badges.length) {
    ctx["status"] = Array.from(badges).map((b) => b.textContent?.trim()).filter(Boolean).join(", ");
  }

  // Capture detail header card text (first card-like block in detail pages)
  const detail = document.querySelector("[data-testid$='-detail']");
  if (detail) {
    // Grab key-value pairs from the header: look for dt/dd, label/value, or simple text spans
    const texts: string[] = [];
    detail.querySelectorAll("h1, h2, h3, [class*='font-semibold'], [class*='font-bold']").forEach((el) => {
      const t = el.textContent?.trim();
      if (t && t.length < 100) texts.push(t);
    });
    if (texts.length) {
      ctx["detail_header"] = texts.slice(0, 5).join(" | ");
    }
  }

  // Capture month selector if present
  const monthSel = document.querySelector("[data-testid='month-selector']");
  if (monthSel?.textContent?.trim()) {
    ctx["month"] = monthSel.textContent.trim();
  }

  return ctx;
}

export function BugReporter() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [context, setContext] = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setContext(capturePageContext());
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => {
        setDone(false);
        setOpen(false);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [done]);

  const handleSubmit = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/v1/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          url: pathname,
          user_email: user?.email ?? "unknown",
          user_role: user?.role ?? "unknown",
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          context,
        }),
      });
      setMessage("");
      setDone(true);
    } catch {
      // silently fail
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
            <span className="text-xs font-medium text-gray-600">
              Bug Report — {pathname}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>
          {done ? (
            <div className="flex items-center justify-center gap-2 py-6 text-green-600">
              <Check size={18} />
              <span className="text-sm font-medium">Saved</span>
            </div>
          ) : (
            <div className="p-3">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the bug..."
                rows={3}
                className="w-full border rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
              {Object.keys(context).length > 0 && (
                <div className="mt-1.5 px-2 py-1.5 bg-gray-50 rounded text-[10px] text-gray-500 max-h-20 overflow-y-auto space-y-0.5">
                  {Object.entries(context).map(([k, v]) => (
                    <div key={k}><span className="font-medium">{k.replace(/_/g, " ")}:</span> {v}</div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gray-400">
                  {user?.email} | Ctrl+Enter to send
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || sending}
                  className="flex items-center gap-1 px-3 py-1 bg-brand-600 text-white rounded text-xs hover:bg-brand-700 disabled:opacity-50"
                >
                  <Send size={12} />
                  {sending ? "..." : "Send"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => { setOpen(!open); setDone(false); }}
        className="ml-auto flex items-center justify-center w-10 h-10 rounded-full bg-gray-800 text-white shadow-lg hover:bg-gray-700 transition-colors"
        title="Report a bug"
      >
        <Bug size={18} />
      </button>
    </div>
  );
}
