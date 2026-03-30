"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, Building2, HardHat, Briefcase, Clock,
  FileText, FolderOpen, UserCog, PanelLeftClose, PanelLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/api";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Users", icon: Users, href: "/users" },
    { label: "Clients", icon: Building2, href: "/clients" },
    { label: "Contractors", icon: HardHat, href: "/contractors" },
    { label: "Placements", icon: Briefcase, href: "/placements" },
    { label: "Timesheets", icon: Clock, href: "/timesheets" },
    { label: "Invoices", icon: FileText, href: "/invoices" },
    { label: "Documents", icon: FolderOpen, href: "/documents" },
  ],
  BROKER: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Clients", icon: Building2, href: "/clients" },
    { label: "Contractors", icon: HardHat, href: "/contractors" },
    { label: "Placements", icon: Briefcase, href: "/placements" },
    { label: "Timesheets", icon: Clock, href: "/timesheets" },
    { label: "Invoices", icon: FileText, href: "/invoices" },
    { label: "Documents", icon: FolderOpen, href: "/documents" },
  ],
  CONTRACTOR: [
    { label: "My Timesheets", icon: Clock, href: "/" },
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
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;
  const items = NAV[user.role] || [];

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
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
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
        })}
      </nav>
    </aside>
  );
}
