"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ShieldCheck, Sparkles, ArrowRight, AlertCircle, UserCheck } from "lucide-react";
import { apiFetch, saveAuthSession } from "@/lib/api";
import { User } from "@/types";

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

const DEMO_ACCOUNTS = [
  {
    label: "Admin Portal (Ops Team)",
    sublabel: "Full Ticket Queue + Gemini AI Workbench",
    email: "admin@bookleafpub.com",
    password: "admin123",
    roleBadge: "ADMIN",
  },
  {
    label: "Priya Sharma (AUTH001)",
    sublabel: "2 Published Books • ₹3,570 Pending Royalty",
    email: "priya.sharma@email.com",
    password: "password123",
    roleBadge: "AUTHOR",
  },
  {
    label: "Kavita Deshmukh (AUTH009)",
    sublabel: "Edge Cases: BK015 (In Production) & BK016 (< ₹1k Threshold)",
    email: "kavita.deshmukh@email.com",
    password: "password123",
    roleBadge: "AUTHOR",
  },
  {
    label: "Sneha Kulkarni (AUTH007)",
    sublabel: "Edge Case: BK013 (In Production - Cover Design)",
    email: "sneha.kulkarni@email.com",
    password: "password123",
    roleBadge: "AUTHOR",
  },
  {
    label: "Ananya Reddy (AUTH003)",
    sublabel: "Edge Case: BK005 (₹2,546 Unpaid > ₹1k Threshold)",
    email: "ananya.reddy@email.com",
    password: "password123",
    roleBadge: "AUTHOR",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@bookleafpub.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e?: React.FormEvent, customEmail?: string, customPassword?: string) {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const targetEmail = customEmail ?? email;
    const targetPassword = customPassword ?? password;

    try {
      const data = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: targetEmail,
          password: targetPassword,
        }),
      });

      saveAuthSession(data.access_token, data.user);

      if (data.user.role === "admin") {
        router.push("/admin/tickets");
      } else {
        router.push("/author/books");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  }

  function handleQuickSelect(accEmail: string, accPassword: string) {
    setEmail(accEmail);
    setPassword(accPassword);
    handleLogin(undefined, accEmail, accPassword);
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Column: Brand & Portal Overview */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-emerald-950/10 text-emerald-950 text-xs font-semibold tracking-wide uppercase">
            <BookOpen className="w-4 h-4 text-emerald-800" />
            BookLeaf Publishing • India & US
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            Author Support &amp; Communication Portal
          </h1>

          <p className="text-slate-600 text-base leading-relaxed">
            A unified operations and author experience platform powered by AI-assisted triage,
            automated priority scoring, and Knowledge-Base-grounded response drafting.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm mb-1">
                <Sparkles className="w-4 h-4 text-amber-600" />
                AI Triage &amp; Drafting
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Single-call classification, priority scoring, and policy-backed responses enriched with live book ledger data.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Role-Based Access
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Strict isolation between Author views and Admin operations, including private internal notes and AI overrides.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Login Card + 1-Click Evaluator Switcher */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Sign in to your account</h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your credentials below or click any seeded test persona for instant login.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:border-transparent"
                placeholder="author@email.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#1B4332] hover:bg-[#143325] disabled:opacity-60 text-white font-medium text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>{loading ? "Signing in..." : "Sign In"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* 1-Click Evaluator Quick-Fill Section */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                1-Click Evaluator Quick Login
              </span>
              <span className="text-[11px] text-slate-400">Pre-seeded dataset</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickSelect(acc.email, acc.password)}
                  className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-emerald-700 hover:bg-emerald-50/40 transition flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-800 group-hover:text-emerald-950">
                      {acc.label}
                    </div>
                    <div className="text-[11px] text-slate-500">{acc.sublabel}</div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      acc.roleBadge === "ADMIN"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-emerald-100 text-emerald-900"
                    }`}
                  >
                    {acc.roleBadge}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}