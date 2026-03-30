"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { apiUpload, api } from "@/lib/api";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CircleAlert } from "lucide-react";
import { FileUpload } from "@/components/shared/file-upload";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import type {
  Placement,
  PlacementDocument,
  Timesheet,
  PaginatedResponse,
  ApprovalFlow,
} from "@/types/api";

type Tab = "timesheets" | "documents" | "settings";

interface SettingsForm {
  approval_flow: ApprovalFlow;
  require_timesheet_attachment: boolean;
  client_can_view_invoices: boolean;
  client_can_view_documents: boolean;
  payment_terms_client_days: number | null;
  payment_terms_contractor_days: number | null;
  notes: string;
}

export default function PlacementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("timesheets");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [docLabel, setDocLabel] = useState("");
  const [tsCreateOpen, setTsCreateOpen] = useState(false);
  const [tsCreateYear, setTsCreateYear] = useState(new Date().getFullYear());
  const [tsCreateMonth, setTsCreateMonth] = useState(new Date().getMonth() + 1);
  const [tsCreateError, setTsCreateError] = useState("");

  // ---- Data fetching ----
  const placementQ = useApiQuery<Placement>(
    ["placement", id],
    `/placements/${id}`
  );
  const timesheetsQ = useApiQuery<PaginatedResponse<Timesheet>>(
    ["placement-timesheets", id],
    `/placements/${id}/timesheets`,
    tab === "timesheets"
  );
  const documentsQ = useApiQuery<PaginatedResponse<PlacementDocument>>(
    ["placement-documents", id],
    `/placements/${id}/documents`,
    tab === "documents"
  );

  const placement = placementQ.data;

  // ---- Mutations ----
  const activateMut = useApiMutation<Placement, void>(
    "POST",
    `/placements/${id}/activate`,
    [["placement", id]]
  );
  const completeMut = useApiMutation<Placement, void>(
    "POST",
    `/placements/${id}/complete`,
    [["placement", id]]
  );
  const cancelMut = useApiMutation<Placement, void>(
    "POST",
    `/placements/${id}/cancel`,
    [["placement", id]]
  );
  const copyMut = useApiMutation<Placement, void>(
    "POST",
    `/placements/${id}/copy`
  );
  const deleteMut = useApiMutation<void, void>(
    "DELETE",
    `/placements/${id}`,
    [["placements"]]
  );
  const settingsMut = useApiMutation<Placement, Partial<SettingsForm>>(
    "PATCH",
    `/placements/${id}`,
    [["placement", id]]
  );

  // ---- Settings form ----
  const [settings, setSettings] = useState<SettingsForm | null>(null);

  const initSettings = useCallback(() => {
    if (placement && !settings) {
      setSettings({
        approval_flow: placement.approval_flow,
        require_timesheet_attachment: placement.require_timesheet_attachment,
        client_can_view_invoices: placement.client_can_view_invoices,
        client_can_view_documents: placement.client_can_view_documents,
        payment_terms_client_days: placement.payment_terms_client_days,
        payment_terms_contractor_days: placement.payment_terms_contractor_days,
        notes: placement.notes,
      });
    }
  }, [placement, settings]);

  // Initialize settings when switching to tab
  if (tab === "settings" && placement && !settings) {
    initSettings();
  }

  // ---- Handlers ----
  const handleActivate = () => activateMut.mutate(undefined as never);
  const handleComplete = () => completeMut.mutate(undefined as never);
  const handleCancel = () => cancelMut.mutate(undefined as never);
  const handleCopy = async () => {
    const created = await copyMut.mutateAsync(undefined as never);
    router.push(`/placements/${created.id}`);
  };
  const handleDelete = () => {
    deleteMut.mutate(undefined as never, {
      onSuccess: () => router.push("/placements"),
    });
  };

  const handleDocUpload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("label", docLabel || file.name);
    await apiUpload(`/placements/${id}/documents`, fd);
    setDocLabel("");
    qc.invalidateQueries({ queryKey: ["placement-documents", id] });
  };

  const handleDocDelete = async (docId: string) => {
    await api(`/placements/${id}/documents/${docId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["placement-documents", id] });
  };

  const handleSettingsSave = () => {
    if (!settings) return;
    settingsMut.mutate(settings);
  };

  // ---- Create Timesheet ----
  const isContractor = user?.role === "CONTRACTOR";
  const ownsPlacement = isContractor && placement?.contractor.id === user?.id;
  const canCreateTs = ownsPlacement && placement?.status === "ACTIVE";

  const isFutureMonth = (() => {
    const now = new Date();
    return tsCreateYear > now.getFullYear() || (tsCreateYear === now.getFullYear() && tsCreateMonth > now.getMonth() + 1);
  })();

  const handleCreateTimesheet = async (year?: number, month?: number) => {
    const y = year ?? tsCreateYear;
    const m = month ?? tsCreateMonth;
    setTsCreateError("");
    try {
      const res = await api<Timesheet>(`/placements/${id}/timesheets`, {
        method: "POST",
        body: JSON.stringify({ year: y, month: m }),
      });
      setTsCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["placement-timesheets", id] });
      qc.invalidateQueries({ queryKey: ["timesheets-pending"] });
      router.push(`/timesheets/${res.id}`);
    } catch (err: any) {
      setTsCreateError(err?.message || "Failed to create timesheet");
    }
  };

  // ---- Loading / Error ----
  if (placementQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading...
      </div>
    );
  }

  if (!placement) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Placement not found
      </div>
    );
  }

  const isDraft = placement.status === "DRAFT";
  const isActive = placement.status === "ACTIVE";
  const isAdminOrBroker = user?.role === "ADMIN" || user?.role === "BROKER";
  const canEditSettings = (isDraft || isActive) && isAdminOrBroker;
  const canManagePlacement = isAdminOrBroker;
  const canUploadDocs = isAdminOrBroker;
  const timesheets = timesheetsQ.data?.data ?? [];
  const documents = documentsQ.data?.data ?? [];

  const TABS: { key: Tab; label: string; show: boolean }[] = [
    { key: "timesheets", label: "Timesheets", show: true },
    { key: "documents", label: "Documents", show: true },
    { key: "settings", label: "Settings", show: canEditSettings },
  ];

  return (
    <div data-testid="placement-detail" className="space-y-6">
      {/* Header Card */}
      <div className="bg-surface border rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold">
                {placement.client.company_name} &rarr; {placement.title || placement.contractor.full_name}
              </h1>
              <StatusBadge value={placement.status} />
            </div>
            {placement.title && (
              <p className="text-sm text-gray-500">{placement.contractor.full_name}</p>
            )}
          </div>
          <div className="flex gap-2">
            {canManagePlacement && isDraft && (
              <>
                <button
                  data-testid="placement-activate-btn"
                  onClick={handleActivate}
                  disabled={activateMut.isPending}
                  className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  Activate
                </button>
                <button
                  data-testid="placement-delete-btn"
                  onClick={() => setConfirmDelete(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  Delete
                </button>
              </>
            )}
            {canManagePlacement && isActive && (
              <>
                <button
                  data-testid="placement-complete-btn"
                  onClick={handleComplete}
                  disabled={completeMut.isPending}
                  className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  Complete
                </button>
                <button
                  data-testid="placement-cancel-btn"
                  onClick={handleCancel}
                  disabled={cancelMut.isPending}
                  className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  data-testid="placement-copy-btn"
                  onClick={handleCopy}
                  disabled={copyMut.isPending}
                  className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Copy
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block">{isContractor ? "End Client" : "Client"}</span>
            <span className="font-medium">
              {placement.client.company_name}
            </span>
          </div>
          {!isContractor && (
            <div>
              <span className="text-gray-500 block">Contractor</span>
              <span className="font-medium">
                {placement.contractor.full_name}
              </span>
            </div>
          )}
          {placement.title && (
            <div>
              <span className="text-gray-500 block">Position</span>
              <span className="font-medium">{placement.title}</span>
            </div>
          )}
          {isAdminOrBroker && placement.client_rate && (
            <div>
              <span className="text-gray-500 block">Rates</span>
              <span className={isActive ? "font-medium text-gray-400" : "font-medium"}>
                {formatCurrency(placement.client_rate, placement.currency)} /{" "}
                {formatCurrency(placement.contractor_rate, placement.currency)}{" "}
                {placement.currency}
              </span>
            </div>
          )}
          {!isContractor && (
            <div>
              <span className="text-gray-500 block">Approval Flow</span>
              <span className="font-medium">
                {placement.approval_flow.replace(/_/g, " ")}
              </span>
            </div>
          )}
          <div>
            <span className="text-gray-500 block">Start Date</span>
            <span className="font-medium">
              {formatDate(placement.start_date)}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">End Date</span>
            <span className="font-medium">
              {formatDate(placement.end_date)}
            </span>
          </div>
          {isAdminOrBroker && (placement.payment_terms_client_days != null || placement.payment_terms_contractor_days != null) && (
            <>
              {placement.payment_terms_client_days != null && (
                <div>
                  <span className="text-gray-500 block">Client Payment Terms</span>
                  <span className="font-medium">{placement.payment_terms_client_days} days</span>
                </div>
              )}
              {placement.payment_terms_contractor_days != null && (
                <div>
                  <span className="text-gray-500 block">Contractor Payment Terms</span>
                  <span className="font-medium">{placement.payment_terms_contractor_days} days</span>
                </div>
              )}
            </>
          )}
        </div>
        {canManagePlacement && (isDraft || isActive) && (
          <div className="mt-4 pt-4 border-t">
            <button
              data-testid="placement-edit-btn"
              onClick={() => { setTab("settings"); initSettings(); }}
              className="text-sm text-brand-600 hover:underline"
            >
              Edit placement settings...
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {TABS.filter((t) => t.show).map((t) => (
            <button
              key={t.key}
              data-testid={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}

      {/* Timesheets Tab */}
      {tab === "timesheets" && (
        <div data-testid="tab-content-timesheets">
          {canCreateTs && (() => {
            const now = new Date();
            const curY = now.getFullYear(), curM = now.getMonth() + 1;
            const lastM = curM === 1 ? 12 : curM - 1;
            const lastY = curM === 1 ? curY - 1 : curY;
            const tsMap = new Map(timesheets.map((t) => [`${t.year}-${t.month}`, t]));
            const curTs = tsMap.get(`${curY}-${curM}`);
            const lastTs = tsMap.get(`${lastY}-${lastM}`);
            const curNeedsAction = !curTs || curTs.status === "DRAFT" || curTs.status === "REJECTED";
            const lastNeedsAction = !lastTs || lastTs.status === "DRAFT" || lastTs.status === "REJECTED";
            // Check placement range includes last/this month
            const pStart = new Date(placement.start_date + "T00:00:00");
            const pEnd = placement.end_date ? new Date(placement.end_date + "T00:00:00") : new Date(2099, 0);
            const lastInRange = new Date(lastY, lastM - 1) >= new Date(pStart.getFullYear(), pStart.getMonth()) && new Date(lastY, lastM - 1) <= new Date(pEnd.getFullYear(), pEnd.getMonth());
            const curInRange = new Date(curY, curM - 1) >= new Date(pStart.getFullYear(), pStart.getMonth()) && new Date(curY, curM - 1) <= new Date(pEnd.getFullYear(), pEnd.getMonth());

            return (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  data-testid="ts-create-btn"
                  onClick={() => { setTsCreateOpen(true); setTsCreateError(""); }}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded text-sm hover:bg-gray-50"
                >
                  Create Timesheet...
                </button>
                {lastInRange && lastNeedsAction && (
                  <button
                    onClick={() => lastTs ? router.push(`/timesheets/${lastTs.id}`) : handleCreateTimesheet(lastY, lastM)}
                    className="px-3 py-2 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 flex items-center gap-1"
                  >
                    <CircleAlert size={14} />
                    Late ! {lastTs ? "Edit" : "Create"} Last Month TS
                    <CircleAlert size={14} />
                  </button>
                )}
                {curInRange && curNeedsAction && (
                  <button
                    onClick={() => curTs ? router.push(`/timesheets/${curTs.id}`) : handleCreateTimesheet(curY, curM)}
                    className="px-3 py-2 rounded text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-1"
                  >
                    {curTs ? "Edit" : "Create"} This Month TS
                  </button>
                )}
              </div>
            );
          })()}
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Period
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Hours
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-gray-200">
                {timesheets.map((ts) => (
                  <tr
                    key={ts.id}
                    data-testid={`ts-row-${ts.id}`}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/timesheets/${ts.id}`)}
                  >
                    <td className="px-4 py-3 text-sm">
                      {formatMonth(ts.year, ts.month)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge value={ts.status} />
                    </td>
                    <td className="px-4 py-3 text-sm">{ts.total_hours}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/timesheets/${ts.id}`);
                        }}
                        className="text-brand-600 hover:underline text-sm"
                      >
                        {ts.status === "DRAFT" || ts.status === "REJECTED" ? "Edit" : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
                {timesheets.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-gray-400 text-sm"
                    >
                      No timesheets
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {tab === "documents" && (
        <div data-testid="tab-content-documents" className="space-y-4">
          {canUploadDocs && (
            <>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Label
                  </label>
                  <input
                    data-testid="doc-label-input"
                    type="text"
                    value={docLabel}
                    onChange={(e) => setDocLabel(e.target.value)}
                    placeholder="Document label (optional)"
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                  />
                </div>
              </div>
              <FileUpload onUpload={handleDocUpload} />
            </>
          )}

          <div className="border rounded-lg divide-y">
            {documents.map((doc) => (
              <div
                key={doc.id}
                data-testid={`doc-row-${doc.id}`}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{doc.label || doc.file_name}</p>
                  <p className="text-xs text-gray-500">
                    {doc.file_name} &middot;{" "}
                    {(doc.file_size_bytes / 1024).toFixed(1)} KB &middot;{" "}
                    Uploaded {formatDate(doc.uploaded_at)} by{" "}
                    {doc.uploaded_by.full_name}
                  </p>
                </div>
                {canUploadDocs && (
                  <button
                    data-testid={`doc-delete-${doc.id}`}
                    onClick={() => handleDocDelete(doc.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
            {documents.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                No documents uploaded
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && canEditSettings && settings && (
        <div data-testid="tab-content-settings" className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Approval Flow
            </label>
            <select
              data-testid="setting-approval-flow"
              value={settings.approval_flow}
              onChange={(e) =>
                setSettings({ ...settings, approval_flow: e.target.value as ApprovalFlow })
              }
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            >
              <option value="BROKER_ONLY">Broker Only</option>
              <option value="CLIENT_THEN_BROKER">Client Then Broker</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                data-testid="setting-require-attachment"
                type="checkbox"
                checked={settings.require_timesheet_attachment}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    require_timesheet_attachment: e.target.checked,
                  })
                }
              />
              <span className="text-sm">Require timesheet attachment</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                data-testid="setting-client-invoices"
                type="checkbox"
                checked={settings.client_can_view_invoices}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    client_can_view_invoices: e.target.checked,
                  })
                }
              />
              <span className="text-sm">Client can view invoices</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                data-testid="setting-client-documents"
                type="checkbox"
                checked={settings.client_can_view_documents}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    client_can_view_documents: e.target.checked,
                  })
                }
              />
              <span className="text-sm">Client can view documents</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Payment Terms (days)
              </label>
              <input
                data-testid="setting-payment-terms-client"
                type="number"
                value={settings.payment_terms_client_days ?? ""}
                onChange={(e) =>
                  setSettings({ ...settings, payment_terms_client_days: e.target.value ? parseInt(e.target.value, 10) : null })
                }
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contractor Payment Terms (days)
              </label>
              <input
                data-testid="setting-payment-terms-contractor"
                type="number"
                value={settings.payment_terms_contractor_days ?? ""}
                onChange={(e) =>
                  setSettings({ ...settings, payment_terms_contractor_days: e.target.value ? parseInt(e.target.value, 10) : null })
                }
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              data-testid="setting-notes"
              value={settings.notes}
              onChange={(e) =>
                setSettings({ ...settings, notes: e.target.value })
              }
              rows={4}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <button
            data-testid="settings-save-btn"
            onClick={handleSettingsSave}
            disabled={settingsMut.isPending}
            className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {settingsMut.isPending ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete Placement"
        message="Are you sure you want to delete this placement? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Create Timesheet Dialog */}
      {tsCreateOpen && placement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setTsCreateOpen(false)} />
          <div data-testid="ts-create-dialog" className="relative bg-surface rounded-lg shadow-lg max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="p-6 pb-3">
              <h3 className="text-lg font-semibold mb-1">Create Timesheet</h3>
              <p className="text-sm text-gray-500">Select a month to create a timesheet for</p>
              {tsCreateError && <p className="text-sm text-red-600 mt-2">{tsCreateError}</p>}
            </div>
            <div className="px-6 overflow-y-auto space-y-1">
              {(() => {
                const pStart = new Date(placement.start_date + "T00:00:00");
                const pEnd = placement.end_date ? new Date(placement.end_date + "T00:00:00") : new Date();
                const now = new Date();
                const tsMap = new Map<string, { status: string; id: string }>();
                for (const ts of (timesheetsQ.data?.data ?? [])) {
                  tsMap.set(`${ts.year}-${ts.month}`, { status: ts.status, id: ts.id });
                }
                const months: { year: number; month: number; status: string | null; tsId: string | null }[] = [];
                let y = pStart.getFullYear(), m = pStart.getMonth() + 1;
                const endYM = pEnd.getFullYear() * 12 + pEnd.getMonth();
                while (y * 12 + (m - 1) <= endYM) {
                  const key = `${y}-${m}`;
                  const existing = tsMap.get(key);
                  months.push({ year: y, month: m, status: existing?.status ?? null, tsId: existing?.id ?? null });
                  if (m === 12) { y++; m = 1; } else { m++; }
                }
                // Reverse to show most recent first
                months.reverse();

                const statusColors: Record<string, string> = {
                  DRAFT: "text-gray-500 bg-gray-100",
                  SUBMITTED: "text-blue-600 bg-blue-50",
                  CLIENT_APPROVED: "text-green-600 bg-green-50",
                  APPROVED: "text-green-700 bg-green-50",
                  REJECTED: "text-red-600 bg-red-50",
                };

                return months.map((item) => {
                  const isMissing = item.status === null;
                  const isCurrent = item.year === now.getFullYear() && item.month === now.getMonth() + 1;
                  const isFuture = item.year > now.getFullYear() || (item.year === now.getFullYear() && item.month > now.getMonth() + 1);
                  const monthName = formatMonth(item.year, item.month);

                  return (
                    <div key={`${item.year}-${item.month}`}
                      className={`flex items-center justify-between px-3 py-2 rounded ${
                        isMissing ? "hover:bg-brand-50 cursor-pointer border border-dashed border-gray-300" : "bg-gray-50 opacity-70"
                      } ${isCurrent ? "ring-2 ring-brand-600/30" : ""}`}
                      onClick={() => {
                        if (isMissing) {
                          handleCreateTimesheet(item.year, item.month);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${isMissing ? "font-medium text-gray-900" : "text-gray-400"}`}>{monthName}</span>
                        {isCurrent && <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">current</span>}
                        {isFuture && isMissing && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">future</span>}
                      </div>
                      {isMissing ? (
                        <span className="text-xs font-medium text-brand-600">+ Create</span>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[item.status!] || "text-gray-500 bg-gray-100"}`}>
                          {item.status!.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
            <div className="flex justify-end p-6 pt-3">
              <button onClick={() => setTsCreateOpen(false)} className="px-4 py-2 border rounded text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
