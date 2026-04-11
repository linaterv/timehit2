"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { api } from "@/lib/api";
import type { User, PaginatedResponse, Client } from "@/types/api";

type Tab = "details" | "clients";

interface BrokerAssignment {
  id: string;
  broker_id: string;
  client_id: string;
  client_name: string;
}

export default function BrokerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("details");

  // Edit form
  const [editing, setEditing] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // Client assignment
  const [assignClientId, setAssignClientId] = useState("");

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const allowed = currentUser?.role === "ADMIN";

  const { data: broker, isLoading } = useApiQuery<User & { broker_assignments?: BrokerAssignment[] }>(
    ["broker-detail", id],
    `/users/${id}`,
    allowed && !!id
  );

  const { data: clientsData } = useApiQuery<PaginatedResponse<Client>>(
    ["clients-for-select"],
    "/clients?per_page=200",
    allowed
  );

  const updateMutation = useApiMutation<User, Record<string, unknown>>(
    "PATCH", `/users/${id}`, [["broker-detail", id], ["brokers"], ["users"]]
  );

  if (!allowed) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Access Denied</h2>
          <p className="mt-2 text-gray-500">Only admins can manage brokers.</p>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!broker) return <div className="text-center py-12 text-gray-400">Broker not found.</div>;

  const assignments = broker.broker_assignments ?? [];
  const assignedClientIds = new Set(assignments.map((a) => a.client_id));
  const availableClients = (clientsData?.data ?? []).filter((c) => !assignedClientIds.has(c.id));

  const startEdit = () => {
    setFormName(broker.full_name);
    setFormEmail(broker.email);
    setFormIsActive(broker.is_active);
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate({ full_name: formName, email: formEmail, is_active: formIsActive }, {
      onSuccess: () => setEditing(false),
    });
  };

  const handleAssignClient = async () => {
    if (!assignClientId) return;
    try {
      await api(`/clients/${assignClientId}/brokers`, {
        method: "POST",
        body: JSON.stringify({ broker_ids: [broker.id] }),
      });
      setAssignClientId("");
      qc.invalidateQueries({ queryKey: ["broker-detail", id] });
      qc.invalidateQueries({ queryKey: ["brokers"] });
    } catch (err: unknown) {
      alert((err as { message?: string })?.message ?? "Failed to assign");
    }
  };

  const handleRemoveClient = async (clientId: string) => {
    try {
      await api(`/clients/${clientId}/brokers/${broker.id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["broker-detail", id] });
      qc.invalidateQueries({ queryKey: ["brokers"] });
    } catch (err: unknown) {
      alert((err as { message?: string })?.message ?? "Failed to remove");
    }
  };

  const handleDelete = async () => {
    setDeleteOpen(false); setDeleteError("");
    try {
      await api(`/users/${broker.id}`, { method: "DELETE" });
      router.push("/brokers");
    } catch (err: unknown) {
      setDeleteError((err as { message?: string })?.message ?? "Failed to delete");
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "details", label: "Details" },
    { key: "clients", label: `Clients (${assignments.length})` },
  ];

  return (
    <div data-testid="broker-detail-page" className="space-y-6">
      {/* Header */}
      <div className="bg-surface border rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{broker.full_name}</h1>
            <p className="text-sm text-gray-500 mt-1">{broker.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${broker.is_active ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-sm text-gray-600">{broker.is_active ? "Active" : "Inactive"}</span>
            </div>
            {assignments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {assignments.map((a) => (
                  <span key={a.client_id} className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-md font-medium">
                    {a.client_name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {broker.id !== currentUser?.id && (
              <button onClick={() => setDeleteOpen(true)}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700">Delete</button>
            )}
            {!editing && (
              <button onClick={startEdit}
                className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Edit</button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-0 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "details" && (
        <div className="bg-surface border rounded-lg p-6">
          {editing ? (
            <div className="space-y-4 max-w-md">
              {updateMutation.error ? (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                  {((updateMutation.error) as unknown as { message?: string })?.message ?? "Error"}
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
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={formIsActive} onChange={(e) => setFormIsActive(e.target.checked)} className="rounded" />
                Active
              </label>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50">
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)}
                  className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-gray-600">
              <p><span className="font-medium">Name:</span> {broker.full_name}</p>
              <p><span className="font-medium">Email:</span> {broker.email}</p>
              <p><span className="font-medium">Role:</span> Broker</p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                <span className={`inline-block w-2.5 h-2.5 rounded-full align-middle ${broker.is_active ? "bg-green-500" : "bg-red-500"}`} />{" "}
                {broker.is_active ? "Active" : "Inactive"}
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "clients" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Assigned Clients</h2>
          </div>

          {assignments.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No clients assigned.</p>
          ) : (
            <div className="border rounded-lg divide-y">
              {assignments.map((a) => (
                <div key={a.client_id} className="flex items-center justify-between px-4 py-3">
                  <button onClick={() => router.push(`/clients/${a.client_id}`)}
                    className="text-sm font-medium text-brand-600 hover:text-brand-800 hover:underline">
                    {a.client_name}
                  </button>
                  <button onClick={() => handleRemoveClient(a.client_id)}
                    className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-center">
            <select value={assignClientId} onChange={(e) => setAssignClientId(e.target.value)}
              className="flex-1 max-w-xs px-3 py-2 border rounded text-sm">
              <option value="">Select client to assign...</option>
              {availableClients.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
            <button onClick={handleAssignClient} disabled={!assignClientId}
              className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50">
              Assign
            </button>
          </div>
        </div>
      )}

      {deleteError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">{deleteError}</div>
      )}

      <ConfirmDialog
        open={deleteOpen} title="Delete Broker"
        message={`Are you sure you want to delete ${broker.full_name}?`}
        confirmLabel="Delete" destructive
        onConfirm={handleDelete} onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
