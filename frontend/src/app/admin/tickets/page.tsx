"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Filter,
  Lock,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Ticket, User } from "@/types";

const CATEGORIES = [
  "All",
  "Royalty & Payments",
  "ISBN & Metadata Issues",
  "Printing & Quality",
  "Distribution & Availability",
  "Book Status & Production Updates",
  "General Inquiry",
];

const PRIORITIES = ["All", "Critical", "High", "Medium", "Low"];
const STATUSES = ["All", "Open", "In Progress", "Resolved", "Closed"];

function priorityBadgeStyle(priority: string) {
  switch (priority) {
    case "Critical":
      return "bg-red-100 text-red-900 border-red-300 font-bold";
    case "High":
      return "bg-orange-100 text-orange-900 border-orange-300 font-semibold";
    case "Medium":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "Low":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Tracks which ticket ID is currently loaded into the editor so 5s polling never overwrites Admin edits
  const activeWorkspaceTicketIdRef = useRef<number | null>(null);

  // Queue Filters
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest");

  // Admin Workspace Form State
  const [draftResponse, setDraftResponse] = useState("");
  const [adminReplyText, setAdminReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("Open");
  const [selectedCategory, setSelectedCategory] = useState<string>("General Inquiry");
  const [selectedPriority, setSelectedPriority] = useState<string>("Medium");
  const [assignedAdminId, setAssignedAdminId] = useState<string>("0");
  const [savingChanges, setSavingChanges] = useState(false);
  const [regeneratingAI, setRegeneratingAI] = useState(false);

  const applyTicketToWorkspace = useCallback((t: Ticket) => {
    activeWorkspaceTicketIdRef.current = t.id;
    setDraftResponse(t.ai_draft_response || "");
    setSelectedStatus(t.status);
    setSelectedCategory(t.category);
    setSelectedPriority(t.priority);
    setAssignedAdminId(t.assigned_admin_id ? String(t.assigned_admin_id) : "0");
    setAdminReplyText("");
    setIsInternalNote(false);
  }, []);

  const loadAdminData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "All") params.append("status", filterStatus);
      if (filterCategory !== "All") params.append("category", filterCategory);
      if (filterPriority !== "All") params.append("priority", filterPriority);
      params.append("date_sort", dateSort);

      const [ticketList, adminList] = await Promise.all([
        apiFetch<Ticket[]>(`/api/tickets?${params.toString()}`),
        apiFetch<User[]>("/api/auth/admins"),
      ]);

      setTickets(ticketList);
      setAdmins(adminList);

      if (ticketList.length > 0) {
        const currentId = activeWorkspaceTicketIdRef.current;
        const stillExists = currentId
          ? ticketList.find((item) => item.id === currentId)
          : null;

        if (!stillExists) {
          const firstTicket = ticketList[0];
          setSelectedTicketId(firstTicket.id);
          applyTicketToWorkspace(firstTicket);
        }
      } else {
        activeWorkspaceTicketIdRef.current = null;
        setSelectedTicketId(null);
      }
    } catch {
      // Ignore transient polling errors
    } finally {
      setLoading(false);
    }
  }, [
    filterStatus,
    filterCategory,
    filterPriority,
    dateSort,
    applyTicketToWorkspace,
  ]);

  // Initial fetch + 5-second background polling (no synchronous setState inside effect)
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void loadAdminData();
    }, 0);

    const pollTimer = setInterval(() => {
      void loadAdminData();
    }, 5000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(pollTimer);
    };
  }, [loadAdminData]);

  function handleSelectTicket(t: Ticket) {
    setSelectedTicketId(t.id);
    applyTicketToWorkspace(t);
    setStatusBanner(null);
  }

  const selectedTicket =
    tickets.find((t) => t.id === selectedTicketId) || null;

  async function handleSendAIDraftToAuthor() {
    if (!selectedTicket || !draftResponse.trim()) return;
    setSavingChanges(true);
    setStatusBanner(null);

    try {
      const nextStatus =
        selectedStatus === "Open" ? "In Progress" : selectedStatus;

      // 1. Save any category/priority overrides and updated AI draft text
      await apiFetch<Ticket>(`/api/tickets/${selectedTicket.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
          category: selectedCategory,
          priority: selectedPriority,
          assigned_admin_id: Number(assignedAdminId),
          ai_draft_response: draftResponse.trim(),
        }),
      });

      // 2. Post the edited AI draft as an official public response visible to the Author
      await apiFetch(`/api/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: draftResponse.trim(),
          is_internal: false,
        }),
      });

      setSelectedStatus(nextStatus);
      setStatusBanner(
        "AI Draft Response sent to Author! It is now visible on the Author's ticket view."
      );
      await loadAdminData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to send AI draft");
    } finally {
      setSavingChanges(false);
    }
  }

  async function handleSaveAndSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTicket) return;
    setSavingChanges(true);
    setStatusBanner(null);

    try {
      // 1. Update ticket status, category, priority, assignee, and draft
      await apiFetch<Ticket>(`/api/tickets/${selectedTicket.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: selectedStatus,
          category: selectedCategory,
          priority: selectedPriority,
          assigned_admin_id: Number(assignedAdminId),
          ai_draft_response: draftResponse,
        }),
      });

      // 2. Determine message content: use bottom reply box if filled, otherwise send the AI draft if no replies exist yet
      const contentToSend =
        adminReplyText.trim() ||
        (selectedTicket.messages.length === 0 ? draftResponse.trim() : "");

      if (contentToSend) {
        await apiFetch(`/api/tickets/${selectedTicket.id}/messages`, {
          method: "POST",
          body: JSON.stringify({
            content: contentToSend,
            is_internal: isInternalNote,
          }),
        });
        setAdminReplyText("");
        setIsInternalNote(false);
        setStatusBanner(
          isInternalNote
            ? "Internal admin note saved (hidden from author)."
            : "Response sent to author and ticket updated!"
        );
      } else {
        setStatusBanner("Ticket status and classification updated!");
      }

      await loadAdminData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update ticket");
    } finally {
      setSavingChanges(false);
    }
  }

  async function handleRegenerateAI() {
    if (!selectedTicket) return;
    setRegeneratingAI(true);
    setStatusBanner(null);
    try {
      const updated = await apiFetch<Ticket>(
        `/api/tickets/${selectedTicket.id}/regenerate-ai`,
        { method: "POST" }
      );
      setDraftResponse(updated.ai_draft_response || "");
      setSelectedCategory(updated.category);
      setSelectedPriority(updated.priority);
      setStatusBanner("Gemini AI generated a fresh response draft!");
      await loadAdminData();
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : "Failed to regenerate AI draft"
      );
    } finally {
      setRegeneratingAI(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Operations Ticket Queue
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage incoming author inquiries, review Gemini AI-drafted responses, and handle escalations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setLoading(true);
              void loadAdminData();
            }}
            className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-800" />
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <Filter className="w-4 h-4 text-emerald-800" />
          <span>Filters:</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => {
              setLoading(true);
              setFilterStatus(e.target.value);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Category:</span>
          <select
            value={filterCategory}
            onChange={(e) => {
              setLoading(true);
              setFilterCategory(e.target.value);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-800 max-w-[200px]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Priority:</span>
          <select
            value={filterPriority}
            onChange={(e) => {
              setLoading(true);
              setFilterPriority(e.target.value);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-slate-500 font-medium">Sort By:</span>
          <select
            value={dateSort}
            onChange={(e) => {
              setLoading(true);
              setDateSort(e.target.value as "newest" | "oldest");
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest Unresolved (SLA Spotlight)</option>
          </select>
        </div>
      </div>

      {/* Main Admin Split View */}
      {loading ? (
        <div className="h-96 rounded-2xl bg-slate-200/60 animate-pulse" />
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-emerald-800 mx-auto opacity-80" />
          <h3 className="text-base font-bold text-slate-900">
            No support tickets match your filter criteria
          </h3>
          <p className="text-xs text-slate-500">
            Try resetting your filters above to view the active queue.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Ticket Queue List */}
          <div className="lg:col-span-5 space-y-3 max-h-[780px] overflow-y-auto pr-1">
            {tickets.map((t) => {
              const isSelected = t.id === selectedTicket?.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTicket(t)}
                  className={`w-full text-left p-4 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? "bg-white border-emerald-800 ring-2 ring-emerald-800/15 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold text-slate-700">
                      #{t.id} • {t.author.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border ${priorityBadgeStyle(
                        t.priority
                      )}`}
                    >
                      {t.priority}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                    {t.subject}
                  </h3>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <span className="truncate max-w-[180px]">{t.category}</span>
                    <span className="font-semibold text-emerald-900">
                      {t.status} • {t.messages.length}{" "}
                      {t.messages.length === 1 ? "msg" : "msgs"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Admin Ticket Workbench & AI Draft Editor */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {selectedTicket ? (
              <form onSubmit={handleSaveAndSend} className="flex flex-col">
                {statusBanner && (
                  <div className="px-6 py-3 bg-emerald-900 text-white text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>{statusBanner}</span>
                  </div>
                )}

                {/* Header Info */}
                <div className="p-6 border-b border-slate-100 space-y-3 bg-slate-50/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-800">
                        Ticket #{selectedTicket.id}
                      </span>
                      <span className="text-xs font-bold text-emerald-900">
                        Author: {selectedTicket.author.name} (
                        {selectedTicket.author.email})
                      </span>
                    </div>

                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(selectedTicket.created_at).toLocaleString()}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900">
                    {selectedTicket.subject}
                  </h2>

                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-emerald-800" />
                        {selectedTicket.book
                          ? `${selectedTicket.book.title} (ISBN: ${selectedTicket.book.isbn} | Status: ${selectedTicket.book.status})`
                          : "General / Account Level Inquiry"}
                      </div>

                      {selectedTicket.attachment_name && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-medium">
                          <Paperclip className="w-3 h-3" />
                          {selectedTicket.attachment_name}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed pt-1">
                      {selectedTicket.description}
                    </p>
                  </div>
                </div>

                {/* Admin Triage Overrides Strip */}
                <div className="p-4 bg-emerald-950/5 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Status
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-1 focus:ring-emerald-800"
                    >
                      {STATUSES.filter((s) => s !== "All").map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Category{" "}
                      {selectedTicket.is_category_overridden
                        ? "(Overridden)"
                        : "(AI)"}
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-1 focus:ring-emerald-800 truncate"
                    >
                      {CATEGORIES.filter((c) => c !== "All").map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Priority{" "}
                      {selectedTicket.is_priority_overridden
                        ? "(Overridden)"
                        : "(AI)"}
                    </label>
                    <select
                      value={selectedPriority}
                      onChange={(e) => setSelectedPriority(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-1 focus:ring-emerald-800"
                    >
                      {PRIORITIES.filter((p) => p !== "All").map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Assignee
                    </label>
                    <select
                      value={assignedAdminId}
                      onChange={(e) => setAssignedAdminId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-1 focus:ring-emerald-800 truncate"
                    >
                      <option value="0">Unassigned</option>
                      {admins.map((adm) => (
                        <option key={adm.id} value={String(adm.id)}>
                          {adm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* AI Draft Editor Section */}
                <div className="p-6 space-y-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Gemini AI-Drafted Response (Editable)
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={regeneratingAI}
                        onClick={handleRegenerateAI}
                        className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${
                            regeneratingAI ? "animate-spin" : ""
                          }`}
                        />
                        {regeneratingAI
                          ? "Generating..."
                          : "Regenerate AI Draft"}
                      </button>

                      <button
                        type="button"
                        disabled={savingChanges || !draftResponse.trim()}
                        onClick={handleSendAIDraftToAuthor}
                        className="px-3 py-1 rounded bg-[#1B4332] hover:bg-[#143325] disabled:opacity-50 text-white text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        Send Edited AI Draft to Author
                      </button>
                    </div>
                  </div>

                  {selectedTicket.ai_reasoning && (
                    <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900">
                      <strong>AI Triage Reasoning:</strong>{" "}
                      {selectedTicket.ai_reasoning}
                    </div>
                  )}

                  <textarea
                    rows={6}
                    value={draftResponse}
                    onChange={(e) => setDraftResponse(e.target.value)}
                    placeholder="AI draft response will appear here..."
                    className="w-full p-3.5 rounded-xl border border-slate-300 text-xs font-mono bg-slate-50/60 focus:outline-none focus:ring-2 focus:ring-emerald-800 leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-500">
                    Edit the AI draft above and click{" "}
                    <strong>&ldquo;Send Edited AI Draft to Author&rdquo;</strong>{" "}
                    to publish it directly to the author&apos;s ticket thread.
                  </p>
                </div>

                {/* Conversation History & New Message Input */}
                <div className="p-6 space-y-4 bg-slate-50/40">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-800" />
                    Conversation Thread &amp; Internal Notes (
                    {selectedTicket.messages.length})
                  </h3>

                  {selectedTicket.messages.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 bg-white">
                      No public replies or internal notes sent yet. Click{" "}
                      <strong>&ldquo;Send Edited AI Draft to Author&rdquo;</strong>{" "}
                      above or write a custom message below.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {selectedTicket.messages.map((msg) => {
                        const isAdmin = msg.sender.role === "admin";
                        return (
                          <div
                            key={msg.id}
                            className={`p-3.5 rounded-xl border text-xs ${
                              msg.is_internal
                                ? "bg-amber-50 border-amber-300 text-amber-900"
                                : isAdmin
                                ? "bg-emerald-950/5 border-emerald-800/30 ml-0 mr-4"
                                : "bg-white border-slate-200 ml-4 mr-0"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-800">
                                {msg.sender.name}{" "}
                                <span className="text-[10px] font-normal text-slate-500">
                                  ({isAdmin ? "Admin" : "Author"})
                                </span>
                              </span>
                              <div className="flex items-center gap-2">
                                {msg.is_internal && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[10px]">
                                    <Lock className="w-2.5 h-2.5" /> Internal Note
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400">
                                  {new Date(msg.created_at).toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Custom Reply / Internal Note Input */}
                  <div className="space-y-2.5 pt-2">
                    <textarea
                      rows={2}
                      value={adminReplyText}
                      onChange={(e) => setAdminReplyText(e.target.value)}
                      placeholder="Write a custom follow-up reply or check 'Post as Internal Note' below..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-800"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs font-medium text-amber-900 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                        />
                        <span className="inline-flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-700" />
                          Post as Internal Note (Hidden from author)
                        </span>
                      </label>

                      <button
                        type="submit"
                        disabled={savingChanges}
                        className="px-5 py-2 rounded-xl bg-[#0F291E] hover:bg-[#081811] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {savingChanges
                          ? "Saving..."
                          : "Save Changes & Send Response"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}