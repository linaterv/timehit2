"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalFilter } from "@/lib/global-filter-context";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatMonth } from "@/lib/utils";
import type { Timesheet, PaginatedResponse, TimesheetStatus } from "@/types/api";

const STATUS_OPTIONS: TimesheetStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "CLIENT_APPROVED",
  "APPROVED",
  "REJECTED",
];

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i).toLocaleString("en-US", { month: "long" }),
}));

type ContractorFilter = "pending" | "SUBMITTED" | "APPROVED" | "all";

interface PendingRow {
  placement_id: string;
  placement: { client: { id: string; company_name: string }; contractor: { id: string; full_name: string } };
  year: number;
  month: number;
  status: string; // "MISSING" or "DRAFT"
  timesheet_id: string | null;
  total_hours: string | null;
}

export default function TimesheetsListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isContractor = user?.role === "CONTRACTOR";

  const { clientId: globalClient, contractorId: globalContractor } = useGlobalFilter();
  const isBrokerOrAdmin = user?.role === "ADMIN" || user?.role === "BROKER";
  const currentDate = new Date();
  const [year, setYear] = useState<number>(currentDate.getFullYear());
  const [month, setMonth] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [clientFilter, setClientFilter] = useState(globalClient);
  const [contractorFilterAdmin, setContractorFilterAdmin] = useState(globalContractor);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string>("updated_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  // Contractor-specific filter
  const [contractorFilter, setContractorFilter] = useState<ContractorFilter>("pending");
  const [autoSwitched, setAutoSwitched] = useState(false);

  // Standard timesheets query (for non-pending views)
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("per_page", "25");
  if (!isContractor || contractorFilter !== "pending") {
    if (year) params.set("year", String(year));
    if (month) params.set("month", month);
    if (isContractor && contractorFilter === "SUBMITTED") params.set("status", "SUBMITTED");
    else if (isContractor && contractorFilter === "APPROVED") params.set("status", "APPROVED");
    else if (status) params.set("status", status);
    if (sort) { params.set("sort", sort); params.set("order", order); }
    if (clientFilter) params.set("client_id", clientFilter);
    if (contractorFilterAdmin) params.set("contractor_id", contractorFilterAdmin);
  }

  const showStandard = !isContractor || contractorFilter !== "pending";
  const timesheetsQ = useApiQuery<PaginatedResponse<Timesheet>>(
    ["timesheets", { year, month, status, page, sort, order, contractorFilter, clientFilter, contractorFilterAdmin }],
    `/timesheets?${params.toString()}`,
    showStandard
  );

  const { data: clientsData } = useApiQuery<PaginatedResponse<{ id: string; company_name: string }>>(
    ["clients-ts-filter"], "/clients?per_page=200", isBrokerOrAdmin
  );
  const { data: contractorsData } = useApiQuery<PaginatedResponse<{ id: string; user_id: string; full_name: string }>>(
    ["contractors-ts-filter"], "/contractors?per_page=200", isBrokerOrAdmin
  );

  // Pending query (contractor only — for "pending" and "all" views)
  const needsPending = isContractor && (contractorFilter === "pending" || contractorFilter === "all");
  const pendingQ = useQuery<{ data: PendingRow[] }>({
    queryKey: ["timesheets-pending"],
    queryFn: () => api<{ data: PendingRow[] }>("/timesheets/pending"),
    enabled: needsPending,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Auto-switch: if pending returns empty, switch to "all"
  useEffect(() => {
    if (isContractor && contractorFilter === "pending" && pendingQ.data && !autoSwitched) {
      if (pendingQ.data.data.length === 0) {
        setContractorFilter("all");
        setAutoSwitched(true);
      }
    }
  }, [isContractor, contractorFilter, pendingQ.data, autoSwitched]);

  const rawTimesheets = timesheetsQ.data?.data ?? [];
  // Deduplicate (backend may return duplicates via joins)
  const timesheets = useMemo(() => {
    const seen = new Set<string>();
    return rawTimesheets.filter((t) => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
  }, [rawTimesheets]);
  const meta = timesheetsQ.data?.meta;
  const pendingRows = useMemo(() =>
    (pendingQ.data?.data ?? []).map((r) => ({ ...r, _rowId: `${r.placement_id}_${r.year}_${r.month}` })),
    [pendingQ.data]
  );

  // For "all" view: merge MISSING rows from pending into the timesheet list
  const mergedTimesheets = useMemo(() => {
    if (!isContractor || contractorFilter !== "all") return timesheets;
    // Get MISSING-only rows (DRAFT already in timesheets list)
    const existingKeys = new Set(timesheets.map((t) => `${t.placement_id}-${t.year}-${t.month}`));
    const missingRows = pendingRows.filter((r) => r.status === "MISSING" && !existingKeys.has(`${r.placement_id}-${r.year}-${r.month}`));
    // Convert missing rows to Timesheet-like shape
    const missingAsTimesheets: Timesheet[] = missingRows.map((r) => ({
      id: `missing_${r.placement_id}_${r.year}_${r.month}`,
      placement_id: r.placement_id,
      placement: {
        client: r.placement.client,
        contractor: r.placement.contractor,
        client_rate: "",
        contractor_rate: "",
        currency: "",
        approval_flow: "BROKER_ONLY" as const,
        require_timesheet_attachment: false,
      },
      year: r.year,
      month: r.month,
      status: "MISSING" as any,
      total_hours: "—",
      submitted_at: null,
      approved_at: null,
      approved_by: null,
      rejected_at: null,
      rejected_by: null,
      rejection_reason: "",
      created_at: "",
    }));
    // Merge, deduplicate by id, sort by year/month desc
    const all = [...timesheets, ...missingAsTimesheets];
    const seen = new Set<string>();
    const deduped = all.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    deduped.sort((a, b) => b.year - a.year || b.month - a.month);
    return deduped;
  }, [timesheets, pendingRows, isContractor, contractorFilter]);

  // Row action handler for standard + merged views
  const handleRowAction = (row: Timesheet) => {
    const id = String(row.id);
    if (id.startsWith("missing_")) {
      const plId = id.split("_")[1];
      handlePendingRowClick({ placement_id: plId, year: row.year, month: row.month, status: "MISSING", timesheet_id: null, total_hours: null, placement: row.placement as any });
    } else {
      router.push(`/timesheets/${row.id}`);
    }
  };

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  const isCurrentMonth = (y: number, m: number) => y === curYear && m === curMonth;

  const needsAttention = (s: string, id: string, y: number, m: number) =>
    (id.startsWith("missing_") || s === "MISSING" || s === "DRAFT") && !isCurrentMonth(y, m);

  const actionLabel = (s: string, id: string) => {
    if (id.startsWith("missing_") || s === "MISSING") return "Create";
    if (s === "DRAFT") return "Edit";
    return "View";
  };

  const actionStyle = (s: string, id: string, y: number, m: number) => {
    if (needsAttention(s, id, y, m)) return "bg-red-50 text-red-700 border border-red-300 hover:bg-red-100";
    if (id.startsWith("missing_") || s === "MISSING" || s === "DRAFT") return "bg-brand-600 text-white hover:bg-brand-700";
    return "border border-gray-300 text-gray-600 hover:bg-gray-50";
  };

  // Columns for standard view
  const columns: Column<Timesheet>[] = [
    {
      key: "placement",
      label: "Placement",
      render: (row) => (
        <span>
          {row.placement?.client.company_name ?? "—"}{" "}
          <span className="text-gray-400">&rarr;</span>{" "}
          {(row.placement as any)?.title || row.placement?.contractor.full_name || "—"}
        </span>
      ),
    },
    { key: "period", label: "Period", sortable: true, render: (row) => formatMonth(row.year, row.month) },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
    { key: "total_hours", label: "Hours", sortable: true, render: (row) => row.total_hours },
    {
      key: "submitted_at", label: "Submitted", sortable: true,
      render: (row) => formatDate(row.submitted_at),
    },
    { key: "approved_by", label: "Approved By", render: (row) => row.approved_by?.full_name ?? "—" },
    {
      key: "action", label: "",
      render: (row) => {
        const attn = needsAttention(row.status, String(row.id), row.year, row.month);
        return (
          <button
            onClick={(e) => { e.stopPropagation(); handleRowAction(row); }}
            className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1 ${actionStyle(row.status, String(row.id), row.year, row.month)}`}
          >
            {attn && <CircleAlert size={14} />}
            {attn && "Late ! "}{actionLabel(row.status, String(row.id))}
            {attn && <CircleAlert size={14} />}
          </button>
        );
      },
    },
  ];

  // Columns for pending view
  const pendingColumns: Column<PendingRow>[] = [
    {
      key: "placement",
      label: "Placement",
      render: (row) => (
        <span>
          {row.placement.client.company_name}{" "}
          <span className="text-gray-400">&rarr;</span>{" "}
          {(row.placement as any).title || row.placement.contractor.full_name}
        </span>
      ),
    },
    { key: "period", label: "Period", render: (row) => formatMonth(row.year, row.month) },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
    { key: "total_hours", label: "Hours", render: (row) => row.total_hours ?? "—" },
    {
      key: "action", label: "",
      render: (row) => {
        const isCur = isCurrentMonth(row.year, row.month);
        const label = row.status === "MISSING" ? "Create" : "Edit";
        return isCur ? (
          <button
            onClick={(e) => { e.stopPropagation(); handlePendingRowClick(row); }}
            className="px-3 py-1 rounded text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-1"
          >
            {label}
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); handlePendingRowClick(row); }}
            className="px-3 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 flex items-center gap-1"
          >
            <CircleAlert size={14} />
            Late ! {label}
            <CircleAlert size={14} />
          </button>
        );
      },
    },
  ];

  const handleSort = (key: string, newOrder: "asc" | "desc") => {
    setSort(key);
    setOrder(newOrder);
    setPage(1);
  };

  const handlePendingRowClick = async (row: PendingRow) => {
    if (row.timesheet_id) {
      router.push(`/timesheets/${row.timesheet_id}`);
    } else {
      // MISSING — create the timesheet first
      try {
        const res = await api<Timesheet>(`/placements/${row.placement_id}/timesheets`, {
          method: "POST",
          body: JSON.stringify({ year: row.year, month: row.month }),
        });
        router.push(`/timesheets/${res.id}`);
      } catch {
        // If it already exists (race), just navigate to timesheets
        router.push("/timesheets");
      }
    }
  };

  return (
    <div data-testid="timesheets-list" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {isContractor ? "My Timesheets" : "Timesheets"}
        </h1>
      </div>

      {/* Filters */}
      <div data-testid="timesheets-filters" className="flex flex-wrap items-end gap-3">
        {isContractor ? (
          /* Contractor filter dropdown */
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Show</label>
            <select
              data-testid="ts-filter-dropdown"
              value={contractorFilter}
              onChange={(e) => { setContractorFilter(e.target.value as ContractorFilter); setPage(1); }}
              className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            >
              <option value="pending">Missing or not submitted</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="all">All</option>
            </select>
          </div>
        ) : (
          /* Admin/Broker filters */
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
              <input data-testid="filter-year" type="number" value={year}
                onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}
                className="border rounded-md px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-brand-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
              <select data-testid="filter-month" value={month}
                onChange={(e) => { setMonth(e.target.value); setPage(1); }}
                className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600">
                <option value="">All months</option>
                {MONTH_OPTIONS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select data-testid="filter-status" value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600">
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s.replace(/_/g, " ")}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
              <select value={clientFilter}
                onChange={(e) => { setClientFilter(e.target.value); setPage(1); }}
                className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600">
                <option value="">All clients</option>
                {(clientsData?.data ?? []).map((c) => (<option key={c.id} value={c.id}>{c.company_name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Contractor</label>
              <select value={contractorFilterAdmin}
                onChange={(e) => { setContractorFilterAdmin(e.target.value); setPage(1); }}
                className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600">
                <option value="">All contractors</option>
                {(contractorsData?.data ?? []).map((c) => (<option key={c.id} value={c.user_id}>{c.full_name}</option>))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Table */}
      {isContractor && contractorFilter === "pending" ? (
        pendingQ.isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Loading...</div>
        ) : (
          <DataTable<PendingRow & Record<string, any>>
            testId="timesheets-table"
            columns={pendingColumns as Column<PendingRow & Record<string, any>>[]}
            data={pendingRows as (PendingRow & Record<string, any>)[]}
            idKey="_rowId"
          />
        )
      ) : timesheetsQ.isLoading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading...</div>
      ) : (
        <DataTable<Timesheet & Record<string, any>>
          testId="timesheets-table"
          columns={columns as Column<Timesheet & Record<string, any>>[]}
          data={(isContractor && contractorFilter === "all" ? mergedTimesheets : timesheets) as (Timesheet & Record<string, any>)[]}
          meta={isContractor && contractorFilter === "all" ? undefined : meta}
          onPageChange={setPage}
          onSort={handleSort}
          sort={sort}
          order={order}
        />
      )}
    </div>
  );
}
