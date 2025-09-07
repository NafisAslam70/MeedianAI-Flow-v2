"use client";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import ManageSlots from "@/components/manageMeedian/ManageSlots";

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

  const [tab, setTab] = useState("full"); // full | nmri | amri | onmri
  const [showMeta, setShowMeta] = useState(false);
  const [draft, setDraft] = useState([]);
  const [metaBlock, setMetaBlock] = useState("all"); // all | 0..6
  const [metaQuery, setMetaQuery] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkAssignments, setBulkAssignments] = useState({});
  const slotTemplateByNo = useMemo(() => new Map(TEMPLATE.map((t) => [t.no, t])), []);
  const [bulkBlock, setBulkBlock] = useState("all"); // all | 0..6
  const [bulkQuery, setBulkQuery] = useState("");


  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Daily Slot Management</h1>
        <p className="text-sm text-gray-600">N‑MRI scheduling with full‑day blocks.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "full", label: "Full Day (Blocks)" },
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
            setShowBulk(true);
          }}
        >
          Bulk Allotments
        </button>
      </div>

      {/* Content */}
      {tab === "full" && (
        <ManageSlots
          slots={slots}
          setSlots={setSlots}
          loading={!!loadingSlots}
          saving={saving}
          setEditSlot={setEditSlot}
          editSlot={editSlot}
          saveSlotAssignment={saveSlotAssignment}
          deleteSlotAssignment={deleteSlotAssignment}
          members={members}
        />
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
          <div className="w-full max-w-7xl max-h-[90vh] bg-white rounded-2xl border shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 mr-auto">Slots Meta</h3>
              {/* Filters (match Bulk UI) */}
              <div className="hidden md:flex items-center gap-2 mr-2">
                <div className="text-xs text-gray-600">Block:</div>
                {["all",0,1,2,3,4,5,6].map((b) => (
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
                  onClick={() => setDraft((d) => [...d, { id: `new-${Date.now()}`, name: "New Slot", startTime: "07:00:00", endTime: "08:00:00", hasSubSlots: false, assignedMemberId: null }])}
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
                          body: JSON.stringify({ name: s.name, startTime: s.startTime, endTime: s.endTime, hasSubSlots: !!s.hasSubSlots }),
                        });
                        if (!res.ok) throw new Error("Failed to create slot");
                      }
                      // Update existing slots (name/timing)
                      const updates = draft
                        .filter((x) => !String(x.id).startsWith("new-"))
                        .map((x) => ({ slotId: Number(x.id), name: x.name, startTime: x.startTime, endTime: x.endTime }));
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
            <div className="px-4 pb-4 overflow-auto max-h-[80vh]">
              <div className="min-w-[1040px]">
                <table className="min-w-full table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[80px]" />
                    <col className="w-[90px]" />
                    <col className="w-[100px]" />
                    <col />
                    <col className="w-[140px]" />
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

      {/* Bulk Allotments Modal (TOD for NMRI only) */}
      {showBulk && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowBulk(false)}>
          <div className="w-full max-w-7xl max-h-[90vh] bg-white rounded-2xl border shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 mr-auto">Bulk Allotments — N‑MRI (TOD/MOD)</h3>
              {/* Filters */}
              <div className="hidden md:flex items-center gap-2 mr-2">
                <div className="text-xs text-gray-600">Block:</div>
                {["all",0,1,2,3,4,5,6].map((b) => (
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
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg border text-sm bg-teal-600 text-white border-teal-600 hover:bg-teal-700"
                  onClick={async () => {
                    try {
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
                    } catch (e) {
                      console.error(e);
                      alert(e.message || "Save failed");
                    }
                  }}
                >
                  Save
                </button>
                <button className="px-3 py-1.5 rounded-lg border text-sm bg-white border-gray-200 text-gray-800" onClick={() => setShowBulk(false)}>Close</button>
              </div>
            </div>

            <div className="px-4 pb-4 overflow-auto max-h-[80vh]">
              {/* Desktop/table view */}
              <div className="min-w-[720px]">
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
                        // NMRI only
                        const t = slotTemplateByNo.get(Number(s.id));
                        if (t && t.type === 'AMRI') return false;
                        // block filter
                        if (bulkBlock !== 'all') {
                          const b = t?.block;
                          if (String(b) !== String(bulkBlock)) return false;
                        }
                        // search in name or member
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
