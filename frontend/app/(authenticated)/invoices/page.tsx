"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalFilter } from "@/lib/global-filter-context";
import { useQuery } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { GenerateInvoicesModal } from "@/components/shared/generate-invoices-modal";
import { EntityLink as EL } from "@/components/shared/entity-link";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import { ManualInvoiceForm } from "@/components/forms/manual-invoice-form";
import type {
  Invoice,
  Placement,
  PaginatedResponse,
  Client,
  InvoiceType,
  InvoiceStatus,
} from "@/types/api";

const INVOICE_TYPES: InvoiceType[] = ["CLIENT_INVOICE", "CONTRACTOR_INVOICE"];
const INVOICE_STATUSES: InvoiceStatus[] = [
  "DRAFT",
  "ISSUED",
  "PAID",
  "VOIDED",
  "CORRECTED",
];

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i).toLocaleString("en-US", { month: "long" }),
}));

export default function InvoicesPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [page, setPage] = useState(1);
  const isContr = user?.role === "CONTRACTOR";
  const [sort, setSort] = useState(isContr ? "issue_date" : "updated_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { clientId: globalClient } = useGlobalFilter();
  const [clientFilter, setClientFilter] = useState(globalClient);
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [manualFilter, setManualFilter] = useState<"" | "true" | "false">("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const isAdminOrBroker =
    user?.role === "ADMIN" || user?.role === "BROKER";
  const isContractor = user?.role === "CONTRACTOR";

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", "25");
    params.set("sort", sort);
    params.set("order", order);
    if (typeFilter) params.set("invoice_type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (clientFilter) params.set("client_id", clientFilter);
    if (yearFilter) params.set(isContractor ? "issue_year" : "year", yearFilter);
    if (monthFilter) params.set("month", monthFilter);
    if (manualFilter) params.set("is_manual", manualFilter);
    return params.toString();
  }, [page, sort, order, typeFilter, statusFilter, clientFilter, yearFilter, monthFilter, manualFilter, isContractor]);

  const { data, isLoading } = useApiQuery<PaginatedResponse<Invoice>>(
    ["invoices", queryParams],
    `/invoices?${queryParams}`
  );

  const { data: clientsData } = useApiQuery<PaginatedResponse<Client>>(
    ["clients-for-select"],
    "/clients?per_page=200"
  );

  // Contractor: get ALL invoices (no filters) for client dropdown + year extraction
  // Uses separate stable query key — never invalidated by filter changes
  const allInvoicesQ = useQuery<PaginatedResponse<Invoice>>({
    queryKey: ["invoices-all-for-filters"],
    queryFn: () => api<PaginatedResponse<Invoice>>("/invoices?per_page=200"),
    enabled: isContractor,
    staleTime: Infinity,
  });

  // Contractor: fetch placements for client filter dropdown
  const { data: placementsData } = useApiQuery<PaginatedResponse<Placement>>(
    ["contractor-placements-for-invoices"],
    "/placements?status=ACTIVE&per_page=100",
    isContractor
  );

  // Contractor: set defaults once data loads
  const [defaultsSet, setDefaultsSet] = useState(false);
  useEffect(() => {
    if (!isContractor || defaultsSet) return;
    // Default client: first active placement's client
    if (placementsData?.data?.length && !clientFilter) {
      setClientFilter(placementsData.data[0].client.id);
    }
    // Default year: most recent year with invoices
    if (allInvoicesQ.data?.data?.length && !yearFilter) {
      const maxYear = Math.max(...allInvoicesQ.data.data.map((inv) => new Date(inv.issue_date).getFullYear()));
      setYearFilter(String(maxYear));
    }
    if (placementsData?.data && allInvoicesQ.data?.data) {
      setDefaultsSet(true);
    }
  }, [isContractor, defaultsSet, placementsData, allInvoicesQ.data, clientFilter, yearFilter]);

  // Contractor client options: from all invoices + active placements
  const contractorPlacementOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>();
    // From invoices (all clients ever invoiced)
    for (const inv of (allInvoicesQ.data?.data ?? [])) {
      if (!inv.client) continue;
      if (!seen.has(inv.client.id)) {
        seen.set(inv.client.id, {
          id: inv.client.id,
          label: `${inv.client.company_name} → ${(inv as any).placement_title || "—"}`,
        });
      }
    }
    // From active placements (may have clients not yet invoiced)
    for (const pl of (placementsData?.data ?? [])) {
      if (!seen.has(pl.client.id)) {
        seen.set(pl.client.id, {
          id: pl.client.id,
          label: `${pl.client.company_name} → ${pl.title || "—"}`,
        });
      }
    }
    return Array.from(seen.values());
  }, [placementsData]);

  const columns: Column<Invoice>[] = [
    { key: "invoice_number", label: "Invoice #", sortable: true },
    ...(!isContractor ? [
      {
        key: "invoice_type",
        label: "Type",
        sortable: true,
        render: (row: Invoice) => (
          row.is_manual
            ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Manual</span>
            : <StatusBadge value={row.invoice_type} />
        ),
      } as Column<Invoice>,
      {
        key: "client",
        label: "Client",
        render: (row: Invoice) => (
          row.client
            ? <EL href={`/clients/${row.client.id}`}>{row.client.company_name}</EL>
            : <span className="text-gray-400">—</span>
        ),
      } as Column<Invoice>,
      {
        key: "contractor",
        label: "Contractor",
        render: (row: Invoice) => (
          row.contractor
            ? <EL href={`/contractors/${row.contractor.id}`}>{row.contractor.full_name}</EL>
            : <span className="text-gray-400">—</span>
        ),
      } as Column<Invoice>,
      {
        key: "placement_title",
        label: "Position",
        render: (row: Invoice) => <span>{(row as any).placement_title || "—"}</span>,
      } as Column<Invoice>,
    ] : [
      {
        key: "placement",
        label: "Placement",
        render: (row: Invoice) => (
          <span>
            {row.client?.company_name ?? "—"}
            <span className="text-gray-400"> → </span>
            {(row as any).placement_title || "—"}
          </span>
        ),
      } as Column<Invoice>,
    ]),
    ...(!isContractor ? [{
      key: "period",
      label: "Period",
      render: (row: Invoice) => (
        row.year && row.month
          ? <span>{formatMonth(row.year, row.month)}</span>
          : <span className="text-gray-400">—</span>
      ),
    } as Column<Invoice>] : []),
    ...(!isContractor ? [{
      key: "total_amount",
      label: "Total",
      sortable: true,
      render: (row: Invoice) => (
        <span className="font-medium">
          {formatCurrency(row.total_amount, row.currency)}
        </span>
      ),
    } as Column<Invoice>] : []),
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: "issue_date",
      label: "Issue Date",
      sortable: true,
      render: (row) => <span>{formatDate(row.issue_date)}</span>,
    },
  ];

  const handleSort = (key: string, newOrder: "asc" | "desc") => {
    setSort(key);
    setOrder(newOrder);
    setPage(1);
  };

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    if (isContractor && allInvoicesQ.data) {
      const yrs = new Set(allInvoicesQ.data.data.map((inv) => new Date(inv.issue_date).getFullYear()));
      return Array.from(yrs).sort((a, b) => b - a);
    }
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, [isContractor, allInvoicesQ.data, currentYear]);

  return (
    <div data-testid="invoices-page" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        {isAdminOrBroker && (
          <div className="flex gap-2">
            <button
              data-testid="manual-invoice-btn"
              onClick={() => setManualOpen(true)}
              className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700"
            >
              New Manual Invoice
            </button>
            <button
              data-testid="generate-invoices-btn"
              onClick={() => setGenerateOpen(true)}
              className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
            >
              Generate Invoices
            </button>
          </div>
        )}
      </div>

      <div data-testid="invoices-filters" className="flex flex-wrap gap-3">
        {!isContractor && (
          <>
            <select
              data-testid="invoices-type-filter"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="">All Types</option>
              {INVOICE_TYPES.map((t) => (<option key={t} value={t}>{t.replace(/_/g, " ")}</option>))}
            </select>

            <select
              data-testid="invoices-status-filter"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="">All Statuses</option>
              {INVOICE_STATUSES.map((s) => (<option key={s} value={s}>{s.replace(/_/g, " ")}</option>))}
            </select>

            <select
              data-testid="invoices-client-filter"
              value={clientFilter}
              onChange={(e) => { setClientFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="">All Clients</option>
              {(clientsData?.data ?? []).map((c) => (<option key={c.id} value={c.id}>{c.company_name}</option>))}
            </select>

            <select
              data-testid="invoices-manual-filter"
              value={manualFilter}
              onChange={(e) => { setManualFilter(e.target.value as "" | "true" | "false"); setPage(1); }}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="">Auto + Manual</option>
              <option value="false">Auto only</option>
              <option value="true">Manual only</option>
            </select>
          </>
        )}

        {isContractor && contractorPlacementOptions.length > 0 && (
          <select
            data-testid="invoices-placement-filter"
            value={clientFilter}
            onChange={(e) => { setClientFilter(e.target.value); setYearFilter(""); setPage(1); }}
            className="px-3 py-2 border rounded text-sm"
          >
            <option value="">All Placements</option>
            {contractorPlacementOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        )}

        <select
          data-testid="invoices-year-filter"
          value={yearFilter}
          onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All Years</option>
          {years.map((y) => (<option key={y} value={y}>{y}</option>))}
        </select>

        {!isContractor && (
          <select
            data-testid="invoices-month-filter"
            value={monthFilter}
            onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded text-sm"
          >
            <option value="">All Months</option>
            {MONTHS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div data-testid="invoices-loading" className="text-center py-12 text-gray-400">
          Loading...
        </div>
      ) : (
        <DataTable<Invoice>
          testId="invoices-table"
          columns={columns}
          data={data?.data ?? []}
          meta={data?.meta}
          onPageChange={setPage}
          onSort={handleSort}
          sort={sort}
          order={order}
          onRowClick={(row) => router.push(`/invoices/${row.id}`)}
        />
      )}

      <GenerateInvoicesModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
      />

      <ManualInvoiceForm
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={(id) => {
          setManualOpen(false);
          router.push(`/invoices/${id}`);
        }}
      />
    </div>
  );
}
