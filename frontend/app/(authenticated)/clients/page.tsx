"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { SlideOver } from "@/components/forms/slide-over";

import type { Client, PaginatedResponse } from "@/types/api";

export default function ClientsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [sort, setSort] = useState("company_name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [slideOpen, setSlideOpen] = useState(false);

  // Form state
  const [formCompanyName, setFormCompanyName] = useState("");
  const [formBillingAddress, setFormBillingAddress] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [formCurrency, setFormCurrency] = useState("EUR");
  const [formPaymentTerms, setFormPaymentTerms] = useState("");
  const [formVatNumber, setFormVatNumber] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const allowed = user?.role === "ADMIN" || user?.role === "BROKER";

  const params = useMemo(() => {
    const p: Record<string, string> = { page: String(page), sort, order };
    if (search) p.search = search;
    if (activeFilter) p.is_active = activeFilter;
    return p;
  }, [page, search, activeFilter, sort, order]);

  const queryString = new URLSearchParams(params).toString();

  const { data, isLoading } = useApiQuery<PaginatedResponse<Client>>(
    ["clients", params],
    `/clients?${queryString}`,
    allowed
  );

  const createMutation = useApiMutation<Client, Record<string, unknown>>(
    "POST",
    "/clients",
    [["clients"]]
  );

  if (!allowed) {
    return (
      <div data-testid="clients-access-denied" className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Access Denied</h2>
          <p className="mt-2 text-gray-500">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const columns: Column<Client>[] = [
    { key: "company_name", label: "Company", sortable: true },
    { key: "country", label: "Country", sortable: true },
    {
      key: "brokers",
      label: "Brokers",
      render: (row) => (
        <span data-testid={`client-brokers-${row.id}`}>
          {row.brokers.map((b) => b.full_name).join(", ") || "\u2014"}
        </span>
      ),
    },
    {
      key: "placement_summary" as keyof Client,
      label: "Placements",
      render: (row) => {
        const s = row.placement_summary;
        if (!s || (s.active_count === 0 && s.inactive_count === 0)) {
          return null;
        }
        return (
          <div className="text-sm">
            {s.recent_active.length > 0 && (
              <div className="space-y-0.5">
                {s.recent_active.map((label, i) => (
                  <div key={i} className="text-gray-700 truncate max-w-[220px]">{label}</div>
                ))}
              </div>
            )}
            <span className="text-xs text-gray-400">
              {s.active_count} active{s.inactive_count > 0 ? ` / ${s.inactive_count} inactive` : ""}
            </span>
          </div>
        );
      },
    },
    {
      key: "is_active",
      label: "Active",
      render: (row) => (
        <span
          data-testid={`client-active-${row.id}`}
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            row.is_active ? "bg-green-500" : "bg-red-500"
          }`}
        />
      ),
    },
  ];

  const resetForm = () => {
    setFormCompanyName("");
    setFormBillingAddress("");
    setFormCountry("");
    setFormCurrency("EUR");
    setFormPaymentTerms("");
    setFormVatNumber("");
    setFormNotes("");
  };

  const handleOpenCreate = () => {
    resetForm();
    setSlideOpen(true);
  };

  const handleSave = () => {
    const body: Record<string, unknown> = {
      company_name: formCompanyName,
      billing_address: formBillingAddress,
      country: formCountry,
      default_currency: formCurrency,
      vat_number: formVatNumber,
      notes: formNotes,
    };
    if (formPaymentTerms) {
      body.payment_terms_days = Number(formPaymentTerms);
    }
    createMutation.mutate(body, {
      onSuccess: () => {
        setSlideOpen(false);
        resetForm();
      },
    });
  };

  const handleSort = (key: string, newOrder: "asc" | "desc") => {
    setSort(key);
    setOrder(newOrder);
    setPage(1);
  };

  const handleRowClick = (row: Client) => {
    router.push(`/clients/${row.id}`);
  };

  return (
    <div data-testid="clients-page" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <button
          data-testid="create-client-btn"
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700"
        >
          Create Client
        </button>
      </div>

      <div data-testid="clients-filters" className="flex gap-3">
        <input
          data-testid="clients-search-input"
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded text-sm w-64"
        />
        <select
          data-testid="clients-active-filter"
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {isLoading ? (
        <div data-testid="clients-loading" className="text-center py-12 text-gray-400">
          Loading...
        </div>
      ) : (
        <DataTable<Client>
          testId="clients-table"
          columns={columns}
          data={data?.data ?? []}
          meta={data?.meta}
          onPageChange={setPage}
          onSort={handleSort}
          sort={sort}
          order={order}
          onRowClick={handleRowClick}
        />
      )}

      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title="Create Client"
        onSave={handleSave}
        saving={createMutation.isPending}
        testId="create-client-slideover"
      >
        <div className="space-y-4">
          <div>
            <label data-testid="field-company-name-label" className="block text-sm font-medium text-gray-700 mb-1">
              Company Name
            </label>
            <input
              data-testid="field-company-name"
              type="text"
              value={formCompanyName}
              onChange={(e) => setFormCompanyName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="field-billing-address-label" className="block text-sm font-medium text-gray-700 mb-1">
              Billing Address
            </label>
            <textarea
              data-testid="field-billing-address"
              value={formBillingAddress}
              onChange={(e) => setFormBillingAddress(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="field-country-label" className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <input
              data-testid="field-country"
              type="text"
              value={formCountry}
              onChange={(e) => setFormCountry(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="field-currency-label" className="block text-sm font-medium text-gray-700 mb-1">
              Default Currency
            </label>
            <input
              data-testid="field-currency"
              type="text"
              value={formCurrency}
              onChange={(e) => setFormCurrency(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="field-payment-terms-label" className="block text-sm font-medium text-gray-700 mb-1">
              Payment Terms (days)
            </label>
            <input
              data-testid="field-payment-terms"
              type="number"
              value={formPaymentTerms}
              onChange={(e) => setFormPaymentTerms(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="field-vat-number-label" className="block text-sm font-medium text-gray-700 mb-1">
              VAT Number
            </label>
            <input
              data-testid="field-vat-number"
              type="text"
              value={formVatNumber}
              onChange={(e) => setFormVatNumber(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="field-notes-label" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              data-testid="field-notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
