"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { SlideOver } from "@/components/forms/slide-over";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { CountrySelect } from "@/components/shared/country-select";
import { formatCurrency } from "@/lib/utils";
import type {
  Invoice,
  ManualInvoicePayload,
  ManualInvoiceLineItemInput,
  PaginatedResponse,
  Client,
  Candidate,
  InvoiceTemplate,
} from "@/types/api";

interface AgencySettings {
  default_payment_terms_client_days: number;
  default_payment_terms_contractor_days: number;
  default_client_invoice_template_id: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

type BillToMode = "client" | "manual";

const CURRENCIES = ["EUR", "USD", "GBP", "SEK", "CHF"];

function emptyLine(): ManualInvoiceLineItemInput {
  return { description: "", quantity: "1", unit_price: "" };
}

function computeLineTotal(qty: string, price: string): number {
  const q = parseFloat(qty || "0");
  const p = parseFloat(price || "0");
  if (!isFinite(q) || !isFinite(p)) return 0;
  return q * p;
}

export function ManualInvoiceForm({ open, onClose, onCreated }: Props) {
  const [billToMode, setBillToMode] = useState<BillToMode>("client");
  const [clientId, setClientId] = useState("");
  const [candidateId, setCandidateId] = useState("");

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceNumberError, setInvoiceNumberError] = useState("");
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [vatRate, setVatRate] = useState("");

