"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle,
  Clock,
  GraduationCap,
  Hash,
  Loader2,
  MessageCircle,
  Mic,
  Shield,
  Users,
  X,
} from "lucide-react";
import useSWR from "swr";

const fetcher = (u) => fetch(u).then((r) => r.json());

const statusStyles = {
  OPEN: {
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  IN_PROGRESS: {
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  ON_HOLD: {
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  ESCALATED: {
    badge: "bg-purple-100 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  },
  CLOSED: {
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
};

const levelPill = {
  1: "bg-sky-100 text-sky-700 border-sky-200",
  2: "bg-indigo-100 text-indigo-700 border-indigo-200",
  3: "bg-rose-100 text-rose-700 border-rose-200",
};

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch (e) {
    return String(value);
  }
};

export default function EscalationsPage() {
  const [tab, setTab] = useState("new");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [l1, setL1] = useState("");
  const [l2, setL2] = useState("");
  const [members, setMembers] = useState([]);
  const [studentIds, setStudentIds] = useState([]);
  const [useMembers, setUseMembers] = useState(true);
  const [useStudents, setUseStudents] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [query, setQuery] = useState("");
  const [openDetailId, setOpenDetailId] = useState(null);
  const [showTimeline, setShowTimeline] = useState(true);
  const [progressNote, setProgressNote] = useState("");
  const [actionModal, setActionModal] = useState(null);
  const [modalL2, setModalL2] = useState("");
  const [modalNote, setModalNote] = useState("");
  const [useDarkTheme, setUseDarkTheme] = useState(false);
  const [reminderModal, setReminderModal] = useState(null);
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderSending, setReminderSending] = useState(false);
  const [creatingEscalation, setCreatingEscalation] = useState(false);

  const { data: counts } = useSWR("/api/managersCommon/escalations?section=counts", fetcher);
  const { data: usersData } = useSWR("/api/managersCommon/users", fetcher);
  const { data: studentsData } = useSWR("/api/managersCommon/students", fetcher);
  const { data: forYou } = useSWR(tab === "forYou" ? "/api/managersCommon/escalations?section=forYou" : null, fetcher);
  const { data: mine } = useSWR(tab === "mine" ? "/api/managersCommon/escalations?section=raisedByMe" : null, fetcher);
  const { data: openAll } = useSWR(tab === "openAll" ? "/api/managersCommon/escalations?section=allOpen" : null, fetcher);
  const { data: closedAll } = useSWR(tab === "closedAll" ? "/api/managersCommon/escalations?section=allClosed" : null, fetcher);
  const { data: detail } = useSWR(openDetailId ? `/api/managersCommon/escalations?section=detail&id=${openDetailId}` : null, fetcher);

  const users = usersData?.users || [];
  const students = studentsData?.students || [];
  const assignableUsers = useMemo(
    () => users.filter((u) => u.role === "admin" || u.role === "team_manager"),
    [users]
  );

  const teamSelectableUsers = useMemo(
    () => users.filter((u) => u.role !== "admin"),
    [users]
  );

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return teamSelectableUsers;
    return teamSelectableUsers.filter((u) =>
      `${u.name} ${u.role || ""}`.toLowerCase().includes(q)
    );
  }, [teamSelectableUsers, memberQuery]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      `${s.name || ""} ${s.className || ""}`.toLowerCase().includes(q)
    );
  }, [students, studentQuery]);

  const selectedMembers = useMemo(
    () =>
      teamSelectableUsers.filter((u) =>
        members.some((id) => String(id) === String(u.id))
      ),
    [teamSelectableUsers, members]
  );

  const selectedStudents = useMemo(
    () =>
      students.filter((s) =>
        studentIds.some((id) => String(id) === String(s.id))
      ),
    [students, studentIds]
  );

  const tabs = useMemo(
    () => [
      {
        key: "new",
        label: "New matter",
        subtitle: "Capture and assign a fresh escalation",
      },
      {
        key: "forYou",
        label: "For you",
        subtitle: "Items awaiting your action",
        count: counts?.forYouCount,
      },
      {
        key: "mine",
        label: "Raised by me",
        subtitle: "Matters you reported",
        count: counts?.raisedByMeCount,
      },
      {
        key: "openAll",
        label: "Open (all)",
        subtitle: "Every active escalation",
        count: counts?.openTotalCount,
      },
      {
        key: "closedAll",
        label: "Closed",
        subtitle: "Recently resolved",
        count: counts?.closedTotalCount ?? counts?.recentClosedCount,
      },
    ],
    [counts]
  );

  const statCards = useMemo(() => {
    const normalise = (value) => (typeof value === "number" && !Number.isNaN(value) ? value : 0);
    return [
      {
        label: "For you",
        value: normalise(counts?.forYouCount),
        caption: "Open items needing your input",
        icon: Shield,
      },
      {
        label: "Raised by me",
        value: normalise(counts?.raisedByMeCount),
        caption: "Matters you initiated",
        icon: ArrowUpRight,
      },
      {
        label: "All open",
        value: normalise(counts?.openTotalCount),
        caption: "Across the organisation",
        icon: AlertCircle,
      },
      {
        label: "Closed",
        value: normalise(counts?.closedTotalCount),
        caption: "Resolved in the last cycle",
        icon: CheckCircle,
      },
    ];
  }, [counts]);

  const detailPanelClass = useDarkTheme ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900";
  const detailBorder = useDarkTheme ? "border-white/10" : "border-slate-200";
  const detailSurface = useDarkTheme ? "border-white/10 bg-white/5" : "border-slate-200 bg-white";
  const detailSurfaceMuted = useDarkTheme ? "border-white/10 bg-white/5 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600";
  const detailMutedText = useDarkTheme ? "text-slate-300" : "text-slate-500";
  const detailChip = useDarkTheme ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-600";
  const detailParticipantChipTeam = useDarkTheme ? "bg-white/10 text-slate-100" : "bg-slate-100 text-slate-700";
  const detailParticipantChipStudent = useDarkTheme ? "bg-white/10 text-slate-100" : "bg-amber-50 text-amber-700";

  const toggleMember = (id) => {
    const idStr = String(id);
    setMembers((prev) =>
      prev.includes(idStr) ? prev.filter((v) => v !== idStr) : [...prev, idStr]
    );
  };

  const sendReminder = async () => {
    if (!reminderModal || reminderSending) return;
    const memberIds = reminderModal.members.map((m) => m.id);
    if (!memberIds.length) {
      setReminderModal(null);
      return;
    }
    setReminderSending(true);
    try {
      const res = await fetch("/api/managersCommon/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remind-members",
          matterId: reminderModal.matterId,
          memberIds,
          message: reminderMessage,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || `Failed (${res.status})`);
      setMsg(`Reminder sent to ${payload.sent} member(s).`);
      setReminderModal(null);
      setReminderMessage("");
    } catch (error) {
      setErr(error.message);
    } finally {
      setReminderSending(false);
    }
  };

  const closeReminderModal = () => {
    if (reminderSending) return;
    setReminderModal(null);
    setReminderMessage("");
  };

  const toggleStudent = (id) => {
    const idStr = String(id);
    setStudentIds((prev) =>
      prev.includes(idStr) ? prev.filter((v) => v !== idStr) : [...prev, idStr]
    );
  };

  const create = async () => {
    setMsg("");
    setErr("");
    try {
      const l1AssigneeId = parseInt(l1, 10) || null;
      const involvedUserIds = useMembers
        ? members.map((id) => parseInt(id, 10)).filter(Boolean)
        : [];
      const involvedStudentIds = useStudents
        ? studentIds.map((id) => parseInt(id, 10)).filter(Boolean)
        : [];
      const snapshotMembers = teamSelectableUsers.filter((u) => involvedUserIds.includes(u.id));
      setCreatingEscalation(true);
      const res = await fetch("/api/managersCommon/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          l1AssigneeId,
          suggestedLevel2Id: l2 ? parseInt(l2, 10) : null,
          involvedUserIds,
          involvedStudentIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setMsg(`Escalation #${data.id} created.`);
      const l1Owner = assignableUsers.find((u) => u.id === l1AssigneeId);
      if (snapshotMembers.length) {
        const defaultNames = snapshotMembers.map((m) => m.name || `User #${m.id}`).join(", ");
        const defaultMessage = `Dear ${defaultNames}, an escalation has been raised (${title || "New matter"}). Please meet the Immediate Supervisor and Director during the escalation window today to resolve the issue.`;
        setReminderModal({
          matterId: data.id,
          members: snapshotMembers,
          l1Name: l1Owner?.name || "Assigned manager",
        });
        setReminderMessage(defaultMessage);
      }
      setTitle("");
      setDescription("");
      setL1("");
      setL2("");
      setMembers([]);
      setStudentIds([]);
      setUseMembers(true);
      setUseStudents(false);
      setTab("forYou");
    } catch (e) {
      setErr(e.message);
    } finally {
      setCreatingEscalation(false);
    }
  };

  const startVoiceForDescription = () => {
    setErr("");
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setErr("Speech recognition not supported in this browser.");
      setTimeout(() => setErr(""), 3000);
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsRecording(true);
    recognition.start();
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setIsRecording(false);
    };
    recognition.onerror = (event) => {
      setErr(`Voice capture error: ${event.error}`);
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);
  };

  const renderList = (rows, { actions = null, variant = "open" } = {}) => {
    const q = query.trim().toLowerCase();
    const actionConfig = actions && typeof actions === "object"
      ? actions
      : actions
        ? { canEscalate: true, canClose: true }
        : null;
    const dataset = (rows || []).filter((m) => {
      if (!q) return true;
      return (
        String(m.id).includes(q) || (m.title || "").toLowerCase().includes(q)
      );
    });

    if (dataset.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 py-16 text-center text-sm text-slate-500">
          <AlertCircle className="mb-2 h-10 w-10 text-slate-400" />
          No escalations yet in this view.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4">
        {dataset.map((m) => {
          const status = String(m.status || "OPEN").toUpperCase();
          const statusTone = statusStyles[status] || statusStyles.OPEN;
          const levelStyle = levelPill[m.level] || levelPill[1];
          const closingNote = m.closeNote?.trim();
          const descriptionPreview = (m.description || "")
            .replace(/\s+/g, " ")
            .slice(0, 180);
          const cardBase = useDarkTheme
            ? "rounded-2xl border border-white/10 bg-white/5 text-slate-100"
            : "rounded-2xl border border-slate-200 bg-white text-slate-800";
          const subText = useDarkTheme ? "text-slate-300" : "text-slate-500";
          const timeText = useDarkTheme ? "text-slate-400" : "text-slate-500";
          const titleText = useDarkTheme ? "text-white" : "text-slate-900";
          const closedNoteClass = useDarkTheme
            ? "rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200"
            : "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700";
          const canEscalate = actionConfig?.canEscalate && m.level === 1 && status !== "CLOSED";
          const canHold = actionConfig?.canHold && status !== "CLOSED" && status !== "ON_HOLD";
          const canWithdraw = actionConfig?.canWithdraw && status !== "CLOSED";
          const canClose = actionConfig?.canClose && status !== "CLOSED";

          return (
            <motion.div
              key={m.id}
              layout
              className={`group relative overflow-hidden p-4 shadow-sm transition hover:border-teal-200 hover:shadow-md ${cardBase}`}
              onClick={() => {
                setOpenDetailId(m.id);
                setErr("");
                setMsg("");
              }}
            >
              <div
                className="absolute inset-0 opacity-0 transition group-hover:opacity-100"
                style={{
                  background: useDarkTheme
                    ? "linear-gradient(115deg, rgba(29,78,216,0.18), rgba(45,212,191,0.18))"
                    : "linear-gradient(115deg, rgba(13,148,136,0.08), rgba(56,189,248,0.08))",
                }}
              />
              <div className="relative flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 px-2 py-0.5 font-medium text-slate-600">
                        <Hash className="h-3 w-3" />
                        {m.id}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${statusTone.badge}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
                        {status.replace("_", " ")}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${levelStyle}`}
                      >
                        L{m.level || 1}
                      </span>
                    </div>
                    <div className={`text-base font-semibold ${titleText}`}>
                      {m.title || "Untitled matter"}
                    </div>
                    <div className={`text-xs ${timeText}`}>
                      Opened {formatDateTime(m.createdAt)}
                    </div>
                  </div>
                  <div className={`flex flex-col items-end gap-2 text-right text-xs ${subText}`}>
                    {m.l1AssigneeName && (
                      <div className="flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 font-medium text-sky-700">
                        <Users className="h-3 w-3" /> {m.l1AssigneeName}
                      </div>
                    )}
                    {m.l2AssigneeName && (
                      <div className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 font-medium text-violet-700">
                        <Shield className="h-3 w-3" /> {m.l2AssigneeName}
                      </div>
                    )}
                  </div>
                </div>

                {descriptionPreview && (
                  <p className={`text-sm ${useDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
                    {descriptionPreview}
                    {descriptionPreview.length === 180 ? "…" : ""}
                  </p>
                )}

                {variant === "closed" && (
                  <div className={closedNoteClass}>
                    <span className="font-medium">Closing note:</span> {closingNote || "No note recorded"}
                  </div>
                )}

                {actionConfig && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className={`text-xs ${subText}`}>
                      Last updated {formatDateTime(m.updatedAt || m.createdAt)}
                    </div>
                    <div className="flex items-center gap-2">
                      {canHold && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-orange-200 px-3 py-1 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionModal({ type: "hold", id: m.id });
                            setModalNote("");
                          }}
                        >
                          <Clock className="h-3 w-3" /> On hold
                        </button>
                      )}
                      {canEscalate && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionModal({ type: "escalate", id: m.id });
                            setModalL2("");
                            setModalNote("");
                          }}
                        >
                          <ArrowUpRight className="h-3 w-3" /> Escalate to L2
                        </button>
                      )}
                      {canWithdraw && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionModal({ type: "withdraw", id: m.id });
                            setModalNote("");
                          }}
                        >
                          <X className="h-3 w-3" /> Withdraw
                        </button>
                      )}
                      {canClose && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionModal({ type: "close", id: m.id });
                            setModalNote("");
                          }}
                        >
                          <CheckCircle className="h-3 w-3" /> Close
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6 lg:flex-row lg:gap-8 lg:px-0">
      <div
        className={`relative sticky top-8 flex w-full flex-col gap-6 rounded-3xl px-6 py-6 shadow-xl sm:px-8 lg:w-[22%] ${
          useDarkTheme
            ? "bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white"
            : "bg-gradient-to-br from-white via-sky-50 to-emerald-50 text-slate-900"
        }`}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: useDarkTheme
              ? "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.35), transparent 55%), radial-gradient(circle at 80% 10%, rgba(13,148,136,0.35), transparent 50%)"
              : "radial-gradient(circle at 10% 20%, rgba(56,189,248,0.25), transparent 55%), radial-gradient(circle at 80% 0%, rgba(45,212,191,0.2), transparent 55%)",
          }}
        />
        <div className="relative flex flex-col gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {statCards.map(({ label, value, caption, icon: Icon }) => (
                <div
                  key={label}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    useDarkTheme
                      ? "border-white/10 bg-white/10 text-white"
                      : "border-slate-200 bg-white text-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs uppercase tracking-wide ${useDarkTheme ? "text-slate-200/80" : "text-slate-500"}`}>
                      {label}
                    </span>
                    <Icon className={`h-4 w-4 ${useDarkTheme ? "text-slate-200/80" : "text-teal-500"}`} />
                  </div>
                  <div className={`mt-1 text-2xl font-semibold ${useDarkTheme ? "text-white" : "text-slate-900"}`}>{value}</div>
                  <div className={`mt-1 text-xs ${useDarkTheme ? "text-slate-200/70" : "text-slate-500"}`}>{caption}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                  useDarkTheme
                    ? "bg-white/10 text-teal-100 ring-1 ring-white/20"
                    : "bg-teal-100 text-teal-700 ring-1 ring-teal-200"
                }`}
              >
                <Shield className="h-3 w-3" /> Manager escalations console
              </div>
              <h1 className={`text-3xl font-semibold leading-tight sm:text-4xl ${useDarkTheme ? "text-white" : "text-slate-900"}`}>
                Keep escalations moving with clarity and pace.
              </h1>
              <p className={`text-sm sm:text-base ${useDarkTheme ? "text-slate-200" : "text-slate-600"}`}>
                Log new matters, review assignments, and nudge the right people forward. Everything is synced with the escalation workflow service.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUseDarkTheme((v) => !v)}
            className={`inline-flex w-max items-center gap-2 self-start rounded-full border px-3 py-1 text-xs font-semibold transition ${
              useDarkTheme
                ? "border-white/30 bg-white/10 text-white hover:border-white/50"
                : "border-teal-200 bg-white text-teal-600 hover:border-teal-300"
            }`}
          >
            {useDarkTheme ? "Switch to light" : "Switch to dark"}
          </button>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <AnimatePresence>
          {(msg || err) && (
            <motion.div
              key={msg ? "msg" : "err"}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                msg
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              <div className="flex items-center gap-2">
                {msg ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <span>{msg || err}</span>
              </div>
              <button
                type="button"
                className="rounded-full bg-white/40 px-2 py-1 text-xs font-semibold text-slate-600 shadow"
                onClick={() => {
                  setMsg("");
                  setErr("");
                }}
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map(({ key, label, subtitle, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
              className={`group flex min-w-[8rem] flex-col items-start rounded-xl border px-3 py-2 text-left transition sm:min-w-[9.5rem] ${
                tab === key
                  ? "border-teal-500 bg-teal-50"
                  : "border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className={`inline-flex items-center gap-1 text-sm font-semibold ${tab === key ? "text-teal-700" : "text-slate-700"}`}>
                {label}
                {count != null && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tab === key ? "bg-white text-teal-700" : "bg-slate-100 text-slate-600"}`}>
                    {count}
                  </span>
                )}
              </span>
              <span className="mt-0.5 text-xs text-slate-500">{subtitle}</span>
            </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or #id"
              className="w-48 rounded-full border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </div>
        </div>
        </div>

        {tab === "new" && (
          <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Escalation overview</h2>
                  <p className="text-sm text-slate-500">Give the escalation a clear title and spell out the context so approvers have everything they need.</p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    placeholder="Give this matter a meaningful name"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span>Description</span>
                    <button
                      type="button"
                      onClick={startVoiceForDescription}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        isRecording
                          ? "border-rose-300 bg-rose-50 text-rose-600"
                          : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-600"
                      }`}
                    >
                      <Mic className="h-3.5 w-3.5" /> {isRecording ? "Listening…" : "Voice"}
                    </button>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    placeholder="Explain what happened, the impact, and what outcome you anticipate."
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Routing</h3>
              <p className="text-sm text-slate-500">Choose the level-1 owner and optionally suggest who should take it at level 2 if escalation is required.</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Level 1 owner</label>
                  <select
                    value={l1}
                    onChange={(e) => setL1(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="">Select a team member…</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested level 2 (optional)</label>
                  <select
                    value={l2}
                    onChange={(e) => setL2(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="">No suggestion</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">People involved</h3>
                  <p className="text-sm text-slate-500">Tag the humans impacted or participating in the investigation.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setUseMembers((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold transition ${
                      useMembers
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-600"
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" /> Team
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseStudents((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold transition ${
                      useStudents
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:text-amber-600"
                    }`}
                  >
                    <GraduationCap className="h-3.5 w-3.5" /> Students
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {useMembers && (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <span>Team members</span>
                        <span>{selectedMembers.length} selected</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedMembers.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                          >
                            {m.name}
                            <button
                              type="button"
                              className="text-emerald-700/80"
                              onClick={() => toggleMember(m.id)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        {selectedMembers.length === 0 && (
                          <span className="text-xs text-slate-400">Nobody tagged yet.</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                      <input
                        value={memberQuery}
                        onChange={(e) => setMemberQuery(e.target.value)}
                        placeholder="Search members"
                        className="mb-3 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-100"
                      />
                      <div className="max-h-48 space-y-1 overflow-auto pr-1">
                        {filteredMembers.map((u) => {
                          const idStr = String(u.id);
                          const checked = members.some((mid) => String(mid) === idStr);
                          return (
                            <label
                              key={u.id}
                              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleMember(u.id)}
                                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />
                              <span className="flex-1 truncate">
                                <span className="font-semibold text-slate-800">{u.name}</span>
                                <span className="text-xs text-slate-400"> • {u.role}</span>
                              </span>
                            </label>
                          );
                        })}
                        {filteredMembers.length === 0 && (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3 text-center text-xs text-slate-400">
                            No team members match that search.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {useStudents && (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <span>Students</span>
                        <span>{selectedStudents.length} selected</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedStudents.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
                          >
                            {s.name}
                            <button
                              type="button"
                              className="text-amber-700/80"
                              onClick={() => toggleStudent(s.id)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        {selectedStudents.length === 0 && (
                          <span className="text-xs text-slate-400">No students tagged.</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                      <input
                        value={studentQuery}
                        onChange={(e) => setStudentQuery(e.target.value)}
                        placeholder="Search students"
                        className="mb-3 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-100"
                      />
                      <div className="max-h-48 space-y-1 overflow-auto pr-1">
                        {filteredStudents.map((s) => {
                          const idStr = String(s.id);
                          const checked = studentIds.some((sid) => String(sid) === idStr);
                          return (
                            <label
                              key={s.id}
                              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleStudent(s.id)}
                                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                              />
                              <span className="flex-1 truncate">
                                <span className="font-semibold text-slate-800">{s.name}</span>
                                {s.className && (
                                  <span className="text-xs text-slate-400"> • {s.className}</span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                        {filteredStudents.length === 0 && (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3 text-center text-xs text-slate-400">
                            No students match that search.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-teal-500/15 via-white to-white p-6 shadow-sm">
              <div className="flex flex-col gap-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">Ready?</span>
                  <p className="text-sm text-slate-600">Make sure the core metadata is filled out above. You can edit the escalation after it is created.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!creatingEscalation) create();
                  }}
                  disabled={creatingEscalation}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-600/30 transition ${
                    creatingEscalation
                      ? "cursor-not-allowed bg-teal-400"
                      : "bg-teal-600 hover:bg-teal-500"
                  }`}
                >
                  {creatingEscalation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {creatingEscalation ? "Creating…" : "Create escalation"}
                </button>
                {creatingEscalation && (
                  <p className="text-xs text-teal-600">creating&gt;.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "forYou" && renderList(forYou?.matters, { actions: { canEscalate: true, canHold: true, canClose: true } })}
      {tab === "mine" && renderList(mine?.matters, { actions: { canWithdraw: true } })}
      {tab === "openAll" && renderList(openAll?.matters)}
      {tab === "closedAll" && renderList(closedAll?.matters, { actions: false, variant: "closed" })}

      <AnimatePresence>
        {openDetailId && (
          <motion.div
            className="fixed inset-0 z-50 flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex-1 bg-black/50" onClick={() => setOpenDetailId(null)} />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className={`relative flex h-full w-full max-w-3xl flex-col overflow-hidden shadow-2xl ${detailPanelClass}`}
            >
              <div className={`flex items-center justify-between border-b px-6 py-5 ${detailBorder}`}>
                <div className="space-y-1">
                  <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${detailMutedText}`}>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${detailChip}`}>
                      <Hash className="h-3 w-3" /> {detail?.matter?.id ?? openDetailId}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                      statusStyles[String(detail?.matter?.status || "OPEN").toUpperCase()]?.badge || "border-slate-700 text-slate-200"
                    }`}>
                      {String(detail?.matter?.status || "OPEN").replace("_", " ")}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                      levelPill[detail?.matter?.level] || "border-slate-700 text-slate-200"
                    }`}>
                      Level {detail?.matter?.level ?? "—"}
                    </span>
                  </div>
                  <div className="text-xl font-semibold tracking-tight">
                    {detail?.matter?.title || "Matter"}
                  </div>
                  <div className={`text-xs ${detailMutedText}`}>
                    Created {formatDateTime(detail?.matter?.createdAt)}
                  </div>
                </div>
                <button
                  type="button"
                  className={`rounded-full p-2 transition ${
                    useDarkTheme ? "bg-white/10 text-slate-200 hover:bg-white/20" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                  onClick={() => setOpenDetailId(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-5">
                <div className="space-y-6 lg:col-span-3">
                  <div className={`rounded-2xl border p-5 ${detailSurface}`}>
                    <h4 className={`text-sm font-semibold uppercase tracking-wide ${detailMutedText}`}>Description</h4>
                    <p className={`mt-3 text-sm ${useDarkTheme ? "text-slate-200" : "text-slate-700"}`}>
                      {detail?.matter?.description?.trim() || "No description provided."}
                    </p>
                  </div>

                  <div className={`rounded-2xl border p-5 ${detailSurface}`}>
                    <div className="flex items-center justify-between">
                      <h4 className={`text-sm font-semibold uppercase tracking-wide ${detailMutedText}`}>Timeline</h4>
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          useDarkTheme
                            ? "border-white/10 text-slate-200 hover:border-white/30 hover:text-white"
                            : "border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-600"
                        }`}
                        onClick={() => setShowTimeline((v) => !v)}
                      >
                        {showTimeline ? "Hide" : `Show (${detail?.steps?.length || 0})`}
                      </button>
                    </div>
                    {showTimeline ? (
                      <div className="mt-4 space-y-4">
                        {(detail?.steps || []).map((step, idx) => (
                          <div key={idx} className="relative pl-8">
                            <span className="absolute left-1 top-2 h-3 w-3 rounded-full bg-emerald-400 shadow shadow-emerald-400/50" />
                            <div className={`text-xs ${detailMutedText}`}>
                              {formatDateTime(step.createdAt)}
                            </div>
                            <div className={`text-sm font-semibold ${useDarkTheme ? "text-white" : "text-slate-800"}`}>
                              {step.action}
                              {step.fromUserName ? ` • ${step.fromUserName}` : ""}
                              {step.toUserName && step.action !== "CLOSE" ? ` → ${step.toUserName}` : ""}
                            </div>
                            {step.note && (
                              <div
                                className={`mt-1 rounded-xl border px-3 py-2 text-xs ${
                                  useDarkTheme ? "border-white/5 bg-white/10 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-600"
                                }`}
                              >
                                {step.note}
                              </div>
                            )}
                          </div>
                        ))}
                        {(!detail?.steps || detail.steps.length === 0) && (
                          <div className={`rounded-2xl border border-dashed p-4 text-center text-xs ${
                            useDarkTheme ? "border-white/10 bg-white/5 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
                          }`}>
                            No updates recorded yet.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`mt-4 rounded-2xl border p-4 text-xs ${
                        useDarkTheme ? "border-white/10 bg-white/5 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}>
                        Timeline hidden.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6 lg:col-span-2">
                  <div className={`rounded-2xl border p-5 ${detailSurface}`}>
                    <h4 className={`text-sm font-semibold uppercase tracking-wide ${detailMutedText}`}>Participants</h4>
                    <div className="mt-3 space-y-4">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide ${detailMutedText}`}>Team</p>
                        <div className="mt-2 space-y-1">
                          {(detail?.members || []).map((m, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${detailParticipantChipTeam}`}
                            >
                              <Users className="h-3.5 w-3.5 text-emerald-400" />
                              {m.userName || `User #${m.userId}`}
                            </div>
                          ))}
                          {(!detail?.members || detail.members.length === 0) && (
                            <div className={`rounded-lg border border-dashed px-3 py-2 text-xs ${
                              useDarkTheme ? "border-white/10 bg-white/5 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
                            }`}>
                              No team members tagged.
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide ${detailMutedText}`}>Students</p>
                        <div className="mt-2 space-y-1">
                          {(detail?.studentMembers || []).map((s, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${detailParticipantChipStudent}`}
                            >
                              <GraduationCap className="h-3.5 w-3.5 text-amber-400" />
                              {s.name || `Student #${s.studentId}`}
                              {s.className ? <span className="text-xs text-slate-400"> • {s.className}</span> : null}
                            </div>
                          ))}
                          {(!detail?.studentMembers || detail.studentMembers.length === 0) && (
                            <div className={`rounded-lg border border-dashed px-3 py-2 text-xs ${
                              useDarkTheme ? "border-white/10 bg-white/5 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
                            }`}>
                              No students tagged.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-2xl border p-5 ${detailSurface}`}>
                    <h4 className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wide ${detailMutedText}`}>
                      <MessageCircle className="h-4 w-4 text-emerald-400" /> Add progress note
                    </h4>
                    <textarea
                      value={progressNote}
                      onChange={(e) => setProgressNote(e.target.value)}
                      rows={4}
                      className={`mt-3 w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/20 ${
                        useDarkTheme ? "border-white/10 bg-white/5 text-slate-200" : "border-slate-200 bg-white text-slate-700"
                      }`}
                      placeholder="Log an update, outcome, or next action."
                    />
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-400"
                        onClick={async () => {
                          if (!progressNote.trim()) return;
                          setErr("");
                          setMsg("");
                          try {
                            const res = await fetch(
                              "/api/managersCommon/escalations?section=progress",
                              {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  id: openDetailId,
                                  note: progressNote.trim(),
                                }),
                              }
                            );
                            const d = await res.json();
                            if (!res.ok) throw new Error(d.error || `Failed (${res.status})`);
                            setProgressNote("");
                            location.reload();
                          } catch (e) {
                            setErr(e.message);
                          }
                        }}
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Add update
                      </button>
                      <button
                        type="button"
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                          useDarkTheme
                            ? "border-white/10 text-slate-200 hover:border-white/30"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                        onClick={() => setProgressNote("")}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reminderModal && (
          <motion.div
            className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeReminderModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-900">Notify involved members</h3>
                  <p className="text-sm text-slate-500">
                    Let the tagged members know that this escalation requires an immediate meeting with leadership.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeReminderModal}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Members</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {reminderModal.members.map((member) => (
                      <span
                        key={member.id}
                        className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700"
                      >
                        <Users className="h-3.5 w-3.5" /> {member.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Reminder message
                  </label>
                  <textarea
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                  <p className="text-xs text-slate-400">
                    This note is stored against the escalation and sent to each selected member.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeReminderModal}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={sendReminder}
                  disabled={reminderSending}
                  className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reminderSending && <Loader2 className="h-4 w-4 animate-spin" />} Send reminder
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {actionModal && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActionModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {actionModal.type === "escalate"
                      ? "Escalate to level 2"
                      : actionModal.type === "hold"
                        ? "Place escalation on hold"
                        : actionModal.type === "withdraw"
                          ? "Withdraw escalation"
                          : "Close escalation"}
                  </h3>
                  <p className="text-xs text-slate-500">Matter #{actionModal.id}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                  onClick={() => setActionModal(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {actionModal.type === "escalate" ? (
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assign to L2</label>
                    <input
                      value={modalL2}
                      onChange={(e) => setModalL2(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      placeholder="Enter user id to assign"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      onClick={() => setActionModal(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-500"
                      onClick={async () => {
                        setErr("");
                        setMsg("");
                        try {
                          const res = await fetch(
                            "/api/managersCommon/escalations?section=escalate",
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: actionModal.id,
                                l2AssigneeId: parseInt(modalL2, 10),
                              }),
                            }
                          );
                          const d = await res.json();
                          if (!res.ok) throw new Error(d.error || `Failed (${res.status})`);
                          setMsg(`Escalation #${actionModal.id} moved to level 2.`);
                          setActionModal(null);
                        } catch (e) {
                          setErr(e.message);
                        }
                      }}
                    >
                      Escalate
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {actionModal.type === "withdraw"
                        ? "Withdrawal note"
                        : actionModal.type === "hold"
                          ? "On-hold note"
                          : "Closing note"}
                    </label>
                    <textarea
                      value={modalNote}
                      onChange={(e) => setModalNote(e.target.value)}
                      rows={4}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      placeholder={
                        actionModal.type === "withdraw"
                          ? "Share why you are withdrawing this escalation (optional)."
                          : actionModal.type === "hold"
                            ? "Share why this escalation is on hold (optional)."
                            : "Explain why this escalation is resolved."
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      onClick={() => setActionModal(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-4 py-2 text-xs font-semibold text-white shadow-sm transition ${
                        actionModal.type === "hold"
                          ? "bg-orange-600 hover:bg-orange-500"
                          : "bg-rose-600 hover:bg-rose-500"
                      }`}
                      onClick={async () => {
                        const noteValue = modalNote.trim();
                        if (actionModal.type === "close" && !noteValue) {
                          setErr("A closing note is required.");
                          return;
                        }
                        setErr("");
                        setMsg("");
                        try {
                          const section = actionModal.type === "hold"
                            ? "hold"
                            : actionModal.type === "withdraw"
                              ? "withdraw"
                              : "close";
                          const res = await fetch(
                            `/api/managersCommon/escalations?section=${section}`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: actionModal.id,
                                note: noteValue || null,
                              }),
                            }
                          );
                          const d = await res.json();
                          if (!res.ok) throw new Error(d.error || `Failed (${res.status})`);
                          if (actionModal.type === "hold") {
                            setMsg(`Escalation #${actionModal.id} placed on hold.`);
                          } else if (actionModal.type === "withdraw") {
                            setMsg(`Escalation #${actionModal.id} withdrawn.`);
                          } else {
                            setMsg(`Escalation #${actionModal.id} closed.`);
                          }
                          setActionModal(null);
                        } catch (e) {
                          setErr(e.message);
                        }
                      }}
                    >
                      {actionModal.type === "hold"
                        ? "Place on hold"
                        : actionModal.type === "withdraw"
                          ? "Withdraw escalation"
                          : "Close escalation"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
}
