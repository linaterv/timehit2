"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/utils";
import { AuditDetailModal } from "./audit-detail-modal";

interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  title: string;
  text: string;
  data_before: Record<string, unknown> | null;
  data_after: Record<string, unknown> | null;
  created_by: { id: string; full_name: string } | null;
  created_at: string;
}

const DOT_COLORS: Record<string, string> = {
  REJECTED: "bg-red-500",
  APPROVED: "bg-green-500",
  SUBMITTED: "bg-blue-500",
  WITHDRAWN: "bg-amber-500",
  CREATED: "bg-brand-600",
  ISSUED: "bg-green-600",
  PAID: "bg-green-700",
  VOIDED: "bg-red-600",
  CORRECTED: "bg-amber-600",
  ACTIVATED: "bg-green-500",
  COMPLETED: "bg-green-600",
  CANCELLED: "bg-red-500",
  UPDATED: "bg-blue-400",
  DELETED: "bg-red-700",
  DEACTIVATED: "bg-amber-500",
  UPLOADED: "bg-brand-500",
  ARCHIVED: "bg-gray-500",
};

export function AuditTimeline({ entries, loading }: { entries: AuditEntry[]; loading: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading) return <p className="text-sm text-gray-400 text-center py-4">Loading...</p>;
  if (entries.length === 0) return <p className="text-sm text-gray-400 text-center py-4">No history yet.</p>;

  return (
    <>
      <div className="space-y-1">
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setSelectedId(entry.id)}
            className="w-full text-left flex gap-3 text-sm hover:bg-gray-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors cursor-pointer group"
          >
            <div className="flex flex-col items-center">
              <div className={`w-2 h-2 rounded-full mt-1.5 ${DOT_COLORS[entry.action] || "bg-gray-400"}`} />
              <div className="w-px flex-1 bg-gray-200" />
            </div>
            <div className="pb-3 min-w-0 flex-1">
              <p className="font-medium text-gray-900">{entry.title}</p>
              {entry.text && <p className="text-gray-500 truncate">{entry.text}</p>}
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDateTime(entry.created_at)}
                {entry.created_by && ` · ${entry.created_by.full_name}`}
              </p>
            </div>
            <span className="text-gray-300 group-hover:text-gray-500 text-sm mt-1 shrink-0">&rsaquo;</span>
          </button>
        ))}
      </div>
      {selectedId && <AuditDetailModal entryId={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  );
}
