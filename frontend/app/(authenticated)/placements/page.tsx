"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { SlideOver } from "@/components/forms/slide-over";
import { StatusBadge } from "@/components/shared/status-badge";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Timesheet } from "@/types/api";
import type {
  Placement,
  PaginatedResponse,
  PlacementStatus,
  ApprovalFlow,
  ClientRef,
  ContractorProfile,
} from "@/types/api";

interface ClientOption {
  id: string;
  company_name: string;
}

interface ContractorOption {
  id: string;
  full_name: string;
  user_id: string;
}

interface CreatePlacementBody {
  client_id: string;
  contractor_id: string;
  client_rate: string;
  contractor_rate: string;
  currency: string;
  start_date: string;
  end_date: string;
  approval_flow: ApprovalFlow;
  require_timesheet_attachment: boolean;
  client_can_view_invoices: boolean;
  client_can_view_documents: boolean;
  payment_terms_client_days: string;
  payment_terms_contractor_days: string;
}

const PLACEMENT_STATUSES: PlacementStatus[] = ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"];

function emptyCreateForm(): CreatePlacementBody {
  return {
    client_id: "",
    contractor_id: "",
    client_rate: "",
    contractor_rate: "",
    currency: "EUR",
    start_date: "",
    end_date: "",
    approval_flow: "BROKER_ONLY",
    require_timesheet_attachment: false,
    client_can_view_invoices: false,
    client_can_view_documents: false,
    payment_terms_client_days: "",
    payment_terms_contractor_days: "",
  };
}

