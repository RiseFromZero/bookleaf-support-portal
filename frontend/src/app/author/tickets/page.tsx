"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Book, Ticket } from "@/types";

function statusBadgeStyle(status: string) {
  switch (status) {
    case "Open":
      return "bg-blue-100 text-blue-900 border-blue-200";
    case "In Progress":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "Resolved":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "Closed":
      return "bg-slate-200 text-slate-700 border-slate-300";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function AuthorTicketsContent() {
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<string>("");

  // Initialize modal & pre-selected book directly from URL searchParams (no synchronous setState in useEffect!)
  const [showNewModal, setShowNewModal] = useState<boolean>(
    () => searchParams.get("new") === "true"
  );
  const [bookIdInput, setBookIdInput] = useState<string>(
    () => searchParams.get("book_id") || "general"
  );
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Follow-up Reply State
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const fetchTicketsAndBooks = useCallback(async () => {
    try {
      const [ticketList, bookList] = await Promise.all([
        apiFetch<Ticket[]>("/api/tickets"),
        apiFetch<Book[]>("/api/books"),
      ]);
      setTickets(ticketList);
      setBooks(bookList);
      setLastSynced(new Date().toLocaleTimeString());

      setSelectedTicketId((prev) => {
        if (prev && ticketList.some((t) => t.id === prev)) return prev;
        return ticketList.length > 0 ? ticketList[0].id : null;
      });
    } catch {
      // Silent ignore during polling
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + Real-Time Polling every 3 seconds
  useEffect(() => {
    // Run initial fetch in an async callback, then poll every 3 seconds
    const initialTimer = setTimeout(() => {
      void fetchTicketsAndBooks();
    }, 0);

    const pollInterval = setInterval(() => {
      void fetchTicketsAndBooks();
    }, 3000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(pollInterval);
    };
  }, [fetchTicketsAndBooks]);

  const selectedTicket =
    tickets.find((t) => t.id === selectedTicketId) || null;

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const payload = {
        book_id: bookIdInput === "general" ? null : Number(bookIdInput),
        subject,
        description,
        attachment_name: attachmentName,
      };

      const created = await apiFetch<Ticket>("/api/tickets", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setTickets((prev) => [created, ...prev]);
      setSelectedTicketId(created.id);
      setShowNewModal(false);
      setSubject("");
      setDescription("");
      setAttachmentName(null);
      setBookIdInput("general");
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to submit support query"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;
    setSendingReply(true);

    try {
      await apiFetch(`/api/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: replyText.trim(),
          is_internal: false,
        }),
      });
      setReplyText("");
      await fetchTicketsAndBooks();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">
              My Support Tickets
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-900">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Live Updates Active {lastSynced && `(${lastSynced})`}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            View responses from the BookLeaf operations team in real time or raise a new support ticket.
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1B4332] hover:bg-[#143325] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Submit a Support Query
        </button>
      </div>

      {/* Main Split View: Left Ticket List | Right Conversation View */}
      {loading ? (
        <div className="h-96 rounded-2xl bg-slate-200/60 animate-pulse" />
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <MessageSquare className="w-10 h-10 text-emerald-800 mx-auto opacity-80" />
          <h3 className="text-base font-bold text-slate-900">
            No support queries submitted yet
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Have a question about your book royalties, production status, ISBN, or store availability? Submit a ticket and our team will assist you.
          </p>
          <button
            onClick={() => setShowNewModal(true)}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Submit Your First Query
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Author's Tickets List */}
          <div className="lg:col-span-5 space-y-3">
            {tickets.map((t) => {
              const isSelected = t.id === selectedTicket?.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTicketId(t.id)}
                  className={`w-full text-left p-4 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? "bg-white border-emerald-800 ring-2 ring-emerald-800/15 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      #{t.id} •{" "}
                      {t.book ? `${t.book.book_code}: ${t.book.title}` : "General / Account Level"}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadgeStyle(
                        t.status
                      )}`}
                    >
                      {t.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                    {t.subject}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                    {t.description}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
                    <span>Category: {t.category}</span>
                    <span>
                      {t.messages.length}{" "}
                      {t.messages.length === 1 ? "reply" : "replies"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Active Ticket Thread */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {selectedTicket ? (
              <div className="flex flex-col h-full">
                {/* Thread Header */}
                <div className="p-6 border-b border-slate-100 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-slate-100 text-slate-700">
                        Ticket #{selectedTicket.id}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeStyle(
                          selectedTicket.status
                        )}`}
                      >
                        {selectedTicket.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        • {selectedTicket.category}
                      </span>
                    </div>

                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Created{" "}
                      {new Date(selectedTicket.created_at).toLocaleString()}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900">
                    {selectedTicket.subject}
                  </h2>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 font-medium">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-800" />
                      {selectedTicket.book
                        ? `${selectedTicket.book.title} (${selectedTicket.book.book_code})`
                        : "General / Account Level"}
                    </span>

                    {selectedTicket.attachment_name && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-medium">
                        <Paperclip className="w-3.5 h-3.5" />
                        Attached: {selectedTicket.attachment_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Messages & Original Query History */}
                <div className="p-6 space-y-4 max-h-[460px] overflow-y-auto bg-slate-50/50">
                  {/* Original Query Bubble */}
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span className="font-bold text-slate-800">
                        {selectedTicket.author.name} (Original Query)
                      </span>
                      <span>
                        {new Date(selectedTicket.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {selectedTicket.description}
                    </p>
                  </div>

                  {/* Admin & Author Thread Replies */}
                  {selectedTicket.messages.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center space-y-1.5 bg-white/60">
                      <RefreshCw className="w-5 h-5 text-emerald-700 mx-auto animate-spin" />
                      <div className="text-xs font-semibold text-slate-700">
                        Awaiting BookLeaf Support Response
                      </div>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        Your ticket has been classified under{" "}
                        <strong>{selectedTicket.category}</strong> and assigned to our support queue. Any response from our team will appear here automatically.
                      </p>
                    </div>
                  ) : (
                    selectedTicket.messages.map((msg) => {
                      const isAdmin = msg.sender.role === "admin";
                      return (
                        <div
                          key={msg.id}
                          className={`p-4 rounded-xl border ${
                            isAdmin
                              ? "bg-emerald-950/5 border-emerald-800/30 ml-0 mr-4"
                              : "bg-white border-slate-200 ml-4 mr-0"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                {msg.sender.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  isAdmin
                                    ? "bg-[#1B4332] text-white"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {isAdmin ? "BookLeaf Support" : "Author"}
                              </span>
                            </div>
                            <span className="text-slate-400">
                              {new Date(msg.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Follow-Up Reply Box */}
                {selectedTicket.status !== "Closed" && (
                  <form
                    onSubmit={handleSendReply}
                    className="p-4 bg-white border-t border-slate-200 flex items-end gap-3"
                  >
                    <textarea
                      rows={2}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a follow-up message to BookLeaf Support..."
                      className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !replyText.trim()}
                      className="px-4 py-2.5 rounded-lg bg-[#1B4332] hover:bg-[#143325] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {sendingReply ? "Sending..." : "Reply"}
                    </button>
                  </form>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Submit Support Query Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 bg-[#1B4332] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-base">Submit a Support Query</h3>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-emerald-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Select Book (or General Account Inquiry)
                </label>
                <select
                  value={bookIdInput}
                  onChange={(e) => setBookIdInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-800"
                >
                  <option value="general">General / Account Level</option>
                  {books.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.book_code} — {b.title} ({b.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Subject Line
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Question about my pending royalty payout"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Detailed Description
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={10}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your question or issue in detail so our team can assist you quickly..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800"
                />
              </div>

              {/* Optional File Attachment UI */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Optional File Attachment (Photos, Screenshots, Statements)
                </label>
                <label className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-dashed border-slate-300 hover:border-emerald-700 bg-slate-50/70 cursor-pointer text-xs text-slate-600">
                  <span className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                    {attachmentName
                      ? `Attached: ${attachmentName}`
                      : "Click to attach a screenshot or defective copy photo (optional)"}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setAttachmentName(file ? file.name : null);
                    }}
                  />
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-[#1B4332] hover:bg-[#143325] disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting
                    ? "Submitting & Running AI Triage..."
                    : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthorTicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-500">
          Loading tickets...
        </div>
      }
    >
      <AuthorTicketsContent />
    </Suspense>
  );
}