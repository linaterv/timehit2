"use client";

import { formatDateTime } from "@/lib/utils";

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
  if (loading) return <p className="text-sm text-gray-400 text-center py-4">Loading...</p>;
  if (entries.length === 0) return <p className="text-sm text-gray-400 text-center py-4">No history yet.</p>;

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-3 text-sm">
          <div className="flex flex-col items-center">
            <div className={`w-2 h-2 rounded-full mt-1.5 ${DOT_COLORS[entry.action] || "bg-gray-400"}`} />
            <div className="w-px flex-1 bg-gray-200" />
          </div>
          <div className="pb-4 min-w-0">
            <p className="font-medium text-gray-900">{entry.title}</p>
            {entry.text && <p className="text-gray-500">{entry.text}</p>}
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDateTime(entry.created_at)}
              {entry.created_by && ` · ${entry.created_by.full_name}`}
            </p>
            {(entry.data_before || entry.data_after) && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "Before", data: entry.data_before, bg: "bg-red-50 text-red-800 border-red-200" },
                  { label: "After", data: entry.data_after, bg: "bg-green-50 text-green-800 border-green-200" },
                ].map(({ label, data, bg }) => data && (
                  <div key={label} className={`${bg} border rounded p-2 overflow-hidden`}>
                    <p className="font-semibold mb-1">{label}</p>
                    {Object.entries(data).filter(([k]) => k !== "entries").map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-gray-500 truncate">{k}</span>
                        <span className="font-mono truncate">{v == null ? "—" : String(v)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