  const [manualCompanyName, setManualCompanyName] = useState("");
  const [manualRegNumber, setManualRegNumber] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualCountry, setManualCountry] = useState("LT");
  const [manualVat, setManualVat] = useState("");

  const [bankName, setBankName] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [bankSwift, setBankSwift] = useState("");

  const [lines, setLines] = useState<ManualInvoiceLineItemInput[]>([emptyLine()]);

  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateResults, setCandidateResults] = useState<Candidate[]>([]);
  const [candidateMenuOpen, setCandidateMenuOpen] = useState(false);
  const [selectedCandidateLabel, setSelectedCandidateLabel] = useState("");

  const reset = useCallback(() => {
    setBillToMode("client");
    setClientId("");
    setCandidateId("");
    setInvoiceNumber("");
    setInvoiceNumberError("");
    setIssueDate(todayISO());
    setDueDate("");
    setPaymentTermsDays("");
    setCurrency("EUR");
    setVatRate("");
    setManualCompanyName("");
    setManualRegNumber("");
    setManualAddress("");
    setManualCountry("LT");
    setManualVat("");
    setBankName("");
    setBankIban("");
    setBankSwift("");
    setLines([emptyLine()]);
    setCandidateSearch("");
    setCandidateResults([]);
    setCandidateMenuOpen(false);
    setSelectedCandidateLabel("");
  }, []);

  const { data: clientsData } = useApiQuery<PaginatedResponse<Client>>(
    ["manual-invoice-clients"],
    "/clients?per_page=200",
    open
  );

  const { data: agencySettings } = useApiQuery<AgencySettings>(
    ["agency-settings"],
    "/agency-settings",
    open
  );

  const { data: clientTplData } = useApiQuery<PaginatedResponse<InvoiceTemplate>>(
    ["client-invoice-templates-active"],
    "/invoice-templates?template_type=CLIENT&status=ACTIVE&per_page=200",
    open
  );

  const defaultTpl = useMemo(() => {
    if (!agencySettings?.default_client_invoice_template_id || !clientTplData?.data) return null;
    return clientTplData.data.find((t) => t.id === agencySettings.default_client_invoice_template_id) ?? null;
  }, [agencySettings, clientTplData]);

  useEffect(() => {
    if (!open || !defaultTpl) return;
    setCurrency((c) => c || defaultTpl.default_currency || "EUR");
    setVatRate((v) => v || defaultTpl.vat_rate_percent || "");
    setBankName((b) => b || defaultTpl.bank_name || "");
    setBankIban((b) => b || defaultTpl.bank_account_iban || "");
    setBankSwift((b) => b || defaultTpl.bank_swift_bic || "");
    setPaymentTermsDays((p) => p || (defaultTpl.payment_terms_days ? String(defaultTpl.payment_terms_days) : ""));
  }, [open, defaultTpl]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!issueDate || !paymentTermsDays || dueDate) return;
    const d = new Date(issueDate);
    const days = parseInt(paymentTermsDays, 10);
    if (isNaN(days)) return;
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().slice(0, 10));
  }, [issueDate, paymentTermsDays, dueDate]);

  useEffect(() => {
    if (!candidateSearch.trim() || !candidateMenuOpen) {
      setCandidateResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api<{ data: Candidate[] }>(
          `/candidates/search?q=${encodeURIComponent(candidateSearch)}`
        );
        setCandidateResults(res.data.slice(0, 8));
      } catch {
        setCandidateResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [candidateSearch, candidateMenuOpen]);

  useEffect(() => {
    if (!invoiceNumber.trim()) {
      setInvoiceNumberError("");
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api<PaginatedResponse<Invoice>>(
          `/invoices?invoice_number=${encodeURIComponent(invoiceNumber.trim())}&per_page=1`
        );
        if (res.data && res.data.length > 0) {
          setInvoiceNumberError(`Invoice number "${invoiceNumber.trim()}" is already taken`);
        } else {
          setInvoiceNumberError("");
        }
      } catch {
        setInvoiceNumberError("");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [invoiceNumber]);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + computeLineTotal(l.quantity, l.unit_price), 0),
    [lines]
  );
  const vatAmount = useMemo(() => {
    const r = parseFloat(vatRate || "0");
    if (!isFinite(r) || r === 0) return 0;
    return (subtotal * r) / 100;
  }, [subtotal, vatRate]);
  const total = subtotal + vatAmount;

  const createMutation = useApiMutation<Invoice, ManualInvoicePayload>(
    "POST",
    "/invoices/manual",
    [["invoices"], ["invoices-all-for-filters"]]
  );

  const clientOptions = useMemo(() => {
    return [
      { value: "", label: "— No client (manual entry) —" },
      ...((clientsData?.data ?? []).map((c) => ({ value: c.id, label: c.company_name }))),
    ];
  }, [clientsData]);

  const allLinesValid = lines.every(
    (l) =>
      l.description.trim() !== "" &&
      parseFloat(l.quantity) > 0 &&
      parseFloat(l.unit_price) > 0
  );

  const requiredBillToValid =
    billToMode === "client"
      ? !!clientId
      : !!manualCompanyName.trim() && !!manualAddress.trim() && !!manualCountry;

  const canSubmit =
    !!invoiceNumber.trim() &&
    !invoiceNumberError &&
    !!issueDate &&
    !!currency &&
    lines.length >= 1 &&
    allLinesValid &&
    requiredBillToValid &&
    !createMutation.isPending;

  const addLine = () => setLines([...lines, emptyLine()]);
  const removeLine = (idx: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };
  const updateLine = (idx: number, field: keyof ManualInvoiceLineItemInput, value: string) => {
    setLines(lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const handleSelectCandidate = (c: Candidate) => {
    setCandidateId(c.id);
    setSelectedCandidateLabel(`${c.full_name}${c.email ? ` (${c.email})` : ""}`);
    setCandidateSearch("");
    setCandidateMenuOpen(false);
  };
  const clearCandidate = () => {
    setCandidateId("");
    setSelectedCandidateLabel("");
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const payload: ManualInvoicePayload = {
      invoice_number: invoiceNumber.trim(),
      issue_date: issueDate,
      due_date: dueDate || null,
      payment_terms_days: paymentTermsDays ? parseInt(paymentTermsDays, 10) : null,
      currency,
      vat_rate_percent: vatRate ? vatRate : null,
      client_id: billToMode === "client" ? clientId : null,
      candidate_id: candidateId || null,
      line_items: lines.map((l) => ({
        description: l.description.trim(),
        quantity: l.quantity,
        unit_price: l.unit_price,
      })),
    };
    if (billToMode === "manual") {
      payload.bill_to = {
        company_name: manualCompanyName.trim(),
        registration_number: manualRegNumber.trim(),
        billing_address: manualAddress.trim(),
        country: manualCountry,
        vat_number: manualVat.trim(),
      };
    }
    if (bankName.trim() || bankIban.trim() || bankSwift.trim()) {
      payload.bank = {
        bank_name: bankName.trim(),
        bank_account_iban: bankIban.trim(),
        bank_swift_bic: bankSwift.trim(),
      };
    }
    createMutation.mutate(payload, {
      onSuccess: (inv) => {
        onCreated(inv.id);
      },
      onError: (err) => {
        const e = err as { status?: number; code?: string; message?: string };
        if (e.status === 409 || (e.message || "").toLowerCase().includes("invoice_number")) {
          setInvoiceNumberError(e.message || "Invoice number already taken");
        }
      },
    });
  };

  const apiErr = createMutation.error as
    | { status?: number; message?: string; details?: { field: string; message: string }[] }
    | undefined;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="New Manual Invoice"
      testId="manual-invoice-form"
    >
      <div data-testid="manual-invoice-form-body" className="space-y-6">
        {apiErr && !invoiceNumberError ? (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
            {apiErr.details?.map((d) => `${d.field}: ${d.message}`).join("; ") || apiErr.message || "Error"}
          </div>
        ) : null}

        {/* IDENTITY */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Identity</h3>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Invoice number *</label>
            <input
              data-testid="mi-number"
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. PERM-2026-001"
              className={`w-full px-3 py-2 border rounded text-sm ${invoiceNumberError ? "border-red-400" : ""}`}
            />
            {invoiceNumberError && (
              <p data-testid="mi-number-error" className="text-xs text-red-600 mt-1">{invoiceNumberError}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Issue date *</label>
              <input
                data-testid="mi-issue-date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Due date</label>
              <input
                data-testid="mi-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
          </div>
        </section>

        {/* BILL TO */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Bill to</h3>
          <div data-testid="mi-bill-to-mode" className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="bill-to-mode"
                value="client"
                checked={billToMode === "client"}
                onChange={() => setBillToMode("client")}
              />
              Existing client
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="bill-to-mode"
                value="manual"
                checked={billToMode === "manual"}
                onChange={() => setBillToMode("manual")}
              />
              Manual entry
            </label>
          </div>
          {billToMode === "client" ? (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Client *</label>
              <div data-testid="mi-client-select">
                <SearchableSelect
                  options={clientOptions}
                  value={clientId}
                  onChange={setClientId}
                  placeholder="Select client..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 border rounded p-3 bg-gray-50">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Company name *</label>
                <input
                  data-testid="mi-bill-company"
                  type="text"
                  value={manualCompanyName}
                  onChange={(e) => setManualCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Reg. number</label>
                  <input
                    data-testid="mi-bill-reg"
                    type="text"
                    value={manualRegNumber}
                    onChange={(e) => setManualRegNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">VAT number</label>
                  <input
                    data-testid="mi-bill-vat"
                    type="text"
                    value={manualVat}
                    onChange={(e) => setManualVat(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Billing address *</label>
                <textarea
                  data-testid="mi-bill-address"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Country *</label>
                <CountrySelect value={manualCountry} onChange={setManualCountry} testId="mi-bill-country" />
              </div>
            </div>
          )}
        </section>

        {/* CANDIDATE */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Candidate (optional)</h3>
          <div data-testid="mi-candidate-select" className="relative">
            {selectedCandidateLabel ? (
              <div className="flex items-center justify-between px-3 py-2 border rounded text-sm bg-brand-50">
                <span>{selectedCandidateLabel}</span>
                <button type="button" onClick={clearCandidate} className="text-gray-500 hover:text-red-600 text-xs">
                  &times; clear
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={candidateSearch}
                  onChange={(e) => { setCandidateSearch(e.target.value); setCandidateMenuOpen(true); }}
                  onFocus={() => setCandidateMenuOpen(true)}
                  placeholder="Search candidate by name, skills..."
                  className="w-full px-3 py-2 border rounded text-sm"
                />
                {candidateMenuOpen && candidateResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                    {candidateResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCandidate(c)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50"
                      >
                        <div className="font-medium">{c.full_name}</div>
                        {c.email && <div className="text-xs text-gray-500">{c.email}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* LINE ITEMS */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Line items</h3>
          <div data-testid="mi-lines" className="space-y-2">
            {lines.map((l, idx) => {
              const lineTotal = computeLineTotal(l.quantity, l.unit_price);
              return (
                <div key={idx} className="border rounded p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <input
                      data-testid={`mi-line-${idx}-desc`}
                      type="text"
                      value={l.description}
                      onChange={(e) => updateLine(idx, "description", e.target.value)}
                      placeholder="Description"
                      className="flex-1 px-3 py-2 border rounded text-sm"
                    />
                    <button
                      type="button"
                      data-testid={`mi-line-${idx}-remove`}
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
                      className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30"
                      title="Remove line"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                      <input
                        data-testid={`mi-line-${idx}-qty`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.quantity}
                        onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Unit price</label>
                      <input
                        data-testid={`mi-line-${idx}-price`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.unit_price}
                        onChange={(e) => updateLine(idx, "unit_price", e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Line total</label>
                      <div className="px-2 py-1.5 border rounded text-sm bg-gray-50 text-gray-700 font-medium">
                        {formatCurrency(lineTotal.toFixed(2), currency)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            data-testid="mi-add-line"
            onClick={addLine}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-dashed rounded text-sm text-gray-600 hover:bg-brand-50 hover:border-brand-400 hover:text-brand-700"
          >
            <Plus size={14} /> Add line
          </button>
        </section>

        {/* TOTALS */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Totals</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Currency *</label>
              <select
                data-testid="mi-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">VAT rate %</label>
              <input
                data-testid="mi-vat"
                type="number"
                step="0.01"
                min="0"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                placeholder="blank = no VAT"
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
          </div>
          <div className="border rounded p-3 bg-gray-50 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span data-testid="mi-totals-subtotal" className="font-medium">{formatCurrency(subtotal.toFixed(2), currency)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">VAT{vatRate ? ` (${vatRate}%)` : ""}</span><span data-testid="mi-totals-vat" className="font-medium">{formatCurrency(vatAmount.toFixed(2), currency)}</span></div>
            <div className="flex justify-between pt-1 border-t"><span className="font-semibold text-gray-800">Total</span><span data-testid="mi-totals-total" className="font-bold text-gray-900">{formatCurrency(total.toFixed(2), currency)}</span></div>
          </div>
        </section>

        {/* PAYMENT DETAILS */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Payment details</h3>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Payment terms (days)</label>
            <input
              data-testid="mi-terms"
              type="number"
              min="0"
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Bank name</label>
            <input
              data-testid="mi-bank-name"
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">IBAN</label>
            <input
              data-testid="mi-bank-iban"
              type="text"
              value={bankIban}
              onChange={(e) => setBankIban(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">SWIFT / BIC</label>
            <input
              data-testid="mi-bank-swift"
              type="text"
              value={bankSwift}
              onChange={(e) => setBankSwift(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm font-mono"
            />
          </div>
        </section>

        <div className="flex gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="mi-submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {createMutation.isPending ? "Saving..." : "Save as Draft"}
          </button>
        </div>
      </div>
    </SlideOver>
  );
}
