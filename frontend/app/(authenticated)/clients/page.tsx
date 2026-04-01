"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { SlideOver } from "@/components/forms/slide-over";
import { CountrySelect } from "@/components/shared/country-select";
import { EntityLink as EL } from "@/components/shared/entity-link";
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
  const [formRegNumber, setFormRegNumber] = useState("");
  const [formCountry, setFormCountry] = useState("LT");
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
    { key: "code", label: "Code", render: (row) => <span className="font-mono text-xs text-gray-500">{row.code}</span> },
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
            <EL href={`/clients/${row.id}?tab=placements`} className="text-xs text-gray-400 hover:text-brand-600">
              {s.active_count} active{s.inactive_count > 0 ? ` / ${s.inactive_count} inactive` : ""}
            </EL>
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
    setFormRegNumber("");
    setFormCountry("LT");
    setFormNotes("");
  };

  const handleOpenCreate = () => {
    resetForm();
    setSlideOpen(true);
  };

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSave = () => {
    const errors: Record<string, string> = {};
    if (!formCompanyName.trim()) errors.company_name = "Company name is required";
    if (!formCountry) errors.country = "Country is required";
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setFieldErrors({});
    createMutation.mutate(
      { company_name: formCompanyName, registration_number: formRegNumber, country: formCountry, notes: formNotes },
      {
        onSuccess: () => { setSlideOpen(false); resetForm(); setFieldErrors({}); },
        onError: (err: unknown) => {
          const e = err as { details?: { field: string; message: string }[] };
          if (e.details?.length) {
            const map: Record<string, string> = {};
            e.details.forEach((d) => { map[d.field] = d.message; });
            setFieldErrors(map);
          }
        },
      },
    );
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
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              data-testid="field-company-name"
              type="text"
              value={formCompanyName}
              onChange={(e) => { setFormCompanyName(e.target.value); setFieldErrors((p) => ({ ...p, company_name: "" })); }}
              className={`w-full px-3 py-2 border rounded text-sm ${fieldErrors.company_name ? "border-red-400" : ""}`}
            />
            {fieldErrors.company_name && <p className="text-xs text-red-600 mt-1">{fieldErrors.company_name}</p>}
          </div>
          <div>
            <label data-testid="field-country-label" className="block text-sm font-medium text-gray-700 mb-1">
              Country <span className="text-red-500">*</span>
            </label>
            <CountrySelect
              value={formCountry}
              onChange={(v) => { setFormCountry(v); setFieldErrors((p) => ({ ...p, country: "" })); }}
              testId="field-country"
              className={`w-full px-3 py-2 border rounded text-sm ${fieldErrors.country ? "border-red-400" : ""}`}
            />
            {fieldErrors.country && <p className="text-xs text-red-600 mt-1">{fieldErrors.country}</p>}
          </div>
          <div>
            <label data-testid="field-reg-number-label" className="block text-sm font-medium text-gray-700 mb-1">
              Company Code
            </label>
            <input
              data-testid="field-reg-number"
              type="text"
              value={formRegNumber}
              onChange={(e) => setFormRegNumber(e.target.value)}
              className={`w-full px-3 py-2 border rounded text-sm ${fieldErrors.registration_number ? "border-red-400" : ""}`}
            />
            {fieldErrors.registration_number && <p className="text-xs text-red-600 mt-1">{fieldErrors.registration_number}</p>}
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
