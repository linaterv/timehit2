"use client";

import { useState, useEffect } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { formatMonth } from "@/lib/utils";
import type { Timesheet, PaginatedResponse } from "@/types/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface GenerateResult {
  generated: number;
  errors?: string[];
}

export function GenerateInvoicesModal({ open, onClose }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [autoIssue, setAutoIssue] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);

  const { data: timesheetsData, isLoading } = useApiQuery<
    PaginatedResponse<Timesheet>
  >(
    ["timesheets-approved"],
    "/timesheets?status=APPROVED&per_page=200",
    open
  );

  const generateMutation = useApiMutation<
    GenerateResult,
    { timesheet_ids: string[]; auto_issue: boolean }
  >("POST", "/invoices/generate", [["invoices"]]);

  const timesheets = timesheetsData?.data ?? [];

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setAutoIssue(false);
      setResult(null);
    }
  }, [open]);

  const toggleTimesheet = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === timesheets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(timesheets.map((t) => t.id)));
    }
  };

  const handleGenerate = () => {
    generateMutation.mutate(
      {
        timesheet_ids: Array.from(selectedIds),
        auto_issue: autoIssue,
      },
      {
        onSuccess: (data) => {
          setResult(data);
        },
      }
    );
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={handleClose} />
      <div
        data-testid="generate-modal"
        className="relative bg-surface rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Generate Invoices</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {result ? (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="font-medium text-green-800">
                  Successfully generated {result.generated} invoice
                  {result.generated !== 1 ? "s" : ""}
                </p>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-medium text-red-800 mb-2">Errors:</p>
                  <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {isLoading ? (
                <div className="text-center py-8 text-gray-400">
                  Loading approved timesheets...
                </div>
              ) : timesheets.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No approved timesheets without invoices found.
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Select approved timesheets to generate invoices for:
                  </p>

                  <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50">
                      <input
                        type="checkbox"
                        checked={
                          timesheets.length > 0 &&
                          selectedIds.size === timesheets.length
                        }
                        onChange={toggleAll}
                      />
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        Select All ({timesheets.length})
                      </span>
                    </div>
                    {timesheets.map((ts) => (
                      <label
                        key={ts.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(ts.id)}
                          onChange={() => toggleTimesheet(ts.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">
                              {ts.placement?.client.company_name ?? "Unknown Client"}
                            </span>
                            <span className="text-gray-400">&mdash;</span>
                            <span>
                              {ts.placement?.contractor.full_name ?? "Unknown Contractor"}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatMonth(ts.year, ts.month)} &middot;{" "}
                            {ts.total_hours}h
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-2">
                <label
                  data-testid="generate-auto-issue"
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={autoIssue}
                    onChange={(e) => setAutoIssue(e.target.checked)}
                    className="rounded"
                  />
                  Auto-issue generated invoices
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 border rounded text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    data-testid="generate-submit"
                    onClick={handleGenerate}
                    disabled={
                      selectedIds.size === 0 || generateMutation.isPending
                    }
                    className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50"
                  >
                    {generateMutation.isPending
                      ? "Generating..."
                      : `Generate (${selectedIds.size})`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
