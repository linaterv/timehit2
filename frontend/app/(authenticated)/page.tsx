"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useApiQuery } from "@/hooks/use-api";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { MonthPicker } from "@/components/shared/month-picker";
import { GenerateInvoicesModal } from "@/components/shared/generate-invoices-modal";
import { formatCurrency, formatMonth } from "@/lib/utils";
import { getAccessToken } from "@/lib/api";
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
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [clientFilter, setClientFilter] = useState("");
  const [contractorFilter, setContractorFilter] = useState("");
  const [needsAttention, setNeedsAttention] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generateOpen, setGenerateOpen] = useState(false);

  const summaryParams = useMemo(
    () => `year=${year}&month=${month}`,
    [year, month]
  );

  const overviewParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("year", String(year));
    p.set("month", String(month));
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

  const { data: overviewData, isLoading } = useApiQuery<
    PaginatedResponse<ControlRow>
  >(["control-overview", overviewParams], `/control/overview?${overviewParams}`);

  const { data: clientsData } = useApiQuery<PaginatedResponse<Client>>(
    ["clients-for-select"],
    "/clients?per_page=200"
  );

  const { data: contractorsData } = useApiQuery<
    PaginatedResponse<{ id: string; user_id: string; full_name: string }>
  >(["contractors-for-select"], "/contractors?per_page=200");

  const overviewRows = overviewData?.data ?? [];

  const columns: Column<ControlRow>[] = [
    {
      key: "client",
      label: "Client",
      render: (row) => <span>{row.client.company_name}</span>,
    },
    {
      key: "contractor",
      label: "Contractor",
      render: (row) => <span>{row.contractor.full_name}</span>,
    },
    {
      key: "rates",
      label: "Rates",
      render: (row) => (
        <span className="text-xs">
          {formatCurrency(row.placement.client_rate, row.placement.currency)} /{" "}
          {formatCurrency(row.placement.contractor_rate, row.placement.currency)}
        </span>
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
      key: "margin",
      label: "Margin",
      render: (row) => (
        <span className="font-medium">
          {row.margin ? formatCurrency(row.margin, row.placement.currency) : "—"}
        </span>
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
      label: "Invoice Status",
      render: (row) => {
        if (row.client_invoice) {
          return <StatusBadge value={row.client_invoice.status} />;
        }
        return <span className="text-xs text-gray-400">No Invoice</span>;
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
  ];

  const handleSort = (key: string, newOrder: "asc" | "desc") => {
    setSort(key);
    setOrder(newOrder);
    setPage(1);
  };

  const handleMonthChange = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleExport = () => {
    const token = getAccessToken();
    const url = `/api/v1/control/export?year=${year}&month=${month}`;
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = `control-export-${year}-${month}.csv`;
          a.click();
          URL.revokeObjectURL(blobUrl);
        });
    } else {
      window.open(url, "_blank");
    }
  };

  // Build a selectable id from placement.id for row selection
  const rowsWithId = overviewRows.map((row) => ({
    ...row,
    id: row.timesheet?.id ?? row.placement.id,
  }));

  return (
    <div data-testid="control-screen" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Control Screen</h1>
        <MonthPicker year={year} month={month} onChange={handleMonthChange} />
      </div>

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
          data-testid="control-client-filter"
          value={clientFilter}
          onChange={(e) => {
            setClientFilter(e.target.value);
            setPage(1);
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
            setPage(1);
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
              setPage(1);
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
