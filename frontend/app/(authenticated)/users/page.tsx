"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { SlideOver } from "@/components/forms/slide-over";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import type { User, PaginatedResponse, Role, Client, PlacementRef } from "@/types/api";

const ROLES: Role[] = ["ADMIN", "BROKER", "CONTRACTOR", "CLIENT_CONTACT"];

export default function UsersPage() {
  const { user: currentUser } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<Role>("BROKER");
  const [formClientId, setFormClientId] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const params = useMemo(() => {
    const p: Record<string, string> = { page: String(page), sort, order };
    if (search) p.search = search;
    if (roleFilter) p.role = roleFilter;
    return p;
  }, [page, search, roleFilter, sort, order]);

  const queryString = new URLSearchParams(params).toString();

  const { data, isLoading } = useApiQuery<PaginatedResponse<User>>(
    ["users", params],
    `/users?${queryString}`,
    currentUser?.role === "ADMIN"
  );

  const { data: clientsData } = useApiQuery<PaginatedResponse<Client>>(
    ["clients-for-select"],
    "/clients?per_page=200",
    slideOpen && formRole === "CLIENT_CONTACT"
  );

  const createMutation = useApiMutation<User, Record<string, unknown>>(
    "POST",
    "/users",
    [["users"]]
  );

  const updateMutation = useApiMutation<User, Record<string, unknown>>(
    "PATCH",
    (body) => `/users/${editingUser?.id}`,
    [["users"]]
  );

  if (currentUser?.role !== "ADMIN") {
    return (
      <div data-testid="users-access-denied" className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Access Denied</h2>
          <p className="mt-2 text-gray-500">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const columns: Column<User>[] = [
    { key: "full_name", label: "Name", sortable: true },
    { key: "email", label: "Email", sortable: true },
    {
      key: "role",
      label: "Role",
      sortable: true,
      render: (row) => <StatusBadge value={row.role} />,
    },
    {
      key: "current_placement" as keyof User,
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
      key: "is_active",
      label: "Active",
      render: (row) => (
        <span
          data-testid={`user-active-${row.id}`}
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            row.is_active ? "bg-green-500" : "bg-red-500"
          }`}
        />
      ),
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      render: (row) => <span>{formatDate(row.created_at)}</span>,
    },
  ];

  const resetForm = () => {
    setFormEmail("");
    setFormName("");
    setFormPassword("");
    setFormRole("BROKER");
    setFormClientId("");
    setFormIsActive(true);
    setEditingUser(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setSlideOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setFormEmail(u.email);
    setFormName(u.full_name);
    setFormPassword("");
    setFormRole(u.role);
    setFormIsActive(u.is_active);
    setSlideOpen(true);
  };

  const handleSave = () => {
    if (editingUser) {
      const body: Record<string, unknown> = { full_name: formName, email: formEmail, is_active: formIsActive };
      updateMutation.mutate(body, {
        onSuccess: () => { setSlideOpen(false); resetForm(); },
      });
    } else {
      const body: Record<string, unknown> = { email: formEmail, full_name: formName, password: formPassword, role: formRole };
      if (formRole === "CLIENT_CONTACT" && formClientId) body.client_id = formClientId;
      createMutation.mutate(body, {
        onSuccess: () => { setSlideOpen(false); resetForm(); },
      });
    }
  };

  const handleDelete = async () => {
    if (!editingUser) return;
    setDeleteOpen(false);
    setDeleteError("");
    try {
      const res = await api<{ deleted: string; message: string }>(`/users/${editingUser.id}`, { method: "DELETE" });
      if (res.deleted === "soft") {
        setDeleteMsg(res.message);
        setSlideOpen(false);
        resetForm();
      } else {
        setSlideOpen(false);
        resetForm();
      }
    } catch (err: unknown) {
      setDeleteError((err as { message?: string })?.message ?? "Failed to delete");
    }
  };

  const handleSort = (key: string, newOrder: "asc" | "desc") => {
    setSort(key);
    setOrder(newOrder);
    setPage(1);
  };

  return (
    <div data-testid="users-page" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button
          data-testid="create-user-btn"
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700"
        >
          Create User
        </button>
      </div>

      <div data-testid="users-filters" className="flex gap-3">
        <input
          data-testid="users-search-input"
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded text-sm w-64"
        />
        <select
          data-testid="users-role-filter"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div data-testid="users-loading" className="text-center py-12 text-gray-400">
          Loading...
        </div>
      ) : (
        <DataTable<User>
          testId="users-table"
          columns={columns}
          data={data?.data ?? []}
          meta={data?.meta}
          onPageChange={setPage}
          onSort={handleSort}
          sort={sort}
          order={order}
          onRowClick={(row) => handleOpenEdit(row)}
        />
      )}

      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editingUser ? "Edit User" : "Create User"}
        onSave={handleSave}
        saving={editingUser ? updateMutation.isPending : createMutation.isPending}
        testId="create-user-slideover"
      >
        <div className="space-y-4">
          <div>
            <label data-testid="field-email-label" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              data-testid="field-email"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="field-full-name-label" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              data-testid="field-full-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          {!editingUser && (
            <>
              <div>
                <label data-testid="field-password-label" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  data-testid="field-password"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div>
                <label data-testid="field-role-label" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  data-testid="field-role"
                  value={formRole}
                  onChange={(e) => {
                    setFormRole(e.target.value as Role);
                    if (e.target.value !== "CLIENT_CONTACT") setFormClientId("");
                  }}
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              {formRole === "CLIENT_CONTACT" && (
                <div>
                  <label data-testid="field-client-id-label" className="block text-sm font-medium text-gray-700 mb-1">
                    Client
                  </label>
                  <select
                    data-testid="field-client-id"
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value="">Select a client...</option>
                    {(clientsData?.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          {editingUser && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Role</span>
                <StatusBadge value={formRole} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={formIsActive} onChange={(e) => setFormIsActive(e.target.checked)} className="rounded" />
                Active
              </label>
              {editingUser.id !== currentUser?.id && (
                <div className="pt-4 border-t">
                  {deleteError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-2">{deleteError}</div>}
                  <button
                    data-testid="user-delete-btn"
                    onClick={() => setDeleteOpen(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Delete User
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </SlideOver>

      {deleteMsg && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded text-sm">
          {deleteMsg}
          <button onClick={() => setDeleteMsg("")} className="ml-2 text-amber-600 hover:text-amber-800">&times;</button>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete User"
        message={`Are you sure you want to delete ${editingUser?.full_name}? If they have existing relations, they will be deactivated instead.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
