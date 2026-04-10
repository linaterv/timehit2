"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { EntityLink as EL } from "@/components/shared/entity-link";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import { FileDown } from "lucide-react";
import { getAccessToken } from "@/lib/api";
import { AuditTimeline } from "@/components/shared/audit-timeline";
import type { Invoice, UserRef } from "@/types/api";

interface InvoiceNotification {
  id: string;
  created_at: string;
  created_by: UserRef;
  title: string;
  text: string;
  status: string;
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

  // Action mutations
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

  // Dialog states
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

  const snap = (invoice.billing_snapshot ?? {}) as Record<string, unknown>;

  return (
    <div data-testid="invoice-detail" className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {invoice.invoice_number}
            </h1>
            {!isContractor && <StatusBadge value={invoice.invoice_type} />}
            <StatusBadge value={invoice.status} />
          </div>
          <p className="text-sm text-gray-500">
            <EL href={`/clients/${invoice.client.id}`}>{invoice.client.company_name}</EL>
            {!isContractor && <> &mdash; <EL href={`/contractors/${invoice.contractor.id}`}>{invoice.contractor.full_name}</EL></>}
            {!isContractor && <> &mdash; {formatMonth(invoice.year, invoice.month)}</>}
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

      {/* Details Card — hidden for contractor */}
      {!isContractor && <div className="border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Invoice Details
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Hourly Rate</span>
            <p className="font-medium">
              {formatCurrency(invoice.hourly_rate, invoice.currency)}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Total Hours</span>
            <p className="font-medium">{invoice.total_hours}h</p>
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
      </div>}

      {/* Billing Snapshot + Placement link — hidden for contractor */}
      {!isContractor && (
        <div className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Billing Snapshot</h2>
            <Link href={`/placements/${invoice.placement_id}`} className="text-sm text-brand-600 hover:underline">
              View Placement &rarr;
            </Link>
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

      {/* Related Entities — admin/broker only */}
      {!isContractor && (
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Related Entities</h2>
          <div className="flex flex-wrap gap-3">
            <EL href={`/clients/${invoice.client.id}`} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm hover:bg-brand-50 hover:border-brand-200">
              <span className="text-xs font-mono text-gray-400">Client</span>
              <span className="font-medium">{invoice.client.company_name}</span>
            </EL>
            <EL href={`/contractors/${invoice.contractor.id}`} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm hover:bg-brand-50 hover:border-brand-200">
              <span className="text-xs font-mono text-gray-400">Contractor</span>
              <span className="font-medium">{invoice.contractor.full_name}</span>
            </EL>
            {invoice.placement_id && (
              <EL href={`/placements/${invoice.placement_id}`} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm hover:bg-brand-50 hover:border-brand-200">
                <span className="text-xs font-mono text-gray-400">Placement</span>
                <span className="font-medium">{(invoice as any).placement_title || "View"}</span>
              </EL>
            )}
            {invoice.timesheet_id && (
              <EL href={`/timesheets/${invoice.timesheet_id}`} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm hover:bg-brand-50 hover:border-brand-200">
                <span className="text-xs font-mono text-gray-400">Timesheet</span>
                <span className="font-medium">{formatMonth(invoice.year, invoice.month)}</span>
              </EL>
            )}
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
      <div className="flex flex-wrap gap-3">
        <button
          data-testid="invoice-pdf-btn"
          onClick={handleDownloadPdf}
          className="inline-flex items-center gap-2 px-4 py-2 border rounded text-sm hover:bg-gray-50"
        >
          <FileDown size={16} />
          Download PDF
        </button>

        {isAdminOrBroker && invoice.status === "DRAFT" && (
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

        {isAdminOrBroker && invoice.status === "ISSUED" && (
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
            <button
              data-testid="invoice-correct-btn"
              onClick={() => {
                setCorrectRate(invoice.hourly_rate);
                setCorrectHours(invoice.total_hours);
                setCorrectReason("");
                setShowCorrectForm(true);
              }}
              className="px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
            >
              Correct
            </button>
          </>
        )}

        {isAdminOrBroker && invoice.status === "PAID" && (
          <button
            data-testid="invoice-void-btn"
            onClick={() => setConfirmVoid(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
          >
            Void
          </button>
        )}
      </div>

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
