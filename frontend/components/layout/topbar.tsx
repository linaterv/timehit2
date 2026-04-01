"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Palette } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/lib/theme-context";
import { useGlobalFilter } from "@/lib/global-filter-context";
import { useApiQuery } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { PaginatedResponse } from "@/types/api";

export function TopBar({ title }: { title?: string }) {
  const { user, logout } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const { clientId, contractorId, setGlobalClient, setGlobalContractor } = useGlobalFilter();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdminOrBroker = user?.role === "ADMIN" || user?.role === "BROKER";

  const { data: clientsData } = useApiQuery<PaginatedResponse<{ id: string; company_name: string }>>(
    ["clients-global-filter"], "/clients?per_page=200", isAdminOrBroker
  );
  const { data: contractorsData } = useApiQuery<PaginatedResponse<{ id: string; user_id: string; full_name: string }>>(
    ["contractors-global-filter"], "/contractors?per_page=200", isAdminOrBroker
  );

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header data-testid="topbar" className="h-14 bg-surface border-b flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        {isAdminOrBroker && (
          <>
            <select
              value={clientId}
              onChange={(e) => setGlobalClient(e.target.value)}
              className="text-xs border rounded px-2 py-1 text-gray-600 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-600 max-w-[160px]"
            >
              <option value="">All Clients</option>
              {(clientsData?.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
            <select
              value={contractorId}
              onChange={(e) => setGlobalContractor(e.target.value)}
              className="text-xs border rounded px-2 py-1 text-gray-600 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-600 max-w-[160px]"
            >
              <option value="">All Contractors</option>
              {(contractorsData?.data ?? []).map((c) => (
                <option key={c.id} value={c.user_id}>{c.full_name}</option>
              ))}
            </select>
          </>
        )}
      </div>
      <div className="relative">
        <button
          data-testid="user-menu"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-medium">
            {user?.full_name?.charAt(0) || "?"}
          </div>
          <span className="hidden sm:inline">{user?.full_name}</span>
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-surface border rounded-lg shadow-sm py-1 z-50">
            <div className="px-3 py-2 text-xs text-gray-500 border-b">
              {user?.email} <span className="ml-1 font-medium">{user?.role}</span>
            </div>
            <div className="border-b">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 px-3 pt-2 pb-1">
                <Palette size={12} /> Theme
              </div>
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    if (user?.id) api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ theme: t.id }) }).catch(() => {});
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                    theme === t.id ? "text-brand-600 bg-brand-50 font-medium" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-gray-300 shrink-0 overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${t.preview.background} 50%, ${t.preview.brand} 50%)` }}
                  />
                  {t.label}
                </button>
              ))}
            </div>
            {user?.role === "CONTRACTOR" && (
              <button
                onClick={() => { router.push("/profile"); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <UserIcon size={14} /> Profile
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
