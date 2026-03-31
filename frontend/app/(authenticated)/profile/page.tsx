"use client";

import { useState, useEffect } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import {
  InvoiceTemplateA4, TplForm, emptyTplForm, tplToForm, STATUS_COLORS,
} from "@/components/shared/invoice-template-editor";
import type { ContractorProfile, InvoiceTemplate } from "@/types/api";

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
  useEffect(() => {
    if (!pwdOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setPwdOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pwdOpen]);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  // Template A4 editor state
  const [tplShowEditor, setTplShowEditor] = useState(false);
  const [tplIsNew, setTplIsNew] = useState(false);
  const [tplEditing, setTplEditing] = useState<InvoiceTemplate | null>(null);
  const [tplForm, setTplForm] = useState<TplForm>(emptyTplForm("CONTRACTOR"));
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
  const templates = (templatesQ.data?.data ?? []).filter((t) => !!t.contractor || !!t.client);

  const globalTplQ = useApiQuery<{ data: InvoiceTemplate[] }>(
    ["invoice-templates", "global", "CONTRACTOR"],
    `/invoice-templates?template_type=CONTRACTOR&status=ACTIVE`,
    !!user
  );
  const globalTemplates = (globalTplQ.data?.data ?? []).filter((t) => !t.contractor && !t.client);

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

  // Template handlers
  const openNewTpl = () => { setTplEditing(null); setTplIsNew(true); setTplForm(emptyTplForm("CONTRACTOR")); setTplError(""); setTplShowEditor(true); };
  const openEditTpl = async (t: InvoiceTemplate) => {
    setTplError("");
    try {
      const detail = await api<InvoiceTemplate>(`/invoice-templates/${t.id}`);
      setTplEditing(detail); setTplIsNew(false); setTplForm(tplToForm(detail));
    } catch { setTplEditing(t); setTplIsNew(false); setTplForm(tplToForm(t)); }
    setTplShowEditor(true);
  };
  const closeTpl = () => { setTplShowEditor(false); setTplEditing(null); setTplIsNew(false); };
  const handleTplSave = async () => {
    setTplError(""); setTplSaving(true);
    try {
      if (tplEditing) {
        const { template_type: _tt, ...rest } = tplForm;
        await api(`/invoice-templates/${tplEditing.id}`, { method: "PATCH", body: JSON.stringify(rest) });
      } else {
        await api("/invoice-templates", { method: "POST", body: JSON.stringify({ ...tplForm, template_type: "CONTRACTOR" }) });
      }
      closeTpl(); templatesQ.refetch();
    } catch (err: unknown) { setTplError((err as { message?: string })?.message ?? "Failed to save"); }
    finally { setTplSaving(false); }
  };
  const handleTplDelete = async () => {
    if (!tplEditing || !confirm(`Delete "${tplEditing.title}"?`)) return;
    try { await api(`/invoice-templates/${tplEditing.id}`, { method: "DELETE" }); closeTpl(); templatesQ.refetch(); }
    catch (err: unknown) { alert((err as { message?: string })?.message ?? "Failed"); }
  };
  const handleTplAction = async (action: string) => {
    if (!tplEditing) return;
    try { await api(`/invoice-templates/${tplEditing.id}/${action}`, { method: "POST" }); closeTpl(); templatesQ.refetch(); }
    catch (err: unknown) { alert((err as { message?: string })?.message ?? "Failed"); }
  };
  const updateTplForm = <K extends keyof TplForm>(k: K, v: TplForm[K]) => setTplForm((p) => ({ ...p, [k]: v }));

  if (!profileId) return <div data-testid="profile-no-contractor" className="text-center py-8 text-gray-400">No contractor profile linked to your account.</div>;
  if (isLoading) return <div data-testid="profile-loading" className="text-center py-8 text-gray-400">Loading...</div>;
  if (!contractor) return <div data-testid="profile-not-found" className="text-center py-8 text-gray-400">Profile not found</div>;

  return (
    <div data-testid="profile-page" className={`space-y-6 ${tplShowEditor ? "" : "max-w-3xl"}`}>
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

      {/* ── INVOICE SETTINGS TAB — Template List ── */}
      {tab === "invoice" && !tplShowEditor && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Invoice Templates</h3>
            <button data-testid="btn-new-template" onClick={openNewTpl}
              className="px-3 py-1.5 bg-brand-600 text-white rounded text-sm hover:bg-brand-700">
              New Template
            </button>
          </div>

          {templates.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No invoice templates yet. Create one to get started.</p>
          )}

          {templates.map((t) => (
            <div key={t.id} data-testid={`tpl-card-${t.id}`}
              onClick={() => openEditTpl(t)}
              className="bg-surface border rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-brand-300 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{t.title}</span>
                  {t.code && <span className="text-xs text-gray-400 font-mono">{t.code}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                  {t.is_default && <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">Default</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t.company_name || "No company"} &middot; {t.invoice_series_prefix || "No prefix"}
                </p>
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
              <span className="text-gray-400 text-sm">&rsaquo;</span>
            </div>
          ))}
        </div>
      )}

      {/* ── INVOICE SETTINGS TAB — A4 Editor ── */}
      {tab === "invoice" && tplShowEditor && (
        <InvoiceTemplateA4
          form={tplForm} onChange={updateTplForm} isNew={tplIsNew} editing={tplEditing}
          onSave={handleTplSave} onDelete={handleTplDelete} onAction={handleTplAction} onClose={closeTpl}
          saving={tplSaving} error={tplError}
          showTypeSelector={false}
          globalTemplates={globalTemplates}
          contractorOwnEdit
          parentTemplate={globalTemplates.find((g) => g.id === (tplForm.parent_id ?? tplEditing?.parent_id)) ?? null}
        />
      )}

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
