"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Palette } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/lib/theme-context";

export function TopBar({ title }: { title?: string }) {
  const { user, logout } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header data-testid="topbar" className="h-14 bg-surface border-b flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
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
                  onClick={() => setTheme(t.id)}
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
