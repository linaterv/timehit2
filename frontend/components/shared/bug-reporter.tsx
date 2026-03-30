"use client";

import { useState, useRef, useEffect } from "react";
import { Bug, Send, X, Check } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export function BugReporter() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
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
