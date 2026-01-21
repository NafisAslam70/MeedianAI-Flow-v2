"use client";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import jsPDF from "jspdf";
import { CalendarDays, Download, Filter, Search, UserCheck, UserX, Users } from "lucide-react";

const fetcher = (u) => fetch(u).then((r) => r.json());

const PROGRAM_TRACK_HINTS = {
  MSP: ["pre_primary", "elementary"],
  MHCP: ["pre_primary", "elementary"],
  MOP: ["mop", "mop2"],
};
const BASE_TRACKS = ["pre_primary", "elementary"];
const formatTrackLabel = (value) => {
  if (!value) return "";
  return String(value)
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
};

export default function AttendanceReportPage() {
  const today = new Date().toISOString().slice(0,10);
  const [date, setDate] = useState(today);
  const [programKey, setProgramKey] = useState("MSP");
  const [track, setTrack] = useState(""); // pre_primary | elementary | both
  const [view, setView] = useState("all"); // all | present | absent
  const [roleFilter, setRoleFilter] = useState("all"); // all | teacher | non_teacher
  const [search, setSearch] = useState("");
  const defaultReminder = useMemo(() => {
    const dateObj = new Date(`${date}T00:00:00`);
    const formattedDate = Number.isNaN(dateObj.getTime())
      ? date
      : dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const scope = [];
    if (programKey) scope.push(programKey);
    if (track) scope.push(track.replace(/_/g, " "));
    const scopeLabel = scope.length ? ` (${scope.join(" • ")})` : "";
    return `Hi there! Your attendance for ${formattedDate}${scopeLabel} is still pending. Please scan in or connect with your moderator to update it.`;
  }, [date, programKey, track]);
  const [reminderSubject, setReminderSubject] = useState("Attendance Reminder");
  const [reminderMessage, setReminderMessage] = useState(defaultReminder);
  const [messageDirty, setMessageDirty] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [banner, setBanner] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const { data: programsData } = useSWR(
    "/api/admin/manageMeedian?section=metaPrograms",
    fetcher,
    { dedupingInterval: 60000 }
  );
  const programOptions = useMemo(() => {
    const rows = Array.isArray(programsData?.programs) ? programsData.programs : [];
    return rows
      .filter((program) => program && program.active !== false)
      .map((program) => ({
        id: program.id,
        key: String(program.programKey || "").toUpperCase(),
        name: program.name || program.programKey || "Program",
        scope: String(program.scope || "").toLowerCase(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [programsData]);
  useEffect(() => {
    if (!programOptions.length) return;
    if (!programKey) return;
    const exists = programOptions.some((program) => program.key === programKey);
    if (!exists) {
      const fallback =
        programOptions.find((program) => program.key === "MSP") ||
        programOptions[0];
      if (fallback) setProgramKey(fallback.key);
    }
  }, [programOptions, programKey]);
  const currentProgram = useMemo(
    () => programOptions.find((program) => program.key === programKey) || null,
    [programOptions, programKey]
  );
  const derivedTrackValues = useMemo(() => {
    const set = new Set();
    const push = (value) => {
      const norm = String(value || "").trim().toLowerCase();
      if (norm) set.add(norm);
    };
    const collectFromProgram = (program) => {
      if (!program) return;
      const scope = program.scope;
      if (scope === "both" || scope === "pre_primary") push("pre_primary");
      if (scope === "both" || scope === "elementary") push("elementary");
      if (scope && !["both", "pre_primary", "elementary"].includes(scope)) push(scope);
      const hints = PROGRAM_TRACK_HINTS[program.key] || [];
      hints.forEach(push);
    };
    if (currentProgram) {
      collectFromProgram(currentProgram);
    } else if (!programKey) {
      programOptions.forEach(collectFromProgram);
    }
    BASE_TRACKS.forEach(push);
    return Array.from(set);
  }, [currentProgram, programKey, programOptions]);
  useEffect(() => {
    if (!track) return;
    if (!derivedTrackValues.includes(track)) {
      setTrack("");
    }
  }, [derivedTrackValues, track]);
  const trackOptions = useMemo(() => {
    const sorted = derivedTrackValues.slice().sort((a, b) => a.localeCompare(b));
    const rows = sorted.map((value) => ({
      value,
      label: formatTrackLabel(value),
    }));
    if (track && !sorted.includes(track)) {
      rows.push({ value: track, label: formatTrackLabel(track) });
    }
    return rows;
  }, [derivedTrackValues, track]);

  const params = new URLSearchParams({ section: 'report', date });
  const normalizedProgramKey = programKey ? programKey.toUpperCase() : "";
  if (normalizedProgramKey) params.set('programKey', normalizedProgramKey);
  if (track) params.set('track', track);

  const { data, isLoading, error, mutate } = useSWR(`/api/attendance?${params.toString()}`, fetcher);

  useEffect(() => {
    if (!messageDirty) {
      setReminderMessage(defaultReminder);
    }
  }, [defaultReminder, messageDirty]);

  const deduped = useMemo(() => {
    if (!data) return { presents: [], absentees: [], totals: null };

    const keepEarliest = (prev, next) => {
      if (!prev?.at) return next;
      if (!next?.at) return prev;
      return new Date(next.at) < new Date(prev.at) ? next : prev;
    };

    const dedupe = (list, merge = (prev) => prev) => {
      if (!Array.isArray(list)) return [];
      const map = new Map();
      const leftovers = [];
      for (const item of list) {
        const key = Number.isFinite(item?.userId) ? String(item.userId) : null;
        if (!key) {
          leftovers.push(item);
          continue;
        }
        const existing = map.get(key);
        map.set(key, existing ? merge(existing, item) : item);
      }
      return [...map.values(), ...leftovers];
    };

    const presents = dedupe(data.presents, keepEarliest)
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const presentSet = new Set(
      presents
        .map((p) => (Number.isFinite(p?.userId) ? Number(p.userId) : null))
        .filter((id) => id !== null)
    );
    const absentees = dedupe(data.absentees)
      .filter((a) => (Number.isFinite(a?.userId) ? !presentSet.has(Number(a.userId)) : true))
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const totals = {
      present: presents.length,
      absent: absentees.length,
      presentTeachers: presents.filter((p) => p.isTeacher === true).length,
      presentNonTeachers: presents.filter((p) => p.isTeacher !== true).length,
      absentTeachers: absentees.filter((p) => p.isTeacher === true).length,
      absentNonTeachers: absentees.filter((p) => p.isTeacher !== true).length,
    };

    return { presents, absentees, totals };
  }, [data]);

  const presentRows = deduped.presents || [];
  const absentRows = deduped.absentees || [];
  const totals = deduped.totals || {
    present: data?.totals?.present ?? 0,
    absent: data?.totals?.absent ?? 0,
    presentTeachers: data?.totals?.presentTeachers ?? 0,
    presentNonTeachers: data?.totals?.presentNonTeachers ?? 0,
    absentTeachers: data?.totals?.absentTeachers ?? 0,
    absentNonTeachers: data?.totals?.absentNonTeachers ?? 0,
  };

  const selectableIds = useMemo(() => {
    return absentRows
      .filter((row) => {
        const number = typeof row?.whatsapp === "string" ? row.whatsapp.trim() : "";
        if (!number) return false;
        return row.whatsappEnabled !== false;
      })
      .map((row) => {
        const id = Number(row.userId);
        return Number.isFinite(id) ? id : null;
      })
      .filter((id) => id !== null);
  }, [absentRows]);

  useEffect(() => {
    setSelectedIds(new Set(selectableIds));
  }, [selectableIds]);

  const selectedCount = selectedIds.size;

  const toggleRecipient = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(selectableIds));
  const clearAll = () => setSelectedIds(new Set());

  const formatTime = (value) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  };

  const filteredRows = useMemo(() => {
    const baseList = view === "present"
      ? presentRows.map((row) => ({ ...row, status: "present" }))
      : view === "absent"
        ? absentRows.map((row) => ({ ...row, status: "absent" }))
        : [
            ...presentRows.map((row) => ({ ...row, status: "present" })),
            ...absentRows.map((row) => ({ ...row, status: "absent" })),
          ];

    const query = search.trim().toLowerCase();

    return baseList.filter((row) => {
      const isTeacher = row.isTeacher === true;
      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "teacher" && isTeacher) ||
        (roleFilter === "non_teacher" && !isTeacher);

      const matchesQuery =
        !query ||
        (row.name?.toLowerCase().includes(query) || String(row.userId || "").includes(query));

      return matchesRole && matchesQuery;
    });
  }, [view, roleFilter, search, presentRows, absentRows]);

  const noMatches = data && !isLoading && filteredRows.length === 0;
  const summaryCards = [
    {
      label: "Total Marked",
      value: totals.present + totals.absent,
      icon: Users,
      accent: "from-cyan-400/20 via-white to-transparent",
      tint: "text-cyan-500",
    },
    {
      label: "Present",
      value: totals.present,
      sub: `${totals.presentTeachers} teachers • ${totals.presentNonTeachers} members`,
      icon: UserCheck,
      accent: "from-emerald-400/20 via-white to-transparent",
      tint: "text-emerald-500",
    },
    {
      label: "Absent",
      value: totals.absent,
      sub: `${totals.absentTeachers} teachers • ${totals.absentNonTeachers} members`,
      icon: UserX,
      accent: "from-rose-400/20 via-white to-transparent",
      tint: "text-rose-500",
    },
  ];

  const generatePdf = () => {
    if (!data) return;
    const doc = new jsPDF();
    let y = 10;
    doc.setFontSize(14);
    doc.text(`Daily Attendance — ${data.date}${data.programKey ? ` (${data.programKey}${data.track?'/'+data.track:''})` : ''}`, 10, y); y += 8;
    doc.setFontSize(11);
    const t = totals;
    doc.text(`Present: ${t.present} (Teachers: ${t.presentTeachers}, Non-Teachers: ${t.presentNonTeachers})`, 10, y); y += 6;
    doc.text(`Absent:  ${t.absent} (Teachers: ${t.absentTeachers}, Non-Teachers: ${t.absentNonTeachers})`, 10, y); y += 8;
    doc.setFontSize(12); doc.text('Presents', 10, y); y += 6; doc.setFontSize(10);
    presentRows.forEach((p) => { if (y > 280) { doc.addPage(); y = 10;} doc.text(`- ${p.name || ('User #'+p.userId)}  at ${p.at ? new Date(p.at).toLocaleTimeString() : '-'}`, 12, y); y += 5; });
    y += 4; if (y > 280) { doc.addPage(); y = 10; }
    doc.setFontSize(12); doc.text('Absentees', 10, y); y += 6; doc.setFontSize(10);
    absentRows.forEach((p) => { if (y > 280) { doc.addPage(); y = 10;} doc.text(`- ${p.name || ('User #'+p.userId)}`, 12, y); y += 5; });
    doc.save(`attendance_${data.date}${data.programKey?`_${data.programKey}`:''}${data.track?`_${data.track}`:''}.pdf`);
  };

  const absenteesCount = absentRows.length;

  const handleNotifyAbsentees = async () => {
    if (sendingReminder) return;
    if (!absenteesCount) {
      setBanner({ type: "info", text: "Everyone is already marked present for the selected filters." });
      return;
    }
    if (!selectedCount) {
      setBanner({ type: "info", text: "Please select at least one recipient." });
      return;
    }
    if (!reminderSubject.trim() || !reminderMessage.trim()) {
      setBanner({ type: "error", text: "Subject and message cannot be empty." });
      return;
    }
    setSendingReminder(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/attendance?section=notifyAbsentees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          programKey,
          track,
          subject: reminderSubject.trim(),
          message: reminderMessage.trim(),
          recipientUserIds: Array.from(selectedIds),
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to send reminders.");
      }
      setBanner({
        type: "success",
        text: `WhatsApp reminders sent: ${payload.sent}. Skipped: ${payload.skipped}. Failed: ${payload.failed}.`,
      });
      mutate();
    } catch (err) {
      setBanner({ type: "error", text: err.message || "Failed to send reminders." });
    } finally {
      setSendingReminder(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
                <CalendarDays size={24} className="text-cyan-500" /> Daily Attendance Report
              </h1>
              <p className="text-sm text-slate-500">Review attendance snapshots, filter by roles, and export a clean report.</p>
            </div>
            <button
              onClick={generatePdf}
              disabled={!data}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={18} /> Export PDF
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Program</label>
              <select
                value={programKey}
                onChange={(e) => {
                  const value = e.target.value;
                  setProgramKey(value ? value.toUpperCase() : "");
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                <option value="">All Programs</option>
                {programOptions.map((program) => (
                  <option key={program.key} value={program.key}>
                    {program.name} ({program.key})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Track</label>
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                <option value="">All Tracks</option>
                {trackOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {data && (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {summaryCards.map(({ label, value, sub, icon: Icon, accent, tint }) => (
              <div
                key={label}
                className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-lg transition hover:border-cyan-500/30`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-70`} />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
                    {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
                  </div>
                  <Icon size={28} className={tint} />
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "all", label: "Everyone" },
                { key: "present", label: "Present" },
                { key: "absent", label: "Absent" },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => setView(option.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    view === option.key
                      ? "bg-cyan-500 text-white shadow"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "all", label: "All Roles" },
                { key: "teacher", label: "Teachers" },
                { key: "non_teacher", label: "Members" },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => setRoleFilter(option.key)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                    roleFilter === option.key
                      ? "border-cyan-500 bg-cyan-50 text-cyan-600"
                      : "border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Filter size={14} /> {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or ID"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
            <p className="text-xs text-slate-500">Showing {filteredRows.length} record{filteredRows.length === 1 ? "" : "s"} — live data updates every finalize.</p>
          </div>

          {banner && (
            <div
              className={`mt-4 rounded-2xl border p-4 text-sm ${
                banner.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : banner.type === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {banner.text}
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">WhatsApp Reminder</h3>
                <p className="text-xs text-slate-500">Send a quick WhatsApp nudge to everyone still marked absent for {date}.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setMessageDirty(false);
                    setReminderMessage(defaultReminder);
                  }}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-400 hover:text-slate-700"
                  type="button"
                >
                  Reset message
                </button>
                <button
                  onClick={handleNotifyAbsentees}
                  disabled={sendingReminder || !selectedCount}
                  className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                >
                  {sendingReminder ? "Sending…" : `Notify ${selectedCount}`}
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</label>
                <input
                  value={reminderSubject}
                  onChange={(e) => setReminderSubject(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recipients</label>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                  {selectedCount} of {absenteesCount} member{absenteesCount === 1 ? "" : "s"} selected
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message</label>
              <textarea
                value={reminderMessage}
                onChange={(e) => {
                  setReminderMessage(e.target.value);
                  setMessageDirty(true);
                }}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
              <p className="text-xs text-slate-400">The default text updates when you change the date. Customise it before sending if needed.</p>
            </div>
            <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {absentRows.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">Everyone is present—no reminders needed.</div>
              ) : (
                <>
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-2 text-xs text-slate-500">
                    <span>{selectedCount} selected</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAll}
                        className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
                        type="button"
                      >
                        Select all
                      </button>
                      <button
                        onClick={clearAll}
                        className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
                        type="button"
                      >
                        Unselect all
                      </button>
                    </div>
                  </div>
                  {absentRows.map((row, idx) => {
                  const idValue = Number(row.userId);
                  const numericId = Number.isFinite(idValue) ? idValue : null;
                  const hasWhatsapp = typeof row.whatsapp === "string" && row.whatsapp.trim() !== "";
                  const whatsappDisabled = row.whatsappEnabled === false;
                  const checked = numericId !== null && selectedIds.has(numericId);
                  const disabled = numericId === null || !hasWhatsapp || whatsappDisabled;
                  return (
                    <label
                      key={numericId !== null ? `absent_${numericId}` : `absent_unknown_${idx}`}
                      className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
                    >
                      <span className="flex flex-col">
                        <span className="font-medium text-slate-900">{row.name || (numericId !== null ? `User #${numericId}` : "Unknown member")}</span>
                        <span className="mt-0.5 text-xs text-slate-500">
                          {numericId !== null ? `#${numericId}` : "No linked user"}
                          {row.isTeacher ? " • Teacher" : " • Member"}
                        </span>
                        {(!hasWhatsapp || whatsappDisabled) && (
                          <span className="mt-0.5 text-xs text-rose-500">
                            {!hasWhatsapp ? "No WhatsApp number on file" : "WhatsApp disabled"}
                          </span>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-cyan-500"
                        checked={checked}
                        onChange={() => numericId !== null && toggleRecipient(numericId)}
                        disabled={disabled}
                      />
                    </label>
                  );
                })}
                </>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Loading attendance…</div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
              {error.message || "Failed to load report"}
            </div>
          )}

          {!isLoading && !error && data && (
            <div className="mt-6 space-y-3">
              {noMatches ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  No attendance records match the current filters.
                </div>
              ) : (
                filteredRows.map((row) => (
                  <div
                    key={`${row.status}_${row.userId}`}
                    className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-cyan-500/30 hover:shadow-lg"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900">
                        {row.name || `User #${row.userId}`}
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">#{row.userId}</span>
                        {row.status === "present" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600">
                            <UserCheck size={12} /> Present · {formatTime(row.at)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-600">
                            <UserX size={12} /> Absent
                          </span>
                        )}
                        {row.isTeacher ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-indigo-600">
                            Teacher
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                            Member
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">{view === "absent" ? "" : formatTime(row.at)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
