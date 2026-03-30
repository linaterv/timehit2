"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { SlideOver } from "@/components/forms/slide-over";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";
import type { ContractorProfile, InvoiceTemplate, Placement, PaginatedResponse } from "@/types/api";

interface ContractorFormData {
  company_name: string;
  registration_number: string;
  country: string;
  default_currency: string;
  vat_registered: boolean;
  vat_number: string;
  vat_rate_percent: string;
  bank_name: string;
  bank_account_iban: string;
  bank_swift_bic: string;
  invoice_series_prefix: string;
  next_invoice_number: number;
  payment_terms_days: number | null;
  billing_address: string;
}

function emptyForm(): ContractorFormData {
  return {
    company_name: "",
    registration_number: "",
    country: "",
    default_currency: "EUR",
    vat_registered: false,
    vat_number: "",
    vat_rate_percent: "",
    bank_name: "",
    bank_account_iban: "",
    bank_swift_bic: "",
    invoice_series_prefix: "",
    next_invoice_number: 1,
    payment_terms_days: null,
    billing_address: "",
  };
}

function profileToForm(p: ContractorProfile): ContractorFormData {
  return {
    company_name: p.company_name ?? "",
    registration_number: p.registration_number ?? "",
    country: p.country ?? "",
    default_currency: p.default_currency ?? "EUR",
    vat_registered: p.vat_registered ?? false,
    vat_number: p.vat_number ?? "",
    vat_rate_percent: p.vat_rate_percent ?? "",
    bank_name: p.bank_name ?? "",
    bank_account_iban: p.bank_account_iban ?? "",
    bank_swift_bic: p.bank_swift_bic ?? "",
    invoice_series_prefix: p.invoice_series_prefix ?? "",
    next_invoice_number: p.next_invoice_number ?? 1,
    payment_terms_days: p.payment_terms_days,
    billing_address: p.billing_address ?? "",
  };
}

