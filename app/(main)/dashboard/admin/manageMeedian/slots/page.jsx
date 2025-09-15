"use client";

import useSWR from "swr";
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import ManageSlots from "@/components/manageMeedian/ManageSlots";
import WeeklyTOD from "@/components/manageMeedian/WeeklyTOD";

// MEED daily slot architecture (template), for guidance and NMRI/AMRI views
const TEMPLATE = [
  { no: 0,  block: 0, title: "Day Open (Promise)/(After Fajr Salah)", type: "AMRI", time: "Pre‑Fajr (2–5m)", note: "#ref PD" },
  { no: 1,  block: 1, title: "Fajr + Morning Coaching", type: "NMRI", time: "04:00–05:45", note: "NMRI routine" },
  { no: 2,  block: 1, title: "Blitz‑1 (Morning)", type: "NMRI", time: "05:45–06:55", note: "Blitz" },
  { no: 3,  block: 1, title: "School Assembly", type: "AMRI", time: "07:00–07:25", note: "#ref PD" },
  { no: 4,  block: 1, title: "MSP‑D1", type: "AMRI", time: "07:25–09:30", note: "#ref PD" },
  { no: 5,  block: 1, title: "Tiffin", type: "NMRI", time: "09:30–10:00", note: "NMRI routine" },
  { no: 6,  block: 1, title: "MSP‑D2", type: "AMRI", time: "10:00–12:30", note: "#ref PD" },
  { no: 7,  block: 1, title: "ASD Blitz‑2", type: "NMRI", time: "12:30–13:45", note: "Blitz (After‑School Departure)" },
  { no: 8,  block: 2, title: "PowerNap", type: "NMRI", time: "13:45–15:00", note: "NMRI routine" },
  { no: 9,  block: 2, title: "BHC Blitz‑3", type: "NMRI", time: "15:00–15:30", note: "Blitz (Before Hostel Coaching)" },
  { no: 10, block: 3, title: "MHCP‑1 (HW Urgencies)", type: "AMRI", time: "15:30–17:20", note: "#ref PD" },
  { no: 11, block: 3, title: "Recreation", type: "NMRI", time: "17:20–18:20", note: "NMRI routine" },
  { no: 12, block: 3, title: "Maghrib Blitz‑4", type: "NMRI", time: "18:20–19:00", note: "Blitz" },
  { no: 13, block: 4, title: "MHCP‑2 (Beyond Potential)", type: "AMRI", time: "19:00–20:00", note: "#ref PD" },
  { no: 14, block: 4, title: "Day Shutdown", type: "AMRI", time: "20:00–20:30", note: "#ref PD" },
  { no: 15, block: 5, title: "AHC Blitz‑5", type: "NMRI", time: "20:30–21:30", note: "Blitz (After Hostel Coaching)" },
  { no: 16, block: 5, title: "GoodNight", type: "NMRI", time: "21:30–21:50", note: "NMRI routine" },
  { no: 17, block: 6, title: "Into the Dreams", type: "NMRI", time: "21:50–03:50", note: "NMRI routine" },
];

