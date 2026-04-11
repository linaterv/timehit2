"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { SlideOver } from "@/components/forms/slide-over";
import type { User, PaginatedResponse } from "@/types/api";

export default function BrokersPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("full_name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  // Create slide-over
  const [createOpen, setCreateOpen] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPassword, setFormPassword] = useState("");

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("role", "BROKER");
    p.set("sort", sort);
    p.set("order", order);
    if (search) p.set("search", search);
    return p.toString();
  }, [page, search, sort, order]);

  const { data, isLoading } = useApiQuery<PaginatedResponse<User>>(
    ["brokers", params],
    `/users?${params}`,
    currentUser?.role === "ADMIN"
  );

  const createMutation = useApiMutation<User, Record<string, unknown>>(
    "POST", "/users", [["brokers"], ["users"]]
  );

  if (currentUser?.role !== "ADMIN") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Access Denied</h2>
          <p className="mt-2 text-gray-500">Only admins can manage brokers.</p>
        </div>
      </div>
    );
  }

  const columns: Column<User>[] = [
    { key: "full_name", label: "Name", sortable: true },
    { key: "email", label: "Email", sortable: true },
    {
      key: "broker_assignments" as keyof User,
      label: "Assigned Clients",
      render: (row) => {
        const assignments = (row as User & { broker_assignments?: { client_name: string }[] }).broker_assignments;
        if (!assignments?.length) return <span className="text-gray-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {assignments.map((a, i) => (
              <span key={i} className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">{a.client_name}</span>
            ))}
          </div>
        );
      },
    },
    {
      key: "is_active",
      label: "Active",
      render: (row) => (
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${row.is_active ? "bg-green-500" : "bg-red-500"}`} />
      ),
    },
  ];

  const resetForm = () => { setFormEmail(""); setFormName(""); setFormPassword(""); };

  return (
    <div data-testid="brokers-page" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Brokers</h1>
        <button
          data-testid="create-broker-btn"
          onClick={() => { resetForm(); setCreateOpen(true); }}
          className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700"
        >
          Create Broker
        </button>
      </div>

      <div className="flex gap-3">
        <input
          data-testid="brokers-search"
          type="text" placeholder="Search brokers..."
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-600"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <DataTable<User>
          testId="brokers-table"
          columns={columns}
          data={data?.data ?? []}
          meta={data?.meta}
          onPageChange={setPage}
          onSort={(key, newOrder) => { setSort(key); setOrder(newOrder); setPage(1); }}
          sort={sort} order={order}
          onRowClick={(row) => router.push(`/brokers/${row.id}`)}
        />
      )}

      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Broker"
        onSave={() => {
          createMutation.mutate({ email: formEmail, full_name: formName, password: formPassword, role: "BROKER" }, {
            onSuccess: () => { setCreateOpen(false); resetForm(); },
          });
        }}
        saving={createMutation.isPending}
        testId="broker-slideover"
      >
        <div className="space-y-4">
          {createMutation.error ? (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              {((createMutation.error) as unknown as { message?: string })?.message ?? "Error"}
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm" />
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
