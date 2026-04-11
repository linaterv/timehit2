"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Upload, FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { api, getAccessToken } from "@/lib/api";
import { StatusBadge } from "@/components/shared/status-badge";
import { CountrySelect } from "@/components/shared/country-select";
import { SlideOver } from "@/components/forms/slide-over";
import type { Candidate, CandidateSearchResult, PaginatedResponse } from "@/types/api";

const STATUSES = ["AVAILABLE", "PROPOSED", "INTERVIEW", "OFFERED", "PLACED", "UNAVAILABLE", "ARCHIVED"];

export default function CandidatesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAllowed = user?.role === "ADMIN" || user?.role === "BROKER";

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCountry, setFormCountry] = useState("LT");
  const [formSkills, setFormSkills] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formCurrency, setFormCurrency] = useState("EUR");
  const [formSource, setFormSource] = useState("");
  const [formLinkedin, setFormLinkedin] = useState("");
  const [importedCv, setImportedCv] = useState<File | null>(null);
  const [cvParsing, setCvParsing] = useState(false);



  // FTS search
  const [ftsQuery, setFtsQuery] = useState("");
  const [ftsResults, setFtsResults] = useState<CandidateSearchResult[] | null>(null);
  const [ftsLoading, setFtsLoading] = useState(false);

  const listParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("per_page", "25");
    p.set("sort", sort);
    p.set("order", order);
    if (statusFilter) p.set("status", statusFilter);
    return p.toString();
  }, [page, sort, order, statusFilter]);

  const { data: listData, isLoading: listLoading } = useApiQuery<PaginatedResponse<Candidate>>(
    ["candidates", listParams],
    `/candidates?${listParams}`,
    isAllowed && !ftsQuery
  );

  const createMutation = useApiMutation<Candidate, Record<string, unknown>>(
    "POST", "/candidates", [["candidates"]]
  );

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) { setFtsQuery(""); setFtsResults(null); return; }
    setFtsQuery(q);
    setFtsLoading(true);
    try {
      const res = await api<{ data: CandidateSearchResult[]; meta: { total: number } }>(`/candidates/search?q=${encodeURIComponent(q)}`);
      setFtsResults(res.data);
    } catch { setFtsResults([]); }
    finally { setFtsLoading(false); }
  };

  const clearSearch = () => { setSearchQuery(""); setFtsQuery(""); setFtsResults(null); };

  const resetForm = () => {
    setFormName(""); setFormEmail(""); setFormPhone(""); setFormCountry("LT");
    setFormSkills(""); setFormRate(""); setFormCurrency("EUR"); setFormSource(""); setFormLinkedin("");
    setImportedCv(null);
  };

  const handleImportCv = async (file: File) => {
    setCvParsing(true);
    setImportedCv(file);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = getAccessToken();
      const res = await fetch("/api/v1/candidates/parse-cv", {
        method: "POST", body: fd,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.full_name) setFormName(data.full_name);
        if (data.email) setFormEmail(data.email);
        if (data.phone) setFormPhone(data.phone);
        if (data.country) setFormCountry(data.country);
        if (data.skills) setFormSkills(data.skills);
        if (data.linkedin_url) setFormLinkedin(data.linkedin_url);
      }
    } catch { /* ignore */ }
    finally { setCvParsing(false); }
  };

  if (!isAllowed) {
    return <div className="text-center py-12 text-gray-400">Access denied.</div>;
  }

  const candidates = ftsQuery ? (ftsResults ?? []) : (listData?.data ?? []);
  const isSearchMode = !!ftsQuery;

  return (
    <div data-testid="candidates-page" className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            data-testid="candidates-search"
            type="text"
            placeholder="Search candidates... partial words work (e.g. recrui, jav, spring)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full pl-10 pr-4 py-3 border-2 border-brand-200 rounded-lg text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <button onClick={handleSearch}
          className="px-5 py-3 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700">
          Search
        </button>
        {isSearchMode && (
          <button onClick={clearSearch} className="px-4 py-3 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Clear
          </button>
        )}
        <button onClick={() => { resetForm(); setCreateOpen(true); }}
          className="px-5 py-3 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 ml-auto">
          Create Candidate
        </button>
      </div>

      {/* Filters (list mode only) */}
      {!isSearchMode && (
        <div className="flex gap-3 items-center">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {/* Results */}
      {(listLoading || ftsLoading) ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {isSearchMode ? `No results for "${ftsQuery}"` : "No candidates yet."}
        </div>
      ) : (
        <div className="space-y-2">
          {isSearchMode && (
            <p className="text-sm text-gray-500">{ftsResults?.length} result{ftsResults?.length !== 1 ? "s" : ""} for &ldquo;{ftsQuery}&rdquo;</p>
          )}
          {candidates.map((c) => (
            <div
              key={c.id}
              onClick={() => router.push(`/candidates/${c.id}`)}
              className="bg-surface border rounded-lg p-4 cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{c.full_name}</span>
                    <StatusBadge value={c.status} />
                    <span className="text-xs text-gray-400">{c.country}</span>
                  </div>
                  {c.skills && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.skills.split(",").map((s, i) => (
                        <span key={i} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{s.trim()}</span>
                      ))}
                    </div>
                  )}
                  {isSearchMode && (c as CandidateSearchResult).snippet && (
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: (c as CandidateSearchResult).snippet }} />
                  )}
                </div>
                <div className="text-right text-xs text-gray-400 shrink-0 ml-4">
                  {c.desired_rate && <p className="font-medium text-gray-600">{c.desired_rate} {c.desired_currency}/h</p>}
                  {c.cv_count != null && c.cv_count > 0 && <p>{c.cv_count} CV{c.cv_count !== 1 ? "s" : ""}</p>}
                  {c.source && <p>{c.source}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination (list mode only) */}
      {!isSearchMode && listData?.meta && listData.meta.total_pages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-30">Prev</button>
          <span className="px-3 py-1 text-sm text-gray-500">Page {page} of {listData.meta.total_pages}</span>
          <button disabled={page >= listData.meta.total_pages} onClick={() => setPage(page + 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-30">Next</button>
        </div>
      )}

      {/* Create slide-over */}
      <SlideOver
        open={createOpen} onClose={() => setCreateOpen(false)}
        title="New Candidate"
        onSave={() => {
          const body: Record<string, unknown> = { full_name: formName, email: formEmail, phone: formPhone, country: formCountry, skills: formSkills, source: formSource, linkedin_url: formLinkedin };
          if (formRate) body.desired_rate = formRate;
          if (formCurrency) body.desired_currency = formCurrency;
          createMutation.mutate(body, {
            onSuccess: async (data) => {
              if (importedCv) {
                const fd = new FormData();
                fd.append("file_type", "CV");
                fd.append("file", importedCv);
                const token = getAccessToken();
                await fetch(`/api/v1/candidates/${data.id}/files`, {
                  method: "POST", body: fd,
                  headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {});
              }
              setCreateOpen(false); resetForm(); router.push(`/candidates/${data.id}`);
            },
          });
        }}
        saving={createMutation.isPending || cvParsing}
        testId="create-candidate-slideover"
      >
        <div className="space-y-4">
          <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            importedCv ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-600"
          }`}>
            {cvParsing ? (
              <span className="text-sm">Parsing CV...</span>
            ) : importedCv ? (
              <>
                <FileText size={16} />
                <span className="text-sm font-medium">{importedCv.name}</span>
                <button type="button" onClick={(e) => { e.preventDefault(); setImportedCv(null); }}
                  className="text-xs text-gray-400 hover:text-red-500 ml-1">&times;</button>
              </>
            ) : (
              <>
                <Upload size={16} />
                <span className="text-sm font-medium">Import from PDF</span>
              </>
            )}
            {!importedCv && !cvParsing && (
              <input type="file" accept=".pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportCv(f); e.target.value = ""; }} />
            )}
          </label>
          {createMutation.error ? (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              {((createMutation.error) as unknown as { details?: { field: string; message: string }[] })?.details?.map((d) => d.message).join("; ")
                || ((createMutation.error) as unknown as { message?: string })?.message
                || "Error"}
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <CountrySelect value={formCountry} onChange={setFormCountry} testId="create-candidate-country" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma-separated)</label>
            <input type="text" value={formSkills} onChange={(e) => setFormSkills(e.target.value)}
              placeholder="java, springboot, kubernetes"
              className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Desired Rate</label>
              <input type="number" value={formRate} onChange={(e) => setFormRate(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm" />
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm">
                <option>EUR</option><option>USD</option><option>GBP</option><option>SEK</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <input type="text" value={formSource} onChange={(e) => setFormSource(e.target.value)}
              placeholder="LinkedIn, Referral, Job board..."
              className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
            <input type="url" value={formLinkedin} onChange={(e) => setFormLinkedin(e.target.value)}
              placeholder="https://linkedin.com/in/..."
              className="w-full px-3 py-2 border rounded text-sm" />
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
