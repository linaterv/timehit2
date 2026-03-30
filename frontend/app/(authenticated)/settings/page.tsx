"use client";

import { useState } from "react";
import { useApiQuery } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { SlideOver } from "@/components/forms/slide-over";
import { StatusBadge } from "@/components/shared/status-badge";
import type { InvoiceTemplate, InvoiceTemplateType, PaginatedResponse } from "@/types/api";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ACTIVE: "bg-green-50 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-400",
};

const TYPE_COLORS: Record<string, string> = {
  CONTRACTOR: "bg-blue-50 text-blue-700",
  CLIENT: "bg-purple-50 text-purple-700",
  AGENCY: "bg-amber-50 text-amber-700",
};

const inputCls = "w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600";

interface TplForm {
  title: string;
  code: string;
  template_type: string;
  contractor_id?: string;
  client_id?: string;
  is_default: boolean;
  company_name: string;
  registration_number: string;
  billing_address: string;
  country: string;
  default_currency: string;
  vat_registered: boolean | null;
  vat_number: string;
  vat_rate_percent: string;
  bank_name: string;
  bank_account_iban: string;
  bank_swift_bic: string;
  invoice_series_prefix: string;
  next_invoice_number: number | null;
  payment_terms_days: number | null;
}

function emptyForm(): TplForm {
  return {
    title: "", code: "", template_type: "CONTRACTOR", is_default: false,
    company_name: "", registration_number: "", billing_address: "", country: "",
    default_currency: "EUR", vat_registered: false, vat_number: "", vat_rate_percent: "",
    bank_name: "", bank_account_iban: "", bank_swift_bic: "",
    invoice_series_prefix: "", next_invoice_number: 1, payment_terms_days: null,
  };
}

