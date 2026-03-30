"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface Props<T> {
  testId: string;
  columns: Column<T>[];
  data: T[];
  meta?: { page: number; per_page: number; total: number; total_pages: number };
  onPageChange?: (page: number) => void;
  onSort?: (key: string, order: "asc" | "desc") => void;
  onRowClick?: (row: T) => void;
  sort?: string;
  order?: "asc" | "desc";
  selectedIds?: Set<string>;
  onSelect?: (ids: Set<string>) => void;
  idKey?: string;
}

export function DataTable<T extends Record<string, any>>({
  testId, columns, data, meta, onPageChange, onSort, onRowClick, sort, order,
  selectedIds, onSelect, idKey = "id",
}: Props<T>) {
  const showSelect = !!onSelect;

  const toggleAll = () => {
    if (!onSelect) return;
    const allIds = new Set(data.map((r) => String(r[idKey])));
    const allSelected = data.every((r) => selectedIds?.has(String(r[idKey])));
    onSelect(allSelected ? new Set() : allIds);
  };

  const toggleOne = (id: string) => {
    if (!onSelect || !selectedIds) return;
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelect(next);
  };

  return (
    <div data-testid={testId}>
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {showSelect && (
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" onChange={toggleAll} checked={data.length > 0 && data.every((r) => selectedIds?.has(String(r[idKey])))} />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn("px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", col.sortable && "cursor-pointer select-none")}
                  onClick={() => col.sortable && onSort?.(col.key, sort === col.key && order === "asc" ? "desc" : "asc")}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sort === col.key && (order === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-gray-200">
            {data.map((row, i) => (
              <tr
                key={String(row[idKey]) || i}
                data-testid={`${testId}-row-${row[idKey]}`}
                onClick={() => onRowClick?.(row)}
                className={cn("hover:bg-gray-50 transition-colors", onRowClick && "cursor-pointer", i % 2 === 1 && "bg-gray-50/40")}
              >
                {showSelect && (
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds?.has(String(row[idKey])) || false} onChange={() => toggleOne(String(row[idKey]))} />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                    {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={columns.length + (showSelect ? 1 : 0)} className="px-4 py-8 text-center text-gray-400 text-sm">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
          <span>Showing {((meta.page - 1) * meta.per_page) + 1}–{Math.min(meta.page * meta.per_page, meta.total)} of {meta.total}</span>
          <div className="flex gap-1">
            <button disabled={meta.page <= 1} onClick={() => onPageChange?.(meta.page - 1)} className="px-3 py-1 border rounded disabled:opacity-30">Prev</button>
            <button disabled={meta.page >= meta.total_pages} onClick={() => onPageChange?.(meta.page + 1)} className="px-3 py-1 border rounded disabled:opacity-30">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
