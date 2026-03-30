"use client";

import { useState, useEffect } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { SlideOver } from "@/components/forms/slide-over";
import type { ContractorProfile, InvoiceTemplate } from "@/types/api";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ACTIVE: "bg-green-50 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-400",
};

interface TemplateFormData {
  name: string;
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
  is_default: boolean;
}

function emptyTemplateForm(): TemplateFormData {
  return {
    name: "", company_name: "", registration_number: "", billing_address: "",
    country: "", default_currency: "EUR", vat_registered: false, vat_number: "",
    vat_rate_percent: "", bank_name: "", bank_account_iban: "", bank_swift_bic: "",
    invoice_series_prefix: "", next_invoice_number: 1, payment_terms_days: null,
    is_default: false,
  };
}

function templateToForm(t: InvoiceTemplate): TemplateFormData {
  return {
    name: t.name, company_name: t.company_name, registration_number: t.registration_number,
    billing_address: t.billing_address, country: t.country, default_currency: t.default_currency,
    vat_registered: t.vat_registered, vat_number: t.vat_number,
    vat_rate_percent: t.vat_rate_percent ?? "", bank_name: t.bank_name,
    bank_account_iban: t.bank_account_iban, bank_swift_bic: t.bank_swift_bic,
    invoice_series_prefix: t.invoice_series_prefix,
    next_invoice_number: t.next_invoice_number, payment_terms_days: t.payment_terms_days,
    is_default: t.is_default,
  };
}

const inputCls = "w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600";

