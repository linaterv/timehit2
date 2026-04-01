"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CountrySelect } from "@/components/shared/country-select";
import { formatDate } from "@/lib/utils";
import {
  InvoiceTemplateA4, TplForm, emptyTplForm, tplToForm,
  STATUS_COLORS, TYPE_LABELS,
} from "@/components/shared/invoice-template-editor";
import type { ContractorProfile, InvoiceTemplate, Placement, PaginatedResponse } from "@/types/api";

interface ContractorFormData {
  code: string;
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
    code: "",
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
    code: p.code ?? "",
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
  const router = useRouter();
  const contractorId = params.id as string;
  const { user } = useAuth();

  const [tab, setTab] = useState<"placements" | "profile" | "templates">("placements");
  const [placementStatus, setPlacementStatus] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ContractorFormData>(emptyForm());
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  // Template state (admin only)
  const [tplShowEditor, setTplShowEditor] = useState(false);
  const [tplIsNew, setTplIsNew] = useState(false);
  const [tplEditing, setTplEditing] = useState<InvoiceTemplate | null>(null);
  const [tplForm, setTplForm] = useState<TplForm>(emptyTplForm("CONTRACTOR"));
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
  const templates = (templatesQ.data?.data ?? []).filter((t) => !!t.contractor || !!t.client);

  const globalTplQ = useApiQuery<{ data: InvoiceTemplate[] }>(
    ["invoice-templates", "global", "CONTRACTOR"],
    `/invoice-templates?template_type=CONTRACTOR&status=ACTIVE`,
    user?.role === "ADMIN"
  );
  const globalTemplates = (globalTplQ.data?.data ?? []).filter((t) => !t.contractor && !t.client);

  const placementsUrl = `/placements?contractor_id=${contractor?.user_id}&per_page=50&sort=start_date&order=desc${placementStatus ? `&status=${placementStatus}` : ""}`;
  const placementsQ = useApiQuery<PaginatedResponse<Placement>>(
    ["placements", "contractor", contractor?.user_id, placementStatus],
    placementsUrl,
    !!contractor?.user_id
  );
  const placements = placementsQ.data?.data ?? [];

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

  const handleDelete = async () => {
    setDeleteOpen(false);
    try {
      const res = await api<{ deleted: string; message: string }>(`/contractors/${contractorId}`, { method: "DELETE" });
      if (res.deleted === "soft") {
        setDeleteMsg(res.message);
      } else {
        router.push("/contractors");
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Failed to delete");
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

  const inputCls = "w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600";
  const openNewTpl = () => { setTplEditing(null); setTplIsNew(true); setTplForm({ ...emptyTplForm("CONTRACTOR"), contractor_id: contractor.user_id } as TplForm); setTplError(""); setTplShowEditor(true); };
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
        await api("/invoice-templates", { method: "POST", body: JSON.stringify({ ...tplForm, contractor_id: contractor.user_id }) });
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
  const handleTplAction = async (act: string) => {
    if (!tplEditing) return;
    try { await api(`/invoice-templates/${tplEditing.id}/${act}`, { method: "POST" }); closeTpl(); templatesQ.refetch(); }
    catch (err: unknown) { alert((err as { message?: string })?.message ?? "Failed"); }
  };
  const updateTplForm = <K extends keyof TplForm>(k: K, v: TplForm[K]) => setTplForm((p) => ({ ...p, [k]: v }));

  const disabled = !editing;

  return (
    <div data-testid="contractor-detail" className={`space-y-6 ${tplShowEditor ? "" : "max-w-3xl"}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          <span className="font-mono text-sm text-gray-400 mr-2">{contractor.code}</span>
          {contractor.full_name}
        </h2>
        <div className="flex gap-2">
          {isAdmin && !editing && (
            <button
              data-testid="contractor-delete-btn"
              onClick={() => setDeleteOpen(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
            >
              Delete
            </button>
          )}
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

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button onClick={() => setTab("placements")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "placements" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Placements
        </button>
        <button onClick={() => setTab("profile")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "profile" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Profile
        </button>
        {isAdmin && (
          <button data-testid="tab-templates" onClick={() => setTab("templates")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "templates" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            Templates
          </button>
        )}
      </div>

      {/* ── PLACEMENTS TAB ── */}
      {tab === "placements" && (
        <div className="space-y-3">
          <select
            data-testid="placements-status-filter"
            value={placementStatus}
            onChange={(e) => setPlacementStatus(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          {placementsQ.isLoading && <p className="text-sm text-gray-400 py-4 text-center">Loading...</p>}
          {!placementsQ.isLoading && placements.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No placements.</p>
          )}
          {placements.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Position</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Start</th>
                  <th className="py-2 pr-4">End</th>
                </tr>
              </thead>
              <tbody>
                {placements.map((p) => (
                  <tr key={p.id}
                    onClick={() => router.push(`/placements/${p.id}`)}
                    className="border-b hover:bg-gray-50 cursor-pointer">
                    <td className="py-2 pr-4">{p.client.company_name}</td>
                    <td className="py-2 pr-4">{p.title || "—"}</td>
                    <td className="py-2 pr-4"><StatusBadge value={p.status} /></td>
                    <td className="py-2 pr-4">{formatDate(p.start_date)}</td>
                    <td className="py-2 pr-4">{p.end_date ? formatDate(p.end_date) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <input
              data-testid="field-code"
              type="text"
              maxLength={4}
              value={form.code}
              onChange={(e) => updateField("code", e.target.value.toUpperCase())}
              disabled={disabled}
              className="w-20 border rounded-md px-3 py-2 text-sm font-mono uppercase disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
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
            <CountrySelect value={form.country} onChange={(v) => updateField("country", v)} disabled={disabled} testId="field-country" />
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

      {/* ── TEMPLATES TAB — List ── */}
      {tab === "templates" && !tplShowEditor && (
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

      {/* ── TEMPLATES TAB — A4 Editor ── */}
      {tab === "templates" && tplShowEditor && (
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

      {deleteMsg && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded text-sm">
          {deleteMsg}
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Contractor"
        message={`Are you sure you want to delete ${contractor.full_name}? If they have placements or invoices, they will be deactivated instead.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
