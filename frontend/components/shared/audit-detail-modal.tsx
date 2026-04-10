"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EntityLink as EL } from "@/components/shared/entity-link";
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
  related?: { type: string; id: string; name: string }[];
}

const ENTITY_ROUTES: Record<string, string> = {
  client: "/clients",
  contractor: "/contractors",
  placement: "/placements",
  timesheet: "/timesheets",
  invoice: "/invoices",
};

export function AuditDetailModal({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const [entry, setEntry] = useState<AuditEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    api<AuditEntry>(`/audit-logs/${entryId}`).then(setEntry).catch(() => {}).finally(() => setLoading(false));
  }, [entryId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-surface rounded-xl shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">Audit Record</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && <p className="text-sm text-gray-400 text-center py-4">Loading...</p>}
          {entry && (
            <>
              {/* Header info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Action</span>
                  <p className="font-medium">{entry.action}</p>
                </div>
                <div>
                  <span className="text-gray-500">Title</span>
                  <p className="font-medium">{entry.title}</p>
                </div>
                <div>
                  <span className="text-gray-500">Entity</span>
                  <p>
                    <span className="font-mono text-xs bg-gray-100 px-1 rounded">{entry.entity_type}</span>
                    {ENTITY_ROUTES[entry.entity_type] && (
                      <EL href={`${ENTITY_ROUTES[entry.entity_type]}/${entry.entity_id}`} className="ml-2 text-xs">
                        Open {entry.entity_type}
                      </EL>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">When</span>
                  <p>{formatDateTime(entry.created_at)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Who</span>
                  <p>{entry.created_by?.full_name ?? "System"}</p>
                </div>
                {entry.text && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Comment</span>
                    <p>{entry.text}</p>
                  </div>
                )}
              </div>

              {/* Cross-links */}
              {entry.related && entry.related.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">Related Entities</h3>
                  <div className="flex flex-wrap gap-2">
                    {entry.related.map((r, i) => (
                      <EL
                        key={i}
                        href={`${ENTITY_ROUTES[r.type] || ""}/${r.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 border rounded text-xs hover:bg-brand-50"
                      >
                        <span className="font-mono text-gray-400">{r.type}</span>
                        <span>{r.name}</span>
                      </EL>
                    ))}
                  </div>
                </div>
              )}

              {/* Full JSON data */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-1">Data Before</h3>
                  <textarea
                    readOnly
                    value={entry.data_before ? JSON.stringify(entry.data_before, null, 2) : "—"}
                    className="w-full h-48 resize-y text-xs font-mono bg-red-50 border border-red-200 rounded p-2 text-red-800"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-1">Data After</h3>
                  <textarea
                    readOnly
                    value={entry.data_after ? JSON.stringify(entry.data_after, null, 2) : "—"}
                    className="w-full h-48 resize-y text-xs font-mono bg-green-50 border border-green-200 rounded p-2 text-green-800"
                  />
                </div>
              </div>

              {/* Raw record ID */}
              <p className="text-xs text-gray-300 font-mono">ID: {entry.id}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
