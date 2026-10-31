"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Library,
  LifeBuoy,
  LogOut,
  MapPin,
  User as UserIcon,
} from "lucide-react";
import { clearAuthSession, getStoredUser } from "@/lib/api";
import { User } from "@/types";

export default function AuthorLayout({
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
    if (stored.role === "admin") {
      router.replace("/admin/tickets");
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

  const navItems = [
    {
      label: "My Books & Royalties",
      href: "/author/books",
      icon: Library,
      active: pathname.startsWith("/author/books"),
    },
    {
      label: "My Support Tickets",
      href: "/author/tickets",
      icon: LifeBuoy,
      active: pathname.startsWith("/author/tickets"),
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col">
      {/* Top Author Header */}
      <header className="bg-[#1B4332] text-white border-b border-emerald-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/author/books" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <span className="font-bold tracking-tight text-base block leading-none">
                  BookLeaf
                </span>
                <span className="text-[10px] text-emerald-200 uppercase tracking-widest">
                  Author Portal
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 ml-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
                      item.active
                        ? "bg-white/15 text-white shadow-xs"
                        : "text-emerald-100 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right User Profile & Switch Account */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="hidden sm:flex flex-col items-end text-right">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <UserIcon className="w-3.5 h-3.5 text-amber-300" />
                  <span>{user.name}</span>
                  {user.author_code && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-800 text-[10px] font-mono text-emerald-100">
                      {user.author_code}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-emerald-200">
                  <span>{user.email}</span>
                  {user.city && (
                    <span className="inline-flex items-center gap-0.5">
                      • <MapPin className="w-3 h-3" /> {user.city}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden sm:block text-xs text-emerald-200">
                Loading profile...
              </div>
            )}

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 border border-emerald-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              title="Sign Out or Switch Demo Persona"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch Account</span>
            </button>
          </div>
        </div>

        {/* Mobile Sub-Nav */}
        <div className="md:hidden flex border-t border-emerald-800 bg-emerald-950/50 px-4 py-2 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 py-1.5 px-3 rounded text-xs font-medium flex items-center justify-center gap-1.5 ${
                  item.active
                    ? "bg-white/15 text-white"
                    : "text-emerald-200 hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content — Always rendered so Next.js 16.4 Instant Navigation succeeds */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}