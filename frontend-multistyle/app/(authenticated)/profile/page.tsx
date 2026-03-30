"use client";

import { useState, useEffect } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import type { ContractorProfile } from "@/types/api";

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

export default function ProfilePage() {
  const { user } = useAuth();
  const profileId = user?.contractor_profile?.id;

  const [form, setForm] = useState<ContractorFormData>(emptyForm());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { data: contractor, isLoading } = useApiQuery<ContractorProfile>(
    ["contractors", profileId],
    `/contractors/${profileId}`,
    !!profileId
  );

  const mutation = useApiMutation<ContractorProfile, ContractorFormData>(
    "PATCH",
    `/contractors/${profileId}`,
    [["contractors", profileId], ["contractors"]]
  );

  useEffect(() => {
    if (contractor) {
      setForm(profileToForm(contractor));
    }
  }, [contractor]);

  const updateField = <K extends keyof ContractorFormData>(key: K, value: ContractorFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setError("");
    setSuccess(false);
    try {
      await mutation.mutateAsync(form);
      setSuccess(true);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message ?? "Failed to save");
    }
  };

  if (!profileId) {
    return (
      <div data-testid="profile-no-contractor" className="text-center py-8 text-gray-400">
        No contractor profile linked to your account.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div data-testid="profile-loading" className="text-center py-8 text-gray-400">
        Loading...
      </div>
    );
  }

  if (!contractor) {
    return (
      <div data-testid="profile-not-found" className="text-center py-8 text-gray-400">
        Profile not found
      </div>
    );
  }

  return (
    <div data-testid="profile-page" className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">{contractor.full_name}</h2>
        <button
          data-testid="contractor-save"
          onClick={handleSave}
          disabled={mutation.isPending}
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving..." : "Save"}
        </button>
      </div>

      {error && (
        <div data-testid="profile-error" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {success && (
        <div data-testid="profile-success" className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">
          Profile updated successfully.
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
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
            <input
              data-testid="field-registration_number"
              type="text"
              value={form.registration_number}
              onChange={(e) => updateField("registration_number", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input
              data-testid="field-country"
              type="text"
              value={form.country}
              onChange={(e) => updateField("country", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
            <input
              data-testid="field-default_currency"
              type="text"
              value={form.default_currency}
              onChange={(e) => updateField("default_currency", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
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
              onClick={() => updateField("vat_registered", !form.vat_registered)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                form.vat_registered ? "bg-brand-600" : "bg-gray-300"
              }`}
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
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VAT Rate (%)</label>
            <input
              data-testid="field-vat_rate_percent"
              type="text"
              value={form.vat_rate_percent}
              onChange={(e) => updateField("vat_rate_percent", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
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
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
            <input
              data-testid="field-bank_account_iban"
              type="text"
              value={form.bank_account_iban}
              onChange={(e) => updateField("bank_account_iban", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SWIFT / BIC</label>
            <input
              data-testid="field-bank_swift_bic"
              type="text"
              value={form.bank_swift_bic}
              onChange={(e) => updateField("bank_swift_bic", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
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
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next Invoice Number</label>
            <input
              data-testid="field-next_invoice_number"
              type="number"
              value={form.next_invoice_number}
              onChange={(e) => updateField("next_invoice_number", parseInt(e.target.value, 10) || 1)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
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
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
            <textarea
              data-testid="field-billing_address"
              value={form.billing_address}
              onChange={(e) => updateField("billing_address", e.target.value)}
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
