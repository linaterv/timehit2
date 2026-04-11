"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Upload, Download, Trash2, FileText, MessageSquare, ArrowRight, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/shared/status-badge";
import { CountrySelect } from "@/components/shared/country-select";
import { api, getAccessToken } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Candidate, CandidateActivityInfo, CandidateFileInfo, PaginatedResponse } from "@/types/api";

function downloadFile(url: string, filename: string) {
  const token = getAccessToken();
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    });
}

type Tab = "profile" | "cvs" | "timeline";

const STATUSES = ["AVAILABLE", "PROPOSED", "INTERVIEW", "OFFERED", "PLACED", "UNAVAILABLE", "ARCHIVED"];
const ACTIVITY_TYPES = [
  { value: "NOTE", label: "Note" },
  { value: "PROPOSED", label: "Proposed to Client" },
  { value: "REJECTED", label: "Rejected" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "OFFER", label: "Offer Made" },
];

const ACTIVITY_ICONS: Record<string, string> = {
  NOTE: "💬", STATUS_CHANGE: "🔄", CV_UPLOADED: "📄", CV_REMOVED: "🗑️",
  FILE_ATTACHED: "📎", LINKED: "🔗", UNLINKED: "🔓",
  PROPOSED: "📤", REJECTED: "❌", INTERVIEW: "🎤", OFFER: "💰", PLACED: "✅",
};

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const allowed = user?.role === "ADMIN" || user?.role === "BROKER";

  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [editing, setEditing] = useState(false);

  // Edit form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [formStatus, setFormStatus] = useState("");
  const [formSkills, setFormSkills] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formCurrency, setFormCurrency] = useState("");
  const [formSource, setFormSource] = useState("");
  const [formLinkedin, setFormLinkedin] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Activity form
  const [activityType, setActivityType] = useState("NOTE");
  const [activityText, setActivityText] = useState("");
  const [activityClient, setActivityClient] = useState("");
  const [activityFiles, setActivityFiles] = useState<File[]>([]);
  const [activitySubmitting, setActivitySubmitting] = useState(false);

  // CV upload
  const [cvUploading, setCvUploading] = useState(false);

  const { data: candidate, isLoading } = useApiQuery<Candidate>(
    ["candidate", id], `/candidates/${id}`, allowed && !!id
  );

  const updateMutation = useApiMutation<Candidate, Record<string, unknown>>(
    "PATCH", `/candidates/${id}`, [["candidate", id], ["candidates"]]
  );

  if (!allowed) return <div className="text-center py-12 text-gray-400">Access denied.</div>;
  if (isLoading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!candidate) return <div className="text-center py-12 text-gray-400">Candidate not found.</div>;

  const cvFiles = (candidate.files ?? []).filter((f) => f.file_type === "CV");
  const activities = candidate.activities ?? [];

  const startEdit = () => {
    setFormName(candidate.full_name); setFormEmail(candidate.email); setFormPhone(candidate.phone);
    setFormCountry(candidate.country); setFormStatus(candidate.status); setFormSkills(candidate.skills);
    setFormRate(candidate.desired_rate ?? ""); setFormCurrency(candidate.desired_currency);
    setFormSource(candidate.source); setFormLinkedin(candidate.linkedin_url); setFormNotes(candidate.notes);
    setEditing(true);
  };

  const handleSave = () => {
    const body: Record<string, unknown> = {
      full_name: formName, email: formEmail, phone: formPhone, country: formCountry,
      status: formStatus, skills: formSkills, source: formSource, linkedin_url: formLinkedin, notes: formNotes,
      desired_currency: formCurrency,
    };
    body.desired_rate = formRate || null;
    updateMutation.mutate(body, { onSuccess: () => setEditing(false) });
  };

  const handleCvUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setCvUploading(true);
    const fd = new FormData();
    fd.append("file_type", "CV");
    Array.from(files).forEach((f) => fd.append("file", f));
    try {
      await fetch(`/api/v1/candidates/${id}/files`, {
        method: "POST", body: fd,
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      qc.invalidateQueries({ queryKey: ["candidate", id] });
    } catch { /* ignore */ }
    finally { setCvUploading(false); }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await api(`/candidates/${id}/files/${fileId}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["candidate", id] });
    } catch { /* ignore */ }
  };

  const handleActivitySubmit = async () => {
    if (!activityText.trim() && activityFiles.length === 0) return;
    setActivitySubmitting(true);
    const fd = new FormData();
    fd.append("type", activityType);
    fd.append("text", activityText);
    if (activityClient) fd.append("client_name", activityClient);
    activityFiles.forEach((f) => fd.append("file", f));
    try {
      await fetch(`/api/v1/candidates/${id}/activities`, {
        method: "POST", body: fd,
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      setActivityText(""); setActivityClient(""); setActivityFiles([]); setActivityType("NOTE");
      qc.invalidateQueries({ queryKey: ["candidate", id] });
    } catch { /* ignore */ }
    finally { setActivitySubmitting(false); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "cvs", label: `CVs (${cvFiles.length})` },
    { key: "timeline", label: `Timeline (${activities.length})` },
  ];

  return (
    <div data-testid="candidate-detail-page" className="space-y-6">
      {/* Header */}
      <div className="bg-surface border rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{candidate.full_name}</h1>
              <StatusBadge value={candidate.status} />
            </div>
            {candidate.skills && (
              <div className="flex flex-wrap gap-1 mt-2">
                {candidate.skills.split(",").map((s, i) => (
                  <span key={i} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{s.trim()}</span>
                ))}
              </div>
            )}
            <div className="mt-2 text-sm text-gray-500 space-y-0.5">
              {candidate.email && <p>{candidate.email}</p>}
              {candidate.phone && <p>{candidate.phone}</p>}
              <p>{candidate.country} {candidate.desired_rate && <span>· {candidate.desired_rate} {candidate.desired_currency}/h</span>} {candidate.source && <span>· {candidate.source}</span>}</p>
              {candidate.linkedin_url && (
                <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                  <ExternalLink size={14} /> LinkedIn
                </a>
              )}
            </div>
            {candidate.contractor_id && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded">Linked to contractor</span>
                <button onClick={() => router.push(`/contractors/${candidate.contractor_id}`)}
                  className="text-xs text-brand-600 hover:underline">View <ArrowRight size={12} className="inline" /></button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {!editing && <button onClick={startEdit} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Edit</button>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-0 -mb-px">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile tab */}
      {activeTab === "profile" && (
        <div className="bg-surface border rounded-lg p-6">
          {editing ? (
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
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
                <CountrySelect value={formCountry} onChange={setFormCountry} testId="edit-candidate-country" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skills</label>
                <input type="text" value={formSkills} onChange={(e) => setFormSkills(e.target.value)}
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
                  className="w-full px-3 py-2 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
                <input type="url" value={formLinkedin} onChange={(e) => setFormLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full px-3 py-2 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={4}
                  className="w-full px-3 py-2 border rounded text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50">
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-gray-600 max-w-lg">
              <p><span className="font-medium">Name:</span> {candidate.full_name}</p>
              <p><span className="font-medium">Email:</span> {candidate.email || "—"}</p>
              <p><span className="font-medium">Phone:</span> {candidate.phone || "—"}</p>
              <p><span className="font-medium">Country:</span> {candidate.country}</p>
              <p><span className="font-medium">Status:</span> <StatusBadge value={candidate.status} /></p>
              <p><span className="font-medium">Skills:</span> {candidate.skills || "—"}</p>
              <p><span className="font-medium">Rate:</span> {candidate.desired_rate ? `${candidate.desired_rate} ${candidate.desired_currency}/h` : "—"}</p>
              <p><span className="font-medium">Source:</span> {candidate.source || "—"}</p>
              <p><span className="font-medium">LinkedIn:</span> {candidate.linkedin_url
                ? <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline inline-flex items-center gap-1"><ExternalLink size={14} /> Profile</a>
                : "—"}</p>
              {candidate.notes && (
                <div>
                  <span className="font-medium">Notes:</span>
                  <p className="mt-1 whitespace-pre-wrap text-gray-500">{candidate.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CVs tab */}
      {activeTab === "cvs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">CVs</h2>
            <label className="px-4 py-2 bg-brand-600 text-white rounded text-sm font-medium hover:bg-brand-700 cursor-pointer">
              <Upload size={14} className="inline mr-1" />
              {cvUploading ? "Uploading..." : "Upload CV"}
              <input type="file" accept=".pdf,.doc,.docx" multiple className="hidden"
                onChange={(e) => handleCvUpload(e.target.files)} disabled={cvUploading} />
            </label>
          </div>
          {cvFiles.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">No CVs uploaded yet.</p>
          ) : (
            <div className="border rounded-lg divide-y">
              {cvFiles.map((f) => (
                <div key={f.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{f.original_filename}</p>
                      <p className="text-xs text-gray-400">{(f.file_size / 1024).toFixed(0)} KB · {formatDate(f.uploaded_at)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => downloadFile(`/api/v1/candidates/${id}/files/${f.id}/download`, f.original_filename)}
                      className="p-1.5 text-gray-400 hover:text-brand-600" title="Download">
                      <Download size={16} />
                    </button>
                    <button onClick={() => handleDeleteFile(f.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline tab */}
      {activeTab === "timeline" && (
        <div className="space-y-4">
          {/* Activity form */}
          <div className="bg-surface border rounded-lg p-4 space-y-3">
            <div className="flex gap-3">
              <select value={activityType} onChange={(e) => setActivityType(e.target.value)}
                className="px-3 py-2 border rounded text-sm">
                {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {activityType !== "NOTE" && (
                <input type="text" value={activityClient} onChange={(e) => setActivityClient(e.target.value)}
                  placeholder="Client name..." className="px-3 py-2 border rounded text-sm flex-1 max-w-xs" />
              )}
            </div>
            <textarea value={activityText} onChange={(e) => setActivityText(e.target.value)}
              placeholder="Add note or activity details..." rows={2}
              className="w-full px-3 py-2 border rounded text-sm" />
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-500 cursor-pointer hover:text-brand-600">
                📎 Attach files
                <input type="file" multiple className="hidden"
                  onChange={(e) => setActivityFiles(Array.from(e.target.files ?? []))} />
                {activityFiles.length > 0 && <span className="ml-1 text-brand-600">({activityFiles.length} selected)</span>}
              </label>
              <button onClick={handleActivitySubmit} disabled={activitySubmitting}
                className="px-4 py-2 bg-brand-600 text-white rounded text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                {activitySubmitting ? "Saving..." : "Add"}
              </button>
            </div>
          </div>

          {/* Activity feed */}
          {activities.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a: CandidateActivityInfo) => (
                <div key={a.id} className="flex gap-3 px-1">
                  <div className="text-lg mt-0.5">{ACTIVITY_ICONS[a.type] || "📌"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-500">{a.type.replace(/_/g, " ")}</span>
                      {a.client_name && <span className="text-xs text-brand-600">{a.client_name}</span>}
                      <span className="text-xs text-gray-400">{formatDate(a.created_at)}</span>
                      {a.created_by && <span className="text-xs text-gray-400">by {a.created_by}</span>}
                    </div>
                    {a.text && <p className="text-sm text-gray-700 mt-0.5">{a.text}</p>}
                    {a.old_value && a.new_value && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        <StatusBadge value={a.old_value} /> <ArrowRight size={10} className="inline mx-1" /> <StatusBadge value={a.new_value} />
                      </p>
                    )}
                    {a.files?.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {a.files.map((f: CandidateFileInfo) => (
                          <button key={f.id} onClick={() => downloadFile(`/api/v1/candidates/${a.candidate_id}/files/${f.id}/download`, f.original_filename)}
                            className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                            📎 {f.original_filename} <span className="text-gray-400">({(f.file_size / 1024).toFixed(0)} KB)</span>
                          </button>
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
    </div>
  );
}
