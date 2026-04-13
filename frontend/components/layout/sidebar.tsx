"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Users, Building2, HardHat, Briefcase, Clock,
  FileText, FolderOpen, UserCog, Settings, ScrollText, PanelLeftClose, PanelLeft, Menu, UserCheck, UserSearch,
  AlertCircle, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getAccessToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/api";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  more?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Clients", icon: Building2, href: "/clients" },
    { label: "Contractors", icon: HardHat, href: "/contractors" },
    { label: "Placements", icon: Briefcase, href: "/placements" },
    { label: "Timesheets", icon: Clock, href: "/timesheets" },
    { label: "Invoices", icon: FileText, href: "/invoices" },
    { label: "Candidates", icon: UserSearch, href: "/candidates", more: true },
    { label: "Brokers", icon: UserCheck, href: "/brokers", more: true },
    { label: "Users", icon: Users, href: "/users", more: true },
    { label: "Documents", icon: FolderOpen, href: "/documents", more: true },
    { label: "Audit", icon: ScrollText, href: "/audit", more: true },
    { label: "Settings", icon: Settings, href: "/settings", more: true },
  ],
  BROKER: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Clients", icon: Building2, href: "/clients" },
    { label: "Contractors", icon: HardHat, href: "/contractors" },
    { label: "Placements", icon: Briefcase, href: "/placements" },
    { label: "Timesheets", icon: Clock, href: "/timesheets" },
    { label: "Invoices", icon: FileText, href: "/invoices" },
    { label: "Candidates", icon: UserSearch, href: "/candidates", more: true },
    { label: "Documents", icon: FolderOpen, href: "/documents", more: true },
  ],
  CONTRACTOR: [
    { label: "My Timesheets", icon: Clock, href: "/timesheets" },
    { label: "My Placements", icon: Briefcase, href: "/placements" },
    { label: "My Invoices", icon: FileText, href: "/invoices" },
    { label: "My Profile", icon: UserCog, href: "/profile" },
  ],
  CLIENT_CONTACT: [
    { label: "Timesheets", icon: Clock, href: "/" },
    { label: "Invoices", icon: FileText, href: "/invoices" },
    { label: "Documents", icon: FolderOpen, href: "/documents" },
  ],
};

export function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Past issues — background fetch
  const [pastIssues, setPastIssues] = useState<{ count: number; earliest_year: number | null; earliest_month: number | null } | null>(null);
  const [pastLoading, setPastLoading] = useState(false);

  const fetchPastIssues = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setPastLoading(true);
    try {
      const res = await fetch("/api/v1/control/past-issues", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPastIssues({ count: data.count, earliest_year: data.earliest_year, earliest_month: data.earliest_month });
      }
    } catch { /* background, ignore */ }
    finally { setPastLoading(false); }
  }, []);

  useEffect(() => {
    if (user && (user.role === "ADMIN" || user.role === "BROKER")) {
      fetchPastIssues();
    }
  }, [user, fetchPastIssues]);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  if (!user) return null;
  const allItems = NAV[user.role] || [];
  const mainItems = allItems.filter((i) => !i.more);
  const moreItems = allItems.filter((i) => i.more);
  const moreActive = moreItems.some((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  const renderLink = (item: NavItem, onClick?: () => void) => {
    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClick}
        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        className={cn(
          "flex items-center gap-3 px-4 py-2 text-sm transition-colors",
          active ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-600 hover:bg-gray-50"
        )}
      >
        <item.icon size={18} />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <aside
      data-testid="sidebar"
      className={cn(
        "h-screen bg-surface border-r flex flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="h-14 flex items-center px-4 border-b">
        {!collapsed && <span className="text-lg font-bold text-brand-600">TimeHit</span>}
        <button
          data-testid="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("p-1 rounded hover:bg-gray-100 text-gray-500", collapsed ? "mx-auto" : "ml-auto")}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      <nav className="flex-1 py-2 space-y-0.5 overflow-y-auto">
        {mainItems.map((item) => renderLink(item))}
        {moreItems.length > 0 && (
          <div ref={moreRef} className="relative">
            <button
              data-testid="nav-more"
              onClick={() => setMoreOpen(!moreOpen)}
              className={cn(
                "flex items-center gap-3 px-4 py-2 text-sm transition-colors w-full",
                moreActive ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <div className="relative">
                <Menu size={18} />
                {pastIssues && pastIssues.count > 0 && (
                  <span
                    role="button"
                    tabIndex={0}
                    title="Go to dashboard (past issues)"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pastIssues.earliest_year && pastIssues.earliest_month) {
                        sessionStorage.setItem("control-year", String(pastIssues.earliest_year));
                        sessionStorage.setItem("control-month", String(pastIssues.earliest_month));
                      }
                      router.push("/");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        e.preventDefault();
                        if (pastIssues.earliest_year && pastIssues.earliest_month) {
                          sessionStorage.setItem("control-year", String(pastIssues.earliest_year));
                          sessionStorage.setItem("control-month", String(pastIssues.earliest_month));
                        }
                        router.push("/");
                      }
                    }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse cursor-pointer hover:scale-125 transition-transform"
                  >
                    {pastIssues.count > 9 ? "!" : pastIssues.count}
                  </span>
                )}
              </div>
              {!collapsed && <span>More</span>}
            </button>
            {moreOpen && (
              <div className={cn(
                "absolute z-50 bg-surface border rounded-lg shadow-lg py-1 min-w-[180px]",
                collapsed ? "left-full top-0 ml-1" : "left-4 right-4 top-full mt-1"
              )}>
                {moreItems.map((item) => renderLink(item, () => setMoreOpen(false)))}
                {pastIssues && pastIssues.count > 0 && (
                  <div className="border-t mt-1 pt-1 px-2 pb-1">
                    <button
                      onClick={() => {
                        setMoreOpen(false);
                        if (pastIssues.earliest_year && pastIssues.earliest_month) {
                          sessionStorage.setItem("control-year", String(pastIssues.earliest_year));
                          sessionStorage.setItem("control-month", String(pastIssues.earliest_month));
                        }
                        router.push("/");
                      }}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700 animate-pulse"
                    >
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{pastIssues.count} past issue{pastIssues.count !== 1 ? "s" : ""} need attention</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); fetchPastIssues(); }}
                      disabled={pastLoading}
                      className="mt-1 w-full flex items-center justify-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={pastLoading ? "animate-spin" : ""} />
                      Refresh
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
