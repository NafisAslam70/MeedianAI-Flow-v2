"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Save,
  Trash2,
  RefreshCw,
  Clock3,
  Link2,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import Button from "@/components/ui/Button";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

const emptyDivision = (start = "") => ({
  label: "",
  startTime: start,
  endTime: "",
  isFree: false,
  checklist: [],
  dutyHolders: [],
  duties: {},
});

export default function MeedSchedulesPage() {
  const { data: session } = useSession();
  const { data: programData } = useSWR("/api/admin/manageMeedian?section=metaPrograms", fetcher, {
    dedupingInterval: 60000,
  });
  const { data: membersData } = useSWR("/api/member/users", fetcher);
  const { data: scheduleData, isLoading, mutate } = useSWR(
    "/api/admin/manageMeedian?section=meedSchedules",
    fetcher,
    { refreshInterval: 30000 }
  );

  const programs = useMemo(
    () => (programData?.programs || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [programData]
  );
  const schedules = scheduleData?.schedules || [];
  const members = membersData?.users || [];

  const togglePin = (id) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (typeof window !== "undefined") {
        localStorage.setItem("meedSchedulePins", JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  const [form, setForm] = useState({
    id: null,
    programId: "",
    title: "",
    description: "",
    scheduleNumber: "",
    releasedBy: "",
    moderatorId: "",
    verifiedBy: "",
    verifiedAt: "",
    active: true,
    divisions: [emptyDivision()],
  });
  const lastDivisionRef = useRef(null);
  const lastDivisionCountRef = useRef(form.divisions.length);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [collapsedMap, setCollapsedMap] = useState({});
  const [pinnedIds, setPinnedIds] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("meedSchedulePins");
      if (!raw) return new Set();
      return new Set(JSON.parse(raw));
    } catch {
      return new Set();
    }
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [printOptions, setPrintOptions] = useState({
    showChecklist: true,
    showDutyHolders: true,
    goal: "",
  });

  const markVerified = () => {
    const today = new Date().toISOString().slice(0, 10);
    const name = session?.user?.name || "Verified User";
    setForm((f) => ({
      ...f,
      verifiedBy: name,
      verifiedAt: f.verifiedAt || today,
    }));
  };

  const displayTitle = (f = form) => {
    if (f.title?.trim()) return f.title.trim();
    const p = programs.find((p) => String(p.id) === String(f.programId));
    return p ? `${p.name} Schedule` : "Untitled Schedule";
  };

  const computeScheduleNumber = (f) => {
    if (f.scheduleNumber?.trim()) return f.scheduleNumber.trim();
    const year = new Date().getFullYear();
    const programKey =
      programs.find((p) => String(p.id) === String(f.programId))?.programKey || "CUS";
    const serialSource = f.id || Date.now();
    const serial = String(serialSource % 10000).padStart(4, "0");
    return `${year}-${programKey}-${serial}`;
  };

  const printSchedule = (source) => {
    const escapeHtml = (str = "") =>
      str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const divisions = (source?.divisions || [])
      .map((d, idx) => ({ ...d, position: Number.isFinite(d.position) ? d.position : idx }))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const program = programs.find((p) => p.id === source.programId);
    const moderator = members.find((m) => String(m.id) === String(source.moderatorId));
    const title = source.title || (program ? `${program.name} Schedule` : "Custom Schedule");
    const releaseStr = new Date().toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const releasedBy = source.releasedBy?.trim() || session?.user?.name || "—";
    const scheduleNo = computeScheduleNumber(source);
    const goalText = (printOptions.goal || "").trim();
    const notesText = (source.description || "").trim();
    const noteItems = notesText
      ? notesText
          .split(/\n+/)
          .map((n) => n.replace(/^(?:\\s|•|\\*|\\-)+/, "").trim())
          .filter(Boolean)
      : [];
    const sealUrl = typeof window !== "undefined" ? `${window.location.origin}/meedSeal.png` : "/meedSeal.png";
    const verifiedBy = source.verifiedBy?.trim();
    const verifiedAt = source.verifiedAt
      ? new Date(source.verifiedAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" })
      : null;
    const verifiedLine = verifiedBy
      ? `Verified by ${verifiedBy}${verifiedAt ? ` on ${verifiedAt}` : ""}`
      : "Verification pending";

    const win = window.open("", "_blank");
    if (!win) return;

    const style = `
      <style>
        body{font-family:'Inter',system-ui,-apple-system,sans-serif;color:#0f172a;margin:24px;}
        table{width:100%;border-collapse:collapse;margin-top:12px;}
        th,td{border:1px solid #444;padding:7px 9px;font-size:12px;}
        th{background:#e5e7eb;text-align:center;letter-spacing:0.2px;}
        .free{color:#c05621;font-weight:700;}
        .meta-chip{padding:6px 10px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;box-shadow:0 1px 2px rgba(0,0,0,0.05);display:inline-flex;gap:6px;align-items:center;}
        .todo-list{margin:8px 0 0;padding-left:0;list-style:none;}
        .todo-list li{display:flex;gap:6px;align-items:flex-start;font-size:12px;}
        .todo-list li span.icon{color:#0ea5e9;font-weight:700;line-height:1;}
        .notes-list{margin:0;padding-left:18px;}
        .notes-list li{margin:3px 0;white-space:pre-wrap;}
        body::before{
          content:"";
          position:fixed;inset:0;
          background:url('${sealUrl}') center center / 260px 260px no-repeat;
          opacity:0.12;pointer-events:none;filter:grayscale(100%);
        }
      </style>
    `;

    const rows = divisions
      .map(
        (d, i) => `
          <tr>
            <td style="text-align:center;font-weight:600;">${i + 1}</td>
            <td>${escapeHtml(d.label || `Division ${i + 1}`)}</td>
            <td style="white-space:nowrap;text-align:center;">${
              d.isFree
                ? '<span class="free">Free / Unbounded</span>'
                : `${d.startTime || "--"} – ${d.endTime || "--"}`
            }</td>
            ${printOptions.showDutyHolders ? `<td>${(d.dutyHolders && d.dutyHolders.length)
              ? d.dutyHolders.map((p) => escapeHtml(p)).join(", ")
              : "—"}</td>` : ""}
          </tr>`
      )
      .join("");

    const checklistBlocks = !printOptions.showChecklist
      ? ""
      : divisions
          .map((d, i) => {
            if (!d.checklist || !d.checklist.length) return "";
            const items = d.checklist
              .map(
                (c) =>
                  `<li><span class="icon">✔</span><span>${escapeHtml(c)}</span></li>`
              )
              .join("");
            return `
              <div style="margin-bottom:12px;">
                <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${i + 1}. ${escapeHtml(
              d.label || "Division"
            )} — Checklist</div>
                <ul class="todo-list">${items}</ul>
              </div>`;
          })
          .join("");

    const header = `
      <div style="display:flex;justify-content:center;align-items:flex-start;gap:12px;">
        <div style="width:82px;height:82px;border-radius:12px;background:#f1f5f9;box-shadow:none;display:flex;align-items:center;justify-content:center;transform:translateY(-6px);">
          <img src="${sealUrl}" alt="Seal" style="width:68px;height:68px;object-fit:contain;filter:grayscale(100%) contrast(115%);" />
        </div>
        <div style="text-align:center; padding-top:10px;">
          <div style="font-size:28px;font-weight:800;color:#0ea5e9;letter-spacing:0.6px;">MEED PUBLIC SCHOOL</div>
          <div style="font-size:14px;color:#374151;margin-top:4px;">“Educating for now and for the world hereafter”</div>
          <div style="margin:8px auto 0;width:220px;height:1px;background:#cbd5e1;"></div>
          <div style="margin-top:8px;font-weight:700;font-size:14px;color:#0f172a;">${escapeHtml(title)}${
            program ? ` — ${escapeHtml(program.programKey)}${program.name ? ` (${escapeHtml(program.name)})` : ""}` : ""
          }${source.wefDate ? `<span style="margin-left:8px;font-size:12px;color:#475569;font-weight:600;">(WEF ${new Date(source.wefDate).toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"2-digit"})})</span>` : ""}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;font-size:12px;color:#1f2937;margin-top:12px;">
        <div style="min-width:180px;text-align:left;">
          <div style="font-weight:600;">Moderator</div>
          <div style="margin-top:2px;">${escapeHtml(moderator?.name || releasedBy)}</div>
        </div>
        <div style="text-align:right;min-width:240px;">
          <div style="font-size:13px;font-weight:700;color:#0f172a; margin-top:2px;">Goal: ${escapeHtml(
            goalText || "—"
          )}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;margin-top:8px;">
            <span class="meta-chip">No: ${escapeHtml(scheduleNo)}</span>
            <span class="meta-chip">Release: ${escapeHtml(releaseStr)} by ${escapeHtml(releasedBy)}</span>
            ${source.wefDate ? `<span class="meta-chip">WEF: ${new Date(source.wefDate).toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"2-digit"})}</span>` : ""}
            <span class="meta-chip">${escapeHtml(verifiedLine)}</span>
          </div>
        </div>
      </div>
    `;

    const html = `
      <html>
        <head><title>${escapeHtml(title)}</title>${style}</head>
        <body>
          ${header}
          <table style="margin-top:14px;">
            <thead><tr><th style="width:8%">#</th><th style="width:45%">Division</th><th style="width:20%">Time</th>${printOptions.showDutyHolders ? "<th>Duty holders</th>" : ""}</tr></thead>
            <tbody>${rows || `<tr><td colspan="${printOptions.showDutyHolders ? 4 : 3}">No divisions.</td></tr>`}</tbody>
          </table>
          <div style="margin-top:12px;font-size:12px; display:flex; align-items:flex-start; gap:16px; break-inside: avoid; page-break-inside: avoid;">
            <div style="flex:1;">
              <div style="font-weight:700;margin-bottom:4px;">Notes</div>
              <div style="padding:10px;border:1px solid #e5e7eb;border-radius:8px;min-height:48px;background:#f8fafc;">
                ${noteItems.length
                  ? `<ul class="notes-list">${noteItems.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
                  : "—"}
              </div>
            </div>
            <div style="width:120px;text-align:center;">
              <div style="position:relative;width:100px;height:100px;margin:0 auto;display:flex;align-items:center;justify-content:center;transform:rotate(-6deg);">
                <div style="position:absolute;inset:0;border:2px dashed #64748b;border-radius:999px;opacity:0.9;"></div>
                <div style="position:absolute;inset:10px;border:2px solid #0ea5e9;border-radius:999px;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px;box-shadow:inset 0 0 0 2px rgba(14,165,233,0.08);">
                  <div style="font-size:10px;letter-spacing:1px;color:#0f172a;font-weight:700;">APPROVED</div>
                  <div style="font-size:13px;font-weight:800;color:#0ea5e9;letter-spacing:0.5px;">MEED</div>
                  <div style="font-size:8px;color:#475569;margin-top:2px;">${escapeHtml(releasedBy || "Moderator")}</div>
                </div>
                <div style="position:absolute;bottom:-16px;left:50%;transform:translateX(-50%);font-size:9px;color:#475569;letter-spacing:0.2px;">${escapeHtml(releaseStr.split(" ").slice(0,3).join(" "))}</div>
              </div>
              <div style="margin-top:10px;font-size:11px;color:#334155;">Released by ${escapeHtml(releasedBy)}</div>
            </div>
          </div>
          ${printOptions.showChecklist && checklistBlocks ? `<div style="page-break-before: always; margin-top:16px;"><div style="font-weight:800;font-size:14px;margin-bottom:8px;">Checklists</div>${checklistBlocks}</div>` : ""}
        </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
    win.onload = () => {
      setTimeout(() => {
        win.print();
        win.close();
      }, 150);
    };
  };

  // Auto-scroll to the newest division when one is added
