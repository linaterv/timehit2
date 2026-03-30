"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/users": "Users",
  "/clients": "Clients",
  "/contractors": "Contractors",
  "/placements": "Placements",
  "/timesheets": "Timesheets",
  "/invoices": "Invoices",
  "/documents": "Documents",
  "/profile": "My Profile",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  }
  if (!user) return null;

  const segments = pathname.split("/").filter(Boolean);
  const isDetailPage = segments.length >= 2 && segments[1]?.length > 10; // UUID-length = detail page
  const title = isDetailPage ? "" : (TITLES[pathname] || TITLES["/" + segments[0]] || "");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto p-6 bg-[var(--background)]">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
