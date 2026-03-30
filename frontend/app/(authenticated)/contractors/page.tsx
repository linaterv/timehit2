"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { useApiQuery } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import type { ContractorProfile, PaginatedResponse } from "@/types/api";

export default function ContractorsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState<string>("all");
  const [sort, setSort] = useState("full_name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", "25");
    params.set("sort", sort);
    params.set("order", order);
    if (search) params.set("search", search);
    if (isActive !== "all") params.set("is_active", isActive);
    return params.toString();
  }, [page, search, isActive, sort, order]);

  const { data, isLoading } = useApiQuery<PaginatedResponse<ContractorProfile>>(
    ["contractors", queryParams],
    `/contractors?${queryParams}`
  );

  const columns: Column<ContractorProfile>[] = [
    { key: "full_name", label: "Name", sortable: true },
    { key: "company_name", label: "Company", sortable: true },
    { key: "country", label: "Country", sortable: true },
    { key: "default_currency", label: "Currency", sortable: true },
    {
      key: "current_placement" as keyof ContractorProfile,
      label: "Placement",
      render: (row) => {
        const p = row.current_placement;
        if (!p) return <span className="text-gray-400">—</span>;
        return (
          <span className="text-sm">
            {p.label}
            {p.status !== "ACTIVE" && (
              <span className="ml-1.5 text-xs text-gray-400">({p.status.toLowerCase()})</span>
            )}
          </span>
        );
      },
    },
    {
      key: "vat_registered",
      label: "VAT Registered",
      render: (row) => (
        <span
          data-testid={`vat-badge-${row.id}`}
          className={
            row.vat_registered
              ? "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700"
              : "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
          }
        >
          {row.vat_registered ? "Yes" : "No"}
        </span>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (row) => (
        <span
          data-testid={`active-badge-${row.id}`}
          className={
            row.is_active
              ? "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700"
              : "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700"
          }
        >
          {row.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const handleSort = (key: string, newOrder: "asc" | "desc") => {
    setSort(key);
    setOrder(newOrder);
    setPage(1);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleActiveFilter = (value: string) => {
    setIsActive(value);
    setPage(1);
  };

  return (
    <div data-testid="contractors-page" className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          data-testid="contractors-search"
          type="text"
          placeholder="Search contractors..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 w-64"
        />
        <select
          data-testid="contractors-active-filter"
          value={isActive}
          onChange={(e) => handleActiveFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
        >
          <option value="all">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {isLoading ? (
        <div data-testid="contractors-loading" className="text-center py-8 text-gray-400">
          Loading...
        </div>
      ) : (
        <DataTable<ContractorProfile>
          testId="contractors-table"
          columns={columns}
          data={data?.data ?? []}
          meta={data?.meta}
          onPageChange={setPage}
          onSort={handleSort}
          sort={sort}
          order={order}
          onRowClick={(row) => router.push(`/contractors/${row.id}`)}
        />
      )}
    </div>
  );
}
