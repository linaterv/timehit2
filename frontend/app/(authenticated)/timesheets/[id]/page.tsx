"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { api, apiUpload } from "@/lib/api";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FileUpload } from "@/components/shared/file-upload";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { Timesheet, TimesheetEntry, TimesheetAttachment } from "@/types/api";

interface LocalEntry {
  _key: string;
  id?: string;
  date: string;
  task_name: string;
  hours: string;
  notes: string;
}

function makeKey() {
  return Math.random().toString(36).slice(2, 10);
}

function getEnabledDates(year: number, month: number, startDate: string, endDate: string | null): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const pStart = new Date(startDate + "T00:00:00");
  const pEnd = endDate ? new Date(endDate + "T00:00:00") : null;
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month - 1, d);
    if (dt < pStart) continue;
    if (pEnd && dt > pEnd) continue;
    dates.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return dates;
}

export default function TimesheetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  // ---- All hooks at the top, unconditionally ----
  const [entries, setEntries] = useState<LocalEntry[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [prefillInfo, setPrefillInfo] = useState("");
  const [confirmSubmitEmpty, setConfirmSubmitEmpty] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  useEffect(() => {
    if (!rejectModalOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setRejectModalOpen(false); setRejectReason(""); } };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [rejectModalOpen]);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmFutureSubmit, setConfirmFutureSubmit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false);
  const [activeTab, setActiveTab] = useState<"entries" | "history">("entries");

  const tsQuery = useQuery<Timesheet>({
    queryKey: ["timesheet", id],
    queryFn: () => api<Timesheet>(`/timesheets/${id}`),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const ts = tsQuery.data;
  const placementId = ts?.placement_id ?? "";

  const placementQuery = useQuery<{ start_date: string; end_date: string | null; client?: { id: string; company_name: string; country?: string } }>({
    queryKey: ["placement-for-ts", placementId],
    queryFn: () => api(`/placements/${placementId}`),
    enabled: !!placementId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Holidays for calendar highlighting
  const clientCountry = placementQuery.data?.client?.country || "LT";
  const holidaysQuery = useQuery<{ holidays: { date: string; name: string }[] }>({
    queryKey: ["holidays", clientCountry, ts?.year],
    queryFn: () => api(`/holidays?country=${clientCountry}&year=${ts?.year}`),
    enabled: !!ts?.year,
  });
  const holidayMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of holidaysQuery.data?.holidays ?? []) m.set(h.date, h.name);
    return m;
  }, [holidaysQuery.data]);

  // Audit log for history tab
  const auditQuery = useQuery<{ data: { id: string; action: string; title: string; text: string; data_before: Record<string, unknown> | null; data_after: Record<string, unknown> | null; created_by: { id: string; full_name: string } | null; created_at: string }[] }>({
    queryKey: ["timesheet-audit", id],
    queryFn: () => api(`/timesheets/${id}/audit-log`),
    enabled: activeTab === "history",
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Sibling timesheets for month navigation
  const siblingsQuery = useQuery<{ data: { id: string; year: number; month: number }[] }>({
    queryKey: ["placement-timesheets-nav", placementId],
    queryFn: () => api(`/placements/${placementId}/timesheets?per_page=100`),
    enabled: !!placementId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const placementDates = placementQuery.data;
  const siblings = siblingsQuery.data?.data ?? [];

  const monthNav = useMemo(() => {
    if (!ts || !placementDates) return { prev: null as null | { year: number; month: number; id: string | null }, next: null as null | { year: number; month: number; id: string | null } };
    const pStart = new Date(placementDates.start_date + "T00:00:00");
    const pEnd = placementDates.end_date ? new Date(placementDates.end_date + "T00:00:00") : new Date();
    const startYM = pStart.getFullYear() * 12 + pStart.getMonth();
    const endYM = pEnd.getFullYear() * 12 + pEnd.getMonth();
    const curYM = ts.year * 12 + (ts.month - 1);
    const siblingMap = new Map(siblings.map((s) => [`${s.year}-${s.month}`, s.id]));

    let prev = null;
    if (curYM > startYM) {
      const py = curYM - 1;
      const year = Math.floor(py / 12);
      const month = (py % 12) + 1;
      prev = { year, month, id: siblingMap.get(`${year}-${month}`) ?? null };
    }
    let next = null;
    if (curYM < endYM) {
      const ny = curYM + 1;
      const year = Math.floor(ny / 12);
      const month = (ny % 12) + 1;
      next = { year, month, id: siblingMap.get(`${year}-${month}`) ?? null };
    }
    return { prev, next };
  }, [ts, placementDates, siblings]);

  const navigateMonth = useCallback(async (target: { year: number; month: number; id: string | null }) => {
    if (target.id) {
      router.push(`/timesheets/${target.id}`);
    } else {
      // MISSING month — create timesheet on the fly
      try {
        const res = await api<Timesheet>(`/placements/${placementId}/timesheets`, {
          method: "POST",
          body: JSON.stringify({ year: target.year, month: target.month }),
        });
        qc.invalidateQueries({ queryKey: ["placement-timesheets-nav", placementId] });
        router.push(`/timesheets/${res.id}`);
      } catch {
        // already exists or error — stay
      }
    }
  }, [placementId, router, qc]);

  // Hydrate entries from server
  useEffect(() => {
    if (ts?.entries && entries === null) {
      setEntries(ts.entries.map((e) => ({
        _key: makeKey(), id: e.id, date: e.date,
        task_name: e.task_name, hours: e.hours, notes: e.notes,
      })));
    }
  }, [ts?.entries, entries]);

  // Derived values
  const placement = ts?.placement;
  const isContractor = user?.role === "CONTRACTOR";
  const isClientContact = user?.role === "CLIENT_CONTACT";
  const isBrokerOrAdmin = user?.role === "BROKER" || user?.role === "ADMIN";
  const ownsTimesheet = isContractor && placement?.contractor.id === user?.id;
  const isDraft = ts?.status === "DRAFT";
  const canEdit = isDraft && (ownsTimesheet || isBrokerOrAdmin);

  const enabledDates = useMemo(() => {
    if (!ts || !placementDates) return [] as string[];
    return getEnabledDates(ts.year, ts.month, placementDates.start_date, placementDates.end_date);
  }, [ts, placementDates]);

  const enabledDateSet = useMemo(() => new Set(enabledDates), [enabledDates]);

  const localEntries = entries ?? [];
  const dailyTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const e of localEntries) { t[e.date] = (t[e.date] || 0) + (parseFloat(e.hours) || 0); }
    return t;
  }, [localEntries]);
  const monthlyTotal = useMemo(() => localEntries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0), [localEntries]);

  const entriesByDate = useMemo(() => {
    const m: Record<string, LocalEntry[]> = {};
    for (const e of localEntries) { if (!m[e.date]) m[e.date] = []; m[e.date].push(e); }
    return m;
  }, [localEntries]);

  const allMonthDates = useMemo(() => {
    if (!ts) return [];
    const dim = new Date(ts.year, ts.month, 0).getDate();
    return Array.from({ length: dim }, (_, i) => {
      const d = i + 1;
      return `${ts.year}-${String(ts.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    });
  }, [ts]);

  // Mutations
  const saveMut = useMutation({
    mutationFn: (body: { entries: Omit<LocalEntry, "_key">[] }) =>
      api<{ entries: TimesheetEntry[]; total_hours: string }>(`/timesheets/${id}/entries/bulk_upsert`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      setSaveError("");
      setEntries(data.entries.map((e) => ({ _key: makeKey(), id: e.id, date: e.date, task_name: e.task_name, hours: e.hours, notes: e.notes })));
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["timesheet", id] }); qc.invalidateQueries({ queryKey: ["timesheet-audit", id] });
    },
    onError: (err) => {
      const e = err as { message?: string; details?: { field: string; message: string }[] };
      if (e.details?.length) setSaveError(e.details.map((d) => `${d.field}: ${d.message}`).join("; "));
      else setSaveError(e.message || "Failed to save");
    },
  });

  const submitMut = useMutation({
    mutationFn: (body: { confirm_zero?: boolean }) =>
      api(`/timesheets/${id}/submit`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["timesheet", id] }); qc.invalidateQueries({ queryKey: ["timesheet-audit", id] }); },
  });

  const clientApproveMut = useMutation({
    mutationFn: () => api(`/timesheets/${id}/client-approve`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["timesheet", id] }); qc.invalidateQueries({ queryKey: ["timesheet-audit", id] }); },
  });

  const approveMut = useMutation({
    mutationFn: () => api(`/timesheets/${id}/approve`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["timesheet", id] }); qc.invalidateQueries({ queryKey: ["timesheet-audit", id] }); },
  });

  const rejectMut = useMutation({
    mutationFn: (body: { reason: string }) =>
      api(`/timesheets/${id}/reject`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["timesheet", id] }); qc.invalidateQueries({ queryKey: ["timesheet-audit", id] }); setRejectModalOpen(false); setRejectReason(""); },
  });

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const withdrawMut = useMutation({
    mutationFn: () => api(`/timesheets/${id}/withdraw`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheet", id] }); qc.invalidateQueries({ queryKey: ["timesheet-audit", id] });
      qc.invalidateQueries({ queryKey: ["timesheets"] });
      qc.invalidateQueries({ queryKey: ["timesheets-pending"] });
      qc.invalidateQueries({ queryKey: ["timesheets-pending-placements"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => api(`/timesheets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheets"] });
      qc.invalidateQueries({ queryKey: ["timesheets-pending"] });
      qc.invalidateQueries({ queryKey: ["timesheets-pending-placements"] });
      router.push("/timesheets");
    },
  });

  // Handlers
  const updateEntry = (key: string, field: keyof LocalEntry, value: string) => {
    setEntries((prev) => (prev ?? []).map((e) => (e._key === key ? { ...e, [field]: value } : e)));
    setDirty(true);
  };
  const addEntry = (date: string) => {
    setEntries((prev) => [...(prev ?? []), { _key: makeKey(), date, task_name: "", hours: "", notes: "" }]);
    setDirty(true);
  };
  const removeEntry = (key: string) => {
    setEntries((prev) => (prev ?? []).filter((e) => e._key !== key));
    setDirty(true);
  };
  const handleSave = () => {
    setSaveError("");
    // Frontend validation: hours per entry 0-24, no negatives
    for (const e of localEntries) {
      const h = parseFloat(e.hours);
      if (isNaN(h) || h < 0 || h > 24) {
        setSaveError(`Invalid hours "${e.hours}" on ${e.date}. Must be 0-24.`);
        return;
      }
    }
    // Check total per day
    const byDate: Record<string, number> = {};
    for (const e of localEntries) { byDate[e.date] = (byDate[e.date] || 0) + (parseFloat(e.hours) || 0); }
    for (const [d, total] of Object.entries(byDate)) {
      if (total > 24) { setSaveError(`${d}: total ${total}h exceeds 24h limit.`); return; }
    }
    saveMut.mutate({ entries: localEntries.map(({ _key, ...rest }) => rest) });
  };
  const isFutureMonth = ts ? (() => {
    const now = new Date();
    return ts.year > now.getFullYear() || (ts.year === now.getFullYear() && ts.month > now.getMonth() + 1);
  })() : false;

  const doSubmit = (confirmZero = false) => {
    submitMut.mutate(confirmZero ? { confirm_zero: true } : {});
  };

  const handleSubmit = () => {
    if (monthlyTotal === 0) { setConfirmSubmitEmpty(true); return; }
    if (isFutureMonth) { setConfirmFutureSubmit(true); return; }
    doSubmit();
  };
  const handleAttachUpload = async (file: File) => {
    const fd = new FormData(); fd.append("file", file);
    await apiUpload(`/timesheets/${id}/attachments`, fd);
    qc.invalidateQueries({ queryKey: ["timesheet", id] }); qc.invalidateQueries({ queryKey: ["timesheet-audit", id] });
  };
  const handleAttachDelete = async (attId: string) => {
    await api(`/timesheets/${id}/attachments/${attId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["timesheet", id] }); qc.invalidateQueries({ queryKey: ["timesheet-audit", id] });
  };

  // ---- Render ----
  if (tsQuery.isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  if (!ts) return <div className="flex items-center justify-center h-64 text-gray-400">Timesheet not found</div>;

  const approvalFlow = placement?.approval_flow;
  const attachments: TimesheetAttachment[] = ts.attachments ?? [];
  const showSubmit = ownsTimesheet && isDraft;
  const showWithdraw = ownsTimesheet && ts.status === "SUBMITTED";
  const showDelete = ownsTimesheet && isDraft;
  const showClientApprove = isClientContact && ts.status === "SUBMITTED" && approvalFlow === "CLIENT_THEN_BROKER";
  const showBrokerApprove = isBrokerOrAdmin && (ts.status === "SUBMITTED" || ts.status === "CLIENT_APPROVED");
  const showReject = (isClientContact && ts.status === "SUBMITTED" && approvalFlow === "CLIENT_THEN_BROKER") ||
    (isBrokerOrAdmin && (ts.status === "SUBMITTED" || ts.status === "CLIENT_APPROVED"));

  const handleDelete = () => {
    const hasEntries = (ts.entries?.length ?? 0) > 0 || localEntries.length > 0;
    if (hasEntries) {
      setConfirmDelete(true);
    } else {
      deleteMut.mutate();
    }
  };

  return (
    <div data-testid="timesheet-detail" className="space-y-6">
      {/* Rejection Banner */}
      {ts.rejection_reason && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800">
            Rejected{ts.rejected_by ? ` by ${ts.rejected_by.full_name}` : ""}
          </p>
          <p className="text-sm text-yellow-700 mt-1">{ts.rejection_reason}</p>
        </div>
      )}

      {/* Header */}
      <div className="bg-surface border rounded-lg p-6">
        {/* Title: client → contractor */}
        <div className="flex items-center justify-between mb-3">
          <div>
            {placement && (
              <>
                <h1 className="text-lg font-semibold">
                  {placement.client.company_name} &rarr; {placement.title || placement.contractor.full_name}
                </h1>
                {placement.title && (
                  <p className="text-sm text-gray-500">{placement.contractor.full_name}</p>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge value={ts.status} />
            <span className="text-sm text-gray-500">Total: <span className="font-semibold text-gray-900">{ts.total_hours}h</span></span>
            {placement && placement.client_rate && isBrokerOrAdmin && (
              <span className="text-xs text-gray-400 ml-1">
                {formatCurrency(placement.client_rate, placement.currency)} / {formatCurrency(placement.contractor_rate, placement.currency)}
              </span>
            )}
          </div>
        </div>
        {/* Month nav: fixed-width arrows + month name */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0">
            <button data-testid="ts-month-prev" onClick={() => monthNav.prev && navigateMonth(monthNav.prev)}
              disabled={!monthNav.prev}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-default w-8 flex justify-center"
              title={monthNav.prev ? `${new Date(monthNav.prev.year, monthNav.prev.month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}${monthNav.prev.id ? "" : " (new)"}` : ""}>
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium min-w-[160px] text-center">
              {new Date(ts.year, ts.month - 1).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
            </span>
            <button data-testid="ts-month-next" onClick={() => monthNav.next && navigateMonth(monthNav.next)}
              disabled={!monthNav.next}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-default w-8 flex justify-center"
              title={monthNav.next ? `${new Date(monthNav.next.year, monthNav.next.month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}${monthNav.next.id ? "" : " (new)"}` : ""}>
              <ChevronRight size={18} />
            </button>
          </div>
          {/* Action buttons — moved here */}
          <div className="flex items-center gap-2">
            {showSubmit && (
              <button data-testid="ts-submit-btn" onClick={handleSubmit} disabled={submitMut.isPending}
                className="px-4 py-1.5 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50">
                {submitMut.isPending ? "Submitting..." : "Submit"}
              </button>
            )}
            {showWithdraw && (
              <button data-testid="ts-withdraw-btn" onClick={() => setWithdrawOpen(true)} disabled={withdrawMut.isPending}
                className="px-4 py-1.5 border border-amber-300 text-amber-700 bg-amber-50 rounded text-sm hover:bg-amber-100 disabled:opacity-50">
                {withdrawMut.isPending ? "Withdrawing..." : "Withdraw"}
              </button>
            )}
            {showClientApprove && (
              <button data-testid="ts-approve-btn" onClick={() => clientApproveMut.mutate()} disabled={clientApproveMut.isPending}
                className="px-4 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">
                {clientApproveMut.isPending ? "Approving..." : "Approve"}
              </button>
            )}
            {showBrokerApprove && (
              <button data-testid="ts-approve-btn" onClick={() => approveMut.mutate()} disabled={approveMut.isPending}
                className="px-4 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">
                {approveMut.isPending ? "Approving..." : "Approve"}
              </button>
            )}
            {showReject && (
              <button data-testid="ts-reject-btn" onClick={() => setRejectModalOpen(true)}
                className="px-4 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700">Reject</button>
            )}
            {showDelete && (
              <button data-testid="ts-delete-btn" onClick={handleDelete} disabled={deleteMut.isPending}
                className="px-4 py-1.5 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50 disabled:opacity-50">
                {deleteMut.isPending ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button onClick={() => setActiveTab("entries")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "entries" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Entries
        </button>
        <button onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "history" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          History
        </button>
      </div>

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="border rounded-lg p-6">
          {auditQuery.isLoading && <p className="text-sm text-gray-400 text-center py-4">Loading...</p>}
          {!auditQuery.isLoading && (auditQuery.data?.data?.length ?? 0) === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No history yet.</p>
          )}
          {(auditQuery.data?.data?.length ?? 0) > 0 && (
            <div className="space-y-3">
              {auditQuery.data!.data.map((entry) => (
                <div key={entry.id} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${
                      entry.action === "REJECTED" ? "bg-red-500"
                      : entry.action === "APPROVED" ? "bg-green-500"
                      : entry.action === "SUBMITTED" ? "bg-blue-500"
                      : entry.action === "WITHDRAWN" ? "bg-amber-500"
                      : "bg-gray-400"
                    }`} />
                    <div className="w-px flex-1 bg-gray-200" />
                  </div>
                  <div className="pb-4 min-w-0">
                    <p className="font-medium text-gray-900">{entry.title}</p>
                    {entry.text && <p className="text-gray-500">{entry.text}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDateTime(entry.created_at)}
                      {entry.created_by && ` · ${entry.created_by.full_name}`}
                    </p>
                    {(entry.data_before || entry.data_after) && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        {[
                          { label: "Before", data: entry.data_before, bg: "bg-red-50 text-red-800 border-red-200" },
                          { label: "After", data: entry.data_after, bg: "bg-green-50 text-green-800 border-green-200" },
                        ].map(({ label, data, bg }) => data && (
                          <div key={label} className={`${bg} border rounded p-2 overflow-hidden`}>
                            <p className="font-semibold mb-1">{label}</p>
                            {Object.entries(data).filter(([k]) => k !== "entries").map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-2">
                                <span className="text-gray-500 truncate">{k}</span>
                                <span className="font-mono truncate">{v == null ? "—" : String(v)}</span>
                              </div>
                            ))}
                            {Array.isArray(data.entries) && (
                              <details className="mt-1">
                                <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                                  {(data.entries as unknown[]).length} entries
                                </summary>
                                <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                                  {(data.entries as { date: string; hours: string; task: string }[]).map((e, i) => (
                                    <div key={i} className="flex gap-2 font-mono">
                                      <span>{e.date}</span>
                                      <span>{e.hours}h</span>
                                      {e.task && <span className="text-gray-400 truncate">{e.task}</span>}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Time Entries — Calendar / Detailed unified view */}
      {activeTab === "entries" && (<><div data-testid="entry-grid" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Time Entries</h2>
          <div className="flex items-center gap-2">
            <button
              data-testid="ts-toggle-detailed"
              onClick={() => setShowDetailed(!showDetailed)}
              className="px-3 py-1 border rounded text-sm text-gray-600 hover:bg-gray-50"
            >
              {showDetailed ? "Calendar View" : "Detailed View"}
            </button>
            {canEdit && (
              <>
                <button
                  data-testid="ts-prefill-btn"
                  onClick={() => {
                    const existingByDate: Record<string, number> = {};
                    for (const e of localEntries) {
                      existingByDate[e.date] = (existingByDate[e.date] || 0) + (parseFloat(e.hours) || 0);
                    }
                    const newEntries: LocalEntry[] = [];
                    const skippedWeekendHoliday: string[] = [];
                    const skippedPartial: string[] = [];
                    for (const iso of enabledDates) {
                      const dt = new Date(iso + "T00:00:00");
                      const dow = dt.getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      const isHoliday = holidayMap.has(iso);
                      const hasEntry = iso in existingByDate;
                      if (hasEntry) {
                        if (isWeekend || isHoliday) {
                          skippedWeekendHoliday.push(`${iso.slice(5)} (${isHoliday ? holidayMap.get(iso) : "weekend"})`);
                        } else if (existingByDate[iso] < 8) {
                          skippedPartial.push(`${iso.slice(5)} (${existingByDate[iso]}h)`);
                        }
                        continue;
                      }
                      if (isWeekend || isHoliday) continue;
                      newEntries.push({ _key: makeKey(), date: iso, task_name: "", hours: "8", notes: "" });
                    }
                    if (newEntries.length) {
                      setEntries((prev) => [...(prev ?? []), ...newEntries]);
                      setDirty(true);
                    }
                    const msgs: string[] = [];
                    if (newEntries.length) msgs.push(`Filled ${newEntries.length} working days with 8h.`);
                    else msgs.push("No days to fill.");
                    if (skippedWeekendHoliday.length) msgs.push(`Left intact (weekend/holiday): ${skippedWeekendHoliday.join(", ")}`);
                    if (skippedPartial.length) msgs.push(`Left intact (already has hours): ${skippedPartial.join(", ")}`);
                    setPrefillInfo(msgs.join(" "));
                  }}
                  className="px-3 py-1 border border-brand-300 text-brand-700 bg-brand-50 rounded text-sm hover:bg-brand-100"
                >
                  Prefill Working Days
                </button>
                <button data-testid="ts-calendar-save" onClick={handleSave} disabled={!dirty || saveMut.isPending}
                  className="px-4 py-1 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50">
                  {saveMut.isPending ? "Saving..." : "Save"}
                </button>
              </>
            )}
          </div>
          {saveError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{saveError}</div>
          )}
          {prefillInfo && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-start justify-between">
              <span>{prefillInfo}</span>
              <button onClick={() => setPrefillInfo("")} className="ml-2 text-amber-500 hover:text-amber-700 shrink-0">&times;</button>
            </div>
          )}
        </div>

        {!showDetailed ? (
          /* ── Calendar month grid ── */
          <div data-testid="ts-calendar">
            {(() => {
              const daysInMonth = new Date(ts.year, ts.month, 0).getDate();
              const firstDow = (new Date(ts.year, ts.month - 1, 1).getDay() + 6) % 7;
              const pStart = placementDates?.start_date ? new Date(placementDates.start_date + "T00:00:00") : null;
              const pEnd = placementDates?.end_date ? new Date(placementDates.end_date + "T00:00:00") : null;

              // Build hours-by-date from local entries (editable) or server entries (read-only)
              const sourceEntries = canEdit ? localEntries : (ts.entries ?? []);
              const hoursByDate: Record<string, number> = {};
              const countByDate: Record<string, number> = {};
              for (const e of sourceEntries) {
                const d = "date" in e ? e.date : "";
                const h = parseFloat(String("hours" in e ? e.hours : 0)) || 0;
                hoursByDate[d] = (hoursByDate[d] || 0) + h;
                countByDate[d] = (countByDate[d] || 0) + 1;
              }

              const handleCalendarChange = (iso: string, value: string) => {
                const count = countByDate[iso] || 0;
                if (count > 1) return; // multi-entry — blocked
                const hours = value;
                if (count === 1) {
                  // Update the single existing entry
                  const entry = localEntries.find((e) => e.date === iso);
                  if (entry) updateEntry(entry._key, "hours", hours);
                } else {
                  // Create new entry
                  const key = makeKey();
                  setEntries((prev) => [...(prev ?? []), { _key: key, date: iso, task_name: "", hours, notes: "" }]);
                  setDirty(true);
                }
              };

              const calTotal = Object.values(hoursByDate).reduce((s, h) => s + h, 0);

              const cells: React.ReactNode[] = [];
              for (let i = 0; i < firstDow; i++) {
                cells.push(<div key={`e-${i}`} className="h-18 border border-gray-100 bg-gray-50/50" />);
              }
              for (let d = 1; d <= daysInMonth; d++) {
                const dt = new Date(ts.year, ts.month - 1, d);
                const iso = `${ts.year}-${String(ts.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                const isHoliday = holidayMap.has(iso);
                const holidayName = holidayMap.get(iso);
                const outOfRange = (pStart && dt < pStart) || (pEnd && dt > pEnd);
                const hours = hoursByDate[iso] || 0;
                const entryCount = countByDate[iso] || 0;
                const isMulti = entryCount > 1;
                const cellEditable = canEdit && !outOfRange;

                cells.push(
                  <div
                    key={iso}
                    data-testid={`ts-calendar-day-${iso}`}
                    className={`h-18 border p-1.5 flex flex-col ${
                      outOfRange ? "border-gray-100 bg-gray-100 opacity-40"
                      : isMulti && cellEditable ? "border-dashed border-amber-300 bg-amber-50/30"
                      : isHoliday ? "border-red-200 bg-red-50"
                      : isWeekend ? "border-gray-100 bg-gray-50"
                      : "border-gray-100 bg-surface"
                    }`}
                    title={isHoliday ? (holidayName ?? "Public holiday") : isMulti && cellEditable ? "Multiple entries — use Detailed View to edit" : ""}
                  >
                    <span className={`text-xs ${isHoliday ? "text-red-500 font-medium" : isWeekend ? "text-gray-400" : "text-gray-500"}`}>{d}</span>
                    {cellEditable && !isMulti ? (
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        value={hours || ""}
                        onChange={(e) => handleCalendarChange(iso, e.target.value)}
                        className="mt-auto w-full text-sm font-semibold text-brand-600 bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:border-brand-600 p-0 text-center"
                        placeholder="—"
                      />
                    ) : (
                      <>
                        {hours > 0 && !outOfRange && (
                          <span className={`mt-auto text-sm font-semibold ${isMulti ? "text-amber-600" : "text-brand-600"}`}>
                            {hours}h{isMulti ? " *" : ""}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              }

              return (
                <div>
                  <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500 mb-1">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dn) => (
                      <div key={dn} className="py-1">{dn}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">{cells}</div>
                  <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
                    <span>Total: <span className="font-semibold">{calTotal.toFixed(2)}h</span></span>
                    {canEdit && Object.values(countByDate).some((c) => c > 1) && (
                      <span className="text-xs text-amber-600">* Days with multiple entries — switch to Detailed View to edit</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          /* ── Detailed entry list ── */
          <div>
            {canEdit && (
              <div className="mb-2 flex gap-2">
                {allMonthDates.filter((d) => enabledDateSet.has(d)).slice(0, 1).length > 0 && (
                  <button onClick={() => {
                    const firstAvail = allMonthDates.find((d) => enabledDateSet.has(d));
                    if (firstAvail) addEntry(firstAvail);
                  }} className="text-xs text-brand-600 hover:underline">+ Add Entry</button>
                )}
              </div>
            )}
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">Hours</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                    {canEdit && <th className="px-4 py-2 w-16" />}
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-gray-200">
                  {canEdit ? (
                    localEntries.map((entry) => {
                      const enabled = enabledDateSet.has(entry.date);
                      return (
                        <tr key={entry._key}>
                          <td className="px-4 py-2">
                            <select value={entry.date} onChange={(e) => updateEntry(entry._key, "date", e.target.value)}
                              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-600">
                              {allMonthDates.filter((d) => enabledDateSet.has(d)).map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <input type="text" placeholder="Task" value={entry.task_name} onChange={(e) => updateEntry(entry._key, "task_name", e.target.value)}
                              disabled={!enabled} className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-600" />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" step="0.25" min="0" max="24" placeholder="0" value={entry.hours} onChange={(e) => updateEntry(entry._key, "hours", e.target.value)}
                              disabled={!enabled} className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-600" />
                          </td>
                          <td className="px-4 py-2">
                            <input type="text" placeholder="Notes" value={entry.notes} onChange={(e) => updateEntry(entry._key, "notes", e.target.value)}
                              disabled={!enabled} className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-600" />
                          </td>
                          <td className="px-2 py-2">
                            <button onClick={() => removeEntry(entry._key)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    (ts.entries ?? []).map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-2 text-sm">{entry.date}</td>
                        <td className="px-4 py-2 text-sm">{entry.task_name}</td>
                        <td className="px-4 py-2 text-sm">{entry.hours}h</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{entry.notes || "—"}</td>
                      </tr>
                    ))
                  )}
                  {((canEdit ? localEntries : (ts.entries ?? [])).length === 0) && (
                    <tr><td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-gray-400 text-sm">No entries</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-2 text-sm" colSpan={2}>Total</td>
                    <td className="px-4 py-2 text-sm">{canEdit ? monthlyTotal.toFixed(2) : ts.total_hours}h</td>
                    <td colSpan={canEdit ? 2 : 1} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium">Attachments</h2>
        {canEdit && <FileUpload onUpload={handleAttachUpload} />}
        {attachments.length > 0 ? (
          <div className="border rounded-lg divide-y">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <a href={`/api/v1/timesheets/${id}/attachments/${att.id}/download`} className="text-sm font-medium text-brand-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    {att.file_name}
                  </a>
                  <p className="text-xs text-gray-500">{(att.file_size_bytes / 1024).toFixed(1)} KB &middot; {formatDate(att.uploaded_at)}</p>
                </div>
                {canEdit && (
                  <button onClick={() => handleAttachDelete(att.id)} className="text-red-600 hover:text-red-700 text-sm">Delete</button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No attachments</p>
        )}
      </div>
      </>)}

      {/* Confirm empty submit */}
      <ConfirmDialog open={confirmSubmitEmpty} title="Submit with 0 Hours?"
        message="This timesheet has no logged hours. Are you sure?" confirmLabel="Submit Anyway"
        onConfirm={() => { setConfirmSubmitEmpty(false); doSubmit(true); }}
        onCancel={() => setConfirmSubmitEmpty(false)} />

      <ConfirmDialog open={confirmFutureSubmit} title="Future Month"
        message="You are submitting a timesheet for a future month. Are you sure?" confirmLabel="Submit"
        onConfirm={() => { setConfirmFutureSubmit(false); doSubmit(); }}
        onCancel={() => setConfirmFutureSubmit(false)} />

      <ConfirmDialog open={confirmDelete} title="Delete Timesheet?"
        message="This timesheet has entries that will be permanently deleted. Are you sure?"
        confirmLabel="Delete" destructive
        onConfirm={() => { setConfirmDelete(false); deleteMut.mutate(); }}
        onCancel={() => setConfirmDelete(false)} />

      <ConfirmDialog open={withdrawOpen} title="Withdraw Timesheet?"
        message="This will move the timesheet back to DRAFT status. You can edit and resubmit it."
        confirmLabel="Withdraw"
        onConfirm={() => { setWithdrawOpen(false); withdrawMut.mutate(); }}
        onCancel={() => setWithdrawOpen(false)} />

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setRejectModalOpen(false)} />
          <div data-testid="reject-modal" className="relative bg-surface rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-3">Reject Timesheet</h3>
            <textarea data-testid="reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              rows={4} className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              placeholder="Reason for rejection..." />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => { setRejectModalOpen(false); setRejectReason(""); }} className="px-4 py-2 border rounded text-sm">Cancel</button>
              <button data-testid="reject-confirm" onClick={() => rejectMut.mutate({ reason: rejectReason })}
                disabled={!rejectReason.trim() || rejectMut.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50">
                {rejectMut.isPending ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
