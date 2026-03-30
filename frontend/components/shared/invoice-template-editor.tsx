"use client";

import type { InvoiceTemplate } from "@/types/api";

// ── Types & Helpers ──

export interface TplForm {
  title: string;
  code: string;
  template_type: string;
  parent_id?: string | null;
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

export function emptyTplForm(templateType = "CONTRACTOR"): TplForm {
  return {
    title: "", code: "", template_type: templateType, parent_id: null, is_default: false,
    company_name: "", registration_number: "", billing_address: "", country: "",
    default_currency: "EUR", vat_registered: false, vat_number: "", vat_rate_percent: "",
    bank_name: "", bank_account_iban: "", bank_swift_bic: "",
    invoice_series_prefix: "", next_invoice_number: 1, payment_terms_days: null,
  };
}

export function tplToForm(t: InvoiceTemplate): TplForm {
  return {
    title: t.title, code: t.code, template_type: t.template_type,
    parent_id: t.parent_id ?? null, is_default: t.is_default,
    company_name: t.company_name, registration_number: t.registration_number,
    billing_address: t.billing_address, country: t.country, default_currency: t.default_currency,
    vat_registered: t.vat_registered, vat_number: t.vat_number,
    vat_rate_percent: t.vat_rate_percent ?? "", bank_name: t.bank_name,
    bank_account_iban: t.bank_account_iban, bank_swift_bic: t.bank_swift_bic,
    invoice_series_prefix: t.invoice_series_prefix,
    next_invoice_number: t.next_invoice_number, payment_terms_days: t.payment_terms_days,
  };
}

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ACTIVE: "bg-green-50 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-400",
};

export const TYPE_COLORS: Record<string, string> = {
  CONTRACTOR: "bg-blue-50 text-blue-700",
  CLIENT: "bg-purple-50 text-purple-700",
};

export const TYPE_LABELS: Record<string, string> = {
  CONTRACTOR: "Contractor → Agency",
  CLIENT: "Agency → Client",
};

// ── Small Components ──

export function Field({ value, onChange, placeholder, className = "", mono = false }: {
  value: string; onChange: (v: string) => void; placeholder: string; className?: string; mono?: boolean;
}) {
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={`bg-blue-50/60 border-b-2 border-brand-200 focus:border-brand-600 focus:bg-blue-50 focus:outline-none rounded-sm px-1 py-0.5 text-gray-900 placeholder:text-brand-300 ${mono ? "font-mono" : ""} ${className}`}
    />
  );
}

function Placeholder({ children, className = "", block = false }: { children: string; className?: string; block?: boolean }) {
  const cls = `text-amber-600/60 text-sm bg-amber-50 px-1 py-0.5 rounded-sm border-b border-dashed border-amber-200 ${className}`;
  return block ? <div className={cls}>{children}</div> : <span className={cls}>{children}</span>;
}

