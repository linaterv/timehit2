"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useApiQuery } from "@/hooks/use-api";
import { formatDateTime } from "@/lib/utils";
import type { PaginatedResponse } from "@/types/api";

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

const ENTITY_TYPES = ["timesheet", "placement", "invoice", "invoice_template", "client", "contractor", "user", "document"];
const ACTION_COLORS: Record<string, string> = {
  CREATED: "bg-brand-50 text-brand-700",
  UPDATED: "bg-blue-50 text-blue-700",
  DELETED: "bg-red-50 text-red-700",
  DEACTIVATED: "bg-amber-50 text-amber-700",
  SUBMITTED: "bg-blue-50 text-blue-700",
  APPROVED: "bg-green-50 text-green-700",
  CLIENT_APPROVED: "bg-green-50 text-green-600",
  REJECTED: "bg-red-50 text-red-700",
  WITHDRAWN: "bg-amber-50 text-amber-700",
  ISSUED: "bg-green-50 text-green-700",
  PAID: "bg-green-100 text-green-800",
  VOIDED: "bg-red-50 text-red-700",
  CORRECTED: "bg-amber-50 text-amber-700",
  ACTIVATED: "bg-green-50 text-green-700",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-50 text-red-700",
  UPLOADED: "bg-brand-50 text-brand-700",
  ARCHIVED: "bg-gray-100 text-gray-600",
  ENTRIES_UPDATED: "bg-blue-50 text-blue-600",
};

function entityLink(type: string, id: string): string {
  switch (type) {
    case "timesheet": return `/timesheets/${id}`;
    case "placement": return `/placements/${id}`;
    case "invoice": return `/invoices/${id}`;
    case "client": return `/clients/${id}`;
    case "contractor": return `/contractors/${id}`;
    default: return "";
  }
}

export default function AuditPage() {
  const { user } = useAuth();
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("per_page", "50");
  if (entityType) params.set("entity_type", entityType);
  if (action) params.set("action", action);
  if (search) params.set("search", search);

  const { data, isLoading } = useApiQuery<PaginatedResponse<AuditEntry>>(
    ["audit-logs", entityType, action, search, page],
    `/audit-logs?${params.toString()}`,
    user?.role === "ADMIN",
  );

  if (user?.role !== "ADMIN") {
    return <div className="text-center py-8 text-gray-400">Admin access required.</div>;
  }

  const entries = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div data-testid="audit-page" className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded text-sm">
          <option value="">All Types</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <input type="text" placeholder="Search title/text..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded text-sm w-64" />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">User</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((e) => {
                const link = entityLink(e.entity_type, e.entity_id);
                const typeLabel = e.entity_type.replace(/_/g, " ");
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">{formatDateTime(e.created_at)}</td>
                    <td className="px-4 py-2">
                      {link ? (
                        <a href={link} target="_blank" rel="noopener" className="text-brand-600 hover:underline text-xs">
                          {typeLabel}
                        </a>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{typeLabel}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ACTION_COLORS[e.action] || "bg-gray-100 text-gray-600"}`}>{e.action}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {link ? (
                        <a href={link} target="_blank" rel="noopener" className="hover:underline">{e.title}</a>
                      ) : (
                        e.title
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{e.created_by?.full_name ?? "—"}</td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No audit entries found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {meta.page} of {meta.total_pages} ({meta.total} entries)</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="px-3 py-1 border rounded disabled:opacity-50">&larr; Prev</button>
            <button disabled={page >= meta.total_pages} onClick={() => setPage(page + 1)}
              className="px-3 py-1 border rounded disabled:opacity-50">Next &rarr;</button>
          </div>
        </div>
      )}
    </div>
  );
}
