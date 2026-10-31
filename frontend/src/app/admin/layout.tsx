"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldAlert,
  Ticket as TicketIcon,
  LogOut,
  User as UserIcon,
  Building2,
} from "lucide-react";
import { clearAuthSession, getStoredUser } from "@/lib/api";
import { User } from "@/types";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace("/");
      return;
    }
    if (stored.role !== "admin") {
      router.replace("/author/books");
      return;
    }
    Promise.resolve().then(() => {
      setUser(stored);
    });
  }, [router]);

  function handleLogout() {
    clearAuthSession();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-[#F4F6F4] text-slate-900 flex flex-col">
      {/* Admin Top Navbar */}
      <header className="bg-[#0F291E] text-white border-b border-emerald-950 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin/tickets" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-800 border border-emerald-600 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <span className="font-bold tracking-tight text-base block leading-none">
                  BookLeaf Operations
                </span>
                <span className="text-[10px] text-emerald-300 uppercase tracking-widest">
                  Admin Control Center
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 ml-4">
              <Link
                href="/admin/tickets"
                className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
                  pathname.startsWith("/admin/tickets")
                    ? "bg-white/15 text-white shadow-xs"
                    : "text-emerald-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                <TicketIcon className="w-4 h-4" />
                Support Ticket Queue
              </Link>
            </nav>
          </div>

          {/* Right User & Logout */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="hidden sm:flex flex-col items-end text-right">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <UserIcon className="w-3.5 h-3.5 text-amber-300" />
                  <span>{user.name}</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold">
                    ADMIN
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-emerald-300">
                  <span>{user.email}</span>
                  <span className="inline-flex items-center gap-0.5">
                    • <Building2 className="w-3 h-3" /> New Delhi HQ
                  </span>
                </div>
              </div>
            ) : (
              <div className="hidden sm:block text-xs text-emerald-300">
                Loading admin profile...
              </div>
            )}

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              title="Sign Out or Switch Persona"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch Account</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}