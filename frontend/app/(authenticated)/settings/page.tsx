"use client";

import { useState } from "react";
import { useApiQuery } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import type { InvoiceTemplate } from "@/types/api";

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

interface TplForm {
  title: string;
  code: string;
  template_type: string;
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

/* Editable field — blue tinted background so user knows it's writable */
function Field({ value, onChange, placeholder, className = "", mono = false }: {
  value: string; onChange: (v: string) => void; placeholder: string; className?: string; mono?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-blue-50/60 border-b-2 border-brand-200 focus:border-brand-600 focus:bg-blue-50 focus:outline-none rounded-sm px-1 py-0.5 text-gray-900 placeholder:text-brand-300 ${mono ? "font-mono" : ""} ${className}`}
    />
  );
}

/* Read-only placeholder — amber/yellow tint, clearly not editable */
function Placeholder({ children, className = "", block = false }: { children: string; className?: string; block?: boolean }) {
  const cls = `text-amber-600/60 text-sm bg-amber-50 px-1 py-0.5 rounded-sm border-b border-dashed border-amber-200 ${className}`;
  return block ? <div className={cls}>{children}</div> : <span className={cls}>{children}</span>;
}

/* Legend shown above the A4 page */
function Legend() {
  return (
    <div className="flex items-center gap-6 text-xs text-gray-500 px-1">
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-4 h-3 bg-blue-50/60 border-b-2 border-brand-200 rounded-sm" />
        Editable — saved to template
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-4 h-3 bg-amber-50 border-b border-dashed border-amber-200 rounded-sm" />
        Auto-filled at generation time
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<InvoiceTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<TplForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const qParams = [typeFilter && `template_type=${typeFilter}`, statusFilter && `status=${statusFilter}`].filter(Boolean).join("&");
  const templatesQ = useApiQuery<{ data: InvoiceTemplate[] }>(
    ["invoice-templates", "all", typeFilter, statusFilter],
    `/invoice-templates${qParams ? `?${qParams}` : ""}`, !!user
  );
  const templates = templatesQ.data?.data ?? [];

  const openNew = () => { setEditing(null); setIsNew(true); setForm(emptyForm()); setError(""); };
  const openEdit = (t: InvoiceTemplate) => { setEditing(t); setIsNew(false); setForm(tplToForm(t)); setError(""); };
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
  const isContractorType = form.template_type === "CONTRACTOR";
  const previewNumber = `${form.invoice_series_prefix || "???-"}${String(form.next_invoice_number ?? 1).padStart(4, "0")}`;

  return (
    <div data-testid="settings-page" className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Settings</h2>

      <div className="flex gap-1 border-b">
        <button data-testid="tab-invoice-templates"
          className="px-4 py-2 text-sm font-medium border-b-2 -mb-px border-brand-600 text-brand-600">
          Invoice Templates
        </button>
      </div>

      {!showEditor ? (
        /* ── TEMPLATE LIST ── */
        <>
          <div className="flex items-center gap-3">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 border rounded text-sm">
              <option value="">All Types</option>
              <option value="CONTRACTOR">Contractor</option>
              <option value="CLIENT">Client</option>
              <option value="AGENCY">Agency</option>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[t.template_type]}`}>{t.template_type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                    {t.is_default && <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">Default</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {t.contractor?.full_name || t.client?.company_name || "No owner"}{" · "}{t.company_name || "No company"}
                  </p>
                </div>
                <span className="text-gray-400">&rsaquo;</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* ── A4 INVOICE EDITOR ── */
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={close} className="px-3 py-1.5 border rounded text-sm">&larr; Back</button>
            <div className="flex items-center gap-2">
              <Field value={form.title} onChange={(v) => u("title", v)} placeholder="Template title" className="text-lg font-semibold w-48" />
              <Field value={form.code} onChange={(v) => u("code", v)} placeholder="CODE" className="text-xs w-20 uppercase" mono />
            </div>
            {!isNew && (
              <select value={form.template_type} disabled className="px-2 py-1 border rounded text-xs bg-gray-50">{["CONTRACTOR","CLIENT","AGENCY"].map((t)=><option key={t}>{t}</option>)}</select>
            )}
            {isNew && (
              <select value={form.template_type} onChange={(e) => u("template_type", e.target.value)} className="px-2 py-1 border rounded text-xs">
                <option value="CONTRACTOR">Contractor → Agency</option>
                <option value="CLIENT">Agency → Client</option>
                <option value="AGENCY">Agency (internal)</option>
              </select>
            )}
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={form.is_default} onChange={(e) => u("is_default", e.target.checked)} className="rounded" />
              Default
            </label>
            <div className="flex-1" />
            {editing?.status === "DRAFT" && <button onClick={() => handleAction("activate")} className="px-3 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100">Activate</button>}
            {editing?.status === "ACTIVE" && <button onClick={() => handleAction("archive")} className="px-3 py-1 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200">Archive</button>}
            {editing && editing.status !== "ACTIVE" && <button onClick={handleDelete} className="px-3 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100">Delete</button>}
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</div>}

          <Legend />

          {/* A4 Page */}
          <div className="mx-auto bg-white border shadow-sm rounded" style={{ width: 680, minHeight: 960, padding: "48px 48px 32px" }}>

            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="text-3xl font-bold text-gray-900 tracking-tight">INVOICE</div>
                <div className="mt-2 space-y-0.5 text-sm text-gray-600">
                  <div>No: <span className="font-mono text-gray-400">{previewNumber}</span></div>
                  <div>Date: <Placeholder>issue date</Placeholder></div>
                  <div>Due: <Placeholder>{form.payment_terms_days ? `+${form.payment_terms_days} days` : "due date"}</Placeholder></div>
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="text-gray-400 font-medium">DRAFT</div>
                <div className="text-gray-300 text-xs mt-1">{form.template_type} INVOICE</div>
              </div>
            </div>

            {/* From / To */}
            <div className="grid grid-cols-2 gap-8 mb-10">
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">From</div>
                <textarea
                  value={form.billing_address}
                  onChange={(e) => u("billing_address", e.target.value)}
                  placeholder={"Company name\nReg. code: 123456789\nVAT: LT100001234\nAddress line 1\nCity, Country\nEmail / website"}
                  rows={7}
                  className="w-full bg-blue-50/60 border-2 border-brand-200 focus:border-brand-600 focus:bg-blue-50 focus:outline-none rounded px-2 py-1.5 text-sm text-gray-900 placeholder:text-brand-300 resize-none leading-relaxed"
                />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Bill To</div>
                <div className="w-full bg-amber-50 border-2 border-dashed border-amber-200 rounded px-2 py-1.5 text-sm text-amber-600/60 leading-relaxed" style={{ minHeight: "calc(7 * 1.625em + 0.75rem)" }}>
                  Recipient company name<br />
                  Reg. code: auto-filled<br />
                  VAT: auto-filled<br />
                  Recipient address<br />
                  City, Country
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="mb-8">
              <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-500 uppercase border-b pb-2">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-right">Hours</div>
                <div className="col-span-2 text-right">Rate</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>
              <div className="grid grid-cols-12 gap-2 py-3 text-sm text-amber-600/60 border-b">
                <div className="col-span-6">Consulting — contractor — month year</div>
                <div className="col-span-2 text-right">0.00</div>
                <div className="col-span-2 text-right">0.00 <Field value={form.default_currency} onChange={(v) => u("default_currency", v)} placeholder="EUR" className="text-xs w-10 text-center" /></div>
                <div className="col-span-2 text-right">0.00</div>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-10">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <Placeholder>{`0.00 ${form.default_currency || "EUR"}`}</Placeholder>
                </div>
                <div className="flex justify-between text-gray-500 items-center">
                  <span>VAT (<Field value={form.vat_rate_percent} onChange={(v) => u("vat_rate_percent", v)} placeholder="0" className="text-xs w-8 text-center" />%)</span>
                  <Placeholder>0.00</Placeholder>
                </div>
                <div className="flex justify-between font-bold text-gray-900 border-t pt-1 text-base">
                  <span>Total</span>
                  <Placeholder className="font-bold">{`0.00 ${form.default_currency || "EUR"}`}</Placeholder>
                </div>
              </div>
            </div>

            {/* Payment Details (contractor type) */}
            {isContractorType && (
              <div className="border-t pt-6 mb-6">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Payment Details</div>
                <div className="space-y-1 text-sm">
                  <div className="flex gap-2 items-center">
                    <span className="text-gray-500 w-12 text-xs">Bank:</span>
                    <Field value={form.bank_name} onChange={(v) => u("bank_name", v)} placeholder="Bank name" className="text-sm flex-1" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-gray-500 w-12 text-xs">IBAN:</span>
                    <Field value={form.bank_account_iban} onChange={(v) => u("bank_account_iban", v)} placeholder="IBAN" className="text-sm flex-1 font-mono" mono />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-gray-500 w-12 text-xs">SWIFT:</span>
                    <Field value={form.bank_swift_bic} onChange={(v) => u("bank_swift_bic", v)} placeholder="SWIFT/BIC" className="text-sm w-40 font-mono" mono />
                  </div>
                </div>
              </div>
            )}

            {/* VAT toggle */}
            <div className="border-t pt-4 flex items-center gap-4 text-xs text-gray-500">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={!!form.vat_registered} onChange={(e) => u("vat_registered", e.target.checked)} className="rounded" />
                VAT Registered
              </label>
              <span>&middot;</span>
              <span>Series: <Field value={form.invoice_series_prefix} onChange={(v) => u("invoice_series_prefix", v)} placeholder="PREFIX-" className="text-xs w-24 font-mono" mono /></span>
              <span>&middot;</span>
              <span>Next #: <input type="number" value={form.next_invoice_number ?? ""} onChange={(e) => u("next_invoice_number", e.target.value ? parseInt(e.target.value, 10) : null)} className="w-16 bg-blue-50/60 border-b-2 border-brand-200 focus:border-brand-600 focus:bg-blue-50 focus:outline-none rounded-sm text-xs font-mono text-center px-1" /></span>
              <span>&middot;</span>
              <span>Terms: <input type="number" value={form.payment_terms_days ?? ""} onChange={(e) => u("payment_terms_days", e.target.value ? parseInt(e.target.value, 10) : null)} className="w-12 bg-blue-50/60 border-b-2 border-brand-200 focus:border-brand-600 focus:bg-blue-50 focus:outline-none rounded-sm text-xs text-center px-1" /> days</span>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t text-xs text-gray-300">
              Invoice {previewNumber} | Generated by TimeHit Platform
            </div>
          </div>
        </>
      )}
    </div>
  );
}
