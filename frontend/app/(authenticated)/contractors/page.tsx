"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/utils";
import type { ContractorProfile, PaginatedResponse, User } from "@/types/api";

export default function ContractorsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState<string>("all");
  const isAdminOrBroker = user?.role === "ADMIN" || user?.role === "BROKER";
  const [sort, setSort] = useState("full_name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => {
    if (!createOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setCreateOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [createOpen]);
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formConfirm, setFormConfirm] = useState("");
  const [formAutoGen, setFormAutoGen] = useState(true);
  const [formShowPwd, setFormShowPwd] = useState(false);
  const [formPwdError, setFormPwdError] = useState("");

  const generatePwd = useCallback(async () => {
    try {
      const data = await api<{ password: string }>("/users/generate-password", { method: "POST" });
      if (data.password) { setFormPassword(data.password); setFormConfirm(data.password); setFormShowPwd(true); }
    } catch {}
  }, []);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", "25");
    params.set("sort", sort);
    params.set("order", order);
    if (search) params.set("search", search);
    if (isActive !== "all") params.set("is_active", isActive);
    return params.toString();
  }, [page, search, isActive, sort, order]);

  const createMutation = useApiMutation<User, Record<string, unknown>>("POST", "/users", [["contractors"]]);

  const { data, isLoading } = useApiQuery<PaginatedResponse<ContractorProfile>>(
    ["contractors", queryParams],
    `/contractors?${queryParams}`
  );

  const columns: Column<ContractorProfile>[] = [
    { key: "code", label: "Code", render: (row) => <span className="font-mono text-xs text-gray-500">{row.code}</span> },
    { key: "full_name", label: "Name", sortable: true },
    {
      key: "placement_summary" as keyof ContractorProfile,
      label: "Placements",
      render: (row) => {
        const s = row.placement_summary;
        if (!s || (s.active_count === 0 && s.inactive_count === 0)) return null;
        return (
          <div className="text-sm">
            {s.recent_active.length > 0 && (
              <div className="space-y-0.5">
                {s.recent_active.map((label, i) => (
                  <div key={i} className="text-gray-700 truncate max-w-[220px]">{label}</div>
                ))}
              </div>
            )}
            <span className="text-xs text-gray-400">
              {s.active_count} active{s.inactive_count > 0 ? ` / ${s.inactive_count} inactive` : ""}
            </span>
          </div>
        );
      },
    },
    {
      key: "is_active" as keyof ContractorProfile,
      label: "Status",
      render: (row) => {
        const inPlacement = (row.placement_summary?.active_count ?? 0) > 0;
        return (
          <span
            data-testid={`active-badge-${row.id}`}
            className={
              inPlacement
                ? "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700"
                : "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500"
            }
          >
            {inPlacement ? "In Placement" : "No Placement"}
          </span>
        );
      },
    },
  ];

  const handleSort = (key: string, newOrder: "asc" | "desc") => {
    setSort(key);
    setOrder(newOrder);
    setPage(1);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleActiveFilter = (value: string) => {
    setIsActive(value);
    setPage(1);
  };

  return (
    <div data-testid="contractors-page" className="space-y-4">
      <div className="flex items-center gap-3">
        {isAdminOrBroker && (
          <button data-testid="create-contractor-btn" onClick={() => { setFormEmail(""); setFormName(""); setFormPassword(""); setFormConfirm(""); setFormAutoGen(true); setFormShowPwd(false); setFormPwdError(""); setCreateOpen(true); generatePwd(); }}
            className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700">Create Contractor</button>
        )}
        <input
          data-testid="contractors-search"
          type="text"
          placeholder="Search contractors..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 w-64"
        />
        <select
          data-testid="contractors-active-filter"
          value={isActive}
          onChange={(e) => handleActiveFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
        >
          <option value="all">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {isLoading ? (
        <div data-testid="contractors-loading" className="text-center py-8 text-gray-400">
          Loading...
        </div>
      ) : (
        <DataTable<ContractorProfile>
          testId="contractors-table"
          columns={columns}
          data={data?.data ?? []}
          meta={data?.meta}
          onPageChange={setPage}
          onSort={handleSort}
          sort={sort}
          order={order}
          onRowClick={(row) => router.push(`/contractors/${row.id}`)}
        />
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setCreateOpen(false)} />
          <div data-testid="create-contractor-dialog" className="relative bg-surface rounded-xl shadow-lg w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">New Contractor</h3>
              <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            {createMutation.error ? <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              {(() => {
                const e = createMutation.error as { message?: string; details?: { field: string; message: string }[] };
                if (e.details?.length) return e.details.map((d, i) => <div key={i}><strong>{d.field}:</strong> {d.message}</div>);
                return e.message || "Failed to create contractor";
              })()}
            </div> : null}
            {formPwdError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{formPwdError}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={formAutoGen} onChange={(e) => {
                setFormAutoGen(e.target.checked);
                if (e.target.checked) { generatePwd(); } else { setFormPassword(""); setFormConfirm(""); setFormShowPwd(false); }
              }} className="rounded" />
              Auto-generate password
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input type={formShowPwd ? "text" : "password"} value={formPassword}
                  onChange={(e) => { setFormPassword(e.target.value); setFormPwdError(""); }}
                  readOnly={formAutoGen}
                  className={`w-full border rounded-md px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-brand-600 ${formAutoGen ? "bg-gray-50" : ""}`} />
                <button type="button" onClick={() => setFormShowPwd(!formShowPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {formShowPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {!formAutoGen && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type={formShowPwd ? "text" : "password"} value={formConfirm}
                  onChange={(e) => { setFormConfirm(e.target.value); setFormPwdError(""); }}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600" />
              </div>
            )}
            {formAutoGen && formPassword && (
              <button type="button" onClick={generatePwd} className="text-xs text-brand-600 hover:text-brand-700">
                Regenerate password
              </button>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCreateOpen(false)} className="px-4 py-2 border rounded-md text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                data-testid="create-contractor-submit"
                disabled={createMutation.isPending}
                onClick={async () => {
                  if (!formAutoGen && formPassword !== formConfirm) { setFormPwdError("Passwords do not match"); return; }
                  if (!formAutoGen && !formPassword) { setFormPwdError("Password is required"); return; }
                  let pwd = formPassword;
                  if (formAutoGen && !pwd) {
                    try {
                      const d = await api<{ password: string }>("/users/generate-password", { method: "POST" });
                      pwd = d.password;
                      setFormPassword(pwd); setFormConfirm(pwd); setFormShowPwd(true);
                    } catch { setFormPwdError("Failed to generate password"); return; }
                  }
                  createMutation.mutate({ email: formEmail, full_name: formName, password: pwd, role: "CONTRACTOR" }, { onSuccess: () => setCreateOpen(false) });
                }}
                className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                {createMutation.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
