"use client";

import { useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  entityType: string;
  entityId: string;
  isLocked: boolean;
  invalidateKeys: string[][];
  label?: string;
}

export function LockBadge({ entityType, entityId, isLocked, invalidateKeys, label }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const handleToggle = async () => {
    if (isLocked) {
      // Unlocking — need reason
      setDialogOpen(true);
      setReason("");
      setError("");
      return;
    }
    // Locking — no reason needed
    setLoading(true);
    try {
      await api("/lock", {
        method: "POST",
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, action: "lock" }),
      });
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleUnlock = async () => {
    if (!reason.trim()) { setError("Reason is required"); return; }
    setLoading(true);
    try {
      await api("/lock", {
        method: "POST",
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, action: "unlock", reason }),
      });
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      setDialogOpen(false);
    } catch { setError("Failed to unlock"); }
    finally { setLoading(false); }
  };

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={loading}
        title={isLocked ? "Locked — click to unlock" : "Unlocked — click to lock"}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          isLocked
            ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
            : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
        }`}
      >
        {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
        {isLocked ? "Locked" : "Unlocked"}
      </button>

      {dialogOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setDialogOpen(false)} />
          <div className="relative w-full max-w-md bg-surface rounded-xl shadow-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">Unlock {label || entityType}</h3>
            <p className="text-sm text-gray-500">Provide a reason for unlocking. This will be logged in the audit trail.</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why does this need to be unlocked?"
              rows={3}
              className="w-full px-3 py-2 border rounded text-sm"
              autoFocus
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDialogOpen(false)}
                className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleUnlock} disabled={loading}
                className="px-4 py-2 bg-brand-600 text-white rounded text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                {loading ? "Unlocking..." : "Unlock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
