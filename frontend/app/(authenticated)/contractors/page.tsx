"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { useApiQuery } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/utils";
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
    {
      key: "placement_summary" as keyof ContractorProfile,
      label: "Placements",
      render: (row) => {
        const s = row.placement_summary;
        if (!s || (s.active_count === 0 && s.inactive_count === 0)) return null;
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
      key: "is_active" as keyof ContractorProfile,
      label: "Status",
      render: (row) => {
        const inPlacement = (row.placement_summary?.active_count ?? 0) > 0;
        return (
          <span
            data-testid={`active-badge-${row.id}`}
            className={
              inPlacement
                ? "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700"
                : "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500"
            }
          >
            {inPlacement ? "In Placement" : "No Placement"}
          </span>
        );
      },
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