export default function ProfilePage() {
  const { user } = useAuth();
  const profileId = user?.contractor_profile?.id;

  const [tab, setTab] = useState<"account" | "invoice">("account");

  // Account tab state
  const [acctForm, setAcctForm] = useState({ company_name: "", registration_number: "", country: "", default_currency: "EUR" });
  const [acctError, setAcctError] = useState("");
  const [acctSuccess, setAcctSuccess] = useState(false);

  // Password dialog
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  // Template slide-over state
  const [tplOpen, setTplOpen] = useState(false);
  const [tplEditing, setTplEditing] = useState<InvoiceTemplate | null>(null);
  const [tplForm, setTplForm] = useState<TemplateFormData>(emptyTemplateForm());
  const [tplError, setTplError] = useState("");
  const [tplSaving, setTplSaving] = useState(false);

  const { data: contractor, isLoading } = useApiQuery<ContractorProfile>(
    ["contractors", profileId], `/contractors/${profileId}`, !!profileId
  );

  const acctMutation = useApiMutation<ContractorProfile, Record<string, unknown>>(
    "PATCH", `/contractors/${profileId}`, [["contractors", profileId], ["contractors"]]
  );

  const templatesQ = useApiQuery<{ data: InvoiceTemplate[] }>(
    ["invoice-templates", "my"], `/invoice-templates?template_type=CONTRACTOR`, !!user
  );
  const templates = templatesQ.data?.data ?? [];

  useEffect(() => {
    if (contractor) {
      setAcctForm({
        company_name: contractor.company_name ?? "",
        registration_number: contractor.registration_number ?? "",
        country: contractor.country ?? "",
        default_currency: contractor.default_currency ?? "EUR",
      });
    }
  }, [contractor]);

  const handleAcctSave = async () => {
    setAcctError(""); setAcctSuccess(false);
    try { await acctMutation.mutateAsync(acctForm); setAcctSuccess(true); }
    catch (err: unknown) { setAcctError((err as { message?: string })?.message ?? "Failed to save"); }
  };

  const handleChangePassword = async () => {
    setPwdError(""); setPwdSuccess(false);
    if (pwdNew !== pwdConfirm) { setPwdError("Passwords do not match"); return; }
    if (!pwdNew) { setPwdError("New password is required"); return; }
    setPwdLoading(true);
    try {
      await api("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: pwdCurrent, new_password: pwdNew }) });
      setPwdSuccess(true); setPwdCurrent(""); setPwdNew(""); setPwdConfirm("");
    } catch (err: unknown) { setPwdError((err as { message?: string })?.message ?? "Failed to change password"); }
    finally { setPwdLoading(false); }
  };

  const openNewTemplate = () => {
    setTplEditing(null); setTplForm(emptyTemplateForm()); setTplError(""); setTplOpen(true);
  };
  const openEditTemplate = (t: InvoiceTemplate) => {
    setTplEditing(t); setTplForm(templateToForm(t)); setTplError(""); setTplOpen(true);
  };

  const handleTplSave = async () => {
    setTplError(""); setTplSaving(true);
    try {
      if (tplEditing) {
        await api(`/invoice-templates/${tplEditing.id}`, { method: "PATCH", body: JSON.stringify(tplForm) });
      } else {
        await api("/invoice-templates", { method: "POST", body: JSON.stringify({ ...tplForm, template_type: "CONTRACTOR" }) });
      }
      setTplOpen(false); templatesQ.refetch();
    } catch (err: unknown) { setTplError((err as { message?: string })?.message ?? "Failed to save"); }
    finally { setTplSaving(false); }
  };

  const handleTplDelete = async (t: InvoiceTemplate) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    try { await api(`/invoice-templates/${t.id}`, { method: "DELETE" }); templatesQ.refetch(); setTplOpen(false); }
    catch (err: unknown) { alert((err as { message?: string })?.message ?? "Failed to delete"); }
  };

  const handleTplAction = async (t: InvoiceTemplate, action: "activate" | "archive") => {
    try { await api(`/invoice-templates/${t.id}/${action}`, { method: "POST" }); templatesQ.refetch(); setTplOpen(false); }
    catch (err: unknown) { alert((err as { message?: string })?.message ?? `Failed to ${action}`); }
  };

  const updateTpl = <K extends keyof TemplateFormData>(k: K, v: TemplateFormData[K]) => setTplForm((p) => ({ ...p, [k]: v }));

  if (!profileId) return <div data-testid="profile-no-contractor" className="text-center py-8 text-gray-400">No contractor profile linked to your account.</div>;
  if (isLoading) return <div data-testid="profile-loading" className="text-center py-8 text-gray-400">Loading...</div>;
  if (!contractor) return <div data-testid="profile-not-found" className="text-center py-8 text-gray-400">Profile not found</div>;

  return (
    <div data-testid="profile-page" className="space-y-6 max-w-3xl">
      <h2 className="text-xl font-semibold text-gray-900">{contractor.full_name}</h2>

      {/* Subtabs */}
      <div className="flex gap-1 border-b">
        <button data-testid="tab-account" onClick={() => setTab("account")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "account" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Account
        </button>
        <button data-testid="tab-invoice" onClick={() => setTab("invoice")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "invoice" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Invoice Settings
        </button>
      </div>

      {/* ── ACCOUNT TAB ── */}
      {tab === "account" && (
        <>
          <section data-testid="section-user-info" className="bg-surface border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Personal Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <p className="text-sm text-gray-900 border rounded-md px-3 py-2 bg-gray-50">{user?.full_name ?? "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-sm text-gray-900 border rounded-md px-3 py-2 bg-gray-50">{user?.email ?? "—"}</p>
              </div>
            </div>
            <button data-testid="btn-change-password"
              onClick={() => { setPwdOpen(true); setPwdError(""); setPwdSuccess(false); setPwdCurrent(""); setPwdNew(""); setPwdConfirm(""); }}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              Change Password
            </button>
          </section>

          <section data-testid="section-company-info" className="bg-surface border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Company Info</h3>
              <button data-testid="contractor-save" onClick={handleAcctSave} disabled={acctMutation.isPending}
                className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700 disabled:opacity-50">
                {acctMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
            {acctError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{acctError}</div>}
            {acctSuccess && <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">Saved.</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input data-testid="field-company_name" type="text" value={acctForm.company_name}
                  onChange={(e) => setAcctForm((p) => ({ ...p, company_name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <input data-testid="field-registration_number" type="text" value={acctForm.registration_number}
                  onChange={(e) => setAcctForm((p) => ({ ...p, registration_number: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input data-testid="field-country" type="text" value={acctForm.country}
                  onChange={(e) => setAcctForm((p) => ({ ...p, country: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
                <input data-testid="field-default_currency" type="text" value={acctForm.default_currency}
                  onChange={(e) => setAcctForm((p) => ({ ...p, default_currency: e.target.value }))} className={inputCls} />
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── INVOICE SETTINGS TAB (Template List) ── */}
      {tab === "invoice" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Invoice Templates</h3>
            <button data-testid="btn-new-template" onClick={openNewTemplate}
              className="px-3 py-1.5 bg-brand-600 text-white rounded text-sm hover:bg-brand-700">
              New Template
            </button>
          </div>

          {templates.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No invoice templates yet. Create one to get started.</p>
          )}

          {templates.map((t) => (
            <div key={t.id} data-testid={`tpl-card-${t.id}`}
              onClick={() => openEditTemplate(t)}
              className="bg-surface border rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-brand-300 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{t.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                  {t.is_default && <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">Default</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t.company_name || "No company"} &middot; {t.invoice_series_prefix || "No prefix"} &middot; {t.country || "—"}
                </p>
              </div>
              <span className="text-gray-400 text-sm">&rsaquo;</span>
            </div>
          ))}
        </div>
      )}

      {/* ── TEMPLATE SLIDE-OVER ── */}
      <SlideOver open={tplOpen} onClose={() => setTplOpen(false)}
        title={tplEditing ? `Edit: ${tplEditing.name}` : "New Template"}
        onSave={handleTplSave} saving={tplSaving} testId="tpl-slideover">
        <div className="space-y-4">
          {tplError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{tplError}</div>}

          {/* Status actions */}
          {tplEditing && (
            <div className="flex gap-2">
              {tplEditing.status === "DRAFT" && (
                <button onClick={() => handleTplAction(tplEditing, "activate")}
                  className="px-3 py-1 text-xs font-medium rounded bg-green-50 text-green-700 hover:bg-green-100">Activate</button>
              )}
              {tplEditing.status === "ACTIVE" && (
                <button onClick={() => handleTplAction(tplEditing, "archive")}
                  className="px-3 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200">Archive</button>
              )}
              {tplEditing.status !== "ACTIVE" && (
                <button onClick={() => handleTplDelete(tplEditing)}
                  className="px-3 py-1 text-xs font-medium rounded bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
            <input type="text" value={tplForm.name} onChange={(e) => updateTpl("name", e.target.value)} className={inputCls} />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Default Template</label>
            <button type="button" role="switch" aria-checked={tplForm.is_default}
              onClick={() => updateTpl("is_default", !tplForm.is_default)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${tplForm.is_default ? "bg-brand-600" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tplForm.is_default ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <hr />
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Company</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Company Name</label>
              <input type="text" value={tplForm.company_name} onChange={(e) => updateTpl("company_name", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Reg. Number</label>
              <input type="text" value={tplForm.registration_number} onChange={(e) => updateTpl("registration_number", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Country</label>
              <input type="text" value={tplForm.country} onChange={(e) => updateTpl("country", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Currency</label>
              <input type="text" value={tplForm.default_currency} onChange={(e) => updateTpl("default_currency", e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Billing Address</label>
              <textarea value={tplForm.billing_address} onChange={(e) => updateTpl("billing_address", e.target.value)} rows={2} className={inputCls} />
            </div>
          </div>

          <hr />
          <h4 className="text-xs font-semibold text-gray-500 uppercase">VAT</h4>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-600">VAT Registered</label>
            <button type="button" role="switch" aria-checked={!!tplForm.vat_registered}
              onClick={() => updateTpl("vat_registered", !tplForm.vat_registered)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${tplForm.vat_registered ? "bg-brand-600" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tplForm.vat_registered ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">VAT Number</label>
              <input type="text" value={tplForm.vat_number} onChange={(e) => updateTpl("vat_number", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">VAT Rate (%)</label>
              <input type="text" value={tplForm.vat_rate_percent} onChange={(e) => updateTpl("vat_rate_percent", e.target.value)} className={inputCls} />
            </div>
          </div>

          <hr />
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Bank</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Bank Name</label>
              <input type="text" value={tplForm.bank_name} onChange={(e) => updateTpl("bank_name", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">IBAN</label>
              <input type="text" value={tplForm.bank_account_iban} onChange={(e) => updateTpl("bank_account_iban", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">SWIFT / BIC</label>
              <input type="text" value={tplForm.bank_swift_bic} onChange={(e) => updateTpl("bank_swift_bic", e.target.value)} className={inputCls} />
            </div>
          </div>

          <hr />
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Invoice Series</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Series Prefix</label>
              <input type="text" value={tplForm.invoice_series_prefix} onChange={(e) => updateTpl("invoice_series_prefix", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Next Number</label>
              <input type="number" value={tplForm.next_invoice_number ?? ""} onChange={(e) => updateTpl("next_invoice_number", e.target.value ? parseInt(e.target.value, 10) : null)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Payment Terms (days)</label>
              <input type="number" value={tplForm.payment_terms_days ?? ""} onChange={(e) => updateTpl("payment_terms_days", e.target.value ? parseInt(e.target.value, 10) : null)} className={inputCls} />
            </div>
          </div>
        </div>
      </SlideOver>

      {/* ── CHANGE PASSWORD DIALOG ── */}
      {pwdOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setPwdOpen(false)} />
          <div data-testid="pwd-dialog" className="relative bg-surface rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">Change Password</h3>
            {pwdError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{pwdError}</p>}
            {pwdSuccess && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">Password changed successfully.</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input data-testid="pwd-current" type="password" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input data-testid="pwd-new" type="password" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input data-testid="pwd-confirm" type="password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} className={inputCls} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPwdOpen(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
              <button data-testid="pwd-submit" onClick={handleChangePassword} disabled={pwdLoading}
                className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700 disabled:opacity-50">
                {pwdLoading ? "Changing..." : "Change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