export function Legend() {
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

// ── A4 Editor Component ──

interface A4Props {
  form: TplForm;
  onChange: <K extends keyof TplForm>(key: K, value: TplForm[K]) => void;
  isNew: boolean;
  editing: InvoiceTemplate | null;
  onSave: () => void;
  onDelete: () => void;
  onAction: (action: string) => void;
  onClose: () => void;
  saving: boolean;
  error: string;
  showTypeSelector?: boolean;
  globalLabel?: string | null;
  globalTemplates?: InvoiceTemplate[];
  /** When true, contractor edits their own side (From + VAT + bank). Agency side becomes read-only. */
  contractorOwnEdit?: boolean;
  /** The selected parent/global template — used to prefill read-only side */
  parentTemplate?: InvoiceTemplate | null;
}

export function InvoiceTemplateA4({
  form, onChange, isNew, editing, onSave, onDelete, onAction, onClose,
  saving, error, showTypeSelector = true, globalLabel, globalTemplates, contractorOwnEdit = false, parentTemplate,
}: A4Props) {
  const u = onChange;
  const isContractorType = form.template_type === "CONTRACTOR";
  // When contractorOwnEdit: contractor edits From side, agency Bill To is read-only (inverted)
  const fromEditable = isContractorType ? contractorOwnEdit : !contractorOwnEdit;
  const toEditable = isContractorType ? !contractorOwnEdit : contractorOwnEdit;
  const vatEditable = contractorOwnEdit;
  const bankEditable = contractorOwnEdit || !isContractorType;
  const previewNumber = `${form.invoice_series_prefix || "???-"}${String(form.next_invoice_number ?? 1).padStart(4, "0")}`;

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onClose} className="px-3 py-1.5 border rounded text-sm">&larr; Back</button>
        <div className="flex items-center gap-2">
          <Field value={form.title} onChange={(v) => u("title", v)} placeholder="Template title" className="text-lg font-semibold w-48" />
          <Field value={form.code} onChange={(v) => u("code", v)} placeholder="CODE" className="text-xs w-20 uppercase" mono />
        </div>
        {!isNew && (
          <span className="px-2 py-1 border rounded text-xs bg-gray-50">{TYPE_LABELS[form.template_type] ?? form.template_type}</span>
        )}
        {isNew && showTypeSelector && (
          <select value={form.template_type} onChange={(e) => u("template_type", e.target.value)} className="px-2 py-1 border rounded text-xs">
            <option value="CONTRACTOR">Contractor → Agency</option>
            <option value="CLIENT">Agency → Client</option>
          </select>
        )}
        {isNew && !showTypeSelector && (
          <span className="px-2 py-1 border rounded text-xs bg-gray-50">{TYPE_LABELS[form.template_type] ?? form.template_type}</span>
        )}
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={form.is_default} onChange={(e) => u("is_default", e.target.checked)} className="rounded" />
          Default
        </label>
        {globalLabel && (
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium">
            {globalLabel}
          </span>
        )}
        {/* Based on (parent) dropdown */}
        {globalTemplates && globalTemplates.length > 0 && (
          <select
            value={form.parent_id ?? ""}
            onChange={(e) => u("parent_id", e.target.value || null)}
            className="px-2 py-1 border rounded text-xs"
          >
            <option value="">Based on: None</option>
            {globalTemplates.map((gt) => (
              <option key={gt.id} value={gt.id}>{gt.title}{gt.code ? ` (${gt.code})` : ""}</option>
            ))}
          </select>
        )}
        <div className="flex-1" />
        {editing?.status === "DRAFT" && <button onClick={() => onAction("activate")} className="px-3 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100">Activate</button>}
        {editing?.status === "ACTIVE" && <button onClick={() => onAction("archive")} className="px-3 py-1 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200">Archive</button>}
        {editing && editing.status !== "ACTIVE" && <button onClick={onDelete} className="px-3 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100">Delete</button>}
        <button onClick={onSave} disabled={saving}
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
            {fromEditable ? (
              <textarea value={form.billing_address} onChange={(e) => u("billing_address", e.target.value)}
                placeholder={isContractorType ? "Contractor company\nReg. code: ...\nVAT: ...\nAddress\nCity, Country" : "Agency name\nReg. code: ...\nVAT: ...\nAddress\nCity, Country"}
                rows={7} className="w-full bg-blue-50/60 border-2 border-brand-200 focus:border-brand-600 focus:bg-blue-50 focus:outline-none rounded px-2 py-1.5 text-sm text-gray-900 placeholder:text-brand-300 resize-none leading-relaxed" />
            ) : (
              <div className="w-full bg-amber-50 border-2 border-dashed border-amber-200 rounded px-2 py-1.5 text-sm text-amber-600/60 leading-relaxed whitespace-pre-wrap" style={{ minHeight: "calc(7 * 1.625em + 0.75rem)" }}>
                {parentTemplate?.billing_address || (isContractorType ? "Contractor info — auto-filled" : "Agency info — from global template")}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Bill To</div>
            {toEditable ? (
              <textarea value={form.billing_address} onChange={(e) => u("billing_address", e.target.value)}
                placeholder={isContractorType ? "Agency name\nReg. code: ...\nVAT: ...\nAddress\nCity, Country" : "Client company\nAddress\nCity, Country"}
                rows={7} className="w-full bg-blue-50/60 border-2 border-brand-200 focus:border-brand-600 focus:bg-blue-50 focus:outline-none rounded px-2 py-1.5 text-sm text-gray-900 placeholder:text-brand-300 resize-none leading-relaxed" />
            ) : (
              <div className="w-full bg-amber-50 border-2 border-dashed border-amber-200 rounded px-2 py-1.5 text-sm text-amber-600/60 leading-relaxed whitespace-pre-wrap" style={{ minHeight: "calc(7 * 1.625em + 0.75rem)" }}>
                {parentTemplate?.billing_address || (isContractorType ? "Agency info — from global template" : "Client info — auto-filled")}
              </div>
            )}
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
              {vatEditable ? (
                <span>VAT (<Field value={form.vat_rate_percent} onChange={(v) => u("vat_rate_percent", v)} placeholder="0" className="text-xs w-8 text-center" />%)</span>
              ) : (
                <span>VAT (<Placeholder>{parentTemplate?.vat_rate_percent ?? "auto"}</Placeholder>%)</span>
              )}
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
            {bankEditable ? (
              <textarea value={form.bank_name} onChange={(e) => u("bank_name", e.target.value)}
                placeholder={"Bank: SEB\nIBAN: LT11 2233 4455 6677 8899\nSWIFT: CBVILT2X"}
                rows={4} className="w-full bg-blue-50/60 border-2 border-brand-200 focus:border-brand-600 focus:bg-blue-50 focus:outline-none rounded px-2 py-1.5 text-sm text-gray-900 placeholder:text-brand-300 resize-none leading-relaxed font-mono" />
            ) : (
              <div className="w-full bg-amber-50 border-2 border-dashed border-amber-200 rounded px-2 py-1.5 text-sm text-amber-600/60 leading-relaxed whitespace-pre-wrap font-mono" style={{ minHeight: "calc(4 * 1.625em + 0.75rem)" }}>
                {parentTemplate?.bank_name || "Bank details — from global template"}
              </div>
            )}
          </div>
        )}

        {/* Footer bar */}
        <div className="border-t pt-4 flex items-center gap-4 text-xs text-gray-500">
          {vatEditable ? (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!form.vat_registered} onChange={(e) => u("vat_registered", e.target.checked)} className="rounded" />
              VAT Registered
            </label>
          ) : (
            <span className="text-amber-600/60">VAT: {contractorOwnEdit ? "from global template" : "from contractor"}</span>
          )}
          <span>&middot;</span>
          <span>Series: <Field value={form.invoice_series_prefix} onChange={(v) => u("invoice_series_prefix", v)} placeholder="PREFIX-" className="text-xs w-24 font-mono" mono /></span>
          <span>&middot;</span>
          <span>Next #: <input type="number" value={form.next_invoice_number ?? ""} onChange={(e) => u("next_invoice_number", e.target.value ? parseInt(e.target.value, 10) : null)} className="w-16 bg-blue-50/60 border-b-2 border-brand-200 focus:border-brand-600 focus:bg-blue-50 focus:outline-none rounded-sm text-xs font-mono text-center px-1" /></span>
          <span>&middot;</span>
          <span>Terms: <input type="number" value={form.payment_terms_days ?? ""} onChange={(e) => u("payment_terms_days", e.target.value ? parseInt(e.target.value, 10) : null)} className="w-12 bg-blue-50/60 border-b-2 border-brand-200 focus:border-brand-600 focus:bg-blue-50 focus:outline-none rounded-sm text-xs text-center px-1" /> days</span>
        </div>

        <div className="mt-8 pt-4 border-t text-xs text-gray-300">
          Invoice {previewNumber} | Generated by TimeHit Platform
        </div>
      </div>
    </>
  );
}
