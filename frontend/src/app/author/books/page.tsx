"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  IndianRupee,
  Info,
  LifeBuoy,
  Printer,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Book } from "@/types";

export default function AuthorBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBooks() {
      try {
        const data = await apiFetch<Book[]>("/api/books");
        setBooks(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load books");
      } finally {
        setLoading(false);
      }
    }
    loadBooks();
  }, []);

  // Portfolio-level summary calculations
  const totalCopies = books.reduce((sum, b) => sum + b.total_copies_sold, 0);
  const totalEarned = books.reduce((sum, b) => sum + b.total_royalty_earned, 0);
  const totalPaid = books.reduce((sum, b) => sum + b.royalty_paid, 0);
  const totalPending = books.reduce((sum, b) => sum + b.royalty_pending, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-slate-200/60 animate-pulse" />
        <div className="h-64 rounded-xl bg-slate-200/60 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Quick Support CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            My Published Books &amp; Royalty Ledger
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Track book production stages, platform distribution, copies sold, and quarterly royalty disbursements.
          </p>
        </div>

        <Link
          href="/author/tickets?new=true"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1B4332] hover:bg-[#143325] text-white text-xs font-semibold shadow-xs transition"
        >
          <LifeBuoy className="w-4 h-4" />
          Raise a Support Ticket
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Top Portfolio KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Total Copies Sold</span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {totalCopies.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {books.length} registered {books.length === 1 ? "title" : "titles"}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Total Royalty Earned</span>
            <IndianRupee className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            ₹{totalEarned.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            80% net profit author share
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Royalty Paid Out</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            ₹{totalPaid.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Disbursed via bank transfer
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Royalty Pending</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">
            ₹{totalPending.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Min. quarterly payout threshold: ₹1,000
          </div>
        </div>
      </div>

      {/* Book Cards List */}
      <div className="space-y-5">
        {books.map((book) => {
          const isInProduction = book.status.toLowerCase().includes("production");
          const isBelowThreshold =
            !isInProduction && book.royalty_pending > 0 && book.royalty_pending < 1000;

          return (
            <div
              key={book.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
            >
              {/* Card Top Header */}
              <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                      {book.book_code}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${
                        isInProduction
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isInProduction ? "bg-amber-600" : "bg-emerald-600"
                        }`}
                      />
                      {book.status}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      • {book.genre}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-800 shrink-0" />
                    {book.title}
                  </h2>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500 pt-0.5">
                    <span>
                      <strong className="text-slate-700">ISBN:</strong>{" "}
                      <span className="font-mono">{book.isbn}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <strong className="text-slate-700">Published:</strong>{" "}
                      {book.publication_date ? (
                        book.publication_date
                      ) : (
                        <span className="italic text-amber-700">
                          Pending (In Production)
                        </span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Printer className="w-3.5 h-3.5 text-slate-400" />
                      <strong className="text-slate-700">Print Partner:</strong>{" "}
                      {book.print_partner || "Unassigned (In Production)"}
                    </span>
                  </div>
                </div>

                {/* Ask Question About This Specific Book */}
                <div className="flex items-center gap-3">
                  <Link
                    href={`/author/tickets?new=true&book_id=${book.id}`}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 hover:border-emerald-800 hover:bg-emerald-50/50 text-xs font-semibold text-slate-700 hover:text-emerald-950 transition"
                  >
                    Ask Support About This Book
                  </Link>
                </div>
              </div>

              {/* Financial & Sales Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-50/50">
                <div className="p-4">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">
                    Book MRP
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-1 font-mono">
                    {book.mrp !== null ? (
                      `₹${book.mrp}`
                    ) : (
                      <span className="text-xs font-sans font-medium text-amber-700">
                        Not Set Yet
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">
                    Royalty / Copy
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-1 font-mono">
                    {book.author_royalty_per_copy !== null ? (
                      `₹${book.author_royalty_per_copy}`
                    ) : (
                      <span className="text-xs font-sans font-medium text-amber-700">
                        Not Set Yet
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">
                    Copies Sold
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-1 font-mono">
                    {book.total_copies_sold.toLocaleString("en-IN")}
                  </div>
                </div>

                <div className="p-4">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">
                    Total Royalty Earned
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-1 font-mono">
                    ₹{book.total_royalty_earned.toLocaleString("en-IN")}
                  </div>
                </div>

                <div className="p-4">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">
                    Royalty Paid
                  </div>
                  <div className="text-base font-bold text-emerald-700 mt-1 font-mono">
                    ₹{book.royalty_paid.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {book.last_royalty_payout_date
                      ? `Last: ${book.last_royalty_payout_date}`
                      : "No prior payout"}
                  </div>
                </div>

                <div className="p-4">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">
                    Royalty Pending
                  </div>
                  <div className="text-base font-bold text-amber-700 mt-1 font-mono">
                    ₹{book.royalty_pending.toLocaleString("en-IN")}
                  </div>
                  {isBelowThreshold && (
                    <div className="text-[10px] text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded mt-1 inline-block">
                      Rolls over (&lt; ₹1,000 min)
                    </div>
                  )}
                </div>
              </div>

              {/* Footer: Storefront Availability or Production Pipeline Notice */}
              <div className="px-6 py-3 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                {isInProduction ? (
                  <div className="flex items-center gap-2 text-amber-800">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      This title is currently in{" "}
                      <strong>{book.status}</strong>. Pricing, royalty rates, and store links will activate once production completes.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500 inline-flex items-center gap-1 font-medium">
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-700" />
                      Available Stores:
                    </span>
                    {book.available_on.length > 0 ? (
                      book.available_on.map((store) => (
                        <span
                          key={store}
                          className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium"
                        >
                          {store}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">
                        No storefronts listed yet
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}