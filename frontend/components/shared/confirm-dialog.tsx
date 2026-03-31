"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = "Confirm", destructive }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onCancel} />
      <div data-testid="confirm-dialog" className="relative bg-surface rounded-lg shadow-lg max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        <div className="flex gap-2 justify-end">
          <button data-testid="confirm-no" onClick={onCancel} className="px-4 py-2 border rounded text-sm">Cancel</button>
          <button
            data-testid="confirm-yes"
            onClick={onConfirm}
            className={`px-4 py-2 rounded text-sm text-white ${destructive ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