export default function ContractorDetailPage() {
  const params = useParams();
  const contractorId = params.id as string;
  const { user } = useAuth();

  const [tab, setTab] = useState<"profile" | "templates">("profile");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ContractorFormData>(emptyForm());
  const [error, setError] = useState("");

  // Template state (admin only)
  const [tplOpen, setTplOpen] = useState(false);
  const [tplEditing, setTplEditing] = useState<InvoiceTemplate | null>(null);
  const [tplForm, setTplForm] = useState<Record<string, unknown>>({});
  const [tplError, setTplError] = useState("");
  const [tplSaving, setTplSaving] = useState(false);

  const { data: contractor, isLoading } = useApiQuery<ContractorProfile>(
    ["contractors", contractorId],
    `/contractors/${contractorId}`,
    !!contractorId
  );

  const templatesQ = useApiQuery<{ data: InvoiceTemplate[] }>(
    ["invoice-templates", "contractor", contractorId],
    `/invoice-templates?template_type=CONTRACTOR&contractor_id=${contractor?.user_id}`,
    !!contractor?.user_id && user?.role === "ADMIN"
  );
  const templates = templatesQ.data?.data ?? [];

  const mutation = useApiMutation<ContractorProfile, ContractorFormData>(
    "PATCH",
    `/contractors/${contractorId}`,
    [["contractors", contractorId], ["contractors"]]
  );

  useEffect(() => {
    if (contractor) {
      setForm(profileToForm(contractor));
    }
  }, [contractor]);

  const isAdmin = user?.role === "ADMIN";
  const isOwnProfile = user?.role === "CONTRACTOR" && user.contractor_profile?.id === contractorId;
  const canEdit = isAdmin || isOwnProfile;

  const handleSave = async () => {
    setError("");
    try {
      await mutation.mutateAsync(form);
      setEditing(false);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message ?? "Failed to save");
    }
  };

  const updateField = <K extends keyof ContractorFormData>(key: K, value: ContractorFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div data-testid="contractor-detail-loading" className="text-center py-8 text-gray-400">
        Loading...
      </div>
    );
  }

  if (!contractor) {
    return (
      <div data-testid="contractor-detail-not-found" className="text-center py-8 text-gray-400">
        Contractor not found
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-600", ACTIVE: "bg-green-50 text-green-700", ARCHIVED: "bg-gray-100 text-gray-400" };
  const inputCls = "w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600";
  const openNewTpl = () => { setTplEditing(null); setTplForm({ title: "", code: "", template_type: "CONTRACTOR", contractor_id: contractor.user_id }); setTplError(""); setTplOpen(true); };
  const openEditTpl = (t: InvoiceTemplate) => { setTplEditing(t); setTplForm({ title: t.title, code: t.code, company_name: t.company_name, registration_number: t.registration_number, billing_address: t.billing_address, country: t.country, default_currency: t.default_currency, vat_registered: t.vat_registered, vat_number: t.vat_number, vat_rate_percent: t.vat_rate_percent ?? "", bank_name: t.bank_name, bank_account_iban: t.bank_account_iban, bank_swift_bic: t.bank_swift_bic, invoice_series_prefix: t.invoice_series_prefix, next_invoice_number: t.next_invoice_number, payment_terms_days: t.payment_terms_days, is_default: t.is_default }); setTplError(""); setTplOpen(true); };
  const handleTplSave = async () => { setTplError(""); setTplSaving(true); try { if (tplEditing) { await api(`/invoice-templates/${tplEditing.id}`, { method: "PATCH", body: JSON.stringify(tplForm) }); } else { await api("/invoice-templates", { method: "POST", body: JSON.stringify(tplForm) }); } setTplOpen(false); templatesQ.refetch(); } catch (err: unknown) { setTplError((err as { message?: string })?.message ?? "Failed to save"); } finally { setTplSaving(false); } };
  const handleTplDelete = async (t: InvoiceTemplate) => { if (!confirm(`Delete "${t.title}"?`)) return; try { await api(`/invoice-templates/${t.id}`, { method: "DELETE" }); templatesQ.refetch(); setTplOpen(false); } catch (err: unknown) { alert((err as { message?: string })?.message ?? "Failed"); } };
  const handleTplAction = async (t: InvoiceTemplate, act: string) => { try { await api(`/invoice-templates/${t.id}/${act}`, { method: "POST" }); templatesQ.refetch(); setTplOpen(false); } catch (err: unknown) { alert((err as { message?: string })?.message ?? "Failed"); } };

  const disabled = !editing;

  return (
    <div data-testid="contractor-detail" className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">{contractor.full_name}</h2>
        <div className="flex gap-2">
          {canEdit && !editing && (
            <button
              data-testid="contractor-edit-btn"
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
            >
              Edit
            </button>
          )}
          {editing && (
            <>
              <button
                data-testid="contractor-cancel-btn"
                onClick={() => {
                  setEditing(false);
                  setForm(profileToForm(contractor));
                  setError("");
                }}
                className="px-4 py-2 border rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                data-testid="contractor-save"
                onClick={handleSave}
                disabled={mutation.isPending}
                className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {mutation.isPending ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs (admin sees Templates tab) */}
      {isAdmin && (
        <div className="flex gap-1 border-b">
          <button onClick={() => setTab("profile")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "profile" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            Profile
          </button>
          <button data-testid="tab-templates" onClick={() => setTab("templates")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "templates" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            Templates
          </button>
        </div>
      )}

      {tab === "profile" && (<>
      {error && (
        <div data-testid="contractor-error" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Company Info */}
      <section data-testid="section-company-info" className="bg-surface border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Company Info</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              data-testid="field-company_name"
              type="text"
              value={form.company_name}
              onChange={(e) => updateField("company_name", e.target.value)}
              disabled={disabled}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
            <input
              data-testid="field-registration_number"
              type="text"
              value={form.registration_number}
              onChange={(e) => updateField("registration_number", e.target.value)}
              disabled={disabled}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input
              data-testid="field-country"
              type="text"
              value={form.country}
              onChange={(e) => updateField("country", e.target.value)}
              disabled={disabled}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
            <input
              data-testid="field-default_currency"
              type="text"
              value={form.default_currency}
              onChange={(e) => updateField("default_currency", e.target.value)}
              disabled={disabled}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
        </div>
      </section>

      {/* VAT */}
      <section data-testid="section-vat" className="bg-surface border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">VAT</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">VAT Registered</label>
            <button
              data-testid="field-vat_registered"
              type="button"
              role="switch"
              aria-checked={form.vat_registered}
              onClick={() => !disabled && updateField("vat_registered", !form.vat_registered)}
              disabled={disabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.vat_registered ? "bg-brand-600" : "bg-gray-300"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.vat_registered ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
            <input
              data-testid="field-vat_number"
              type="text"
              value={form.vat_number}
              onChange={(e) => updateField("vat_number", e.target.value)}
              disabled={disabled}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VAT Rate (%)</label>
            <input
              data-testid="field-vat_rate_percent"
              type="text"
              value={form.vat_rate_percent}
              onChange={(e) => updateField("vat_rate_percent", e.target.value)}
              disabled={disabled}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
        </div>
      </section>

      {/* Bank */}
      <section data-testid="section-bank" className="bg-surface border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Bank</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
            <input
              data-testid="field-bank_name"
              type="text"
              value={form.bank_name}
              onChange={(e) => updateField("bank_name", e.target.value)}
              disabled={disabled}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
            <input
              data-testid="field-bank_account_iban"
              type="text"
              value={form.bank_account_iban}
              onChange={(e) => updateField("bank_account_iban", e.target.value)}
              disabled={disabled}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SWIFT / BIC</label>
            <input
              data-testid="field-bank_swift_bic"
              type="text"
              value={form.bank_swift_bic}
              onChange={(e) => updateField("bank_swift_bic", e.target.value)}
              disabled={disabled}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
        </div>
      </section>

      {/* Invoice Settings */}
      <section data-testid="section-invoice-settings" className="bg-surface border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Invoice Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Series Prefix</label>
            <input
              data-testid="field-invoice_series_prefix"
              type="text"
              value={form.invoice_series_prefix}
              onChange={(e) => updateField("invoice_series_prefix", e.target.value)}
              disabled={disabled}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next Invoice Number</label>
            <input
              data-testid="field-next_invoice_number"
              type="number"
              value={form.next_invoice_number}
              onChange={(e) => updateField("next_invoice_number", parseInt(e.target.value, 10) || 1)}
              disabled={disabled}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms (days)</label>
            <input
              data-testid="field-payment_terms_days"
              type="number"
              value={form.payment_terms_days ?? ""}
              onChange={(e) =>
                updateField("payment_terms_days", e.target.value ? parseInt(e.target.value, 10) : null)
              }
              disabled={disabled}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
            <textarea
              data-testid="field-billing_address"
              value={form.billing_address}
              onChange={(e) => updateField("billing_address", e.target.value)}
              disabled={disabled}
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
        </div>
      </section>
      </>)}

      {/* ── TEMPLATES TAB ── */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Invoice Templates</h3>
            <button data-testid="btn-new-template" onClick={openNewTpl}
              className="px-3 py-1.5 bg-brand-600 text-white rounded text-sm hover:bg-brand-700">New Template</button>
          </div>
          {templates.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No templates.</p>}
          {templates.map((t) => (
            <div key={t.id} onClick={() => openEditTpl(t)}
              className="bg-surface border rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-brand-300 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{t.title}</span>
                  {t.code && <span className="text-xs text-gray-400 font-mono">{t.code}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                  {t.is_default && <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">Default</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">{t.company_name || "No company"} &middot; {t.invoice_series_prefix || "No prefix"}</p>
              </div>
              <span className="text-gray-400 text-sm">&rsaquo;</span>
            </div>
          ))}
        </div>
      )}

      {/* Template Slide-Over */}
      <SlideOver open={tplOpen} onClose={() => setTplOpen(false)}
        title={tplEditing ? `Edit: ${tplEditing.title}` : "New Template"}
        onSave={handleTplSave} saving={tplSaving} testId="tpl-slideover">
        <div className="space-y-4">
          {tplError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{tplError}</div>}
          {tplEditing && (
            <div className="flex gap-2">
              {tplEditing.status === "DRAFT" && <button onClick={() => handleTplAction(tplEditing, "activate")} className="px-3 py-1 text-xs font-medium rounded bg-green-50 text-green-700 hover:bg-green-100">Activate</button>}
              {tplEditing.status === "ACTIVE" && <button onClick={() => handleTplAction(tplEditing, "archive")} className="px-3 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200">Archive</button>}
              {tplEditing.status !== "ACTIVE" && <button onClick={() => handleTplDelete(tplEditing)} className="px-3 py-1 text-xs font-medium rounded bg-red-50 text-red-600 hover:bg-red-100">Delete</button>}
            </div>
          )}
          {["title", "code", "company_name", "registration_number", "country", "default_currency", "billing_address", "vat_number", "vat_rate_percent", "bank_name", "bank_account_iban", "bank_swift_bic", "invoice_series_prefix"].map((f) => (
            <div key={f}>
              <label className="block text-xs text-gray-600 mb-1">{f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</label>
              {f === "billing_address" ? (
                <textarea value={String(tplForm[f] ?? "")} onChange={(e) => setTplForm((p) => ({ ...p, [f]: e.target.value }))} rows={2} className={inputCls} />
              ) : (
                <input type="text" value={String(tplForm[f] ?? "")} onChange={(e) => setTplForm((p) => ({ ...p, [f]: e.target.value }))} className={inputCls} />
              )}
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Next Number</label>
              <input type="number" value={String(tplForm.next_invoice_number ?? "")} onChange={(e) => setTplForm((p) => ({ ...p, next_invoice_number: e.target.value ? parseInt(e.target.value, 10) : null }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Payment Terms</label>
              <input type="number" value={String(tplForm.payment_terms_days ?? "")} onChange={(e) => setTplForm((p) => ({ ...p, payment_terms_days: e.target.value ? parseInt(e.target.value, 10) : null }))} className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-600">Default</label>
            <button type="button" role="switch" aria-checked={!!tplForm.is_default}
              onClick={() => setTplForm((p) => ({ ...p, is_default: !p.is_default }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${tplForm.is_default ? "bg-brand-600" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tplForm.is_default ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