export default function PlacementsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const isContractor = user?.role === "CONTRACTOR";

  // Fetch pending timesheets for contractor to show current-month actions
  interface PendingRow { placement_id: string; year: number; month: number; status: string; timesheet_id: string | null }
  const pendingQ = useQuery<{ data: PendingRow[] }>({
    queryKey: ["timesheets-pending-placements"],
    queryFn: () => api<{ data: PendingRow[] }>("/timesheets/pending"),
    enabled: isContractor,
  });
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const lastMonth = curMonth === 1 ? 12 : curMonth - 1;
  const lastMonthYear = curMonth === 1 ? curYear - 1 : curYear;

  const pendingByPlacement = useMemo(() => {
    const map = new Map<string, { current?: PendingRow; last?: PendingRow }>();
    for (const r of (pendingQ.data?.data ?? [])) {
      const key = r.placement_id;
      if (!map.has(key)) map.set(key, {});
      const entry = map.get(key)!;
      if (r.year === curYear && r.month === curMonth) entry.current = r;
      if (r.year === lastMonthYear && r.month === lastMonth) entry.last = r;
    }
    return map;
  }, [pendingQ.data, curYear, curMonth, lastMonthYear, lastMonth]);

  const qc = useQueryClient();
  const handleCreateTs = async (placementId: string, year: number, month: number) => {
    try {
      const res = await api<Timesheet>(`/placements/${placementId}/timesheets`, {
        method: "POST",
        body: JSON.stringify({ year, month }),
      });
      qc.invalidateQueries({ queryKey: ["timesheets-pending-placements"] });
      qc.invalidateQueries({ queryKey: ["timesheets-pending"] });
      qc.invalidateQueries({ queryKey: ["timesheets"] });
      router.push(`/timesheets/${res.id}`);
    } catch {
      router.push("/timesheets");
    }
  };

  const [statusFilter, setStatusFilter] = useState<string>(isContractor ? "ACTIVE" : "");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [contractorFilter, setContractorFilter] = useState<string>("");
  const [sort, setSort] = useState("start_date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [slideOpen, setSlideOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreatePlacementBody>(emptyCreateForm());

  const canCreate = user?.role === "ADMIN" || user?.role === "BROKER";
  const canSeeRates = user?.role === "ADMIN" || user?.role === "BROKER";

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", "25");
    params.set("sort", sort);
    params.set("order", order);
    if (statusFilter) params.set("status", statusFilter);
    if (clientFilter) params.set("client_id", clientFilter);
    if (contractorFilter) params.set("contractor_id", contractorFilter);
    return params.toString();
  }, [page, statusFilter, clientFilter, contractorFilter, sort, order]);

  const { data, isLoading } = useApiQuery<PaginatedResponse<Placement>>(
    ["placements", queryParams],
    `/placements?${queryParams}`
  );

  const { data: clientsData } = useApiQuery<PaginatedResponse<ClientOption>>(
    ["clients-list"],
    "/clients?per_page=200"
  );

  const { data: contractorsData } = useApiQuery<PaginatedResponse<ContractorOption>>(
    ["contractors-list"],
    "/contractors?per_page=200"
  );

  const createMutation = useApiMutation<Placement, CreatePlacementBody>(
    "POST",
    "/placements",
    [["placements"]]
  );

  const clients = clientsData?.data ?? [];
  const contractors = contractorsData?.data ?? [];

  const columns: Column<Placement>[] = [
    ...(isContractor ? [{
      key: "placement",
      label: "Placement",
      sortable: false,
      render: (row: Placement) => (
        <span>{row.client.company_name} <span className="text-gray-400">→</span> {row.title || "—"}</span>
      ),
    } as Column<Placement>] : [
      {
        key: "client",
        label: "Client",
        sortable: false,
        render: (row: Placement) => row.client.company_name,
      } as Column<Placement>,
      {
        key: "contractor",
        label: "Contractor",
        sortable: false,
        render: (row: Placement) => row.contractor.full_name,
      } as Column<Placement>,
      {
        key: "title",
        label: "Position",
        sortable: false,
        render: (row: Placement) => row.title || "—",
      } as Column<Placement>,
    ]),
    ...(canSeeRates ? ([
      {
        key: "client_rate",
        label: "Client Rate",
        sortable: true,
        render: (row: Placement) => formatCurrency(row.client_rate, row.currency),
      },
      {
        key: "contractor_rate",
        label: "Contractor Rate",
        sortable: true,
        render: (row: Placement) => formatCurrency(row.contractor_rate, row.currency),
      },
    ] as Column<Placement>[]) : []),
    {
      key: "start_date",
      label: "Start",
      sortable: true,
      render: (row) => formatDate(row.start_date),
    },
    {
      key: "end_date",
      label: "End",
      sortable: true,
      render: (row) => formatDate(row.end_date),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => <StatusBadge value={row.status} />,
    },
    ...(!isContractor ? [{
      key: "approval_flow",
      label: "Approval Flow",
      sortable: false,
      render: (row: Placement) => (
        <span className="text-xs text-gray-500">{row.approval_flow.replace(/_/g, " ")}</span>
      ),
    } as Column<Placement>] : []),
    ...(isContractor ? [{
      key: "ts_action",
      label: "",
      sortable: false,
      render: (row: Placement) => {
        if (row.status !== "ACTIVE") return null;
        const pending = pendingByPlacement.get(row.id);
        if (!pending) return null;
        const { last, current } = pending;

        const lastBtn = last ? (
          <button onClick={(e) => { e.stopPropagation();
            last.status === "MISSING" ? handleCreateTs(row.id, lastMonthYear, lastMonth) : router.push(`/timesheets/${last.timesheet_id}`);
          }}
            className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 flex items-center gap-1">
            <CircleAlert size={12} />
            Late ! {last.status === "MISSING" ? "Create" : "Edit"} Last Month TS
            <CircleAlert size={12} />
          </button>
        ) : null;

        const curBtn = current ? (
          <button onClick={(e) => { e.stopPropagation();
            current.status === "MISSING" ? handleCreateTs(row.id, curYear, curMonth) : router.push(`/timesheets/${current.timesheet_id}`);
          }}
            className="px-2 py-1 rounded text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-1">
            {current.status === "MISSING" ? "Create" : "Edit"} This Month TS
          </button>
        ) : null;

        if (!lastBtn && !curBtn) return null;
        return <div className="flex flex-col gap-1">{lastBtn}{curBtn}</div>;
      },
    } as Column<Placement>] : []),
  ];

  const handleSort = (key: string, newOrder: "asc" | "desc") => {
    setSort(key);
    setOrder(newOrder);
    setPage(1);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleClientFilter = (value: string) => {
    setClientFilter(value);
    setPage(1);
  };

  const handleContractorFilter = (value: string) => {
    setContractorFilter(value);
    setPage(1);
  };

  const updateCreate = <K extends keyof CreatePlacementBody>(key: K, value: CreatePlacementBody[K]) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreate = async () => {
    try {
      const body = {
        ...createForm,
        payment_terms_client_days: createForm.payment_terms_client_days ? parseInt(createForm.payment_terms_client_days, 10) : null,
        payment_terms_contractor_days: createForm.payment_terms_contractor_days ? parseInt(createForm.payment_terms_contractor_days, 10) : null,
      };
      await createMutation.mutateAsync(body as any);
      setSlideOpen(false);
      setCreateForm(emptyCreateForm());
    } catch {
      // error handled by mutation state
    }
  };

  return (
    <div data-testid="placements-page" className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          data-testid="placements-status-filter"
          value={statusFilter}
          onChange={(e) => handleStatusFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
        >
          <option value="">All Statuses</option>
          {PLACEMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        {!isContractor && (
          <>
            <select
              data-testid="placements-client-filter"
              value={clientFilter}
              onChange={(e) => handleClientFilter(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>

            <select
              data-testid="placements-contractor-filter"
              value={contractorFilter}
              onChange={(e) => handleContractorFilter(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            >
              <option value="">All Contractors</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.user_id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </>
        )}

        {canCreate && (
          <button
            data-testid="placements-create-btn"
            onClick={() => setSlideOpen(true)}
            className="ml-auto px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
          >
            Create Placement
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div data-testid="placements-loading" className="text-center py-8 text-gray-400">
          Loading...
        </div>
      ) : (
        <DataTable<Placement>
          testId="placements-table"
          columns={columns}
          data={data?.data ?? []}
          meta={data?.meta}
          onPageChange={setPage}
          onSort={handleSort}
          sort={sort}
          order={order}
          onRowClick={(row) => router.push(`/placements/${row.id}`)}
        />
      )}

      {/* Create SlideOver */}
      <SlideOver
        open={slideOpen}
        onClose={() => {
          setSlideOpen(false);
          setCreateForm(emptyCreateForm());
        }}
        title="Create Placement"
        onSave={handleCreate}
        saving={createMutation.isPending}
        testId="placement-create-slideover"
      >
        <div className="space-y-4">
          {createMutation.isError && (
            <div data-testid="placement-create-error" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              {(() => {
                const e = createMutation.error as { message?: string; details?: { field: string; message: string }[] };
                if (e?.details?.length) return e.details.map((d, i) => <div key={i}><strong>{d.field}:</strong> {d.message}</div>);
                return e?.message || "Failed to create placement";
              })()}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              data-testid="create-client_id"
              value={createForm.client_id}
              onChange={(e) => updateCreate("client_id", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contractor</label>
            <select
              data-testid="create-contractor_id"
              value={createForm.contractor_id}
              onChange={(e) => updateCreate("contractor_id", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            >
              <option value="">Select contractor...</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.user_id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Rate</label>
              <input
                data-testid="create-client_rate"
                type="text"
                value={createForm.client_rate}
                onChange={(e) => updateCreate("client_rate", e.target.value)}
                placeholder="0.00"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Rate</label>
              <input
                data-testid="create-contractor_rate"
                type="text"
                value={createForm.contractor_rate}
                onChange={(e) => updateCreate("contractor_rate", e.target.value)}
                placeholder="0.00"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <input
              data-testid="create-currency"
              type="text"
              value={createForm.currency}
              onChange={(e) => updateCreate("currency", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                data-testid="create-start_date"
                type="date"
                value={createForm.start_date}
                onChange={(e) => updateCreate("start_date", e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                data-testid="create-end_date"
                type="date"
                value={createForm.end_date}
                onChange={(e) => updateCreate("end_date", e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Approval Flow</label>
            <select
              data-testid="create-approval_flow"
              value={createForm.approval_flow}
              onChange={(e) => updateCreate("approval_flow", e.target.value as ApprovalFlow)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            >
              <option value="BROKER_ONLY">Broker Only</option>
              <option value="CLIENT_THEN_BROKER">Client then Broker</option>
            </select>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                data-testid="create-require_timesheet_attachment"
                type="checkbox"
                checked={createForm.require_timesheet_attachment}
                onChange={(e) => updateCreate("require_timesheet_attachment", e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-gray-700">Require timesheet attachment</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                data-testid="create-client_can_view_invoices"
                type="checkbox"
                checked={createForm.client_can_view_invoices}
                onChange={(e) => updateCreate("client_can_view_invoices", e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-gray-700">Client can view invoices</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                data-testid="create-client_can_view_documents"
                type="checkbox"
                checked={createForm.client_can_view_documents}
                onChange={(e) => updateCreate("client_can_view_documents", e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-gray-700">Client can view documents</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Payment Terms (days)</label>
              <input
                data-testid="create-payment_terms_client_days"
                type="number"
                value={createForm.payment_terms_client_days}
                onChange={(e) => updateCreate("payment_terms_client_days", e.target.value)}
                placeholder="e.g. 30"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Payment Terms (days)</label>
              <input
                data-testid="create-payment_terms_contractor_days"
                type="number"
                value={createForm.payment_terms_contractor_days}
                onChange={(e) => updateCreate("payment_terms_contractor_days", e.target.value)}
                placeholder="e.g. 14"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
