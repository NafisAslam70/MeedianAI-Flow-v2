"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCcw,
  ShieldAlert,
  Users,
} from "lucide-react";

const fetcher = (url) =>
  fetch(url, { cache: "no-store" }).then((res) => {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json();
  });

const STATUS_STYLES = {
  open: "bg-amber-100 text-amber-700 border-amber-200",
  triaged: "bg-sky-100 text-sky-700 border-sky-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  waiting_user: "bg-purple-100 text-purple-700 border-purple-200",
  escalated: "bg-rose-100 text-rose-700 border-rose-200",
  resolved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
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
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch (error) {
    return String(value);
  }
}

const DEFAULT_MESSAGE = { type: null, text: "" };

export default function ManagerTicketsPage() {
  const [view, setView] = useState("queue");
  const [queue, setQueue] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  const key = useMemo(() => {
    const params = new URLSearchParams();
    params.set("view", view);
    if (queue !== "all") params.set("queue", queue);
    if (status !== "all") params.set("status", status);
    if (priority !== "all") params.set("priority", priority);
    return `/api/managersCommon/tickets?${params.toString()}`;
  }, [view, queue, status, priority]);

  const { data, error, isLoading, mutate } = useSWR(key, fetcher);
  const tickets = data?.tickets ?? [];
  const queues = data?.queues ?? [];
  const statusFlow = data?.statusFlow ?? [];
  const priorityOptions = data?.priorities ?? ["low", "normal", "high", "urgent"];
  const queueSummary = data?.queueSummary ?? {};
  const statusSummary = data?.statusSummary ?? {};

  const [activeTicketId, setActiveTicketId] = useState(null);
  const {
    data: detailData,
    isLoading: detailLoading,
    mutate: mutateDetail,
  } = useSWR(activeTicketId ? `/api/managersCommon/tickets/${activeTicketId}` : null, fetcher);
  const detail = detailData?.ticket || null;
  const activities = detailData?.activities || [];
  const statusChoices = detailData?.statusFlow || statusFlow;

  const { data: usersData } = useSWR(activeTicketId ? "/api/managersCommon/users" : null, fetcher);
  const assignableUsers = usersData?.users ?? [];
  const escalationTargets = assignableUsers.filter((user) => user.role === "admin" || user.role === "team_manager");

  const [assignTo, setAssignTo] = useState("");
  const [statusUpdate, setStatusUpdate] = useState("");
  const [priorityUpdate, setPriorityUpdate] = useState("");
  const [managerComment, setManagerComment] = useState("");
  const [escalateNote, setEscalateNote] = useState("");
  const [escalateTarget, setEscalateTarget] = useState("");
  // Member reply window (hours selector)
  const [memberReplyHours, setMemberReplyHours] = useState("72");

  const [actionLoading, setActionLoading] = useState({
    assign: false,
    status: false,
    priority: false,
    comment: false,
    escalate: false,
  });
  const [actionFeedback, setActionFeedback] = useState(DEFAULT_MESSAGE);

  useEffect(() => {
    if (!detail) return;
    setAssignTo(detail.assignedToId ? String(detail.assignedToId) : "");
    setStatusUpdate(detail.status);
    setPriorityUpdate(detail.priority);
    setManagerComment("");
    setEscalateNote("");
    setEscalateTarget("");
    setActionFeedback(DEFAULT_MESSAGE);
  }, [detail]);

  const setFeedback = (type, text) => {
    setActionFeedback({ type, text });
    if (type === "success") {
      setTimeout(() => setActionFeedback(DEFAULT_MESSAGE), 3000);
    }
  };

  const performAction = async (body, key) => {
    if (!activeTicketId) return;
    setActionFeedback(DEFAULT_MESSAGE);
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/managersCommon/tickets/${activeTicketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Action failed");
      setFeedback("success", "Update saved");
      mutateDetail();
      mutate();
    } catch (err) {
      setFeedback("error", err.message || "Unable to update ticket");
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleAssign = () => {
    if (!assignTo) {
      setFeedback("error", "Select a teammate to assign");
      return;
    }
    performAction({ action: "assign", assigneeId: Number(assignTo) }, "assign");
  };

  const handleStatus = () => {
    if (!statusUpdate) {
      setFeedback("error", "Select a status");
      return;
    }
    performAction({ action: "status", status: statusUpdate }, "status");
  };

  const handlePriority = () => {
    if (!priorityUpdate) {
      setFeedback("error", "Select a priority");
      return;
    }
    performAction({ action: "priority", priority: priorityUpdate }, "priority");
  };

  const handleComment = () => {
    if (!managerComment.trim()) {
      setFeedback("error", "Comment cannot be empty");
      return;
    }
    performAction({ action: "comment", comment: managerComment.trim() }, "comment");
    setManagerComment("");
  };

  const handleEscalate = () => {
    if (!escalateTarget) {
      setFeedback("error", "Select who will own the escalation");
      return;
    }
    performAction(
      {
        action: "escalate",
        assigneeId: Number(escalateTarget),
        note: escalateNote.trim() || null,
      },
      "escalate"
    );
  };

  const closeDetail = () => {
    setActiveTicketId(null);
    setActionFeedback(DEFAULT_MESSAGE);
  };

  const viewChoices = [
    { key: "queue", label: "My queue" },
    { key: "assigned", label: "Assigned to me" },
    { key: "created", label: "Raised by me" },
  ];

  const allQueueOptions = ["all", ...queues];
  const allStatusOptions = ["all", ...statusFlow];
  const allPriorityOptions = ["all", ...priorityOptions];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Operations Control</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Ticket Queue</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Stay ahead of member issues, reassign workloads, and trigger escalations when something needs more attention.
            </p>
          </div>
          <button
            type="button"
            onClick={() => mutate()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-100"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2.5fr),minmax(0,1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">View</label>
                  <select
                    value={view}
                    onChange={(event) => setView(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    {viewChoices.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Queue</label>
                  <select
                    value={queue}
                    onChange={(event) => setQueue(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    {allQueueOptions.map((item) => (
                      <option key={item} value={item}>
                        {item === "all" ? "All queues" : item.charAt(0).toUpperCase() + item.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    {allStatusOptions.map((item) => (
                      <option key={item} value={item}>
                        {item === "all" ? "All statuses" : item.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</label>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    {allPriorityOptions.map((item) => (
                      <option key={item} value={item}>
                        {item === "all" ? "All priorities" : item.charAt(0).toUpperCase() + item.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Loading queue…
              </div>
            ) : error ? (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                Unable to load tickets. Try refreshing.
              </div>
            ) : tickets.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                No tickets found for this filter.
              </div>
            ) : (
              <div className="mt-6 divide-y divide-slate-200 border border-slate-200 rounded-2xl bg-white overflow-hidden">
                <div className="hidden bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[1.2fr,1.2fr,1fr,0.7fr,0.7fr,0.9fr,0.5fr]">
                  <span>Ticket</span>
                  <span>Title</span>
                  <span>Queue</span>
                  <span>Status</span>
                  <span>Priority</span>
                  <span>Updated</span>
                  <span>Action</span>
                </div>
                {tickets.map((ticket) => {
                  const statusClass = STATUS_STYLES[ticket.status] || "bg-slate-100 text-slate-600 border-slate-200";
                  const priorityClass = PRIORITY_STYLES[ticket.priority] || "bg-slate-100 text-slate-600 border-slate-200";
                  return (
                    <article
                      key={ticket.id}
                      className="grid gap-4 px-5 py-4 text-sm text-slate-700 md:grid-cols-[1.2fr,1.2fr,1fr,0.7fr,0.7fr,0.9fr,0.5fr] md:items-center"
                    >
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ticket.ticketNumber}</div>
                        <div className="text-xs text-slate-500">By {ticket.createdByName || "Member"}</div>
                      </div>
                      <div className="font-semibold text-slate-900">
                        {ticket.title}
                        <p className="text-xs font-normal text-slate-500">Assigned to {ticket.assignedToName || "—"}</p>
                      </div>
                      <div className="capitalize">{ticket.queue}</div>
                      <div>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
                          {ticket.status.replace("_", " ")}
                        </span>
                        {ticket.escalated ? (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                            <ShieldAlert className="h-3 w-3" />
                            Escalated
                          </span>
                        ) : null}
                      </div>
                      <div>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${priorityClass}`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{formatDate(ticket.lastActivityAt)}</div>
                      <div>
                        <button
                          type="button"
                          onClick={() => setActiveTicketId(ticket.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
                        >
                          View <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="h-4 w-4 text-indigo-500" /> Queue load
              </div>
              <div className="mt-3 space-y-2 text-xs">
                {Object.keys(queueSummary).length === 0 ? (
                  <p className="text-slate-500">No tickets yet.</p>
                ) : (
                  Object.entries(queueSummary).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="capitalize text-slate-600">{key}</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {value.open} open
                        {value.escalated ? <span className="ml-2 text-xs text-rose-600">{value.escalated} escalated</span> : null}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Status mix</h3>
              <div className="mt-3 space-y-2 text-xs">
                {Object.keys(statusSummary).length === 0 ? (
                  <p className="text-slate-500">No tickets yet.</p>
                ) : (
                  Object.entries(statusSummary).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="capitalize text-slate-600">{key.replace("_", " ")}</span>
                      <span className="text-sm font-semibold text-slate-800">{value}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {activeTicketId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4 py-10">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-xl">
            <button
              type="button"
              onClick={closeDetail}
              className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-700"
            >
              ×
            </button>
            <div className="max-h-[85vh] overflow-y-auto p-6">
              {detailLoading && !detail ? (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Loading ticket…
                </div>
              ) : detail ? (
                <div className="space-y-8">
                  <header className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <span>{detail.ticketNumber}</span>
                      <span>Raised by {detail.createdByName || "Member"}</span>
                      <span>Queue: <span className="capitalize text-slate-700">{detail.queue}</span></span>
                    </div>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold text-slate-900">{detail.title}</h2>
                        <p className="text-sm text-slate-600">
                          {detail.category}
                          {detail.subcategory ? ` • ${detail.subcategory}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${STATUS_STYLES[detail.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {detail.status.replace("_", " ")}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${PRIORITY_STYLES[detail.priority] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          Priority: {detail.priority}
                        </span>
                        {detail.escalated ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-600">
                            <ShieldAlert className="h-3 w-3" /> Escalated
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      Updated {formatDate(detail.lastActivityAt)} · Assigned to {detail.assignedToName || "—"}
                    </div>
                  </header>

                  {actionFeedback.text ? (
                    <div
                      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                        actionFeedback.type === "error"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {actionFeedback.type === "error" ? (
                        <AlertCircle className="mt-0.5 h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 h-4 w-4" />
                      )}
                      <span>{actionFeedback.text}</span>
                    </div>
                  ) : null}

                  <section className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-900">Assignment</h3>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assign to</label>
                        <select
                          value={assignTo}
                          onChange={(event) => setAssignTo(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        >
                          <option value="">Unassigned</option>
                          {assignableUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name || `User #${user.id}`} ({user.role})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleAssign}
                          disabled={actionLoading.assign}
                          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {actionLoading.assign ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Assign
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Update status</label>
                        <select
                          value={statusUpdate}
                          onChange={(event) => setStatusUpdate(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        >
                          {statusChoices.map((item) => (
                            <option key={item} value={item}>
                              {item.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleStatus}
                          disabled={actionLoading.status}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {actionLoading.status ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Update
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</label>
                        <select
                          value={priorityUpdate}
                          onChange={(event) => setPriorityUpdate(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        >
                          {priorityOptions.map((item) => (
                            <option key={item} value={item}>
                              {item.charAt(0).toUpperCase() + item.slice(1)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handlePriority}
                          disabled={actionLoading.priority}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {actionLoading.priority ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Update
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-900">Escalation & updates</h3>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manager comment</label>
                        <textarea
                          rows={3}
                          value={managerComment}
                          onChange={(event) => setManagerComment(event.target.value)}
                          placeholder="Ping the member, request more info, or note progress."
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                        <button
                          type="button"
                          onClick={handleComment}
                          disabled={actionLoading.comment}
                          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {actionLoading.comment ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Post update
                        </button>
                      </div>

                      {/* Member reply window controls */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Member reply window</label>
                        {detail?.metadata?.memberCommentAllowed ? (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                            <div className="text-xs text-emerald-700">
                              Enabled{detail?.metadata?.memberCommentAllowUntil ? ` until ${new Date(detail.metadata.memberCommentAllowUntil).toLocaleString()}` : ''}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => performAction({ action: "revoke_member_comment" }, "comment")}
                                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                              >
                                Close window
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                            <div className="text-xs text-slate-600">Allow the member (raiser) to reply on this ticket for a limited time.</div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => performAction({ action: "allow_member_comment", hours: 72 }, "comment")}
                                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                              >
                                Allow 72h
                              </button>
                              <button
                                type="button"
                                onClick={() => performAction({ action: "allow_member_comment", hours: 48 }, "comment")}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                              >
                                48h
                              </button>
                              <button
                                type="button"
                                onClick={() => performAction({ action: "allow_member_comment", hours: 24 }, "comment")}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                              >
                                24h
                              </button>
                              <div className="ml-auto flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={720}
                                  value={memberReplyHours}
                                  onChange={(e) => setMemberReplyHours(e.target.value)}
                                  className="w-20 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                  placeholder="Hours"
                                  aria-label="Custom reply window (hours)"
                                />
                                <button
                                  type="button"
                                  onClick={() => performAction({ action: "allow_member_comment", hours: Number(memberReplyHours) || 72 }, "comment")}
                                  className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                                >
                                  Allow
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Escalate to</label>
                        <select
                          value={escalateTarget}
                          onChange={(event) => setEscalateTarget(event.target.value)}
                          disabled={detail.escalated}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">Select L2 owner</option>
                          {escalationTargets.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name || `User #${user.id}`} ({user.role})
                            </option>
                          ))}
                        </select>
                        <textarea
                          rows={3}
                          value={escalateNote}
                          onChange={(event) => setEscalateNote(event.target.value)}
                          placeholder="Context for the escalation (optional)"
                          disabled={detail.escalated}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={handleEscalate}
                          disabled={detail.escalated || actionLoading.escalate}
                          className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionLoading.escalate ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />} {detail.escalated ? "Already escalated" : "Escalate"}
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">Description</h3>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <p className="whitespace-pre-line">{detail.description}</p>
                      {Array.isArray(detail.attachments) && detail.attachments.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attachments</h4>
                          {detail.attachments.map((item, index) => (
                            <a
                              key={index}
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:border-indigo-300 hover:text-indigo-700"
                            >
                              <MessageCircle className="h-3.5 w-3.5" /> {item.name || item.url}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
                    {activities.length === 0 ? (
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">No activity yet.</p>
                    ) : (
                      <ol className="space-y-3">
                        {activities.map((activity) => (
                          <li key={activity.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <span>{formatDate(activity.createdAt)}</span>
                              {activity.authorName ? <span className="font-semibold text-slate-700">· {activity.authorName}</span> : null}
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{activity.type.replace("_", " ")}</span>
                            </div>
                            <p className="mt-1 text-sm text-slate-800">{activity.message || "(no message)"}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
              ) : (
                <div className="text-sm text-slate-600">Ticket was not found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
