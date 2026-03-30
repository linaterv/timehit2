"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useApiQuery } from "@/hooks/use-api";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { GenerateInvoicesModal } from "@/components/shared/generate-invoices-modal";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import type {
  Invoice,
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
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);

  const isAdminOrBroker =
    user?.role === "ADMIN" || user?.role === "BROKER";

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", "25");
    params.set("sort", sort);
    params.set("order", order);
    if (typeFilter) params.set("invoice_type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (clientFilter) params.set("client_id", clientFilter);
    if (yearFilter) params.set("year", yearFilter);
    if (monthFilter) params.set("month", monthFilter);
    return params.toString();
  }, [page, sort, order, typeFilter, statusFilter, clientFilter, yearFilter, monthFilter]);

  const { data, isLoading } = useApiQuery<PaginatedResponse<Invoice>>(
    ["invoices", queryParams],
    `/invoices?${queryParams}`
  );

  const { data: clientsData } = useApiQuery<PaginatedResponse<Client>>(
    ["clients-for-select"],
    "/clients?per_page=200"
  );

  const columns: Column<Invoice>[] = [
    { key: "invoice_number", label: "Invoice #", sortable: true },
    {
      key: "invoice_type",
      label: "Type",
      sortable: true,
      render: (row) => <StatusBadge value={row.invoice_type} />,
    },
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
      key: "period",
      label: "Period",
      render: (row) => <span>{formatMonth(row.year, row.month)}</span>,
    },
    {
      key: "total_amount",
      label: "Total",
      sortable: true,
      render: (row) => (
        <span className="font-medium">
          {formatCurrency(row.total_amount, row.currency)}
        </span>
      ),
    },
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
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div data-testid="invoices-page" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        {isAdminOrBroker && (
          <button
            data-testid="generate-invoices-btn"
            onClick={() => setGenerateOpen(true)}
            className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700"
          >
            Generate Invoices
          </button>
        )}
      </div>

      <div data-testid="invoices-filters" className="flex flex-wrap gap-3">
        <select
          data-testid="invoices-type-filter"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All Types</option>
          {INVOICE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <select
          data-testid="invoices-status-filter"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All Statuses</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <select
          data-testid="invoices-client-filter"
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
          data-testid="invoices-year-filter"
          value={yearFilter}
          onChange={(e) => {
            setYearFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All Years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          data-testid="invoices-month-filter"
          value={monthFilter}
          onChange={(e) => {
            setMonthFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All Months</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
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
    </div>
  );
}
