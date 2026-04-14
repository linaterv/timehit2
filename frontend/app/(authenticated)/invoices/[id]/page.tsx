"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { EntityLink as EL } from "@/components/shared/entity-link";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { StatusBadge } from "@/components/shared/status-badge";
import { LockBadge } from "@/components/shared/lock-badge";
import { BackLink } from "@/components/shared/back-link";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { CountrySelect } from "@/components/shared/country-select";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import { FileDown } from "lucide-react";
import { getAccessToken } from "@/lib/api";
import { AuditTimeline } from "@/components/shared/audit-timeline";
import type {
  Invoice,
  InvoiceLineItem,
  ManualInvoicePayload,
  ManualInvoiceLineItemInput,
  UserRef,
  Client,
  PaginatedResponse,
} from "@/types/api";

interface InvoiceNotification {
  id: string;
  created_at: string;
  created_by: UserRef;
  title: string;
  text: string;
  status: string;
}

const CURRENCIES = ["EUR", "USD", "GBP", "SEK", "CHF"];

function lineTotalNum(qty: string, price: string): number {
  const q = parseFloat(qty || "0");
  const p = parseFloat(price || "0");
  if (!isFinite(q) || !isFinite(p)) return 0;
  return q * p;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const invoiceId = params.id as string;

  const isAdminOrBroker =
    user?.role === "ADMIN" || user?.role === "BROKER";
  const isContractor = user?.role === "CONTRACTOR";

  const { data: invoice, isLoading } = useApiQuery<Invoice>(
    ["invoice", invoiceId],
    `/invoices/${invoiceId}`
  );

  const { data: notificationsData } = useApiQuery<{ data: InvoiceNotification[] }>(
    ["invoice-notifications", invoiceId],
    `/invoices/${invoiceId}/notifications`
  );

  const auditQ = useApiQuery<{ data: { id: string; action: string; title: string; text: string; data_before: Record<string, unknown> | null; data_after: Record<string, unknown> | null; created_by: { id: string; full_name: string } | null; created_at: string; entity_type: string; entity_id: string }[] }>(
    ["invoice-audit", invoiceId], `/invoices/${invoiceId}/audit-log`
  );

  const issueMutation = useApiMutation<Invoice, void>(
    "POST",
    `/invoices/${invoiceId}/issue`,
    [["invoice", invoiceId], ["invoices"]]
  );

  const deleteMutation = useApiMutation<void, void>(
    "DELETE",
    `/invoices/${invoiceId}`,
    [["invoices"]]
  );

  const markPaidMutation = useApiMutation<Invoice, { payment_date: string }>(
    "POST",
    `/invoices/${invoiceId}/mark-paid`,
    [["invoice", invoiceId], ["invoices"]]
  );

  const voidMutation = useApiMutation<Invoice, void>(
    "POST",
    `/invoices/${invoiceId}/void`,
    [["invoice", invoiceId], ["invoices"]]
  );

  const correctMutation = useApiMutation<
    Invoice,
    { hourly_rate: string; total_hours: string; reason: string }
  >(
    "POST",
    `/invoices/${invoiceId}/correct`,
    [["invoice", invoiceId], ["invoices"]]
  );

  const patchMutation = useApiMutation<Invoice, Partial<ManualInvoicePayload>>(
    "PATCH",
    `/invoices/${invoiceId}`,
    [["invoice", invoiceId], ["invoices"]]
  );

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [showPaidForm, setShowPaidForm] = useState(false);
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [showCorrectForm, setShowCorrectForm] = useState(false);
  const [correctRate, setCorrectRate] = useState("");
  const [correctHours, setCorrectHours] = useState("");
  const [correctReason, setCorrectReason] = useState("");

  // ---------- Manual edit state ----------
  const [editing, setEditing] = useState(false);
  const [editNumber, setEditNumber] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editCurrency, setEditCurrency] = useState("EUR");
  const [editVatRate, setEditVatRate] = useState("");
  const [editTerms, setEditTerms] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editBillMode, setEditBillMode] = useState<"client" | "manual">("client");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editRegNumber, setEditRegNumber] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCountry, setEditCountry] = useState("LT");
  const [editVatNum, setEditVatNum] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editBankIban, setEditBankIban] = useState("");
  const [editBankSwift, setEditBankSwift] = useState("");
  const [editLines, setEditLines] = useState<ManualInvoiceLineItemInput[]>([]);
  const [editError, setEditError] = useState("");

  const { data: clientsData } = useApiQuery<PaginatedResponse<Client>>(
    ["manual-invoice-clients"],
    "/clients?per_page=200",
    editing
  );

  const snap = useMemo(() => (invoice?.billing_snapshot ?? {}) as Record<string, unknown>, [invoice]);

  const startEdit = () => {
    if (!invoice) return;
    setEditing(true);
    setEditError("");
    setEditNumber(invoice.invoice_number);
    setEditIssueDate(invoice.issue_date);
    setEditDueDate(invoice.due_date ?? "");
    setEditCurrency(invoice.currency);
    setEditVatRate(invoice.vat_rate_percent ?? "");
    setEditTerms(invoice.payment_terms_days != null ? String(invoice.payment_terms_days) : "");
    if (invoice.client) {
      setEditClientId(invoice.client.id);
      setEditBillMode("client");
    } else {
      setEditClientId("");
      setEditBillMode("manual");
    }
    setEditCompanyName(String(snap["client_company_name"] ?? ""));
    setEditRegNumber(String(snap["client_registration_number"] ?? ""));
    setEditAddress(String(snap["client_billing_address"] ?? ""));
    setEditCountry(String(snap["client_country"] ?? "LT"));
    setEditVatNum(String(snap["client_vat_number"] ?? ""));
    setEditBankName(String(snap["bank_name"] ?? ""));
    setEditBankIban(String(snap["bank_account_iban"] ?? ""));
    setEditBankSwift(String(snap["bank_swift_bic"] ?? ""));
    setEditLines(
      (invoice.line_items ?? []).map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
      }))
    );
  };

  const discardEdit = () => {
    setEditing(false);
    setEditError("");
  };

  const editSubtotal = useMemo(
    () => editLines.reduce((sum, l) => sum + lineTotalNum(l.quantity, l.unit_price), 0),
    [editLines]
  );
  const editVatAmount = useMemo(() => {
    const r = parseFloat(editVatRate || "0");
    if (!isFinite(r) || r === 0) return 0;
    return (editSubtotal * r) / 100;
  }, [editSubtotal, editVatRate]);
  const editTotal = editSubtotal + editVatAmount;

  const editCanSave =
    !!editNumber.trim() &&
    !!editIssueDate &&
    !!editCurrency &&
    editLines.length >= 1 &&
    editLines.every(
      (l) =>
        l.description.trim() !== "" &&
        parseFloat(l.quantity) > 0 &&
        parseFloat(l.unit_price) > 0
    ) &&
    (editBillMode === "client"
      ? !!editClientId
      : !!editCompanyName.trim() && !!editAddress.trim());

  const saveEdit = () => {
    if (!invoice || !editCanSave) return;
    setEditError("");
    const payload: Partial<ManualInvoicePayload> = {
      invoice_number: editNumber.trim(),
      issue_date: editIssueDate,
      due_date: editDueDate || null,
      payment_terms_days: editTerms ? parseInt(editTerms, 10) : null,
      currency: editCurrency,
      vat_rate_percent: editVatRate ? editVatRate : null,
      client_id: editBillMode === "client" ? editClientId : null,
      line_items: editLines.map((l) => ({
        description: l.description.trim(),
        quantity: l.quantity,
        unit_price: l.unit_price,
      })),
      bank: {
        bank_name: editBankName.trim(),
        bank_account_iban: editBankIban.trim(),
        bank_swift_bic: editBankSwift.trim(),
      },
    };
    if (editBillMode === "manual") {
      payload.bill_to = {
        company_name: editCompanyName.trim(),
        registration_number: editRegNumber.trim(),
        billing_address: editAddress.trim(),
        country: editCountry,
        vat_number: editVatNum.trim(),
      };
    }
    patchMutation.mutate(payload, {
      onSuccess: () => {
        setEditing(false);
      },
      onError: (err) => {
        const e = err as { status?: number; message?: string; details?: { field: string; message: string }[] };
        setEditError(
          e.details?.map((d) => `${d.field}: ${d.message}`).join("; ") || e.message || "Save failed"
        );
      },
    });
  };

  if (isLoading) {
    return (
      <div data-testid="invoice-loading" className="text-center py-12 text-gray-400">
        Loading...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div data-testid="invoice-not-found" className="text-center py-12 text-gray-400">
        Invoice not found
      </div>
    );
  }

  const isManual = invoice.is_manual;

  const handleIssue = () => {
    issueMutation.mutate(undefined as unknown as void);
  };

  const handleDelete = () => {
    deleteMutation.mutate(undefined as unknown as void, {
      onSuccess: () => router.push("/invoices"),
    });
  };

  const handleMarkPaid = () => {
    markPaidMutation.mutate(
      { payment_date: paymentDate },
      { onSuccess: () => setShowPaidForm(false) }
    );
  };

  const handleVoid = () => {
    voidMutation.mutate(undefined as unknown as void, {
      onSuccess: () => setConfirmVoid(false),
    });
  };

  const handleCorrect = () => {
    correctMutation.mutate(
      {
        hourly_rate: correctRate,
        total_hours: correctHours,
        reason: correctReason,
      },
      {
        onSuccess: () => {
          setShowCorrectForm(false);
          setCorrectRate("");
          setCorrectHours("");
          setCorrectReason("");
        },
      }
    );
  };

  const handleDownloadPdf = () => {
    const token = getAccessToken();
    const url = `/api/v1/invoices/${invoiceId}/pdf`;
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${invoice?.invoice_number || "invoice"}.pdf`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      });
  };

  const clientOptions = [
    { value: "", label: "— No client —" },
    ...((clientsData?.data ?? []).map((c) => ({ value: c.id, label: c.company_name }))),
  ];

  const isManualDraftEditable =
    isManual && isAdminOrBroker && invoice.status === "DRAFT" && !invoice.is_locked;

  return (
    <div data-testid={isManual ? "manual-invoice-detail" : "invoice-detail"} className="space-y-6">
      <BackLink />
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {invoice.invoice_number}
            </h1>
            {isManual ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Manual</span>
            ) : (
              !isContractor && <StatusBadge value={invoice.invoice_type} />
            )}
            <StatusBadge value={invoice.status} />
            {isAdminOrBroker && <LockBadge entityType="invoice" entityId={invoiceId} isLocked={invoice.is_locked ?? false}
              invalidateKeys={[["invoice", invoiceId], ["invoices"]]} label={invoice.invoice_number} />}
          </div>
          <p className="text-sm text-gray-500">
            {invoice.client ? (
              <EL href={`/clients/${invoice.client.id}`}>{invoice.client.company_name}</EL>
            ) : (
              <span className="text-gray-500">{String(snap["client_company_name"] ?? "—")}</span>
            )}
            {!isContractor && invoice.contractor && (
              <> &mdash; <EL href={`/contractors/${invoice.contractor.id}`}>{invoice.contractor.full_name}</EL></>
            )}
            {!isContractor && !isManual && invoice.year != null && invoice.month != null && (
              <> &mdash; {formatMonth(invoice.year, invoice.month)}</>
            )}
          </p>
        </div>
        <div className="text-right">
          {!isContractor && (
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(invoice.total_amount, invoice.currency)}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            Issued {formatDate(invoice.issue_date)}
            {invoice.due_date && <> &middot; Due {formatDate(invoice.due_date)}</>}
          </p>
        </div>
      </div>

      {/* Manual Edit Panel (DRAFT only) */}
      {editing && isManualDraftEditable && (
        <div className="border-2 border-brand-400 rounded-lg p-6 space-y-5 bg-brand-50/30">
          <h2 className="text-lg font-semibold text-gray-900">Edit Manual Invoice</h2>
          {editError && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{editError}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Invoice number *</label>
              <input
                data-testid="mi-edit-number"
                type="text"
                value={editNumber}
                onChange={(e) => setEditNumber(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Issue date *</label>
              <input
                data-testid="mi-edit-issue-date"
                type="date"
                value={editIssueDate}
                onChange={(e) => setEditIssueDate(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Due date</label>
              <input
                data-testid="mi-edit-due-date"
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Payment terms (days)</label>
              <input
                data-testid="mi-edit-terms"
                type="number"
                min="0"
                value={editTerms}
                onChange={(e) => setEditTerms(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={editBillMode === "client"} onChange={() => setEditBillMode("client")} />
                Existing client
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={editBillMode === "manual"} onChange={() => setEditBillMode("manual")} />
                Manual entry
              </label>
            </div>
            {editBillMode === "client" ? (
              <SearchableSelect
                options={clientOptions}
                value={editClientId}
                onChange={setEditClientId}
                placeholder="Select client..."
                testId="mi-edit-client-select"
              />
            ) : (
              <div className="space-y-2 border rounded p-3 bg-gray-50">
                <input
                  data-testid="mi-edit-bill-company"
                  type="text"
                  placeholder="Company name *"
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    data-testid="mi-edit-bill-reg"
                    type="text"
                    placeholder="Reg. number"
                    value={editRegNumber}
                    onChange={(e) => setEditRegNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                  <input
                    data-testid="mi-edit-bill-vat"
                    type="text"
                    placeholder="VAT number"
                    value={editVatNum}
                    onChange={(e) => setEditVatNum(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
                <textarea
                  data-testid="mi-edit-bill-address"
                  placeholder="Billing address *"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
                <CountrySelect value={editCountry} onChange={setEditCountry} testId="mi-edit-bill-country" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Line items</h3>
            {editLines.map((l, idx) => (
              <div key={idx} className="border rounded p-3 space-y-2 bg-white">
                <div className="flex gap-2">
                  <input
                    data-testid={`mi-edit-line-${idx}-desc`}
                    type="text"
                    value={l.description}
                    onChange={(e) => setEditLines(editLines.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))}
                    placeholder="Description"
                    className="flex-1 px-3 py-2 border rounded text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => editLines.length > 1 && setEditLines(editLines.filter((_, i) => i !== idx))}
                    disabled={editLines.length === 1}
                    className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    data-testid={`mi-edit-line-${idx}-qty`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Qty"
                    value={l.quantity}
                    onChange={(e) => setEditLines(editLines.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  />
                  <input
                    data-testid={`mi-edit-line-${idx}-price`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Unit price"
                    value={l.unit_price}
                    onChange={(e) => setEditLines(editLines.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  />
                  <div className="px-2 py-1.5 border rounded text-sm bg-gray-50 font-medium">
                    {formatCurrency(lineTotalNum(l.quantity, l.unit_price).toFixed(2), editCurrency)}
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              data-testid="mi-edit-add-line"
              onClick={() => setEditLines([...editLines, { description: "", quantity: "1", unit_price: "" }])}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-dashed rounded text-sm text-gray-600 hover:bg-brand-50 hover:border-brand-400"
            >
              <Plus size={14} /> Add line
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Currency *</label>
              <select
                data-testid="mi-edit-currency"
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">VAT rate %</label>
              <input
                data-testid="mi-edit-vat"
                type="number"
                step="0.01"
                min="0"
                value={editVatRate}
                onChange={(e) => setEditVatRate(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
          </div>

          <div className="border rounded p-3 bg-gray-50 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium">{formatCurrency(editSubtotal.toFixed(2), editCurrency)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">VAT{editVatRate ? ` (${editVatRate}%)` : ""}</span><span className="font-medium">{formatCurrency(editVatAmount.toFixed(2), editCurrency)}</span></div>
            <div className="flex justify-between pt-1 border-t"><span className="font-semibold">Total</span><span className="font-bold">{formatCurrency(editTotal.toFixed(2), editCurrency)}</span></div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input
              data-testid="mi-edit-bank-name"
              type="text"
              placeholder="Bank name"
              value={editBankName}
              onChange={(e) => setEditBankName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
            <input
              data-testid="mi-edit-bank-iban"
              type="text"
              placeholder="IBAN"
              value={editBankIban}
              onChange={(e) => setEditBankIban(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm font-mono"
            />
            <input
              data-testid="mi-edit-bank-swift"
              type="text"
              placeholder="SWIFT/BIC"
              value={editBankSwift}
              onChange={(e) => setEditBankSwift(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm font-mono"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              data-testid="mi-edit-save"
              onClick={saveEdit}
              disabled={!editCanSave || patchMutation.isPending}
              className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {patchMutation.isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              data-testid="mi-edit-discard"
              onClick={discardEdit}
              className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Details card — AUTO only, hidden for contractor and manual */}
      {!isContractor && !isManual && !editing && (
        <div className="border rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Invoice Details
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Hourly Rate</span>
              <p className="font-medium">
                {invoice.hourly_rate ? formatCurrency(invoice.hourly_rate, invoice.currency) : "—"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Total Hours</span>
              <p className="font-medium">{invoice.total_hours ? `${invoice.total_hours}h` : "—"}</p>
            </div>
            <div>
              <span className="text-gray-500">Subtotal</span>
              <p className="font-medium">
                {formatCurrency(invoice.subtotal, invoice.currency)}
              </p>
            </div>
            <div>
              <span className="text-gray-500">VAT Rate</span>
              <p className="font-medium">
                {invoice.vat_rate_percent ? `${invoice.vat_rate_percent}%` : "N/A"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">VAT Amount</span>
              <p className="font-medium">
                {invoice.vat_amount
                  ? formatCurrency(invoice.vat_amount, invoice.currency)
                  : "N/A"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Total</span>
              <p className="font-semibold text-lg">
                {formatCurrency(invoice.total_amount, invoice.currency)}
              </p>
            </div>
          </div>
          {invoice.payment_date && (
            <div className="pt-2 border-t text-sm">
              <span className="text-gray-500">Payment Date: </span>
              <span className="font-medium">{formatDate(invoice.payment_date)}</span>
              {invoice.payment_reference && (
                <>
                  <span className="text-gray-500 ml-4">Reference: </span>
                  <span className="font-medium">{invoice.payment_reference}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Line items — MANUAL only */}
      {isManual && !editing && (
        <div data-testid="mi-line-items" className="border rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 w-12">#</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3 text-right">Unit price</th>
                  <th className="py-2 text-right">Line total</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.line_items ?? []).map((l: InvoiceLineItem, idx) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-gray-500">{idx + 1}</td>
                    <td className="py-2 pr-3">{l.description}</td>
                    <td className="py-2 pr-3 text-right">{l.quantity}</td>
                    <td className="py-2 pr-3 text-right">{formatCurrency(l.unit_price, invoice.currency)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(l.line_total, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-sm">
                  <td colSpan={4} className="py-2 pr-3 text-right text-gray-500">Subtotal</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(invoice.subtotal, invoice.currency)}</td>
                </tr>
                {invoice.vat_rate_percent && (
                  <tr className="text-sm">
                    <td colSpan={4} className="py-2 pr-3 text-right text-gray-500">VAT ({invoice.vat_rate_percent}%)</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(invoice.vat_amount ?? "0", invoice.currency)}</td>
                  </tr>
                )}
                <tr className="text-sm border-t">
                  <td colSpan={4} className="py-2 pr-3 text-right font-semibold">Total</td>
                  <td className="py-2 text-right font-bold text-base">{formatCurrency(invoice.total_amount, invoice.currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {invoice.payment_date && (
            <div className="pt-2 border-t text-sm">
              <span className="text-gray-500">Payment Date: </span>
              <span className="font-medium">{formatDate(invoice.payment_date)}</span>
              {invoice.payment_reference && (
                <>
                  <span className="text-gray-500 ml-4">Reference: </span>
                  <span className="font-medium">{invoice.payment_reference}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Billing Snapshot + Placement link — AUTO only */}
      {!isContractor && !isManual && !editing && (
        <div className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Billing Snapshot</h2>
            {invoice.placement_id && (
              <Link href={`/placements/${invoice.placement_id}`} className="text-sm text-brand-600 hover:underline">
                View Placement &rarr;
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-6 text-sm">
            {snap["agency_billing_address"] ? (
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase">From (Agency)</span>
                <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{String(snap["agency_billing_address"])}</div>
              </div>
            ) : null}
            {snap["client_billing_address"] ? (
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase">Bill To (Client)</span>
                <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{String(snap["client_billing_address"])}</div>
              </div>
            ) : null}
            {snap["contractor_billing_address"] ? (
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase">From (Contractor)</span>
                <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{String(snap["contractor_billing_address"])}</div>
              </div>
            ) : null}
            {snap["contractor_bank_name"] ? (
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase">Payment Details</span>
                <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap font-mono">{String(snap["contractor_bank_name"])}</div>
              </div>
            ) : null}
          </div>
          <div className="text-sm text-gray-500 pt-2 border-t flex flex-wrap gap-4">
            {invoice.issue_date && <span>Issue date: <strong>{formatDate(invoice.issue_date)}</strong></span>}
            {invoice.due_date && <span>Due date: <strong>{formatDate(invoice.due_date)}</strong></span>}
            {(snap["client_payment_terms_days"] != null || snap["contractor_payment_terms_days"] != null) && (
              <span>Payment terms: <strong>{String(snap["client_payment_terms_days"] ?? snap["contractor_payment_terms_days"])} days</strong></span>
            )}
          </div>
        </div>
      )}

      {/* Manual bill-to / bank snapshot */}
      {isManual && !editing && (
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Billing Snapshot</h2>
          <div className="grid grid-cols-2 gap-6 text-sm">
            {snap["client_company_name"] || snap["client_billing_address"] ? (
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase">Bill To</span>
                <div className="mt-1 text-sm text-gray-900">
                  {snap["client_company_name"] ? <div className="font-medium">{String(snap["client_company_name"])}</div> : null}
                  {snap["client_billing_address"] ? <div className="whitespace-pre-wrap">{String(snap["client_billing_address"])}</div> : null}
                  {snap["client_vat_number"] ? <div className="text-gray-500">VAT: {String(snap["client_vat_number"])}</div> : null}
                </div>
              </div>
            ) : null}
            {snap["bank_name"] || snap["bank_account_iban"] ? (
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase">Payment Details</span>
                <div className="mt-1 text-sm text-gray-900 font-mono">
                  {snap["bank_name"] ? <div>{String(snap["bank_name"])}</div> : null}
                  {snap["bank_account_iban"] ? <div>{String(snap["bank_account_iban"])}</div> : null}
                  {snap["bank_swift_bic"] ? <div>{String(snap["bank_swift_bic"])}</div> : null}
                </div>
              </div>
            ) : null}
          </div>
          <div className="text-sm text-gray-500 pt-2 border-t flex flex-wrap gap-4">
            <span>Issue date: <strong>{formatDate(invoice.issue_date)}</strong></span>
            {invoice.due_date && <span>Due date: <strong>{formatDate(invoice.due_date)}</strong></span>}
            {invoice.payment_terms_days != null && (
              <span>Payment terms: <strong>{invoice.payment_terms_days} days</strong></span>
            )}
          </div>
        </div>
      )}

      {/* Related Entities — admin/broker only; skip manual without placement */}
      {!isContractor && !isManual && (
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Related Entities</h2>
          <div className="flex flex-wrap gap-3">
            {invoice.client && (
              <EL href={`/clients/${invoice.client.id}`} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm hover:bg-brand-50 hover:border-brand-200">
                <span className="text-xs font-mono text-gray-400">Client</span>
                <span className="font-medium">{invoice.client.company_name}</span>
              </EL>
            )}
            {invoice.contractor && (
              <EL href={`/contractors/${invoice.contractor.id}`} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm hover:bg-brand-50 hover:border-brand-200">
                <span className="text-xs font-mono text-gray-400">Contractor</span>
                <span className="font-medium">{invoice.contractor.full_name}</span>
              </EL>
            )}
            {invoice.placement_id && (
              <EL href={`/placements/${invoice.placement_id}`} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm hover:bg-brand-50 hover:border-brand-200">
                <span className="text-xs font-mono text-gray-400">Placement</span>
                <span className="font-medium">{(invoice as unknown as { placement_title?: string }).placement_title || "View"}</span>
              </EL>
            )}
            {invoice.timesheet_id && invoice.year != null && invoice.month != null && (
              <EL href={`/timesheets/${invoice.timesheet_id}`} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm hover:bg-brand-50 hover:border-brand-200">
                <span className="text-xs font-mono text-gray-400">Timesheet</span>
                <span className="font-medium">{formatMonth(invoice.year, invoice.month)}</span>
              </EL>
            )}
          </div>
        </div>
      )}

      {/* Manual: client link only (no placement, no timesheet, no billing period) */}
      {isManual && invoice.client && !editing && (
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Related</h2>
          <div className="flex flex-wrap gap-3">
            <EL href={`/clients/${invoice.client.id}`} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm hover:bg-brand-50 hover:border-brand-200">
              <span className="text-xs font-mono text-gray-400">Client</span>
              <span className="font-medium">{invoice.client.company_name}</span>
            </EL>
          </div>
        </div>
      )}

      {/* Correction link */}
      {invoice.correction_link && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm">
          <p className="font-medium text-amber-800">
            This invoice has a corrective invoice.
          </p>
          <p className="text-amber-700 mt-1">
            Reason: {invoice.correction_link.reason}
          </p>
          <Link
            href={`/invoices/${invoice.correction_link.corrective_invoice_id}`}
            className="text-amber-800 underline hover:text-amber-900 mt-1 inline-block"
          >
            View Corrective Invoice
          </Link>
        </div>
      )}

      {/* Action Buttons */}
      {!editing && (
        <div className="flex flex-wrap gap-3">
          <button
            data-testid="invoice-pdf-btn"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded text-sm hover:bg-gray-50"
          >
            <FileDown size={16} />
            Download PDF
          </button>

          {isManualDraftEditable && (
            <button
              data-testid="mi-edit-btn"
              onClick={startEdit}
              className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
            >
              Edit
            </button>
          )}

          {isAdminOrBroker && invoice.status === "DRAFT" && !invoice.is_locked && (
            <>
              <button
                data-testid="invoice-issue-btn"
                onClick={handleIssue}
                disabled={issueMutation.isPending}
                className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {issueMutation.isPending ? "Issuing..." : "Issue"}
              </button>
              <button
                data-testid="invoice-delete-btn"
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Delete
              </button>
            </>
          )}

          {isAdminOrBroker && invoice.status === "ISSUED" && !invoice.is_locked && (
            <>
              <button
                data-testid="invoice-paid-btn"
                onClick={() => setShowPaidForm(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700"
              >
                Mark Paid
              </button>
              <button
                data-testid="invoice-void-btn"
                onClick={() => setConfirmVoid(true)}
                className="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                Void
              </button>
              {!isManual && (
                <button
                  data-testid="invoice-correct-btn"
                  onClick={() => {
                    setCorrectRate(invoice.hourly_rate ?? "");
                    setCorrectHours(invoice.total_hours ?? "");
                    setCorrectReason("");
                    setShowCorrectForm(true);
                  }}
                  className="px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
                >
                  Correct
                </button>
              )}
            </>
          )}

          {isAdminOrBroker && invoice.status === "PAID" && !invoice.is_locked && (
            <button
              data-testid="invoice-void-btn"
              onClick={() => setConfirmVoid(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
            >
              Void
            </button>
          )}
        </div>
      )}

      {/* Mark Paid Form */}
      {showPaidForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <h3 className="font-semibold text-sm">Mark as Paid</h3>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Payment Date
            </label>
            <input
              data-testid="invoice-payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="px-3 py-2 border rounded text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleMarkPaid}
              disabled={markPaidMutation.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {markPaidMutation.isPending ? "Saving..." : "Confirm Payment"}
            </button>
            <button
              onClick={() => setShowPaidForm(false)}
              className="px-4 py-2 border rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Correct Form */}
      {showCorrectForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <h3 className="font-semibold text-sm">Create Correction</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Hourly Rate
              </label>
              <input
                data-testid="correct-hourly-rate"
                type="text"
                value={correctRate}
                onChange={(e) => setCorrectRate(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Total Hours
              </label>
              <input
                data-testid="correct-total-hours"
                type="text"
                value={correctHours}
                onChange={(e) => setCorrectHours(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Reason</label>
            <textarea
              data-testid="correct-reason"
              value={correctReason}
              onChange={(e) => setCorrectReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCorrect}
              disabled={correctMutation.isPending || !correctReason.trim()}
              className="px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50"
            >
              {correctMutation.isPending ? "Submitting..." : "Submit Correction"}
            </button>
            <button
              onClick={() => setShowCorrectForm(false)}
              className="px-4 py-2 border rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete Invoice"
        message={`Are you sure you want to delete invoice ${invoice.invoice_number}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        confirmLabel="Delete"
        destructive
      />

      <ConfirmDialog
        open={confirmVoid}
        title="Void Invoice"
        message={`Are you sure you want to void invoice ${invoice.invoice_number}? This action cannot be undone.`}
        onConfirm={handleVoid}
        onCancel={() => setConfirmVoid(false)}
        confirmLabel="Void Invoice"
        destructive
      />

      {/* Audit History */}
      {!isContractor && (
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Audit History</h2>
          <AuditTimeline entries={auditQ.data?.data ?? []} loading={auditQ.isLoading} />
        </div>
      )}

      {/* Notification History */}
      {(notificationsData?.data?.length ?? 0) > 0 && (
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">History</h2>
          <div className="space-y-3">
            {notificationsData!.data.map((n) => (
              <div key={n.id} className="flex gap-3 text-sm">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-brand-600 mt-1.5" />
                  <div className="w-px flex-1 bg-gray-200" />
                </div>
                <div className="pb-3">
                  <p className="font-medium text-gray-900">{n.title}</p>
                  <p className="text-gray-500">{n.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(n.created_at)}
                    {" · "}{n.created_by.full_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
