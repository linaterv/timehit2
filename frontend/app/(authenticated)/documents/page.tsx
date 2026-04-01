"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalFilter } from "@/lib/global-filter-context";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EntityLink as EL } from "@/components/shared/entity-link";
import { formatDate } from "@/lib/utils";
import { Download, Trash2 } from "lucide-react";
import { getAccessToken } from "@/lib/api";
import type { PlacementDocument, PaginatedResponse, Client } from "@/types/api";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { user } = useAuth();

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("uploaded_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const { clientId: globalClient } = useGlobalFilter();
  const [clientFilter, setClientFilter] = useState(globalClient);
  const [labelFilter, setLabelFilter] = useState("");
  const [uploadedFrom, setUploadedFrom] = useState("");
  const [uploadedTo, setUploadedTo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PlacementDocument | null>(
    null
  );

  const isAdminOrBroker =
    user?.role === "ADMIN" || user?.role === "BROKER";

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("per_page", "25");
    p.set("sort", sort);
    p.set("order", order);
    if (search) p.set("search", search);
    if (clientFilter) p.set("client_id", clientFilter);
    if (labelFilter) p.set("label", labelFilter);
    if (uploadedFrom) p.set("uploaded_from", uploadedFrom);
    if (uploadedTo) p.set("uploaded_to", uploadedTo);
    return p.toString();
  }, [page, sort, order, search, clientFilter, labelFilter, uploadedFrom, uploadedTo]);

  const { data, isLoading } = useApiQuery<PaginatedResponse<PlacementDocument>>(
    ["documents", queryParams],
    `/documents?${queryParams}`
  );

  const { data: clientsData } = useApiQuery<PaginatedResponse<Client>>(
    ["clients-for-select"],
    "/clients?per_page=200"
  );

  const deleteMutation = useApiMutation<void, { id: string }>(
    "DELETE",
    (body) => `/documents/${body.id}`,
    [["documents"]]
  );

  const handleDownload = (doc: PlacementDocument) => {
    const token = getAccessToken();
    const url = `/api/v1/documents/${doc.id}/download`;
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = doc.file_name;
          a.click();
          URL.revokeObjectURL(blobUrl);
        });
    } else {
      window.open(url, "_blank");
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { id: deleteTarget.id },
      { onSuccess: () => setDeleteTarget(null) }
    );
  };

  const handleSort = (key: string, newOrder: "asc" | "desc") => {
    setSort(key);
    setOrder(newOrder);
    setPage(1);
  };

  const columns: Column<PlacementDocument>[] = [
    { key: "file_name", label: "File Name", sortable: true },
    { key: "label", label: "Label", sortable: true },
    {
      key: "client",
      label: "Client",
      render: (row) => (
        row.placement ? <EL href={`/clients/${row.placement.client.id}`}>{row.placement.client.company_name}</EL> : <span>—</span>
      ),
    },
    {
      key: "contractor",
      label: "Contractor",
      render: (row) => (
        row.placement ? <EL href={`/contractors/${row.placement.contractor.id}`}>{row.placement.contractor.full_name}</EL> : <span>—</span>
      ),
    },
    {
      key: "uploaded_by",
      label: "Uploaded By",
      render: (row) => <span>{row.uploaded_by.full_name}</span>,
    },
    {
      key: "uploaded_at",
      label: "Uploaded At",
      sortable: true,
      render: (row) => <span>{formatDate(row.uploaded_at)}</span>,
    },
    {
      key: "file_size_bytes",
      label: "Size",
      render: (row) => <span>{formatFileSize(row.file_size_bytes)}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            data-testid={`download-${row.id}`}
            onClick={() => handleDownload(row)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            title="Download"
          >
            <Download size={16} />
          </button>
          {isAdminOrBroker && (
            <button
              data-testid={`delete-${row.id}`}
              onClick={() => setDeleteTarget(row)}
              className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div data-testid="documents-page" className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Documents</h1>

      <div data-testid="documents-filters" className="flex flex-wrap gap-3">
        <input
          data-testid="documents-search"
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded text-sm w-64"
        />

        <select
          data-testid="documents-client-filter"
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

        <input
          data-testid="documents-label-filter"
          type="text"
          placeholder="Label..."
          value={labelFilter}
          onChange={(e) => {
            setLabelFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded text-sm w-40"
        />

        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">From</label>
          <input
            data-testid="documents-from-date"
            type="date"
            value={uploadedFrom}
            onChange={(e) => {
              setUploadedFrom(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded text-sm"
          />
        </div>

        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">To</label>
          <input
            data-testid="documents-to-date"
            type="date"
            value={uploadedTo}
            onChange={(e) => {
              setUploadedTo(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div data-testid="documents-loading" className="text-center py-12 text-gray-400">
          Loading...
        </div>
      ) : (
        <DataTable<PlacementDocument>
          testId="documents-table"
          columns={columns}
          data={data?.data ?? []}
          meta={data?.meta}
          onPageChange={setPage}
          onSort={handleSort}
          sort={sort}
          order={order}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteTarget?.file_name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
