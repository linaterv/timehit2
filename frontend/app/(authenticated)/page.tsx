"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalFilter } from "@/lib/global-filter-context";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/use-api";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

import { GenerateInvoicesModal } from "@/components/shared/generate-invoices-modal";
import { formatCurrency, formatMonth } from "@/lib/utils";
import { api, getAccessToken } from "@/lib/api";
import type {
  ControlRow,
  ControlSummary,
  PaginatedResponse,
  Client,
  Timesheet,
} from "@/types/api";

/* ──────────────────────────── Contractor redirect ──────────────────────────── */
function ContractorDashboard() {
  const router = useRouter();
  useEffect(() => { router.replace("/timesheets"); }, [router]);
  return <div className="flex items-center justify-center h-32 text-gray-400">Redirecting...</div>;
}

function _unused() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("per_page", "25");
    p.set("sort", sort);
    p.set("order", order);
    return p.toString();
  }, [page, sort, order]);

  const { data, isLoading } = useApiQuery<PaginatedResponse<Timesheet>>(
    ["my-timesheets", queryParams],
    `/timesheets?${queryParams}`
  );

  const columns: Column<Timesheet>[] = [
    {
      key: "client",
      label: "Client",
      render: (row) => <span>{row.placement?.client.company_name ?? "—"}</span>,
    },
    {
      key: "period",
      label: "Period",
      render: (row) => formatMonth(row.year, row.month),
    },
    { key: "total_hours", label: "Hours", sortable: true },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => <StatusBadge value={row.status} />,
    },
  ];

  const handleSort = (key: string, newOrder: "asc" | "desc") => {
    setSort(key);
    setOrder(newOrder);
    setPage(1);
  };

  return (
    <div data-testid="contractor-dashboard" className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">My Timesheets</h1>
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <DataTable<Timesheet>
          testId="contractor-timesheets-table"
          columns={columns}
          data={data?.data ?? []}
          meta={data?.meta}
          onPageChange={setPage}
          onSort={handleSort}
          sort={sort}
          order={order}
          onRowClick={(row) => router.push(`/timesheets/${row.id}`)}
        />
      )}
    </div>
  );
}

/* ──────────────── Client contact dashboard ──────────────── */
function ClientContactDashboard() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("per_page", "25");
    p.set("status", "SUBMITTED");
    return p.toString();
  }, [page]);

  const { data, isLoading } = useApiQuery<PaginatedResponse<Timesheet>>(
    ["pending-approval-timesheets", queryParams],
    `/timesheets?${queryParams}`
  );

  const columns: Column<Timesheet>[] = [
    {
      key: "contractor",
      label: "Contractor",
      render: (row) => <span>{row.placement?.contractor.full_name ?? "—"}</span>,
    },
    {
      key: "period",
      label: "Period",
      render: (row) => formatMonth(row.year, row.month),
    },
    { key: "total_hours", label: "Hours" },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge value={row.status} />,
    },
  ];

  return (
    <div data-testid="client-dashboard" className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">
        Timesheets Awaiting Approval
      </h1>
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <DataTable<Timesheet>
          testId="client-timesheets-table"
          columns={columns}
          data={data?.data ?? []}
          meta={data?.meta}
          onPageChange={setPage}
          onRowClick={(row) => router.push(`/timesheets/${row.id}`)}
        />
      )}
    </div>
  );
}

