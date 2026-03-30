"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApiQuery } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMonth } from "@/lib/utils";
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

export default function TimesheetsListPage() {
  const router = useRouter();
  const { user } = useAuth();

  const currentDate = new Date();
  const [year, setYear] = useState<number>(currentDate.getFullYear());
  const [month, setMonth] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string>("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const params = new URLSearchParams();
  params.set("page", String(page));
  if (year) params.set("year", String(year));
  if (month) params.set("month", month);
  if (status) params.set("status", status);
  if (sort) {
    params.set("sort", sort);
    params.set("order", order);
  }

  const timesheetsQ = useApiQuery<PaginatedResponse<Timesheet>>(
    ["timesheets", { year, month, status, page, sort, order }],
    `/timesheets?${params.toString()}`
  );

  const timesheets = timesheetsQ.data?.data ?? [];
  const meta = timesheetsQ.data?.meta;

  const columns: Column<Timesheet>[] = [
    {
      key: "placement",
      label: "Placement",
      render: (row) => (
        <span data-testid={`ts-placement-${row.id}`}>
          {row.placement?.client.company_name ?? "—"}{" "}
          <span className="text-gray-400">&rarr;</span>{" "}
          {row.placement?.contractor.full_name ?? "—"}
        </span>
      ),
    },
    {
      key: "period",
      label: "Period",
      sortable: true,
      render: (row) => formatMonth(row.year, row.month),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: "total_hours",
      label: "Total Hours",
      sortable: true,
      render: (row) => row.total_hours,
    },
    {
      key: "submitted_at",
      label: "Submitted",
      sortable: true,
      render: (row) =>
        row.submitted_at
          ? new Date(row.submitted_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : "—",
    },
    {
      key: "approved_by",
      label: "Approved By",
      render: (row) => row.approved_by?.full_name ?? "—",
    },
  ];

  const handleSort = (key: string, newOrder: "asc" | "desc") => {
    setSort(key);
    setOrder(newOrder);
    setPage(1);
  };

  return (
    <div data-testid="timesheets-list" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {user?.role === "CONTRACTOR" ? "My Timesheets" : "Timesheets"}
        </h1>
      </div>

      {/* Filters */}
      <div
        data-testid="timesheets-filters"
        className="flex flex-wrap items-end gap-3"
      >
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Year
          </label>
          <input
            data-testid="filter-year"
            type="number"
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setPage(1);
            }}
            className="border rounded-md px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-brand-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Month
          </label>
          <select
            data-testid="filter-month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
            className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
          >
            <option value="">All months</option>
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Status
          </label>
          <select
            data-testid="filter-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {timesheetsQ.isLoading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          Loading...
        </div>
      ) : (
        <DataTable<Timesheet & Record<string, unknown>>
          testId="timesheets-table"
          columns={columns as Column<Timesheet & Record<string, unknown>>[]}
          data={timesheets as (Timesheet & Record<string, unknown>)[]}
          meta={meta}
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
