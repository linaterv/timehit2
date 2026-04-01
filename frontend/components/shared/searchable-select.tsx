"use client";

import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  testId?: string;
  compact?: boolean;
}

export function SearchableSelect({ options, value, onChange, placeholder = "Select...", testId, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  return (
    <div ref={containerRef} className="relative" data-testid={testId}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); }}
        className={`w-full border rounded-md text-left focus:outline-none focus:ring-2 focus:ring-brand-600 flex items-center justify-between ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}
      >
        <span className={`truncate ${selected && selected.value ? "text-gray-900" : "text-gray-400"}`}>
          {selected && selected.value ? selected.label : placeholder}
        </span>
        <svg className={`text-gray-400 shrink-0 ${compact ? "w-3 h-3" : "w-4 h-4"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className={`absolute z-50 mt-1 bg-white border rounded-md shadow-lg max-h-60 flex flex-col ${compact ? "w-52" : "w-full"}`}>
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setOpen(false); setSearch(""); }
                if (e.key === "Enter" && filtered.length === 1) {
                  onChange(filtered[0].value);
                  setOpen(false);
                  setSearch("");
                }
              }}
              placeholder="Type to search..."
              className={`w-full px-2 border rounded focus:outline-none focus:ring-1 focus:ring-brand-600 ${compact ? "py-1 text-xs" : "py-1.5 text-sm"}`}
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 && (
              <div className={`px-3 py-2 text-gray-400 ${compact ? "text-xs" : "text-sm"}`}>No results</div>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                className={`w-full text-left hover:bg-brand-50 ${compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"} ${o.value === value ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-700"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