function tplToForm(t: InvoiceTemplate): TplForm {
  return {
    title: t.title, code: t.code, template_type: t.template_type, is_default: t.is_default,
    company_name: t.company_name, registration_number: t.registration_number,
    billing_address: t.billing_address, country: t.country, default_currency: t.default_currency,
    vat_registered: t.vat_registered, vat_number: t.vat_number,
    vat_rate_percent: t.vat_rate_percent ?? "", bank_name: t.bank_name,
    bank_account_iban: t.bank_account_iban, bank_swift_bic: t.bank_swift_bic,
    invoice_series_prefix: t.invoice_series_prefix,
    next_invoice_number: t.next_invoice_number, payment_terms_days: t.payment_terms_days,
  };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [tplOpen, setTplOpen] = useState(false);
  const [tplEditing, setTplEditing] = useState<InvoiceTemplate | null>(null);
  const [tplForm, setTplForm] = useState<TplForm>(emptyForm());
  const [tplError, setTplError] = useState("");
  const [tplSaving, setTplSaving] = useState(false);

  const qParams = [
    typeFilter && `template_type=${typeFilter}`,
    statusFilter && `status=${statusFilter}`,
  ].filter(Boolean).join("&");
  const templatesQ = useApiQuery<{ data: InvoiceTemplate[] }>(
    ["invoice-templates", "all", typeFilter, statusFilter],
    `/invoice-templates${qParams ? `?${qParams}` : ""}`,
    !!user
  );
  const templates = templatesQ.data?.data ?? [];

  const openNew = () => { setTplEditing(null); setTplForm(emptyForm()); setTplError(""); setTplOpen(true); };
  const openEdit = (t: InvoiceTemplate) => { setTplEditing(t); setTplForm(tplToForm(t)); setTplError(""); setTplOpen(true); };

  const handleSave = async () => {
    setTplError(""); setTplSaving(true);
    try {
      if (tplEditing) {
        const { template_type: _tt, ...rest } = tplForm;
        await api(`/invoice-templates/${tplEditing.id}`, { method: "PATCH", body: JSON.stringify(rest) });
      } else {
        await api("/invoice-templates", { method: "POST", body: JSON.stringify(tplForm) });
      }
      setTplOpen(false); templatesQ.refetch();
    } catch (err: unknown) { setTplError((err as { message?: string })?.message ?? "Failed to save"); }
    finally { setTplSaving(false); }
  };

  const handleDelete = async (t: InvoiceTemplate) => {
    if (!confirm(`Delete template "${t.title}"?`)) return;
    try { await api(`/invoice-templates/${t.id}`, { method: "DELETE" }); templatesQ.refetch(); setTplOpen(false); }
    catch (err: unknown) { alert((err as { message?: string })?.message ?? "Failed"); }
  };

  const handleAction = async (t: InvoiceTemplate, action: string) => {
    try { await api(`/invoice-templates/${t.id}/${action}`, { method: "POST" }); templatesQ.refetch(); setTplOpen(false); }
    catch (err: unknown) { alert((err as { message?: string })?.message ?? "Failed"); }
  };

  const updateForm = <K extends keyof TplForm>(k: K, v: TplForm[K]) => setTplForm((p) => ({ ...p, [k]: v }));

  if (user?.role !== "ADMIN") {
    return <div className="text-center py-8 text-gray-400">Admin access required.</div>;
  }

  return (
    <div data-testid="settings-page" className="space-y-6 max-w-5xl">
      <h2 className="text-xl font-semibold text-gray-900">Settings</h2>

      {/* Subtabs */}
      <div className="flex gap-1 border-b">
        <button data-testid="tab-invoice-templates"
          className="px-4 py-2 text-sm font-medium border-b-2 -mb-px border-brand-600 text-brand-600">
          Invoice Templates
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border rounded text-sm">
          <option value="">All Types</option>
          <option value="CONTRACTOR">Contractor</option>
          <option value="CLIENT">Client</option>
          <option value="AGENCY">Agency</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded text-sm">
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <div className="flex-1" />
        <button data-testid="btn-new-template" onClick={openNew}
          className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700">
          New Template
        </button>
      </div>

      {/* Template list */}
      {templates.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">No templates found.</p>
      )}

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} onClick={() => openEdit(t)}
            className="bg-surface border rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-brand-300 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900">{t.title}</span>
                {t.code && <span className="text-xs text-gray-400 font-mono">{t.code}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[t.template_type]}`}>{t.template_type}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                {t.is_default && <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">Default</span>}
              </div>
              <p className="text-xs text-gray-500 mt-1 truncate">
                {t.contractor?.full_name || t.client?.company_name || "No owner"}
                {" · "}{t.company_name || "No company"}{" · "}{t.invoice_series_prefix || "No prefix"}
              </p>
            </div>
            <span className="text-gray-400 text-sm ml-2">&rsaquo;</span>
          </div>
        ))}
      </div>

      {/* Slide-over */}
      <SlideOver open={tplOpen} onClose={() => setTplOpen(false)}
        title={tplEditing ? `Edit: ${tplEditing.title}` : "New Template"}
        onSave={handleSave} saving={tplSaving} testId="tpl-slideover">
        <div className="space-y-4">
          {tplError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{tplError}</div>}

          {/* Status actions */}
          {tplEditing && (
            <div className="flex gap-2">
              {tplEditing.status === "DRAFT" && (
                <button onClick={() => handleAction(tplEditing, "activate")}
                  className="px-3 py-1 text-xs font-medium rounded bg-green-50 text-green-700 hover:bg-green-100">Activate</button>
              )}
              {tplEditing.status === "ACTIVE" && (
                <button onClick={() => handleAction(tplEditing, "archive")}
                  className="px-3 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200">Archive</button>
              )}
              {tplEditing.status !== "ACTIVE" && (
                <button onClick={() => handleDelete(tplEditing)}
                  className="px-3 py-1 text-xs font-medium rounded bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
              )}
            </div>
          )}

          {/* Identity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={tplForm.title} onChange={(e) => updateForm("title", e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Code</label>
              <input type="text" value={tplForm.code} onChange={(e) => updateForm("code", e.target.value)} className={inputCls} placeholder="e.g. DEFAULT, LT, EN" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Type</label>
              {tplEditing ? (
                <p className="text-sm text-gray-900 border rounded-md px-3 py-2 bg-gray-50">{tplForm.template_type}</p>
              ) : (
                <select value={tplForm.template_type} onChange={(e) => updateForm("template_type", e.target.value)} className={inputCls}>
                  <option value="CONTRACTOR">Contractor</option>
                  <option value="CLIENT">Client</option>
                  <option value="AGENCY">Agency</option>
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Default Template</label>
            <button type="button" role="switch" aria-checked={tplForm.is_default}
              onClick={() => updateForm("is_default", !tplForm.is_default)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${tplForm.is_default ? "bg-brand-600" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tplForm.is_default ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <hr />
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Company</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Company Name</label>
              <input type="text" value={tplForm.company_name} onChange={(e) => updateForm("company_name", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Reg. Number</label>
              <input type="text" value={tplForm.registration_number} onChange={(e) => updateForm("registration_number", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Country</label>
              <input type="text" value={tplForm.country} onChange={(e) => updateForm("country", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Currency</label>
              <input type="text" value={tplForm.default_currency} onChange={(e) => updateForm("default_currency", e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Billing Address</label>
              <textarea value={tplForm.billing_address} onChange={(e) => updateForm("billing_address", e.target.value)} rows={2} className={inputCls} />
            </div>
          </div>

          <hr />
          <h4 className="text-xs font-semibold text-gray-500 uppercase">VAT</h4>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-600">VAT Registered</label>
            <button type="button" role="switch" aria-checked={!!tplForm.vat_registered}
              onClick={() => updateForm("vat_registered", !tplForm.vat_registered)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${tplForm.vat_registered ? "bg-brand-600" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tplForm.vat_registered ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">VAT Number</label>
              <input type="text" value={tplForm.vat_number} onChange={(e) => updateForm("vat_number", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">VAT Rate (%)</label>
              <input type="text" value={tplForm.vat_rate_percent} onChange={(e) => updateForm("vat_rate_percent", e.target.value)} className={inputCls} />
            </div>
          </div>

          <hr />
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Bank</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Bank Name</label>
              <input type="text" value={tplForm.bank_name} onChange={(e) => updateForm("bank_name", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">IBAN</label>
              <input type="text" value={tplForm.bank_account_iban} onChange={(e) => updateForm("bank_account_iban", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">SWIFT / BIC</label>
              <input type="text" value={tplForm.bank_swift_bic} onChange={(e) => updateForm("bank_swift_bic", e.target.value)} className={inputCls} />
            </div>
          </div>

          <hr />
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Invoice Series</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Series Prefix</label>
              <input type="text" value={tplForm.invoice_series_prefix} onChange={(e) => updateForm("invoice_series_prefix", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Next Number</label>
              <input type="number" value={tplForm.next_invoice_number ?? ""} onChange={(e) => updateForm("next_invoice_number", e.target.value ? parseInt(e.target.value, 10) : null)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Payment Terms (days)</label>
              <input type="number" value={tplForm.payment_terms_days ?? ""} onChange={(e) => updateForm("payment_terms_days", e.target.value ? parseInt(e.target.value, 10) : null)} className={inputCls} />
            </div>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