/* ──────────────── Admin / Broker Control Screen ──────────────── */
function ControlScreen() {
  const now = new Date();
  const lastMonth = now.getMonth(); // 0-indexed, so this is last month's 1-indexed value
  const lastMonthYear = lastMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const [year, setYear] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("control-year");
      if (saved) return parseInt(saved, 10);
    }
    return lastMonth === 0 ? lastMonthYear : now.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("control-month");
      if (saved) return parseInt(saved, 10);
    }
    return lastMonth === 0 ? 12 : lastMonth;
  });

  useEffect(() => {
    sessionStorage.setItem("control-year", String(year));
    sessionStorage.setItem("control-month", String(month));
  }, [year, month]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const { clientId: globalClient, contractorId: globalContractor } = useGlobalFilter();
  const [clientFilter, setClientFilter] = useState(globalClient);
  const [contractorFilter, setContractorFilter] = useState(globalContractor);
  const [needsAttention, setNeedsAttention] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [creatingTsForPlacement, setCreatingTsForPlacement] = useState<string | null>(null);
  const [lastActedRowId, setLastActedRowId] = useState<string | null>(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("control-highlight") || null;
    return null;
  });
  useEffect(() => {
    if (lastActedRowId) sessionStorage.setItem("control-highlight", lastActedRowId);
    else sessionStorage.removeItem("control-highlight");
  }, [lastActedRowId]);
  const router = useRouter();
  const qc = useQueryClient();

  const handleCreateTs = async (placementId: string) => {
    setCreatingTsForPlacement(placementId);
    try {
      const res = await api<{ id: string }>(`/placements/${placementId}/timesheets`, {
        method: "POST",
        body: JSON.stringify({ year: year, month: month }),
      });
      router.push(`/timesheets/${res.id}`);
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || "Failed to create timesheet");
    } finally {
      setCreatingTsForPlacement(null);
    }
  };

  const handleGenerateInline = async (tsId: string, rowId: string) => {
    setGeneratingId(tsId);
    setLastActedRowId(rowId);
    try {
      await api("/invoices/generate", { method: "POST", body: JSON.stringify({ timesheet_ids: [tsId] }) });
      qc.invalidateQueries({ queryKey: ["control-overview"] });
      qc.invalidateQueries({ queryKey: ["control-summary"] });
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || "Failed to generate invoices");
    } finally {
      setGeneratingId(null);
    }
  };

  const summaryParams = useMemo(
    () => `year=${year}&month=${month}`,
    [year, month]
  );

  const overviewParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("year", String(year));
    if (month) p.set("month", String(month));
    p.set("page", String(page));
    p.set("per_page", "25");
    if (sort) {
      p.set("sort", sort);
      p.set("order", order);
    }
    if (clientFilter) p.set("client_id", clientFilter);
    if (contractorFilter) p.set("contractor_id", contractorFilter);
    if (needsAttention) p.set("needs_attention", "true");
    return p.toString();
  }, [year, month, page, sort, order, clientFilter, contractorFilter, needsAttention]);

  const { data: summary } = useApiQuery<ControlSummary>(
    ["control-summary", summaryParams],
    `/control/summary?${summaryParams}`
  );

  // Single month: one call. All months (month=0): 12 parallel calls merged.
  const singleMonthQ = useApiQuery<PaginatedResponse<ControlRow>>(
    ["control-overview", overviewParams],
    `/control/overview?${overviewParams}`,
    month !== 0,
  );

  const [allMonthsData, setAllMonthsData] = useState<ControlRow[] | null>(null);
  const [allMonthsLoading, setAllMonthsLoading] = useState(false);
  useEffect(() => {
    if (month !== 0) { setAllMonthsData(null); return; }
    setAllMonthsLoading(true);
    const base = new URLSearchParams();
    base.set("year", String(year));
    if (clientFilter) base.set("client_id", clientFilter);
    if (contractorFilter) base.set("contractor_id", contractorFilter);
    if (needsAttention) base.set("needs_attention", "true");
    const maxMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    Promise.all(
      Array.from({ length: maxMonth }, (_, i) => {
        const p = new URLSearchParams(base);
        p.set("month", String(i + 1));
        return api<PaginatedResponse<ControlRow>>(`/control/overview?${p.toString()}`)
          .then((r) => r.data.map((row) => ({ ...row, year, month: i + 1 })))
          .catch(() => [] as ControlRow[]);
      })
    ).then((results) => {
      setAllMonthsData(results.flat());
      setAllMonthsLoading(false);
    });
  }, [month, year, clientFilter, contractorFilter, needsAttention]);

  const overviewData = month === 0
    ? (allMonthsData ? { data: allMonthsData, meta: { total: allMonthsData.length, page: 1, per_page: 999, total_pages: 1 } } : null)
    : singleMonthQ.data;
  const isLoading = month === 0 ? allMonthsLoading : singleMonthQ.isLoading;

  const { data: clientsData } = useApiQuery<PaginatedResponse<Client>>(
    ["clients-for-select"],
    "/clients?per_page=200"
  );

  const { data: contractorsData } = useApiQuery<
    PaginatedResponse<{ id: string; user_id: string; full_name: string }>
  >(["contractors-for-select"], "/contractors?per_page=200");

  const overviewRows = overviewData?.data ?? [];

  const columns: Column<ControlRow>[] = [
    ...(month === 0 ? [{
      key: "period" as keyof ControlRow,
      label: "Period",
      render: (row: ControlRow) => row.year && row.month ? formatMonth(row.year, row.month) : "—",
    }] : []),
    {
      key: "placement",
      label: "Placement",
      render: (row) => (
        <div>
          <span className="font-medium">{row.client.company_name}</span>
          <span className="text-gray-400 mx-1">&rarr;</span>
          <span>{row.placement.title || row.contractor.full_name}</span>
          {row.placement.title && <div className="text-xs text-gray-400">{row.contractor.full_name}</div>}
        </div>
      ),
    },
    {
      key: "hours",
      label: "Hours",
      render: (row) => (
        <span>{row.timesheet ? `${row.timesheet.total_hours}h` : "—"}</span>
      ),
    },
    {
      key: "ts_status",
      label: "TS Status",
      render: (row) =>
        row.timesheet ? (
          <StatusBadge value={row.timesheet.status} />
        ) : (
          <span className="text-xs text-gray-400">No TS</span>
        ),
    },
    {
      key: "inv_status",
      label: "Invoice",
      render: (row) => {
        const rid = `${row.placement.id}_${(row as any).year ?? year}_${(row as any).month ?? month}`;
        if (!row.client_invoice && !row.contractor_invoice) {
          return <span className="text-xs text-gray-400">No Invoice</span>;
        }
        return (
          <div className="flex flex-col gap-0.5">
            {row.client_invoice && (
              <button onClick={(e) => { e.stopPropagation(); setLastActedRowId(rid); router.push(`/invoices/${row.client_invoice!.id}`); }}
                className="text-xs text-brand-600 hover:underline text-left">
                {row.client_invoice.invoice_number} <StatusBadge value={row.client_invoice.status} />
              </button>
            )}
            {row.contractor_invoice && (
              <button onClick={(e) => { e.stopPropagation(); setLastActedRowId(rid); router.push(`/invoices/${row.contractor_invoice!.id}`); }}
                className="text-xs text-brand-600 hover:underline text-left">
                {row.contractor_invoice.invoice_number} <StatusBadge value={row.contractor_invoice.status} />
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: "flags",
      label: "Flags",
      render: (row) =>
        row.flags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.flags.map((flag) => (
              <span
                key={flag}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700"
              >
                {flag}
              </span>
            ))}
          </div>
        ) : null,
    },
    {
      key: "action" as keyof ControlRow,
      label: "",
      render: (row) => {
        const btns: React.ReactNode[] = [];
        // No timesheet → Create
        if (!row.timesheet) {
          const isCreating = creatingTsForPlacement === row.placement.id;
          btns.push(
            <button key="create" onClick={(e) => { e.stopPropagation(); setLastActedRowId(`${row.placement.id}_${(row as any).year ?? year}_${(row as any).month ?? month}`); handleCreateTs(row.placement.id); }}
              disabled={isCreating}
              className="px-2 py-1 rounded text-xs font-medium border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap">
              {isCreating ? "Creating..." : "Create TS"}
            </button>
          );
        }
        // Draft → Edit
        if (row.timesheet?.status === "DRAFT") {
          btns.push(
            <button key="edit" onClick={(e) => { e.stopPropagation(); setLastActedRowId(`${row.placement.id}_${(row as any).year ?? year}_${(row as any).month ?? month}`); router.push(`/timesheets/${row.timesheet!.id}`); }}
              className="px-2 py-1 rounded text-xs font-medium border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 whitespace-nowrap">
              Edit TS
            </button>
          );
        }
        // Submitted/Client Approved → View
        if (row.timesheet?.status === "SUBMITTED" || row.timesheet?.status === "CLIENT_APPROVED") {
          btns.push(
            <button key="view" onClick={(e) => { e.stopPropagation(); setLastActedRowId(`${row.placement.id}_${(row as any).year ?? year}_${(row as any).month ?? month}`); router.push(`/timesheets/${row.timesheet!.id}`); }}
              className="px-2 py-1 rounded text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap">
              View TS
            </button>
          );
        }
        // Approved without invoice (either or both missing) → Generate
        if (row.timesheet?.status === "APPROVED" && (!row.client_invoice || !row.contractor_invoice)) {
          const isGen = generatingId === row.timesheet.id;
          btns.push(
            <button key="gen" onClick={(e) => { e.stopPropagation(); handleGenerateInline(row.timesheet!.id, `${row.placement.id}_${year}_${month}`); }}
              disabled={isGen}
              className="px-2 py-1 rounded text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap">
              {isGen ? "Generating..." : "Generate Invoice"}
            </button>
          );
        }
        return btns.length ? <div className="flex gap-1">{btns}</div> : null;
      },
    },
  ];

  const handleSort = (key: string, newOrder: "asc" | "desc") => {
    setSort(key);
    setOrder(newOrder);
    setPage(1);
  };

  const handleExport = async () => {
    const token = getAccessToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      if (month === 0) {
        // All months: fetch 12 CSVs and merge
        const rows: string[] = [];
        let headerLine = "";
        for (let m = 1; m <= 12; m++) {
          const res = await fetch(`/api/v1/control/export?year=${year}&month=${m}`, { headers });
          if (!res.ok) continue;
          const text = await res.text();
          const lines = text.trim().split("\n");
          if (!headerLine && lines.length > 0) headerLine = `Period,${lines[0]}`;
          for (let i = 1; i < lines.length; i++) {
            rows.push(`${year}-${String(m).padStart(2, "0")},${lines[i]}`);
          }
        }
        const csv = [headerLine, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `control-export-${year}-all.csv`; a.click(); URL.revokeObjectURL(url);
      } else {
        const res = await fetch(`/api/v1/control/export?year=${year}&month=${month}`, { headers });
        if (!res.ok) { alert("Export failed"); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `control-export-${year}-${String(month).padStart(2, "0")}.csv`; a.click(); URL.revokeObjectURL(url);
      }
    } catch { alert("Export failed"); }
  };

  // Build a selectable id from placement.id for row selection
  const rowsWithId = overviewRows.map((row) => ({
    ...row,
    id: `${row.placement.id}_${(row as any).year ?? year}_${(row as any).month ?? month}`,
  }));

  return (
    <div data-testid="control-screen" className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Control Screen</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          data-testid="summary-awaiting"
          className="border rounded-lg p-4 bg-surface"
        >
          <p className="text-sm text-gray-500">Awaiting Approval</p>
          <p className="text-2xl font-bold text-gray-900">
            {summary?.timesheets_awaiting_approval ?? "—"}
          </p>
        </div>
        <div
          data-testid="summary-no-invoice"
          className="border rounded-lg p-4 bg-surface"
        >
          <p className="text-sm text-gray-500">No Invoice</p>
          <p className="text-2xl font-bold text-gray-900">
            {summary?.approved_without_invoices ?? "—"}
          </p>
        </div>
        <div
          data-testid="summary-unpaid"
          className="border rounded-lg p-4 bg-surface"
        >
          <p className="text-sm text-gray-500">Unpaid Invoices</p>
          <p className="text-2xl font-bold text-gray-900">
            {summary?.invoices_awaiting_payment ?? "—"}
          </p>
        </div>
        <div
          data-testid="summary-issues"
          className="border rounded-lg p-4 bg-surface"
        >
          <p className="text-sm text-gray-500">Issues</p>
          <p className="text-2xl font-bold text-gray-900">
            {summary?.placements_with_issues ?? "—"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          data-testid="control-month-filter"
          value={`${year}-${String(month).padStart(2, "0")}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            setYear(y); setMonth(m); setPage(1); setLastActedRowId(null);
          }}
          className="px-3 py-2 border rounded text-sm font-medium"
        >
          {(() => {
            const opts: { value: string; label: string }[] = [];
            // "All months" option for current year
            opts.push({ value: `${now.getFullYear()}-00`, label: `All ${now.getFullYear()}` });
            if (now.getFullYear() > 2025) opts.push({ value: `${now.getFullYear() - 1}-00`, label: `All ${now.getFullYear() - 1}` });
            const d = new Date(now.getFullYear(), now.getMonth(), 1);
            for (let i = 0; i < 18; i++) {
              const y = d.getFullYear();
              const m = d.getMonth() + 1;
              opts.push({
                value: `${y}-${String(m).padStart(2, "0")}`,
                label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
              });
              d.setMonth(d.getMonth() - 1);
            }
            return opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>);
          })()}
        </select>

        <select
          data-testid="control-client-filter"
          value={clientFilter}
          onChange={(e) => {
            setClientFilter(e.target.value);
            setPage(1); setLastActedRowId(null);
          }}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All Clients</option>
          {(clientsData?.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>

        <select
          data-testid="control-contractor-filter"
          value={contractorFilter}
          onChange={(e) => {
            setContractorFilter(e.target.value);
            setPage(1); setLastActedRowId(null);
          }}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All Contractors</option>
          {(contractorsData?.data ?? []).map((c) => (
            <option key={c.id} value={c.user_id}>
              {c.full_name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input
            data-testid="control-needs-attention"
            type="checkbox"
            checked={needsAttention}
            onChange={(e) => {
              setNeedsAttention(e.target.checked);
              setPage(1); setLastActedRowId(null);
            }}
            className="rounded"
          />
          Needs attention
        </label>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-brand-50 border border-brand-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-brand-700">
            {selectedIds.size} selected
          </span>
          <button
            data-testid="bulk-generate"
            onClick={() => setGenerateOpen(true)}
            className="px-3 py-1.5 bg-brand-600 text-white rounded text-sm hover:bg-brand-700"
          >
            Generate Invoices
          </button>
          <button
            data-testid="bulk-export"
            onClick={handleExport}
            className="px-3 py-1.5 border border-brand-300 text-brand-700 rounded text-sm hover:bg-brand-100"
          >
            Export CSV
          </button>
        </div>
      )}

      {/* Data Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <DataTable<ControlRow & { id: string }>
          testId="control-table"
          columns={columns as Column<ControlRow & { id: string }>[]}
          data={rowsWithId}
          meta={overviewData?.meta}
          onPageChange={setPage}
          onSort={handleSort}
          sort={sort}
          order={order}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          highlightId={lastActedRowId}
        />
      )}

      {/* Standalone export link when nothing selected */}
      {selectedIds.size === 0 && (
        <div className="flex gap-3">
          <button
            data-testid="bulk-export"
            onClick={handleExport}
            className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      )}

      <GenerateInvoicesModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
      />
    </div>
  );
}

/* ──────────────── Main Dashboard page ──────────────── */
export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === "CONTRACTOR") {
    return <ContractorDashboard />;
  }

  if (user.role === "CLIENT_CONTACT") {
    return <ClientContactDashboard />;
  }

  return <ControlScreen />;
}
