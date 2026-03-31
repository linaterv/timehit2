"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSave?: () => void;
  saving?: boolean;
  testId?: string;
}

export function SlideOver({ open, onClose, title, children, onSave, saving, testId }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div data-testid={testId} className="relative w-full max-w-lg bg-surface rounded-xl shadow-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {onSave && (
          <div className="flex gap-2 p-5 border-t">
            <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-md text-sm hover:bg-gray-50">Cancel</button>
            <button
              data-testid={testId ? `${testId}-save` : "save"}
              onClick={onSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
