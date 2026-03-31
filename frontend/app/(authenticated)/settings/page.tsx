"use client";

import { useState, useEffect } from "react";
import { useApiQuery } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import {
  InvoiceTemplateA4, TplForm, emptyTplForm, tplToForm,
  STATUS_COLORS, TYPE_COLORS, TYPE_LABELS,
} from "@/components/shared/invoice-template-editor";
import type { InvoiceTemplate } from "@/types/api";

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"templates" | "placement">("templates");

  // Placement settings
  const [plClientDays, setPlClientDays] = useState(30);
  const [plContrDays, setPlContrDays] = useState(35);
  const [plSaving, setPlSaving] = useState(false);
  const [plSaved, setPlSaved] = useState(false);

  const agencyQ = useApiQuery<{ default_payment_terms_client_days: number; default_payment_terms_contractor_days: number }>(
    ["agency-settings"], "/agency-settings"
  );
  useEffect(() => {
    if (agencyQ.data) {
      setPlClientDays(agencyQ.data.default_payment_terms_client_days);
      setPlContrDays(agencyQ.data.default_payment_terms_contractor_days);
    }
  }, [agencyQ.data]);

  const handlePlSave = async () => {
    setPlSaving(true); setPlSaved(false);
    try {
      await api("/agency-settings", {
        method: "PATCH",
        body: JSON.stringify({
          default_payment_terms_client_days: plClientDays,
          default_payment_terms_contractor_days: plContrDays,
        }),
      });
      setPlSaved(true);
      agencyQ.refetch();
    } catch { /* ignore */ }
    finally { setPlSaving(false); }
  };

  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<InvoiceTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<TplForm>(emptyTplForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const qParams = [typeFilter && `template_type=${typeFilter}`, statusFilter && `status=${statusFilter}`].filter(Boolean).join("&");
  const templatesQ = useApiQuery<{ data: InvoiceTemplate[] }>(
    ["invoice-templates", "all", typeFilter, statusFilter],
    `/invoice-templates${qParams ? `?${qParams}` : ""}`, !!user
  );
  const allTemplates = templatesQ.data?.data ?? [];
  const templates = allTemplates.filter((t) => !t.contractor && !t.client);

  const openNew = () => { setEditing(null); setIsNew(true); setForm(emptyTplForm()); setError(""); };
  const openEdit = async (t: InvoiceTemplate) => {
    setError("");
    try {
      const detail = await api<InvoiceTemplate>(`/invoice-templates/${t.id}`);
      setEditing(detail); setIsNew(false); setForm(tplToForm(detail));
    } catch { setEditing(t); setIsNew(false); setForm(tplToForm(t)); }
  };
  const close = () => { setEditing(null); setIsNew(false); };

  const handleSave = async () => {
    setError(""); setSaving(true);
    try {
      if (editing) {
        const { template_type: _tt, ...rest } = form;
        await api(`/invoice-templates/${editing.id}`, { method: "PATCH", body: JSON.stringify(rest) });
      } else {
        await api("/invoice-templates", { method: "POST", body: JSON.stringify(form) });
      }
      close(); templatesQ.refetch();
    } catch (err: unknown) { setError((err as { message?: string })?.message ?? "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!editing || !confirm(`Delete "${editing.title}"?`)) return;
    try { await api(`/invoice-templates/${editing.id}`, { method: "DELETE" }); close(); templatesQ.refetch(); }
    catch (err: unknown) { alert((err as { message?: string })?.message ?? "Failed"); }
  };

  const handleAction = async (action: string) => {
    if (!editing) return;
    try { await api(`/invoice-templates/${editing.id}/${action}`, { method: "POST" }); close(); templatesQ.refetch(); }
    catch (err: unknown) { alert((err as { message?: string })?.message ?? "Failed"); }
  };

  const u = <K extends keyof TplForm>(k: K, v: TplForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  if (user?.role !== "ADMIN") return <div className="text-center py-8 text-gray-400">Admin access required.</div>;

  const showEditor = isNew || editing;

  return (
    <div data-testid="settings-page" className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Settings</h2>

      <div className="flex gap-1 border-b">
        <button data-testid="tab-invoice-templates"
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "templates" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Invoice Templates
        </button>
        <button data-testid="tab-placement-settings"
          onClick={() => setActiveTab("placement")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "placement" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Placement Defaults
        </button>
      </div>

      {activeTab === "placement" && (
        <div className="max-w-md space-y-4">
          <p className="text-sm text-gray-500">Default payment terms applied to new placements.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Payment Terms (days)</label>
            <input type="number" value={plClientDays}
              onChange={(e) => { setPlClientDays(parseInt(e.target.value, 10) || 0); setPlSaved(false); }}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Payment Terms (days)</label>
            <input type="number" value={plContrDays}
              onChange={(e) => { setPlContrDays(parseInt(e.target.value, 10) || 0); setPlSaved(false); }}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handlePlSave} disabled={plSaving}
              className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700 disabled:opacity-50">
              {plSaving ? "Saving..." : "Save"}
            </button>
            {plSaved && <span className="text-sm text-green-600">Saved</span>}
          </div>
        </div>
      )}

      {activeTab === "templates" && !showEditor ? (
        <>
          <div className="flex items-center gap-3">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 border rounded text-sm">
              <option value="">All Types</option>
              <option value="CONTRACTOR">Contractor → Agency</option>
              <option value="CLIENT">Agency → Client</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded text-sm">
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <div className="flex-1" />
            <button data-testid="btn-new-template" onClick={openNew}
              className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700">New Template</button>
          </div>

          {templates.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">No templates found.</p>}

          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} onClick={() => openEdit(t)}
                className="bg-surface border rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-brand-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{t.title}</span>
                    {t.code && <span className="text-xs text-gray-400 font-mono">{t.code}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[t.template_type]}`}>{TYPE_LABELS[t.template_type] ?? t.template_type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                    {t.is_default && <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">Default</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Global</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{t.company_name || "No company"}</p>
                </div>
                <button onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const r = await fetch(`/api/v1/invoice-templates/${t.id}/sample-pdf`);
                    const blob = await r.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    const name = (t.title || "template").replace(/[^a-zA-Z0-9]/g, "_");
                    const d = new Date(); const ts = `${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}${String(d.getSeconds()).padStart(2,"0")}`;
                    a.href = url; a.download = `prev_svd_${name}_${ts}.pdf`; a.click(); URL.revokeObjectURL(url);
                  } catch { alert("Failed"); }
                }} className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-500 hover:bg-gray-50 shrink-0">PDF Preview</button>
                <span className="text-gray-400">&rsaquo;</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {activeTab === "templates" && showEditor && (
        <InvoiceTemplateA4
          form={form} onChange={u} isNew={isNew} editing={editing}
          onSave={handleSave} onDelete={handleDelete} onAction={handleAction} onClose={close}
          saving={saving} error={error}
          globalLabel={`Global — shared with all ${form.template_type === "CONTRACTOR" ? "contractors" : "clients"}`}
        />
      )}
    </div>
  );
}
