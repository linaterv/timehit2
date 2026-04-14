"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalFilter } from "@/lib/global-filter-context";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/use-api";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EntityLink as EL } from "@/components/shared/entity-link";

import { GenerateInvoicesModal } from "@/components/shared/generate-invoices-modal";
import { FileWarning, FileX, CreditCard, MailX, AlertTriangle, Lock, Unlock } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatCurrency, formatMonth } from "@/lib/utils";
import { api, getAccessToken } from "@/lib/api";
import type {
  ControlRow,
  ControlSummary,
  PaginatedResponse,
  Client,
  Timesheet,
  User,
  Invoice,
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

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ year: number; month: number }>).detail;
      if (detail?.year) setYear(detail.year);
      if (typeof detail?.month === "number") setMonth(detail.month);
      setPage(1);
    };
    window.addEventListener("control-set-period", handler);
    return () => window.removeEventListener("control-set-period", handler);
  }, []);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const { clientId: globalClient, contractorId: globalContractor } = useGlobalFilter();
  const [clientFilter, setClientFilter] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("control-clientFilter") || globalClient;
    return globalClient;
  });
  const [contractorFilter, setContractorFilter] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("control-contractorFilter") || globalContractor;
    return globalContractor;
  });
  const [brokerFilter, setBrokerFilter] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("control-brokerFilter") || "";
    return "";
  });
  const [needsAttention, setNeedsAttention] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("control-needsAttention") === "true";
    return false;
  });
  const [flagFilter, setFlagFilter] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("control-flagFilter");
      if (saved) return new Set(JSON.parse(saved));
    }
    return new Set();
  });
  useEffect(() => {
    sessionStorage.setItem("control-clientFilter", clientFilter);
    sessionStorage.setItem("control-contractorFilter", contractorFilter);
    sessionStorage.setItem("control-brokerFilter", brokerFilter);
    sessionStorage.setItem("control-needsAttention", String(needsAttention));
    sessionStorage.setItem("control-flagFilter", JSON.stringify([...flagFilter]));
  }, [clientFilter, contractorFilter, brokerFilter, needsAttention, flagFilter]);
  const [flagDropdownOpen, setFlagDropdownOpen] = useState(false);
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

  const handleCreateTs = async (placementId: string, rowMonth?: number) => {
    const m = rowMonth || month;
    if (!m) { alert("Cannot create timesheet in All months view. Select a specific month."); return; }
    setCreatingTsForPlacement(placementId);
    try {
      const res = await api<{ id: string }>(`/placements/${placementId}/timesheets`, {
        method: "POST",
        body: JSON.stringify({ year: year, month: m }),
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

  const summaryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("year", String(year));
    p.set("month", String(month));
    if (clientFilter) p.set("client_id", clientFilter);
    if (contractorFilter) p.set("contractor_id", contractorFilter);
    if (brokerFilter) p.set("broker_id", brokerFilter);
    return p.toString();
  }, [year, month, clientFilter, contractorFilter, brokerFilter]);

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
    if (brokerFilter) p.set("broker_id", brokerFilter);
    if (needsAttention) p.set("needs_attention", "true");
    return p.toString();
  }, [year, month, page, sort, order, clientFilter, contractorFilter, brokerFilter, needsAttention]);

  const { data: summary } = useApiQuery<ControlSummary>(
    ["control-summary", summaryParams],
    `/control/summary?${summaryParams}`
  );

  // Unlocked entities
  const { data: unlockedData } = useApiQuery<{ total: number; placements: unknown[]; clients: unknown[]; contractors: unknown[]; invoices: unknown[] }>(
    ["control-unlocked"], "/control/unlocked"
  );
  const [lockAllOpen, setLockAllOpen] = useState(false);
  const [lockingAll, setLockingAll] = useState(false);
  const [lockRowTarget, setLockRowTarget] = useState<{ placementId: string; label: string; year?: number; month?: number } | null>(null);
  const [lockingRowId, setLockingRowId] = useState<string | null>(null);

  const handleLockRow = async () => {
    if (!lockRowTarget) return;
    setLockingRowId(lockRowTarget.placementId);
    setLockRowTarget(null);
    try {
      await api("/control/lock-row", {
        method: "POST",
        body: JSON.stringify({ placement_id: lockRowTarget.placementId, year: lockRowTarget.year, month: lockRowTarget.month }),
      });
      qc.invalidateQueries({ queryKey: ["control-overview"] });
      qc.invalidateQueries({ queryKey: ["control-unlocked"] });
    } catch { /* ignore */ }
    finally { setLockingRowId(null); }
  };

  const handleLockAll = async () => {
    setLockAllOpen(false);
    setLockingAll(true);
    try {
      await api("/control/lock-all", { method: "POST" });
      qc.invalidateQueries({ queryKey: ["control-unlocked"] });
    } catch { /* ignore */ }
    finally { setLockingAll(false); }
  };

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
    if (brokerFilter) base.set("broker_id", brokerFilter);
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
  }, [month, year, clientFilter, contractorFilter, brokerFilter, needsAttention]);

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

  const { data: brokersData } = useApiQuery<PaginatedResponse<User>>(
    ["brokers-for-select"],
    "/users?role=BROKER&is_active=true&per_page=200"
  );

  useEffect(() => {
    if (clientFilter && clientsData?.data && !clientsData.data.some((c) => c.id === clientFilter)) {
      setClientFilter("");
    }
  }, [clientFilter, clientsData]);
  useEffect(() => {
    if (contractorFilter && contractorsData?.data && !contractorsData.data.some((c) => c.user_id === contractorFilter)) {
      setContractorFilter("");
    }
  }, [contractorFilter, contractorsData]);
  useEffect(() => {
    if (brokerFilter && brokersData?.data && !brokersData.data.some((b) => b.id === brokerFilter)) {
      setBrokerFilter("");
    }
  }, [brokerFilter, brokersData]);

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
          <EL href={`/clients/${row.client.id}`} className="font-medium">{row.client.company_name}</EL>
          <span className="text-gray-400 mx-1">&rarr;</span>
          <EL href={`/placements/${row.placement.id}`}>{row.placement.title || row.contractor.full_name}</EL>
          {row.placement.title && <div className="text-xs"><EL href={`/contractors/${row.contractor.id}`} className="text-gray-400 hover:text-brand-600">{row.contractor.full_name}</EL></div>}
        </div>
      ),
    },
    {
      key: "brokers" as keyof ControlRow,
      label: "Broker",
      render: (row) => {
        if (!row.brokers?.length) return <span className="text-gray-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {row.brokers.map((b) => (
              <span key={b.id} className="text-xs text-gray-600">{b.full_name}</span>
            ))}
          </div>
        );
      },
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
      key: "action" as keyof ControlRow,
      label: "",
      render: (row) => {
        const btns: React.ReactNode[] = [];
        // No timesheet → Create
        if (!row.timesheet) {
          const isCreating = creatingTsForPlacement === row.placement.id;
          btns.push(
            <button key="create" onClick={(e) => { e.stopPropagation(); setLastActedRowId(`${row.placement.id}_${(row as any).year ?? year}_${(row as any).month ?? month}`); handleCreateTs(row.placement.id, (row as any).month); }}
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
            <button key="gen" onClick={(e) => { e.stopPropagation(); handleGenerateInline(row.timesheet!.id, `${row.placement.id}_${(row as any).year ?? year}_${(row as any).month ?? month}`); }}
              disabled={isGen}
              className="px-2 py-1 rounded text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap">
              {isGen ? "Generating..." : "Generate Invoice"}
            </button>
          );
        }
        return btns.length ? <div className="flex gap-1">{btns}</div> : null;
      },
    },
    {
      key: "flags",
      label: "Flags",
      wrap: true,
      render: (row) =>
        row.flags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.flags.map((flag) => (
              <span
                key={flag}
                title={flag}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap"
              >
                {FLAG_LABELS[flag] ?? flag}
              </span>
            ))}
          </div>
        ) : null,
    },
    {
      key: "unlocked" as keyof ControlRow,
      label: "Lock",
      render: (row) => {
        const ul = row.unlocked ?? [];
        if (ul.length === 0) {
          return <Lock size={14} className="text-emerald-400" />;
        }
        const isLocking = lockingRowId === row.placement.id;
        return (
          <div className="flex items-center gap-1">
            <Unlock size={14} className="text-yellow-500" />
            <button
              onClick={(e) => { e.stopPropagation(); setLockRowTarget({ placementId: row.placement.id, label: `${row.client.company_name} → ${row.placement.title || row.contractor.full_name}`, year: (row as any).year ?? year, month: (row as any).month ?? month }); }}
              disabled={isLocking}
              className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-300 hover:bg-yellow-200 disabled:opacity-50 whitespace-nowrap"
            >
              {isLocking ? "..." : "Lock"}
            </button>
          </div>
        );
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

  // Client-side flag filtering
  const FLAG_LABELS: Record<string, string> = {
    no_timesheet: "No Timesheet",
    timesheet_draft: "Timesheet Draft",
    pending_approval: "Pending Approval",
    approved_no_invoice: "Approved, No Invoice",
    missing_attachment: "Missing Attachment",
    missing_bank_details: "Missing Bank Details",
    invoice_not_sent: "Invoice Not Sent",
    unpaid: "Unpaid",
    suspicious: "Suspicious",
  };

  const filteredRows = flagFilter.size === 0
    ? overviewRows
    : overviewRows.filter((row) =>
        row.flags.some((f) =>
          flagFilter.has(f) ||
          (flagFilter.has("unpaid") && f.includes("unpaid")) ||
          (flagFilter.has("suspicious") && f.startsWith("suspicious:")) ||
          (flagFilter.has("invoice_not_sent") && (f === "invoice_not_sent" || f === "client_inv_not_sent" || f === "contr_inv_not_sent"))
        )
      );

  // Build a selectable id from placement.id for row selection
  const rowsWithId = filteredRows.map((row) => ({
    ...row,
    id: `${row.placement.id}_${(row as any).year ?? year}_${(row as any).month ?? month}`,
  }));

  return (
    <div data-testid="control-screen" className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Control Screen</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div
          data-testid="summary-ts-issues"
          onClick={() => { setFlagFilter(new Set(["no_timesheet", "timesheet_draft", "pending_approval", "missing_attachment"])); setNeedsAttention(false); setPage(1); }}
          className="rounded-lg p-4 bg-amber-50 border border-amber-200 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-700">Timesheet Issues</p>
              <p className="text-3xl font-bold text-amber-900 mt-1">
                {summary?.timesheet_issues ?? "—"}
              </p>
            </div>
            <div className="rounded-full bg-amber-100 p-3">
              <FileWarning className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>
        <div
          data-testid="summary-no-invoice"
          onClick={() => { setFlagFilter(new Set(["approved_no_invoice"])); setNeedsAttention(false); setPage(1); }}
          className="rounded-lg p-4 bg-blue-50 border border-blue-200 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">No Invoice</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">
                {summary?.approved_without_invoices ?? "—"}
              </p>
            </div>
            <div className="rounded-full bg-blue-100 p-3">
              <FileX className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div
          data-testid="summary-unpaid"
          onClick={() => { setFlagFilter(new Set(["unpaid"])); setNeedsAttention(false); setPage(1); }}
          className="rounded-lg p-4 bg-purple-50 border border-purple-200 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Unpaid Invoices</p>
              <p className="text-3xl font-bold text-purple-900 mt-1">
                {summary?.invoices_awaiting_payment ?? "—"}
              </p>
            </div>
            <div className="rounded-full bg-purple-100 p-3">
              <CreditCard className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div
          data-testid="summary-not-sent"
          onClick={() => { setFlagFilter(new Set(["invoice_not_sent"])); setNeedsAttention(false); setPage(1); }}
          className="rounded-lg p-4 bg-orange-50 border border-orange-200 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">Invoice Not Sent</p>
              <p className="text-3xl font-bold text-orange-900 mt-1">
                {summary?.invoices_not_sent ?? "—"}
              </p>
            </div>
            <div className="rounded-full bg-orange-100 p-3">
              <MailX className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div
          data-testid="summary-issues"
          onClick={() => { setFlagFilter(new Set()); setNeedsAttention(true); setPage(1); }}
          className="rounded-lg p-4 bg-red-50 border border-red-200 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">Issues</p>
              <p className="text-3xl font-bold text-red-900 mt-1">
                {summary?.placements_with_issues ?? "—"}
              </p>
            </div>
            <div className="rounded-full bg-red-100 p-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
        <div
          className={`rounded-lg p-4 border cursor-default transition-shadow ${
            (unlockedData?.total ?? 0) > 0
              ? "bg-yellow-50 border-yellow-300"
              : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${(unlockedData?.total ?? 0) > 0 ? "text-yellow-700" : "text-emerald-700"}`}>
                {(unlockedData?.total ?? 0) > 0 ? "Unlocked" : "All Locked"}
              </p>
              <p className={`text-3xl font-bold mt-1 ${(unlockedData?.total ?? 0) > 0 ? "text-yellow-900" : "text-emerald-900"}`}>
                {unlockedData?.total ?? "—"}
              </p>
            </div>
            <div className={`rounded-full p-3 ${(unlockedData?.total ?? 0) > 0 ? "bg-yellow-100" : "bg-emerald-100"}`}>
              {(unlockedData?.total ?? 0) > 0
                ? <Unlock className="h-6 w-6 text-yellow-600" />
                : <Lock className="h-6 w-6 text-emerald-600" />}
            </div>
          </div>
          {(unlockedData?.total ?? 0) > 0 && (
            <button
              onClick={() => setLockAllOpen(true)}
              disabled={lockingAll}
              className="mt-3 w-full px-3 py-1.5 bg-yellow-600 text-white rounded text-xs font-medium hover:bg-yellow-700 disabled:opacity-50"
            >
              {lockingAll ? "Locking..." : "Lock All"}
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!lockRowTarget}
        title="Lock Row"
        message={`Lock all entities for ${lockRowTarget?.label ?? ""}? This will lock the placement, client, contractor, and related invoices. Unlocking will require a reason.`}
        confirmLabel="Lock"
        onConfirm={handleLockRow}
        onCancel={() => setLockRowTarget(null)}
      />

      <ConfirmDialog
        open={lockAllOpen}
        title="Lock All Entities"
        message={`Lock all ${unlockedData?.total ?? 0} unlocked entities tied to active placements? This includes ${unlockedData?.placements?.length ?? 0} placements, ${unlockedData?.clients?.length ?? 0} clients, ${unlockedData?.contractors?.length ?? 0} contractors, and ${unlockedData?.invoices?.length ?? 0} invoices. Unlocking will require a reason.`}
        confirmLabel="Lock All"
        onConfirm={handleLockAll}
        onCancel={() => setLockAllOpen(false)}
      />

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

        <select
          data-testid="control-broker-filter"
          value={brokerFilter}
          onChange={(e) => {
            setBrokerFilter(e.target.value);
            setPage(1); setLastActedRowId(null);
          }}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All Brokers</option>
          {(brokersData?.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.full_name}
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

        {/* Flags multi-select dropdown */}
        <div className="relative">
          <button
            data-testid="filter-flags"
            onClick={() => setFlagDropdownOpen(!flagDropdownOpen)}
            className={`px-3 py-2 border rounded text-sm flex items-center gap-1 ${flagFilter.size > 0 ? "border-brand-500 bg-brand-50 text-brand-700 font-medium" : ""}`}
          >
            Flags{flagFilter.size > 0 ? ` (${flagFilter.size})` : ""}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {flagDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFlagDropdownOpen(false)} />
              <div className="absolute z-20 mt-1 bg-white border rounded-lg shadow-lg py-1 min-w-[220px]">
                {flagFilter.size > 0 && (
                  <button
                    onClick={() => { setFlagFilter(new Set()); setPage(1); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-gray-50 border-b"
                  >
                    Clear all
                  </button>
                )}
                {Object.entries(FLAG_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={flagFilter.has(key)}
                      onChange={() => {
                        const next = new Set(flagFilter);
                        if (next.has(key)) next.delete(key); else next.add(key);
                        setFlagFilter(next);
                        setPage(1);
                      }}
                      className="rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
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

      {/* Unpaid Manual Invoices (no placement → not in the main table; surface here so they don't get lost) */}
      <ManualInvoicesBlock year={year} />

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

function ManualInvoicesBlock({ year }: { year: number }) {
  const router = useRouter();
  const { data } = useApiQuery<PaginatedResponse<Invoice>>(
    ["manual-invoices-unpaid", year],
    `/invoices?is_manual=true&status=ISSUED,DRAFT&year=${year}&per_page=50&sort=due_date&order=asc`,
  );
  const rows = data?.data ?? [];
  if (rows.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div data-testid="manual-invoices-block" className="border rounded-lg bg-surface">
      <div className="px-4 py-2 border-b bg-amber-50 text-sm font-medium text-amber-900 flex items-center gap-2">
        <span>Unpaid Manual Invoices</span>
        <span className="text-xs text-amber-700 font-normal">({rows.length})</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
          <tr>
            <th className="px-3 py-1.5 text-left">Invoice #</th>
            <th className="px-3 py-1.5 text-left">Bill To</th>
            <th className="px-3 py-1.5 text-right">Amount</th>
            <th className="px-3 py-1.5 text-left">Issue Date</th>
            <th className="px-3 py-1.5 text-left">Due Date</th>
            <th className="px-3 py-1.5 text-left">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((inv) => {
            const overdue = inv.status === "ISSUED" && inv.due_date && inv.due_date < today;
            const billTo = inv.client?.company_name
              ?? (inv.billing_snapshot as { client_company_name?: string } | undefined)?.client_company_name
              ?? "—";
            return (
              <tr key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)}
                className="cursor-pointer hover:bg-gray-50">
                <td className="px-3 py-1.5 font-mono text-xs">{inv.invoice_number}</td>
                <td className="px-3 py-1.5">{billTo}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">{inv.total_amount} {inv.currency}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-xs text-gray-600">{inv.issue_date}</td>
                <td className={`px-3 py-1.5 whitespace-nowrap text-xs ${overdue ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                  {inv.due_date || "—"}{overdue ? " (overdue)" : ""}
                </td>
                <td className="px-3 py-1.5">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                    inv.status === "DRAFT" ? "bg-gray-100 text-gray-700" : "bg-blue-100 text-blue-700"
                  }`}>{inv.status}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
