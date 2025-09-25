"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  MessageCircle,
  Plus,
  RefreshCcw,
  Loader2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const fetcher = (url) =>
  fetch(url, { cache: "no-store" }).then((res) => {
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    return res.json();
  });

const STATUS_STYLES = {
  open: "bg-amber-100 text-amber-700 border-amber-200",
  triaged: "bg-sky-100 text-sky-700 border-sky-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  waiting_user: "bg-purple-100 text-purple-700 border-purple-200",
  escalated: "bg-rose-100 text-rose-700 border-rose-200",
  resolved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed: "bg-rose-200 text-rose-800 border-rose-300",
};

const PRIORITY_STYLES = {
  urgent: "bg-rose-100 text-rose-700 border-rose-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  normal: "bg-sky-100 text-sky-700 border-sky-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

function formatDate(value) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch (err) {
    return String(value);
  }
}

const emptyCounts = { total: 0, byStatus: {} };

export default function MemberTicketsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState("mine"); // mine | assigned
  const key = tab === "assigned" ? "/api/member/tickets?view=assigned" : "/api/member/tickets";
  const { data, error, isLoading, mutate } = useSWR(key, fetcher);
  const categories = data?.categories ?? [];
  const priorities = data?.priorities ?? ["low", "normal", "high", "urgent"];
  const tickets = data?.tickets ?? [];
  const counts = data?.counts ?? emptyCounts;

  const [categoryKey, setCategoryKey] = useState("");
  const [subcategoryKey, setSubcategoryKey] = useState("");
  const [priority, setPriority] = useState("normal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [snackbar, setSnackbar] = useState("");

  const [activeTicketId, setActiveTicketId] = useState(null);
  const { data: detailData, isLoading: detailLoading, mutate: mutateDetail } = useSWR(
    activeTicketId ? `/api/member/tickets/${activeTicketId}` : null,
    fetcher
  );
  const detail = detailData?.ticket || null;
  const activities = detailData?.activities || [];

  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Open ticket detail if ticketId is present in URL (e.g., from notifications shortcut)
  useEffect(() => {
    const tid = searchParams?.get?.("ticketId");
    if (tid) {
      const n = Number(tid);
      if (!Number.isNaN(n) && n > 0) setActiveTicketId(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (categories.length && !categoryKey) {
      setCategoryKey(categories[0].key);
    }
  }, [categories, categoryKey]);

  const selectedCategory = useMemo(
    () => categories.find((item) => item.key === categoryKey) || null,
    [categories, categoryKey]
  );

  useEffect(() => {
    if (!selectedCategory) {
      setSubcategoryKey("");
      return;
    }
    const subs = selectedCategory.subcategories || [];
    if (!subs.length) {
      setSubcategoryKey("");
      return;
    }
    if (!subcategoryKey || !subs.some((item) => item.key === subcategoryKey)) {
      setSubcategoryKey(subs[0].key);
    }
  }, [selectedCategory, subcategoryKey]);

  useEffect(() => {
    if (!snackbar) return;
    const timer = setTimeout(() => setSnackbar(""), 4000);
    return () => clearTimeout(timer);
  }, [snackbar]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAttachmentName("");
    setAttachmentUrl("");
    setPriority("normal");
    setCreateError("");
  };

  const openCreateForm = () => {
    setCreateError("");
    setShowCreate(true);
  };

  const closeCreateForm = () => {
    setShowCreate(false);
    resetForm();
    setSubmitting(false);
  };

  const handleCreateTicket = async (event) => {
    event.preventDefault();
    setCreateError("");

    if (!title.trim() || !description.trim()) {
      setCreateError("Title and description are required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        categoryKey,
        subcategoryKey: subcategoryKey || null,
        priority,
        title,
        description,
        attachments: attachmentUrl
          ? [
              {
                url: attachmentUrl.trim(),
                name: attachmentName.trim() || null,
              },
            ]
          : [],
      };

      const res = await fetch("/api/member/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Failed to create ticket");
      }

      mutate();
      resetForm();
      setShowCreate(false);
      setSnackbar(body.message || "Ticket created");
    } catch (err) {
      setCreateError(err.message || "Unable to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const statusKeys = Object.entries(counts.byStatus || {});

  const handleAddComment = async () => {
    if (!activeTicketId) return;
    setCommentError("");
    if (!comment.trim()) {
      setCommentError("Comment cannot be empty");
      return;
    }
    setCommentLoading(true);
    try {
      const res = await fetch(`/api/member/tickets/${activeTicketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Failed to post comment");
      }
      setComment("");
      mutateDetail();
      mutate();
    } catch (err) {
      setCommentError(err.message || "Unable to add comment");
    } finally {
      setCommentLoading(false);
    }
  };

  const closeDetail = () => {
    setActiveTicketId(null);
    setComment("");
    setCommentError("");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Support Desk</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Raise a Ticket</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Report issues, request help, or ask for resources. The operations team will keep you posted right here.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <Plus className="h-4 w-4" />
                Raise Ticket
              </button>
              <button
                type="button"
                onClick={() => mutate()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <RefreshCcw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            <div className="flex items-center justify-end gap-3 text-sm text-slate-600">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              {counts.total > 0 ? `${counts.total} ticket${counts.total === 1 ? "" : "s"} on record` : "No tickets yet"}
            </div>
          </div>
        </div>

        {snackbar ? (
          <div className="mt-6 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
            <span>{snackbar}</span>
          </div>
        ) : null}

        <div className="mt-6">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setTab("mine")}
              className={`px-3 py-1.5 rounded-full ${tab === 'mine' ? 'bg-indigo-600 text-white' : ''}`}
            >
              My tickets
            </button>
            <button
              type="button"
              onClick={() => setTab("assigned")}
              className={`px-3 py-1.5 rounded-full ${tab === 'assigned' ? 'bg-indigo-600 text-white' : ''}`}
            >
              Assigned to me
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Your tickets</h2>
                <p className="text-sm text-slate-600">Track progress and conversations with the operations team.</p>
              </div>
              <div className="text-sm text-slate-500">
                {counts.total > 0 ? `${counts.total} ticket${counts.total === 1 ? "" : "s"} logged` : "You have not raised a ticket yet"}
              </div>
            </div>

            {isLoading ? (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                Loading tickets…
              </div>
            ) : error ? (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                Failed to load tickets. Try refreshing.
              </div>
            ) : tickets.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                <p>No tickets yet. Use the "Raise Ticket" button above to get started.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {tickets.map((ticket) => {
                  const statusClass = STATUS_STYLES[ticket.status] || "bg-slate-100 text-slate-600 border-slate-200";
                  const priorityClass = PRIORITY_STYLES[ticket.priority] || "bg-slate-100 text-slate-600 border-slate-200";
                  return (
                    <article
                      key={ticket.id}
                      className={`group rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${ticket.status==='closed' ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <span>{ticket.ticketNumber}</span>
                            {ticket.escalated ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                                <AlertCircle className="h-3 w-3" /> Escalated
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-1 text-base font-semibold text-slate-900">{ticket.title}</h3>
                          <p className="text-xs text-slate-500">
                            {ticket.category} {ticket.subcategory ? `• ${ticket.subcategory}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${statusClass}`}>
                            {ticket.status.replace("_", " ")}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${priorityClass}`}>
                            Priority: {ticket.priority}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span>Queue: <span className="font-semibold text-slate-700 capitalize">{ticket.queue}</span></span>
                        <span>Owner: <span className="font-semibold text-slate-700">{ticket.assignedToName || "Unassigned"}</span></span>
                        <span>Last update: <span className="font-semibold text-slate-700">{formatDate(ticket.lastActivityAt)}</span></span>
                      </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveTicketId(ticket.id)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
                          >
                            View updates <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Status overview</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {statusKeys.length === 0 ? (
                <p className="text-xs text-slate-500">No tickets yet.</p>
              ) : (
                statusKeys.map(([status, count]) => {
                  const badge = STATUS_STYLES[status] || "bg-slate-100 text-slate-600 border-slate-200";
                  return (
                    <div
                      key={status}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-semibold capitalize ${badge}`}>
                        {status.replace("_", " ")}
                      </span>
                      <span className="text-sm font-semibold text-slate-700">{count}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4 py-10">
          <div className={`relative w-full max-w-4xl rounded-2xl shadow-xl ${detail?.status==='closed' ? 'bg-rose-50 border border-rose-200' : 'bg-white'}`}>
            <button
              type="button"
              onClick={closeCreateForm}
              className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-500 transition hover:text-slate-700"
            >
              <span className="sr-only">Close</span>
              <X className="h-4 w-4" aria-hidden />
            </button>
            <div className="max-h-[80vh] overflow-y-auto p-6">
              <header className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New ticket</p>
                <h2 className="text-2xl font-semibold text-slate-900">What do you need help with?</h2>
                <p className="text-sm text-slate-600">Share as many useful details as possible. Attach a drive link or screenshot if it will speed things up.</p>
              </header>

              {createError ? (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <span>{createError}</span>
                </div>
              ) : null}

              <form className="mt-6 space-y-4 md:space-y-6" onSubmit={handleCreateTicket}>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
                  <select
                    value={categoryKey}
                    onChange={(event) => setCategoryKey(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    {categories.map((category) => (
                      <option key={category.key} value={category.key}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCategory?.subcategories?.length ? (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subcategory</label>
                    <select
                      value={subcategoryKey}
                      onChange={(event) => setSubcategoryKey(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      {selectedCategory.subcategories.map((subcategory) => (
                        <option key={subcategory.key} value={subcategory.key}>
                          {subcategory.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {/* Priority selection removed for members; managers can change later */}

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    placeholder="Short summary (e.g. Hostel geyser not working)"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    required
                    rows={5}
                    placeholder="Describe what happened, when it started, and anything already tried."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attachment name</label>
                    <input
                      value={attachmentName}
                      onChange={(event) => setAttachmentName(event.target.value)}
                      placeholder="Screenshot or drive folder"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attachment link</label>
                    <input
                      value={attachmentUrl}
                      onChange={(event) => setAttachmentUrl(event.target.value)}
                      placeholder="https://..."
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeCreateForm}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Submit ticket
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTicketId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4 py-10">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <button
              type="button"
              onClick={closeDetail}
              className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-700"
            >
              <span className="sr-only">Close</span>
              ×
            </button>
            <div className="max-h-[80vh] overflow-y-auto p-6">
              {detailLoading && !detail ? (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                  Loading ticket…
                </div>
              ) : detail ? (
                <div className="space-y-6">
                  <header>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{detail.ticketNumber}</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-900">{detail.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {detail.category}
                      {detail.subcategory ? ` • ${detail.subcategory}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${STATUS_STYLES[detail.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {detail.status.replace("_", " ")}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${PRIORITY_STYLES[detail.priority] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        Priority: {detail.priority}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600">
                        Queue: {detail.queue}
                      </span>
                      {detail.escalated ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-600">
                          <AlertCircle className="h-3 w-3" /> Escalated
                        </span>
                      ) : null}
                    </div>
                  </header>

                  <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</h3>
                    <p className="whitespace-pre-line text-slate-700">{detail.description}</p>
                    {Array.isArray(detail.attachments) && detail.attachments.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attachments</h4>
                        {detail.attachments.map((item, index) => (
                          <a
                            key={index}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:border-indigo-300 hover:text-indigo-700"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> {item.name || item.url}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
                    {activities.length === 0 ? (
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                        No updates yet. The operations team will respond shortly.
                      </p>
                    ) : (
                      <ol className="space-y-3">
                        {activities.map((activity) => (
                          <li
                            key={activity.id}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700"
                          >
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span>{formatDate(activity.createdAt)}</span>
                              {activity.authorName ? (
                                <span className="font-semibold text-slate-700">· {activity.authorName}</span>
                              ) : null}
                              {activity.type === "status_change" ? (
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-600">
                                  Status update
                                </span>
                              ) : activity.type === "system" ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                  System
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-slate-800">{activity.message || "(No message)"}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>

                  {/* Assignee actions: allow status control; resolution requires manager approval */}
                  {detail && detail.status !== 'closed' && session?.user?.id && Number(session.user.id) === detail.assignedToId ? (
                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-900">My actions</h3>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-xs text-slate-500">Status</div>
                            <div className="mt-1 font-semibold">{detail.status.replace("_"," ")}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {detail.status !== 'in_progress' && (
                              <button
                                type="button"
                                disabled={statusUpdating}
                                onClick={async ()=>{
                                  setStatusUpdating(true);
                                  try{
                                    const res = await fetch(`/api/member/tickets/${detail.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'status', status:'in_progress' })});
                                    if(res.ok){ mutateDetail(); mutate(); }
                                  } finally { setStatusUpdating(false); }
                                }}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                              >
                                Mark In‑Progress
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={resolving}
                              onClick={async ()=>{
                                setResolving(true);
                                try{
                                  const res = await fetch(`/api/member/tickets/${detail.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'request_resolution' })});
                                  if(res.ok){ mutateDetail(); mutate(); }
                                } finally { setResolving(false); }
                              }}
                              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                            >
                              Request Resolution (manager approval)
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {detail?.status !== 'closed' && detailData?.canComment ? (
                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-900">Add comment</h3>
                      {commentError ? (
                        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
                          <span>{commentError}</span>
                        </div>
                      ) : null}
                      <textarea
                        rows={3}
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Share new information or update the operations team"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleAddComment}
                          disabled={commentLoading}
                          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {commentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                          Send update
                        </button>
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-slate-600">Ticket was not found or removed.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