const blocks = {
  0: "Block 0 – Opening Ritual",
  1: "Block 1 – Spiritual & Academic Anchors",
  2: "Block 2 – Midday Consolidation",
  3: "Block 3 – Afternoon Depth",
  4: "Block 4 – Evening Transformation",
  5: "Block 5 – Night Anchors",
  6: "Block 6 – Sleep Cycle",
};

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function SlotsPage() {
  const { data: slotData, isLoading: loadingSlots } = useSWR("/api/admin/manageMeedian?section=slots", fetcher);
  const { data: teamData } = useSWR("/api/admin/manageMeedian?section=team", fetcher, { dedupingInterval: 30000 });
  const { data: weeklyData, mutate: mutateWeekly } = useSWR("/api/admin/manageMeedian?section=slotsWeekly", fetcher);
  const { data: calData } = useSWR("/api/admin/manageMeedian?section=schoolCalendar", fetcher, { dedupingInterval: 600000 });

  const [slots, setSlots] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editSlot, setEditSlot] = useState(null);
  const members = useMemo(() => teamData?.users || [], [teamData]);

  // keep local slots in sync
  useMemo(() => {
    if (slotData?.slots) setSlots(slotData.slots);
  }, [slotData?.slots]);

  const saveSlotAssignment = async (slotId, memberId) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/manageMeedian?section=slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ slotId, memberId }] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, assignedMemberId: memberId } : s)));
      setEditSlot(null);
    } catch (e) {
      console.error("Save failed", e);
      alert("Failed to save assignment.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSlotAssignment = async (slotId) => {
    await saveSlotAssignment(slotId, null);
  };

  const [tab, setTab] = useState("full"); // full | weekly | nmri | amri | onmri
  const [showMeta, setShowMeta] = useState(false);
  const [draft, setDraft] = useState([]);
  const [metaBlock, setMetaBlock] = useState("all"); // all | 0..6
  const [metaQuery, setMetaQuery] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkMode, setBulkMode] = useState("legacy"); // legacy | weekly
  const [bulkAssignments, setBulkAssignments] = useState({}); // legacy mode: slotId -> userId
  const [weeklyMatrix, setWeeklyMatrix] = useState({}); // weekly: slotId -> weekday -> { eng: [userId], disc: [userId] }
  const [selectedWeeks, setSelectedWeeks] = useState([]); // array of { id, startDate, endDate, label }
  const [picker, setPicker] = useState(null); // { slotId, day, role: 'eng'|'disc' }
  const [finalizing, setFinalizing] = useState(false);
  const slotTemplateByNo = useMemo(() => new Map(TEMPLATE.map((t) => [t.no, t])), []);
  const [bulkBlock, setBulkBlock] = useState("1"); // default B1; 'all' available at end
  const [bulkQuery, setBulkQuery] = useState("");
  // —
  const moderators = useMemo(() => {
    const map = teamData?.userMriRoles || {};
    return (members || []).filter(u => Array.isArray(map[u.id]) && map[u.id].includes('nmri_moderator'));
  }, [teamData, members]);
  const calendarWeeks = useMemo(() => {
    const rows = calData?.calendar || [];
    return rows.filter(r => r.weekNumber != null && r.startDate && r.endDate)
      .map(r => ({ id: r.id, label: `W${r.weekNumber}`, startDate: String(r.startDate).slice(0,10), endDate: String(r.endDate).slice(0,10) }));
  }, [calData]);
  const selectedWeeksLabel = useMemo(() => {
    if (!selectedWeeks?.length) return 'All Weeks';
    return selectedWeeks.map(w => w.label).join(', ');
  }, [selectedWeeks]);


  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Daily Slot Management</h1>
        <p className="text-sm text-gray-600">N‑MRI scheduling with full‑day blocks.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "full", label: "Current NMRI Allotment" },
          { key: "weekly", label: "Weekly TOD" },
          { key: "nmri", label: "N‑MRI" },
          { key: "amri", label: "A‑MRI" },
          { key: "onmri", label: "O‑NMRI" },
        ].map((t) => (
          <button
            key={t.key}
            className={`px-3 py-1.5 rounded-lg border text-sm ${
              tab === t.key ? "bg-teal-600 text-white border-teal-600" : "bg-white border-gray-200 text-gray-800"
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <button
          className="ml-auto px-3 py-1.5 rounded-lg border text-sm bg-white border-gray-200 text-gray-800 hover:bg-gray-50"
          onClick={() => { setDraft(slots.map(s => ({...s}))); setShowMeta(true); }}
        >
          Slots Meta
        </button>
        <button
          className="px-3 py-1.5 rounded-lg border text-sm bg-white border-gray-200 text-gray-800 hover:bg-gray-50"
          onClick={() => {
            // initialize bulk map with current assignments for NMRI only
            const amriSet = new Set(TEMPLATE.filter(t => t.type === 'AMRI').map(t => t.no));
            const init = {};
            for (const s of slots) {
              if (!amriSet.has(Number(s.id))) init[s.id] = s.assignedMemberId || '';
            }
            setBulkAssignments(init);
            // initialize weekly matrix from weeklyData; merge with any saved draft
            const matrix = {};
            const week = weeklyData?.week || [];
            for (const w of week) {
              const sid = w.slot.id;
              if (!matrix[sid]) matrix[sid] = {};
              for (let d = 0; d <= 6; d++) {
                const eng = (w.roles || []).find(r => Number(r.weekday) === d && r.role === 'nmri_guide_english');
                const disc = (w.roles || []).find(r => Number(r.weekday) === d && r.role === 'nmri_guide_discipline');
                matrix[sid][d] = {
                  eng: (eng?.members || []).map(m => String(m.userId)),
                  disc: (disc?.members || []).map(m => String(m.userId)),
                };
              }
            }
            try {
              const saved = JSON.parse(localStorage.getItem('weeklyTODDraft') || 'null');
              if (saved && typeof saved === 'object') {
                for (const sid of Object.keys(saved)) {
                  if (!matrix[sid]) matrix[sid] = {};
                  for (const d of Object.keys(saved[sid] || {})) {
                    const day = Number(d);
                    matrix[sid][day] = {
                      eng: (saved[sid][d]?.eng || []).map(String),
                      disc: (saved[sid][d]?.disc || []).map(String),
                    };
                  }
                }
              }
            } catch {}
            setWeeklyMatrix(matrix);
            setShowBulk(true);
          }}
        >
          Bulk Allotments
        </button>
      </div>

      {/* Content */}
      {tab === "full" && (
        <CurrentNmriAllotmentView
          weeklyWeek={weeklyData?.week || []}
          members={members}
          slotTemplateByNo={slotTemplateByNo}
        />
      )}

      {tab === "weekly" && (
        <WeeklyTOD />
      )}

      {tab === "nmri" && (
        <div className="space-y-3">
          <div className="rounded-xl border p-3 bg-white">
            <h3 className="text-base font-semibold text-gray-900 mb-1">N‑MRI — Non‑Program Rituals</h3>
            <p className="text-xs text-gray-600">Oversight: TOD/MOD. Blitz windows follow 4‑S standard (fast, silent, orderly, accurate).</p>
          </div>
          {Object.entries(blocks).map(([bKey, bTitle]) => {
            const items = TEMPLATE.filter((t) => t.block === Number(bKey) && t.type === "NMRI");
            if (!items.length) return null;
            return (
              <div key={bKey} className="rounded-xl border bg-white">
                <div className="px-3 py-2 border-b text-sm font-semibold text-gray-900">{bTitle}</div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((it) => {
                    const match = slots.find((s) => Number(s.id) === it.no);
                    return (
                      <div key={it.no} className="rounded-lg border p-3">
                        <div className="text-xs text-gray-500">Slot {it.no}</div>
                        <div className="text-sm font-semibold text-gray-900">{it.title}</div>
                        <div className="text-xs text-gray-600">{match ? `${String(match.startTime).slice(0,5)} - ${String(match.endTime).slice(0,5)}` : it.time}</div>
                        <div className="text-xs text-purple-700 mt-1">{it.note}</div>
                        <div className="text-xs text-gray-700 mt-1">TOD/MOD: {match ? (members.find((m) => String(m.id) === String(match.assignedMemberId))?.name || "Unassigned") : "Unassigned"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "amri" && (
        <div className="space-y-3">
          <div className="rounded-xl border p-3 bg-white">
            <h3 className="text-base font-semibold text-gray-900 mb-1">A‑MRI — Program Slots</h3>
            <p className="text-xs text-gray-600">Governed by Program Design (PD). Roles: PI + TOD. Manage schedule under Programs → MSP/MHCP.</p>
          </div>
          {Object.entries(blocks).map(([bKey, bTitle]) => {
            const items = TEMPLATE.filter((t) => t.block === Number(bKey) && t.type === "AMRI");
            if (!items.length) return null;
            return (
              <div key={bKey} className="rounded-xl border bg-white">
                <div className="px-3 py-2 border-b text-sm font-semibold text-gray-900">{bTitle}</div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((it) => {
                    const match = slots.find((s) => Number(s.id) === it.no);
                    return (
                      <div key={it.no} className="rounded-lg border p-3">
                        <div className="text-xs text-gray-500">Slot {it.no}</div>
                        <div className="text-sm font-semibold text-gray-900">{it.title}</div>
                        <div className="text-xs text-gray-600">{match ? `${String(match.startTime).slice(0,5)} - ${String(match.endTime).slice(0,5)}` : it.time}</div>
                        <div className="text-xs text-emerald-700 mt-1">{it.note}</div>
                        <div className="text-xs text-gray-700 mt-1">PI: —  •  TOD: {match ? (members.find((m) => String(m.id) === String(match.assignedMemberId))?.name || "Unassigned") : "Unassigned"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "onmri" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border p-4 bg-white">
          <h3 className="text-base font-semibold text-gray-900 mb-2">O‑NMRI</h3>
          <p className="text-sm text-gray-700">Outside/Other N‑MRI configuration coming soon.</p>
        </motion.div>
      )}

      {/* Slots Meta Modal */}
      {showMeta && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowMeta(false)}>
          <div className="w-full max-w-[95vw] max-h-[85vh] bg-white rounded-2xl border shadow-xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 mr-auto">Slots Meta</h3>
              {/* Filters (match Bulk UI) */}
              <div className="hidden md:flex items-center gap-2 mr-2">
                <div className="text-xs text-gray-600">Block:</div>
                {[0,1,2,3,4,5,6,"all"].map((b) => (
                  <button
                    key={String(b)}
                    className={`px-2 py-1 rounded-lg border text-xs ${metaBlock===String(b)?"bg-teal-600 text-white border-teal-600":"bg-white border-gray-200 text-gray-800"}`}
                    onClick={() => setMetaBlock(String(b))}
                  >
                    {b==="all"?"All":`B${b}`}
                  </button>
                ))}
                <input
                  placeholder="Search name/time"
                  className="ml-2 border rounded-lg px-2 py-1 text-sm w-52"
                  value={metaQuery}
                  onChange={(e)=>setMetaQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg border text-sm bg-white border-gray-200 text-gray-800 hover:bg-gray-50"
                  onClick={() => setDraft((d) => [...d, { id: `new-${Date.now()}`, name: "New Slot", startTime: "07:00:00", endTime: "08:00:00", hasSubSlots: false, assignedMemberId: null, description: "" }])}
                >
                  + Add Slot
                </button>
                <button
                  className="px-3 py-1.5 rounded-lg border text-sm bg-teal-600 text-white border-teal-600 hover:bg-teal-700"
                  onClick={async () => {
                    setSaving(true);
                    try {
                      // Create new slots
                      for (const s of draft.filter((x) => String(x.id).startsWith("new-"))) {
                        const res = await fetch("/api/admin/manageMeedian?section=slots", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: s.name, startTime: s.startTime, endTime: s.endTime, hasSubSlots: !!s.hasSubSlots, description: s.description || null }),
                        });
                        if (!res.ok) throw new Error("Failed to create slot");
                      }
                      // Update existing slots (name/timing)
                      const updates = draft
                        .filter((x) => !String(x.id).startsWith("new-"))
                        .map((x) => ({ slotId: Number(x.id), name: x.name, startTime: x.startTime, endTime: x.endTime, description: x.description || null }));
                      if (updates.length) {
                        const resU = await fetch("/api/admin/manageMeedian?section=slots", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ updates }),
                        });
                        if (!resU.ok) throw new Error("Failed to update slots");
                      }
                      // Refresh
                      setShowMeta(false);
                      window.location.reload();
                    } catch (e) {
                      console.error(e);
                      alert(e.message || "Failed to save changes");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Save Changes
                </button>
                <button className="px-3 py-1.5 rounded-lg border text-sm bg-white border-gray-200 text-gray-800" onClick={() => setShowMeta(false)}>Close</button>
              </div>
            </div>
            <div className="px-4 pb-4 flex-1 min-h-0 overflow-auto">
              <div className="min-w-[1040px]">
                <table className="min-w-full table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[80px]" />
                    <col className="w-[90px]" />
                    <col className="w-[100px]" />
                    <col />
                    <col className="w-[140px]" />
                    <col className="w-[260px]" />
                    <col className="w-[140px]" />
                    <col className="w-[120px]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2">Slot</th>
                      <th className="text-left px-3 py-2">Block</th>
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2">Start</th>
                      <th className="text-left px-3 py-2">End</th>
                      <th className="text-left px-3 py-2">Actions</th>
                      <th className="text-left px-3 py-2">Description (NMRI)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft
                      .filter((s) => {
                        const idNum = Number(String(s.id).startsWith("new-") ? NaN : s.id);
                        const t = slotTemplateByNo.get(idNum);
                        if (metaBlock !== 'all') {
                          if (!t || String(t.block) !== String(metaBlock)) return false;
                        }
                        if (metaQuery) {
                          const q = metaQuery.toLowerCase();
                          const time = `${String(s.startTime || '').slice(0,5)}-${String(s.endTime || '').slice(0,5)}`;
                          if (!String(s.name || '').toLowerCase().includes(q) && !time.includes(q)) return false;
                        }
                        return true;
                      })
                      .map((s, idx) => {
                        const idStr = String(s.id);
                        const idNum = Number(idStr);
                        const t = slotTemplateByNo.get(idNum);
                        return (
                          <tr key={idStr} className="border-b last:border-0">
                            <td className="px-3 py-2 text-gray-600">{idStr.startsWith("new-") ? "new" : idStr}</td>
                            <td className="px-3 py-2 text-xs text-gray-700">{t ? `B${t.block}` : "—"}</td>
                            <td className="px-3 py-2 text-xs text-gray-700">{t ? t.type : "—"}</td>
                            <td className="px-3 py-2">
                              <input className="border rounded px-2 py-1 w-full" value={s.name || ""} onChange={(e) => setDraft((d) => d.map((r) => r===s ? { ...r, name: e.target.value } : r))} />
                            </td>
                            <td className="px-3 py-2">
                              <input type="time" className="border rounded px-2 py-1 w-full" value={String(s.startTime || "07:00:00").slice(0,5)} onChange={(e) => setDraft((d) => d.map((r) => r===s ? { ...r, startTime: `${e.target.value}:00` } : r))} />
                            </td>
                            <td className="px-3 py-2">
                              <input type="time" className="border rounded px-2 py-1 w-full" value={String(s.endTime || "08:00:00").slice(0,5)} onChange={(e) => setDraft((d) => d.map((r) => r===s ? { ...r, endTime: `${e.target.value}:00` } : r))} />
                            </td>
                            <td className="px-3 py-2">
                              <button
                                className="px-2 py-1 text-xs rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                                onClick={async () => {
                                  if (idStr.startsWith("new-")) {
                                    setDraft((d) => d.filter((r) => r !== s));
                                  } else {
                                    if (!confirm("Delete this slot? Assignments will be cleared.")) return;
                                    try {
                                      const res = await fetch("/api/admin/manageMeedian?section=slots", {
                                        method: "DELETE",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ slotId: Number(s.id), deleteSlot: true }),
                                      });
                                      if (!res.ok) throw new Error("Failed to delete slot");
                                      setDraft((d) => d.filter((r) => r !== s));
                                      setSlots((prev) => prev.filter((r) => r.id !== s.id));
                                    } catch (e) {
                                      console.error(e);
                                      alert(e.message || "Failed to delete slot");
                                    }
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </td>
                            <td className="px-3 py-2 align-top">
                              {t && t.type === 'NMRI' ? (
                                <textarea
                                  rows={2}
                                  placeholder="Optional description (what happens in this slot)"
                                  className="w-full border rounded px-2 py-1 text-xs"
                                  value={s.description || ''}
                                  onChange={(e)=> setDraft(d => d.map(r => r===s ? { ...r, description: e.target.value } : r))}
                                />
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Allotments Modal (legacy single-member and weekly multi-member) */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm bg-white rounded-2xl border shadow-xl p-6 flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
            <div className="text-sm font-semibold text-gray-900">Finalizing NMRI Allotments…</div>
            <div className="text-xs text-gray-600">Applying templates and member assignments. Please wait.</div>
          </div>
        </div>
      )}
      {showBulk && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowBulk(false)}>
          <div className="w-full max-w-7xl max-h-[90vh] bg-white rounded-2xl border shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 mr-auto">Bulk Allotments</h3>
              {/* Mode */}
              <div className="hidden md:flex items-center gap-2 mr-2">
                <span className="text-xs text-gray-600">Mode:</span>
                <select className="border rounded-lg px-2 py-1 text-xs" value={bulkMode} onChange={(e)=>setBulkMode(e.target.value)}>
                  <option value="legacy">Legacy (single member)</option>
                  <option value="weekly">Weekly TOD (matrix)</option>
                </select>

              </div>
              {/* Filters */}
              <div className="hidden md:flex items-center gap-2 mr-2">
                <div className="text-xs text-gray-600">Block:</div>
                {[0,1,2,3,4,5,6,"all"].map((b) => (
                  <button
                    key={String(b)}
                    className={`px-2 py-1 rounded-lg border text-xs ${bulkBlock===String(b)?"bg-teal-600 text-white border-teal-600":"bg-white border-gray-200 text-gray-800"}`}
                    onClick={() => setBulkBlock(String(b))}
                  >
                    {b==="all"?"All":`B${b}`}
                  </button>
                ))}
                <input
                  placeholder="Search slot/member"
                  className="ml-2 border rounded-lg px-2 py-1 text-sm w-52"
                  value={bulkQuery}
                  onChange={(e)=>setBulkQuery(e.target.value)}
                />
                {bulkMode==='weekly' && (
                  <div className="ml-3 relative">
                    <WeekMultiSelect
                      weeks={calendarWeeks}
                      selected={selectedWeeks}
                      onChange={setSelectedWeeks}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg border text-sm bg-white border-gray-200 text-gray-800 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={finalizing}
                  onClick={() => { try { localStorage.setItem('weeklyTODDraft', JSON.stringify(weeklyMatrix)); alert('Draft saved'); } catch {} }}
                >
                  Save Draft
                </button>
                <button
                  className="px-3 py-1.5 rounded-lg border text-sm bg-teal-600 text-white border-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={finalizing}
                  onClick={async () => {
                    try {
                      setShowFinalizeModal(true);
                      setFinalizing(true);
                      if (bulkMode === 'legacy') {
                        const amriSet = new Set(TEMPLATE.filter(t => t.type === 'AMRI').map(t => t.no));
                        const updates = Object.entries(bulkAssignments)
                          .filter(([slotId]) => !amriSet.has(Number(slotId)))
                          .map(([slotId, memberId]) => ({ slotId: Number(slotId), memberId: memberId ? Number(memberId) : null }));
                        // Only send updates that differ from current
                        const filtered = updates.filter(u => {
                          const current = slots.find(s => Number(s.id) === Number(u.slotId));
                          return String(current?.assignedMemberId || '') !== String(u.memberId || '');
                        });
                        if (!filtered.length) { setShowBulk(false); return; }
                        const res = await fetch("/api/admin/manageMeedian?section=slots", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ updates: filtered }),
                        });
                        if (!res.ok) throw new Error("Failed to save bulk assignments");
                        // Update local state
                        setSlots(prev => prev.map(s => {
                          const found = filtered.find(u => u.slotId === s.id);
                          return found ? { ...s, assignedMemberId: found.memberId } : s;
                        }));
                        setShowBulk(false);
                        return;
                      }

                      // Weekly matrix finalize — upsert templates across all days and sync assignments
                      const templateUpserts = [];
                      for (const s of slots) {
                        const t = slotTemplateByNo.get(Number(s.id));
                        if (t && t.type === 'AMRI') continue;
                        for (let d = 0; d <= 6; d++) {
                          const cell = weeklyMatrix[s.id]?.[d] || { eng: [], disc: [] };
                          const eng = cell.eng || [];
                          const disc = cell.disc || [];
                          templateUpserts.push({ slotId: s.id, weekday: d, role: 'nmri_guide_english', requiredCount: Math.max(1, eng.length), active: true });
                          if (s.isHighGathering || disc.length) {
                            templateUpserts.push({ slotId: s.id, weekday: d, role: 'nmri_guide_discipline', requiredCount: Math.max(1, disc.length), active: true });
                          }
                        }
                      }
                      if (templateUpserts.length) {
                        await fetch('/api/admin/manageMeedian?section=slotsWeekly', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upserts: templateUpserts }) });
                      }
                      await mutateWeekly();
                      const fresh = (await fetch('/api/admin/manageMeedian?section=slotsWeekly').then(r=>r.json())).week || [];
                      const roleRowByKey = new Map();
                      for (const w of fresh) {
                        for (const rr of (w.roles || [])) roleRowByKey.set(`${w.slot.id}|${rr.weekday}|${rr.role}`, rr);
                      }
                      const toAdd = [];
                      const toDeactivate = [];
                      for (const s of slots) {
                        const t = slotTemplateByNo.get(Number(s.id));
                        if (t && t.type === 'AMRI') continue;
                        for (let d = 0; d <= 6; d++) {
                          const rrE = roleRowByKey.get(`${s.id}|${d}|nmri_guide_english`);
                          if (rrE) {
                            const currentE = new Map((rrE.members || []).map(m => [String(m.userId), m]));
                            const desiredE = new Set(((weeklyMatrix[s.id]?.[d]?.eng) || []).map(String));
                            for (const uid of desiredE) if (!currentE.has(uid)) toAdd.push({ slotWeeklyRoleId: rrE.id, userId: Number(uid) });
                            for (const [uid, m] of currentE.entries()) if (!desiredE.has(uid)) toDeactivate.push({ id: m.id, active: false });
                          }
                          const rrD = roleRowByKey.get(`${s.id}|${d}|nmri_guide_discipline`);
                          if (rrD) {
                            const currentD = new Map((rrD.members || []).map(m => [String(m.userId), m]));
                            const desiredD = new Set(((weeklyMatrix[s.id]?.[d]?.disc) || []).map(String));
                            for (const uid of desiredD) if (!currentD.has(uid)) toAdd.push({ slotWeeklyRoleId: rrD.id, userId: Number(uid) });
                            for (const [uid, m] of currentD.entries()) if (!desiredD.has(uid)) toDeactivate.push({ id: m.id, active: false });
                          }
                        }
                      }
                      let range = null;
                      if (selectedWeeks && selectedWeeks.length) {
                        const starts = selectedWeeks.map(w => new Date(w.startDate));
                        const ends = selectedWeeks.map(w => new Date(w.endDate));
                        const min = new Date(Math.min.apply(null, starts));
                        const max = new Date(Math.max.apply(null, ends));
                        const iso = d => d.toISOString().slice(0,10);
                        range = { startDate: iso(min), endDate: iso(max) };
                      }
                      for (const a of toAdd) {
                        const payload = range ? { ...a, ...range } : a;
                        await fetch('/api/admin/manageMeedian?section=slotRoleAssignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                      }

                      if (toDeactivate.length) {
                        await fetch('/api/admin/manageMeedian?section=slotRoleAssignments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: toDeactivate }) });
                      }
                      await mutateWeekly();
                      setShowBulk(false);
                      setTab('full');
                    } catch (e) {
                      console.error(e);
                      alert(e.message || "Save failed");
                    } finally {
                      setFinalizing(false);
                      setShowFinalizeModal(false);
                    }
                  }}
                >
                  {finalizing ? 'Finalizing…' : 'Finalize NMRI Allotments'}
                </button>
                <button className="px-3 py-1.5 rounded-lg border text-sm bg-white border-gray-200 text-gray-800" onClick={() => setShowBulk(false)}>Close</button>
              </div>
            </div>

            <div className="px-4 pb-4 overflow-auto max-h-[80vh]">
              {bulkMode === 'weekly' && (
                <div className="mb-2 p-2 rounded-lg border bg-gray-50 text-[11px] text-gray-700">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border text-[10px]">E</span>
                      <span>Guide (English)</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border text-[10px] ml-3">D</span>
                      <span>Guide (Discipline)</span>
                    </div>
                    <div className="truncate">
                      Moderator shown separately. Manage in
                      <a href="/dashboard/admin/manageMeedian/mri-roles" className="ml-1 text-teal-700 underline">MRI & Roles</a>.
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="text-gray-600">Moderators:</span>
                    {moderators.length ? moderators.map(m => (
                      <span key={`mod-${m.id}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white border text-[11px]">
                        {m.name}
                      </span>
                    )) : (
                      <span className="text-gray-500">None</span>
                    )}
                  </div>
                </div>
              )}
              {/* Desktop/table view */}
              <div className="min-w-[1200px]">
                {bulkMode !== 'weekly' ? (
                  <table className="min-w-full table-fixed border-collapse">
                    <colgroup>
                      <col className="w-[80px]" />
                      <col />
                      <col className="w-[140px]" />
                      <col className="w-[260px]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-700">
                        <th className="text-left px-3 py-2">Slot</th>
                        <th className="text-left px-3 py-2">Name</th>
                        <th className="text-left px-3 py-2">Time</th>
                        <th className="text-left px-3 py-2">TOD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slots
                        .filter((s) => {
                          const t = slotTemplateByNo.get(Number(s.id));
                          if (t && t.type === 'AMRI') return false;
                          if (bulkBlock !== 'all') { const b = t?.block; if (String(b) !== String(bulkBlock)) return false; }
                          if (bulkQuery) {
                            const member = members.find((m) => String(m.id) === String(s.assignedMemberId))?.name || '';
                            const q = bulkQuery.toLowerCase();
                            if (!String(s.name).toLowerCase().includes(q) && !member.toLowerCase().includes(q)) return false;
                          }
                          return true;
                        })
                        .map((s) => (
                          <tr key={s.id} className="border-b last:border-0">
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{s.id}</td>
                            <td className="px-3 py-2 text-sm text-gray-800">{s.name}</td>
                            <td className="px-3 py-2 text-xs text-gray-600">{String(s.startTime).slice(0,5)} - {String(s.endTime).slice(0,5)}</td>
                            <td className="px-3 py-2">
                              <select
                                className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                value={bulkAssignments[s.id] ?? ''}
                                onChange={(e) => setBulkAssignments((prev) => ({ ...prev, [s.id]: e.target.value }))}
                              >
                                <option value="">Unassigned</option>
                                {members.map((m) => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b text-[11px] font-semibold text-gray-700 sticky top-0">
                        <th className="text-left px-3 py-2">Slot</th>
                        <th className="text-left px-3 py-2">Name</th>
                        <th className="text-left px-3 py-2">Time</th>
                        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                          <th key={d} className="text-left px-3 py-2">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slots
                        .filter((s) => {
                          const t = slotTemplateByNo.get(Number(s.id));
                          if (t && t.type === 'AMRI') return false;
                          if (bulkBlock !== 'all') { const b = t?.block; if (String(b) !== String(bulkBlock)) return false; }
                          if (bulkQuery) { const q = bulkQuery.toLowerCase(); if (!String(s.name).toLowerCase().includes(q)) return false; }
                          return true;
                        })
                        .map((s) => (
                          <tr key={s.id} className="border-b last:border-0 align-top">
                            <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{s.id}</td>
                            <td className="px-3 py-2 text-sm text-gray-800 whitespace-nowrap">{s.name}</td>
                            <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{String(s.startTime).slice(0,5)} - {String(s.endTime).slice(0,5)}</td>
                            {Array.from({ length: 7 }).map((_, d) => (
                            <td key={`${s.id}-${d}`} className="px-2 py-2 align-top">
                              {/* English row */}
                              <div className="flex items-start gap-1 mb-1">
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-white border text-[10px] text-gray-700">E</span>
                                <div className="flex-1">
                                  <div className="flex flex-wrap gap-1">
                                    {(weeklyMatrix[s.id]?.[d]?.eng || []).map((uid) => (
                                      <span key={`${s.id}-${d}-eng-${uid}`} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 border">
                                        {members.find(m => String(m.id) === String(uid))?.name || `User ${uid}`}
                                        <button className="text-red-600" onClick={() => setWeeklyMatrix(prev => ({ ...prev, [s.id]: { ...(prev[s.id] || {}), [d]: { eng: (prev[s.id]?.[d]?.eng || []).filter(u => String(u) !== String(uid)), disc: (prev[s.id]?.[d]?.disc || []) } } }))}>×</button>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  {picker && picker.slotId===s.id && picker.day===d && picker.role==='eng' ? (
                                    <select className="border rounded px-1 py-0.5 text-[10px]" defaultValue="" onChange={(e)=>{ const v=e.target.value; if (!v) return; setWeeklyMatrix(prev => { const cur = new Set((prev[s.id]?.[d]?.eng || []).map(String)); cur.add(String(v)); return { ...prev, [s.id]: { ...(prev[s.id] || {}), [d]: { eng: Array.from(cur), disc: (prev[s.id]?.[d]?.disc || []) } } }; }); setPicker(null); e.target.value=''; }}>
                                      <option value="">Add…</option>
                                      {members.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
                                    </select>
                                  ) : (
                                    <button className="text-[10px] px-1.5 py-0.5 border rounded hover:bg-gray-50" onClick={()=>setPicker({ slotId: s.id, day: d, role: 'eng' })}>+ Add</button>
                                  )}
                                </div>
                              </div>
                              {/* Discipline row */}
                              <div className="flex items-start gap-1">
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-white border text-[10px] text-gray-700">D</span>
                                <div className="flex-1">
                                  <div className="flex flex-wrap gap-1">
                                    {(weeklyMatrix[s.id]?.[d]?.disc || []).map((uid) => (
                                      <span key={`${s.id}-${d}-disc-${uid}`} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 border">
                                        {members.find(m => String(m.id) === String(uid))?.name || `User ${uid}`}
                                        <button className="text-red-600" onClick={() => setWeeklyMatrix(prev => ({ ...prev, [s.id]: { ...(prev[s.id] || {}), [d]: { eng: (prev[s.id]?.[d]?.eng || []), disc: (prev[s.id]?.[d]?.disc || []).filter(u => String(u) !== String(uid)) } } }))}>×</button>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  {picker && picker.slotId===s.id && picker.day===d && picker.role==='disc' ? (
                                    <select className="border rounded px-1 py-0.5 text-[10px]" defaultValue="" onChange={(e)=>{ const v=e.target.value; if (!v) return; setWeeklyMatrix(prev => { const cur = new Set((prev[s.id]?.[d]?.disc || []).map(String)); cur.add(String(v)); return { ...prev, [s.id]: { ...(prev[s.id] || {}), [d]: { eng: (prev[s.id]?.[d]?.eng || []), disc: Array.from(cur) } } }; }); setPicker(null); e.target.value=''; }}>
                                      <option value="">Add…</option>
                                      {members.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
                                    </select>
                                  ) : (
                                    <button className="text-[10px] px-1.5 py-0.5 border rounded hover:bg-gray-50" onClick={()=> setPicker({ slotId: s.id, day: d, role: 'disc' })}>+ Add</button>
                                  )}
                                </div>
                              </div>
                            </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WeekMultiSelect({ weeks, selected, onChange }) {
  const [open, setOpen] = React.useState(false);
  const today = new Date();
  const isPast = (w) => new Date(w.endDate) < new Date(today.toISOString().slice(0,10));
  const isCurrent = (w) => new Date(w.startDate) <= today && today <= new Date(w.endDate);
  const toggle = (w) => {
    const on = selected.find(sw => sw.id === w.id);
    onChange(on ? selected.filter(x => x.id !== w.id) : [...selected, w]);
  };
  const label = selected.length ? selected.map(w => w.label).join(', ') : 'All Weeks';
  return (
    <div className="text-xs">
      <button className="px-2 py-1 border rounded-lg bg-white hover:bg-gray-50" onClick={()=>setOpen(v=>!v)}>
        Weeks: {label}
      </button>
      {open && (
        <div className="absolute mt-1 z-50 w-64 max-h-56 overflow-auto bg-white border rounded-lg shadow p-2">
          {!weeks?.length && <div className="text-gray-500 text-[11px] px-1 py-1">No calendar weeks</div>}
          {weeks.map(w => {
            const disabled = isPast(w);
            const on = selected.find(sw => sw.id === w.id);
            return (
              <label key={w.id} className={`flex items-center justify-between gap-2 px-2 py-1 rounded cursor-pointer ${disabled? 'opacity-50 cursor-not-allowed':''}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" disabled={disabled} checked={!!on} onChange={()=>!disabled && toggle(w)} />
                  <div className="flex flex-col">
                    <span className="font-medium">{w.label} {isCurrent(w) ? <span className="text-emerald-600">(current)</span> : null}</span>
                    <span className="text-[11px] text-gray-600">{w.startDate} – {w.endDate}</span>
                  </div>
                </div>
              </label>
            );
          })}
          <div className="mt-2 flex items-center justify-end gap-2">
            <button className="px-2 py-1 border rounded text-[11px]" onClick={()=>setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CurrentNmriAllotmentView({ weeklyWeek, members, slotTemplateByNo }) {
  const [showFull, setShowFull] = React.useState(false);
  const nmriRows = (weeklyWeek || []).filter(w => {
    const t = slotTemplateByNo.get(Number(w.slot.id));
    return t && t.type === 'NMRI';
  }).sort((a,b) => {
    const ab = (slotTemplateByNo.get(Number(a.slot.id))?.block ?? 99);
    const bb = (slotTemplateByNo.get(Number(b.slot.id))?.block ?? 99);
    if (ab !== bb) return ab - bb;
    return Number(a.slot.id) - Number(b.slot.id);
  });

  const nameById = new Map((members||[]).map(u => [String(u.id), u.name]));
  const namesFor = (roles, day, roleKey) => {
    const rr = (roles||[]).find(r => Number(r.weekday) === Number(day) && r.role === roleKey);
    const arr = (rr?.members || []).filter(m => m.active !== false);
    if (!arr.length) return '—';
    return arr.map(m => nameById.get(String(m.userId)) || `User ${m.userId}`).join(', ');
  };

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="px-3 py-2 border-b text-sm font-semibold text-gray-900 flex items-center justify-between">
        <span>Current NMRI Allotment (Read‑only)</span>
        <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={()=>setShowFull(true)}>Full View</button>
      </div>
      <div className="p-3 overflow-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-700">
              <th className="text-left px-3 py-2">Slot</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Time</th>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                <th key={d} className="text-left px-3 py-2">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nmriRows.map(({ slot, roles }) => (
              <tr key={slot.id} className="border-b last:border-0 align-top">
                <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{slot.id}</td>
                <td className="px-3 py-2 text-sm text-gray-800 whitespace-nowrap">{slot.name}</td>
                <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{String(slot.startTime).slice(0,5)} - {String(slot.endTime).slice(0,5)}</td>
                {Array.from({ length: 7 }).map((_, d) => (
                  <td key={`${slot.id}-${d}`} className="px-3 py-2">
                    <div className="text-[11px] text-gray-700">E: {namesFor(roles, d, 'nmri_guide_english')}</div>
                    <div className="text-[11px] text-gray-700 mt-1">D: {namesFor(roles, d, 'nmri_guide_discipline')}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showFull && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setShowFull(false)}>
          <div className="w-full max-w-[95vw] max-h-[90vh] bg-white rounded-2xl border shadow-xl overflow-hidden flex flex-col" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-sm font-semibold text-gray-900">Current NMRI Allotment — Full View</div>
              <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={()=>setShowFull(false)}>Close</button>
            </div>
            <div className="px-4 pb-4 flex-1 min-h-0 overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-700 sticky top-0">
                    <th className="text-left px-3 py-2">Slot</th>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Time</th>
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                      <th key={d} className="text-left px-3 py-2">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nmriRows.map(({ slot, roles }) => (
                    <tr key={slot.id} className="border-b last:border-0 align-top">
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{slot.id}</td>
                      <td className="px-3 py-2 text-sm text-gray-800 whitespace-nowrap">{slot.name}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{String(slot.startTime).slice(0,5)} - {String(slot.endTime).slice(0,5)}</td>
                      {Array.from({ length: 7 }).map((_, d) => (
                        <td key={`${slot.id}-${d}`} className="px-3 py-2">
                          <div className="text-[12px] text-gray-800">E: {namesFor(roles, d, 'nmri_guide_english')}</div>
                          <div className="text-[12px] text-gray-800 mt-1">D: {namesFor(roles, d, 'nmri_guide_discipline')}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