useEffect(() => {
  if (form.divisions.length > lastDivisionCountRef.current) {
    setTimeout(() => {
      lastDivisionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }
  lastDivisionCountRef.current = form.divisions.length;
}, [form.divisions.length]);

// Autofill releasedBy from current user if empty
useEffect(() => {
  const name = session?.user?.name;
  if (name && !form.releasedBy) {
    setForm((f) => ({ ...f, releasedBy: name }));
  }
}, [session?.user?.name]);

const resetForm = () => {
  setForm({
    id: null,
    programId: "",
    title: "",
    description: "",
    scheduleNumber: "",
    releasedBy: session?.user?.name || "",
    moderatorId: "",
    verifiedBy: "",
    verifiedAt: "",
    active: true,
    divisions: [emptyDivision()],
  });
  setPrintOptions({
    showChecklist: true,
    showDutyHolders: true,
    goal: "",
  });
};

  const upsertSchedule = async (override = {}) => {
    setSaving(true);
    setError("");
    try {
      const current = { ...form, ...override };
      setForm(current);
      const payload = {
        id: current.id,
        programId: current.programId ? Number(current.programId) : null,
        title: current.title,
        description: current.description || null,
        scheduleNumber: computeScheduleNumber(current),
        releasedBy: current.releasedBy?.trim() || session?.user?.name || "",
        moderatorId: current.moderatorId ? Number(current.moderatorId) : null,
        verifiedBy: current.verifiedBy?.trim() || null,
        verifiedAt: current.verifiedAt || null,
        active: current.active,
        goal: printOptions.goal,
        printOptions: {
          showChecklist: printOptions.showChecklist,
          showDutyHolders: printOptions.showDutyHolders,
        },
        divisions: current.divisions.map((d, idx) => ({
          ...d,
          position: idx,
          startTime: d.isFree ? null : d.startTime,
          endTime: d.isFree ? null : d.endTime,
          dutyHolders: Array.isArray(d.dutyHolders)
            ? d.dutyHolders.filter((x) => x?.trim()).map((x) => x.trim())
            : [],
        })),
      };
      const method = current.id ? "PATCH" : "POST";
      const res = await fetch("/api/admin/manageMeedian?section=meedSchedules", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to save schedule");
      await mutate();
      resetForm();
    } catch (e) {
      setError(e.message || "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  const deleteSchedule = async (id) => {
    if (!id) return;
    if (!window.confirm("Delete this schedule? Divisions will be removed too.")) return;
    if (!window.confirm("Are you 100% sure? This cannot be undone.")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=meedSchedules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to delete");
      await mutate();
      if (form.id === id) resetForm();
    } catch (e) {
      setError(e.message || "Unable to delete");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (schedule) => {
    setForm({
      id: schedule.id,
      programId: schedule.programId ? String(schedule.programId) : "",
      title: schedule.title || "",
      description: schedule.description || "",
      scheduleNumber: schedule.scheduleNumber || "",
      releasedBy: schedule.releasedBy || session?.user?.name || "",
      wefDate: schedule.wefDate || "",
      moderatorId: schedule.moderatorId ? String(schedule.moderatorId) : "",
      verifiedBy: schedule.verifiedBy || "",
      verifiedAt: schedule.verifiedAt || "",
      active: !!schedule.active,
      divisions:
        schedule.divisions?.length
          ? schedule.divisions.map((d) => ({
              label: d.label || "",
              startTime: d.startTime || "",
              endTime: d.endTime || "",
              isFree: !!d.isFree,
              checklist: Array.isArray(d.checklist) ? d.checklist : [],
              dutyHolders: Array.isArray(d.dutyHolders) ? d.dutyHolders : [],
            }))
          : [emptyDivision()],
    });
    setPrintOptions({
      showChecklist: schedule.printOptions?.showChecklist ?? true,
      showDutyHolders: schedule.printOptions?.showDutyHolders ?? true,
      goal: schedule.goal || schedule.printOptions?.goal || "",
    });
  };

  const addDivision = () => {
    setForm((f) => {
      const prev = f.divisions[f.divisions.length - 1];
      const start = prev?.endTime || "";
      return { ...f, divisions: [...f.divisions, emptyDivision(start)] };
    });
  };

  const moveDivision = (from, to) => {
    setForm((f) => {
      const list = [...f.divisions];
      if (to < 0 || to >= list.length) return f;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      return { ...f, divisions: list };
    });
  };

  const moveChecklistItem = (divisionIndex, from, to) => {
    setForm((f) => {
      const list = [...f.divisions];
      const chk = Array.isArray(list[divisionIndex]?.checklist) ? [...list[divisionIndex].checklist] : [];
      if (to < 0 || to >= chk.length) return f;
      const [item] = chk.splice(from, 1);
      chk.splice(to, 0, item);
      list[divisionIndex] = { ...list[divisionIndex], checklist: chk };
      return { ...f, divisions: list };
    });
  };

  const updateDivision = (idx, updater) => {
    setForm((f) => {
      const list = [...f.divisions];
      list[idx] = updater(list[idx] || {}, list, idx);
      return { ...f, divisions: list };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap rounded-2xl bg-gradient-to-r from-sky-50 via-teal-50 to-emerald-50 border border-sky-100 px-4 py-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-white/70 p-2 shadow">
            <Clock3 className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white text-gray-800 px-3 py-1 text-[11px] font-semibold border border-gray-200 shadow-sm">
              No. {computeScheduleNumber(form)}
            </div>
            <h1 className="mt-2 text-xl font-semibold text-gray-900">Meed Schedules</h1>
            <p className="text-sm text-gray-600">
              Link a program or create a custom schedule, then craft divisions with timing, checklist, and auto-chained starts.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="light" onClick={() => mutate()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="light" onClick={resetForm}>
            Clear
          </Button>
          <Button variant="secondary" onClick={() => upsertSchedule({ active: false })} disabled={saving}>
            Save Draft
          </Button>
          <Button variant="primary" onClick={() => upsertSchedule({ active: true })} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {form.id ? "Update" : "Save"} & Finalise
          </Button>
          <Button variant="secondary" onClick={markVerified} disabled={saving}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {form.verifiedBy ? "Verified" : "Mark Verified"}
          </Button>
          <Button
            variant="light"
            onClick={() => printSchedule({ ...form, programId: form.programId ? Number(form.programId) : null })}
          >
            Print
          </Button>
          <Button
            variant="light"
            onClick={() => setCollapsedMap((m) => {
              const allCollapsed = Object.values(m).every(Boolean) && Object.keys(m).length >= form.divisions.length;
              if (allCollapsed) return {};
              const next = {};
              form.divisions.forEach((_, i) => { next[i] = true; });
              return next;
            })}
          >
            {Object.values(collapsedMap).some(Boolean) ? "Expand all" : "Collapse all"}
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-4 py-2 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6">
        {/* Form */}
        <div className="rounded-2xl bg-white/90 backdrop-blur border border-gray-100 shadow-lg shadow-sky-50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{form.id ? "Edit Schedule" : "Create New"}</h2>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Active
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Program (optional)</label>
            <div className="flex items-center gap-2">
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={form.programId}
                onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))}
              >
                <option value="">No program (custom)</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.programKey} — {p.name}
                  </option>
                ))}
              </select>
              {form.programId && (
                <div className="flex items-center text-xs text-gray-500 px-2 py-1 rounded-md border border-dashed border-gray-200">
                  <Link2 className="w-3 h-3 mr-1" />
                  linked
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Pick a program to pre-attach the schedule. Leave blank to create a custom schedule.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Schedule title</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="e.g., MSP Evening Routine"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Schedule number</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Auto or custom (e.g., 0042)"
                value={form.scheduleNumber}
                onChange={(e) => setForm((f) => ({ ...f, scheduleNumber: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Notes (prints under schedule)</label>
            <textarea
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              rows={3}
              placeholder="Notes (one bullet per line in print)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Moderator (for print)</label>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={form.moderatorId}
                onChange={(e) => {
                  const mid = e.target.value;
                  const selected = members.find((m) => String(m.id) === mid);
                  setForm((f) => ({
                    ...f,
                    moderatorId: mid,
                    releasedBy: selected ? selected.name : f.releasedBy,
                  }));
                }}
              >
                <option value="">Select moderator</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Released by</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Name / role"
                value={form.releasedBy}
                onChange={(e) => setForm((f) => ({ ...f, releasedBy: e.target.value }))}
              />
              <p className="text-xs text-gray-500">Will be printed along with the release date/time.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">WEF Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={form.wefDate}
                onChange={(e) => setForm((f) => ({ ...f, wefDate: e.target.value }))}
              />
              <p className="text-xs text-gray-500">Effective from date shown on print.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={printOptions.showChecklist}
                onChange={(e) => setPrintOptions((o) => ({ ...o, showChecklist: e.target.checked }))}
              />
              Show checklist in print
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={printOptions.showDutyHolders}
                onChange={(e) => setPrintOptions((o) => ({ ...o, showDutyHolders: e.target.checked }))}
              />
              Show duty holders in print
            </label>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Notes (prints under schedule)</label>
              <textarea
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                rows={3}
                placeholder="Notes (one bullet per line in print)"
                value={form.description}
                onFocus={(e) => {
                  if (!e.target.value.trim()) {
                    setForm((f) => ({ ...f, description: "• " }));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const value = form.description || "";
                    const prefix = value.endsWith("\n") || !value ? "• " : "\n• ";
                    setForm((f) => ({ ...f, description: (f.description || "") + prefix }));
                  }
                }}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Goal (prints on header)</label>
              <textarea
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                rows={2}
                placeholder="Goal shown near the header"
                value={printOptions.goal}
                onChange={(e) => setPrintOptions((o) => ({ ...o, goal: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Verified by (optional)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Approver name / role"
                value={form.verifiedBy}
                onChange={(e) => setForm((f) => ({ ...f, verifiedBy: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Verified on (optional)</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={form.verifiedAt}
                onChange={(e) => setForm((f) => ({ ...f, verifiedAt: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <h3 className="font-medium text-gray-800">Divisions</h3>
          <Button
            variant="light"
            size="sm"
            onClick={addDivision}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add division
          </Button>
          </div>

          <div className="space-y-3">
            <AnimatePresence>
              {form.divisions.map((div, idx) => (
                <motion.div
                  key={`div-${idx}`}
                  ref={idx === form.divisions.length - 1 ? lastDivisionRef : null}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-xl border border-gray-200/70 bg-gradient-to-br from-white to-gray-50 p-3 space-y-3 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <button
                      className="text-gray-500 hover:text-gray-700"
                      onClick={() =>
                        setCollapsedMap((m) => ({ ...m, [idx]: !m[idx] }))
                      }
                      title={collapsedMap[idx] ? "Expand" : "Collapse"}
                    >
                      {collapsedMap[idx] ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                    </button>
                    <input
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder={`Division ${idx + 1} label`}
                      value={div.label}
                      onChange={(e) => {
                        updateDivision(idx, (d) => ({ ...d, label: e.target.value }));
                      }}
                    />
                    <label className="flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={div.isFree}
                        onChange={(e) => {
                          updateDivision(idx, (d) => ({ ...d, isFree: e.target.checked }));
                        }}
                      />
                      Free / unbounded
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => moveDivision(idx, idx - 1)}
                          disabled={idx === 0}
                          title="Move up"
                        >
                          <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => moveDivision(idx, idx + 1)}
                          disabled={idx === form.divisions.length - 1}
                          title="Move down"
                        >
                          <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        className="text-rose-500 hover:text-rose-600"
                        onClick={() => {
                          if (!window.confirm("Delete this division?")) return;
                          setForm((f) => ({
                            ...f,
                            divisions: f.divisions.length === 1 ? [emptyDivision()] : f.divisions.filter((_, i) => i !== idx),
                          }));
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {!collapsedMap[idx] && (
                    <>
                      {!div.isFree && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-700">Start</label>
                            <input
                              type="time"
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-200"
                              value={div.startTime}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateDivision(idx, (d) => ({ ...d, startTime: val }));
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-700">End</label>
                            <input
                              type="time"
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-200"
                              value={div.endTime}
                              onChange={(e) => {
                                const val = e.target.value;
                                setForm((f) => {
                                  const list = [...f.divisions];
                                  list[idx] = { ...(list[idx] || {}), endTime: val };
                                  // auto-chain: if next division exists and is not free, set its start to this end when empty
                                  const nextDiv = list[idx + 1];
                                  if (nextDiv && !nextDiv.isFree) {
                                    const shouldReplace = !nextDiv.startTime;
                                    if (shouldReplace) {
                                      list[idx + 1] = { ...nextDiv, startTime: val };
                                    }
                                  }
                                  return { ...f, divisions: list };
                                });
                              }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700">Checklist</label>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const next = [...form.divisions];
                              const list = Array.isArray(next[idx].checklist) ? [...next[idx].checklist] : [];
                              list.push("");
                              next[idx] = { ...next[idx], checklist: list };
                              setForm((f) => ({ ...f, divisions: next }));
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add item
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {(div.checklist || []).map((item, cIdx) => (
                            <div key={`chk-${idx}-${cIdx}`} className="flex items-center gap-2">
                              <input
                                className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs"
                                placeholder="What to do in this division"
                                value={item}
                                onChange={(e) => {
                                  const next = [...form.divisions];
                                  const list = Array.isArray(next[idx].checklist) ? [...next[idx].checklist] : [];
                                  list[cIdx] = e.target.value;
                                  next[idx] = { ...next[idx], checklist: list };
                                  setForm((f) => ({ ...f, divisions: next }));
                                }}
                              />
                          <button
                            className="text-gray-500 hover:text-rose-500"
                            onClick={() => {
                              if (!window.confirm("Delete this checklist item?")) return;
                              const next = [...form.divisions];
                              const list = Array.isArray(next[idx].checklist) ? [...next[idx].checklist] : [];
                              list.splice(cIdx, 1);
                              next[idx] = { ...next[idx], checklist: list };
                              setForm((f) => ({ ...f, divisions: next }));
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <div className="flex items-center gap-1">
                                <button
                                  className="text-gray-400 hover:text-gray-700"
                                  onClick={() => moveChecklistItem(idx, cIdx, cIdx - 1)}
                                  disabled={cIdx === 0}
                                  title="Move up"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  className="text-gray-400 hover:text-gray-700"
                                  onClick={() => moveChecklistItem(idx, cIdx, cIdx + 1)}
                                  disabled={cIdx === (div.checklist?.length || 0) - 1}
                                  title="Move down"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {(div.checklist || []).length === 0 && (
                            <div className="text-[11px] text-gray-500">No checklist yet. Add steps to guide this slot.</div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700">Duty holders (optional)</label>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const next = [...form.divisions];
                              const list = Array.isArray(next[idx].dutyHolders) ? [...next[idx].dutyHolders] : [];
                              list.push("");
                              next[idx] = { ...next[idx], dutyHolders: list };
                              setForm((f) => ({ ...f, divisions: next }));
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add person
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {(div.dutyHolders || []).map((person, pIdx) => (
                        <div key={`dh-${idx}-${pIdx}`} className="flex items-center gap-2">
                          <select
                            className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs"
                            value={person}
                            onChange={(e) => {
                              const next = [...form.divisions];
                              const list = Array.isArray(next[idx].dutyHolders) ? [...next[idx].dutyHolders] : [];
                              list[pIdx] = e.target.value;
                              next[idx] = { ...next[idx], dutyHolders: list };
                              setForm((f) => ({ ...f, divisions: next }));
                            }}
                          >
                            <option value="">Select member</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.name}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                          <button
                            className="text-gray-500 hover:text-rose-500"
                            onClick={() => {
                              if (!window.confirm("Remove this duty holder?")) return;
                              const next = [...form.divisions];
                              const list = Array.isArray(next[idx].dutyHolders) ? [...next[idx].dutyHolders] : [];
                              list.splice(pIdx, 1);
                              next[idx] = { ...next[idx], dutyHolders: list };
                              setForm((f) => ({ ...f, divisions: next }));
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {(div.dutyHolders || []).length === 0 && (
                            <div className="text-[11px] text-gray-500">Optional list of who holds this duty.</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <Button
              variant="light"
              size="sm"
              className="w-full justify-center"
              onClick={addDivision}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add division
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="rounded-2xl bg-white/90 backdrop-blur border border-gray-100 shadow-md p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-gray-900">Existing schedules</h2>
            {isLoading && <span className="text-xs text-gray-500">Loading…</span>}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm pl-9"
                placeholder="Search title or program"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="16.65" y1="16.65" x2="21" y2="21" />
              </svg>
            </div>
          </div>

          {!schedules.length && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
              Nothing yet. Create your first schedule on the left.
            </div>
          )}

          <div className="grid gap-3">
            {schedules
              .slice()
              .filter((s) => {
                if (!searchTerm.trim()) return true;
                const hay = `${s.title || ""} ${s.programKey || ""} ${s.programName || ""}`.toLowerCase();
                return hay.includes(searchTerm.toLowerCase());
              })
              .sort((a, b) => {
                const ap = pinnedIds.has(a.id) ? 1 : 0;
                const bp = pinnedIds.has(b.id) ? 1 : 0;
                if (ap !== bp) return bp - ap; // pinned first
                return (b.updatedAt || b.id || 0) - (a.updatedAt || a.id || 0);
              })
              .map((s) => {
                const collapsed = collapsedMap[`card-${s.id}`] ?? true;
                return (
                  <div
                    key={s.id}
                    className="rounded-xl border border-gray-200 p-4 bg-gradient-to-br from-white to-gray-50 cursor-pointer"
                    onClick={() =>
                      setCollapsedMap((m) => ({ ...m, [`card-${s.id}`]: !((m[`card-${s.id}`] ?? true)) }))
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <button
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() =>
                              setCollapsedMap((m) => ({ ...m, [`card-${s.id}`]: !m[`card-${s.id}`] }))
                            }
                            title={collapsed ? "Expand" : "Collapse"}
                          >
                      {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                          <span className="text-sm font-semibold text-gray-900">{s.title}</span>
                          {s.programKey && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                              {s.programKey}
                            </span>
                          )}
                          {!s.active && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                              inactive
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {s.programName ? `Linked to ${s.programName}` : "Custom schedule"}
                        </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="light"
                          onClick={() => togglePin(s.id)}
                        >
                          {pinnedIds.has(s.id) ? "Unpin" : "Pin"}
                        </Button>
                        <Button size="sm" variant="light" onClick={() => startEdit(s)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteSchedule(s.id)} className="text-rose-600">
                          Delete
                        </Button>
                      </div>
                    </div>
                    {!collapsed && (
                      <>
                        {s.divisions?.length ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {s.divisions
                              .slice()
                              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                              .map((d) => (
                                <div
                                  key={d.id}
                                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium text-gray-900">{d.label}</div>
                                      <div className="text-xs text-gray-600">
                                        {d.isFree ? "Free / unbounded" : `${d.startTime || "--"} – ${d.endTime || "--"}`}
                                      </div>
                                    </div>
                                    {d.isFree ? (
                                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                                        free
                                      </span>
                                    ) : null}
                                  </div>
                                  {(d.checklist || []).length ? (
                                    <ul className="list-disc list-inside text-xs text-gray-700 space-y-0.5">
                                      {d.checklist.map((c, i) => (
                                        <li key={`c-${d.id}-${i}`}>{c}</li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-gray-500">No divisions added.</div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
