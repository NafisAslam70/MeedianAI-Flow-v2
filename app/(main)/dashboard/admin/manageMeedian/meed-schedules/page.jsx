"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Save, Trash2, RefreshCw, Clock3, Link2, ArrowUp, ArrowDown } from "lucide-react";
import Button from "@/components/ui/Button";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

const emptyDivision = () => ({ label: "", startTime: "", endTime: "", isFree: false, checklist: [] });

export default function MeedSchedulesPage() {
  const { data: programData } = useSWR("/api/admin/manageMeedian?section=metaPrograms", fetcher, {
    dedupingInterval: 60000,
  });
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

  const [form, setForm] = useState({
    id: null,
    programId: "",
    title: "",
    description: "",
    active: true,
    divisions: [emptyDivision()],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const displayTitle = (f = form) => {
    if (f.title?.trim()) return f.title.trim();
    const p = programs.find((p) => String(p.id) === String(f.programId));
    return p ? `${p.name} Schedule` : "Untitled Schedule";
  };

  const printSchedule = (source) => {
    const divisions = (source?.divisions || []).map((d, idx) => ({
      ...d,
      position: Number.isFinite(d.position) ? d.position : idx,
    })).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const program = programs.find((p) => p.id === source.programId);
    const title = source.title || (program ? `${program.name} Schedule` : "Custom Schedule");
    const win = window.open("", "_blank");
    if (!win) return;
    const style = `
      <style>
        body{font-family: "Inter", system-ui, -apple-system, sans-serif; color:#111; margin:32px;}
        h1{margin:0; font-size:24px;}
        h2{margin:8px 0 24px; font-size:18px; color:#444;}
        table{width:100%; border-collapse: collapse; margin-top:12px;}
        th, td{border:1px solid #ccc; padding:8px 10px; font-size:13px; text-align:left;}
        th{background:#f7f7f7;}
        .free{color:#c05621; font-weight:600;}
        .seal{margin-top:48px; display:flex; justify-content:flex-end; align-items:center; gap:12px;}
        .seal .circle{width:80px; height:80px; border:2px dashed #999; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; color:#555;}
      </style>
    `;
    const rows = divisions.map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${d.label || `Division ${i + 1}`}</td>
        <td>${d.isFree ? '<span class="free">Free / Unbounded</span>' : `${d.startTime || "--"} – ${d.endTime || "--"}`}</td>
      </tr>
    `).join("");
    const checklistBlocks = divisions
      .map((d, i) => {
        if (!d.checklist || !d.checklist.length) return "";
        const items = d.checklist.map((c) => `<li>${c}</li>`).join("");
        return `<h3 style="margin:12px 0 4px; font-size:14px;">${i + 1}. ${d.label || "Division"} — Checklist</h3><ul style="margin-top:4px; padding-left:18px; font-size:12px;">${items}</ul>`;
      })
      .join("");
    win.document.write(`
      <html><head><title>${title}</title>${style}</head>
      <body>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h1>Meed Public School</h1>
          ${program ? `<div style="font-size:12px; color:#555;">Program: ${program.programKey} • ${program.name}</div>` : ""}
        </div>
        <h2>${title}</h2>
        <table>
          <thead>
            <tr><th>#</th><th>Division</th><th>Time</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="3">No divisions.</td></tr>'}</tbody>
        </table>
        ${checklistBlocks}
        <div class="seal">
          <div>Seal</div>
          <div class="circle">Official</div>
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const resetForm = () =>
    setForm({
      id: null,
      programId: "",
      title: "",
      description: "",
      active: true,
      divisions: [emptyDivision()],
    });

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
        active: current.active,
        divisions: current.divisions.map((d, idx) => ({
          ...d,
          position: idx,
          startTime: d.isFree ? null : d.startTime,
          endTime: d.isFree ? null : d.endTime,
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
      active: !!schedule.active,
      divisions:
        schedule.divisions?.length
          ? schedule.divisions.map((d) => ({
              label: d.label || "",
              startTime: d.startTime || "",
              endTime: d.endTime || "",
              isFree: !!d.isFree,
              checklist: Array.isArray(d.checklist) ? d.checklist : [],
            }))
          : [emptyDivision()],
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Clock3 className="w-5 h-5 text-teal-600" />
            Meed Schedules
          </h1>
          <p className="text-sm text-gray-600">
            Link a program or create a custom schedule, then break it into divisions with timed or free blocks plus a checklist of what must be done.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="light" onClick={() => mutate()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="secondary" onClick={resetForm}>
            Clear Form
          </Button>
          <Button variant="primary" onClick={() => upsertSchedule()} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {form.id ? "Update" : "Save"} Schedule
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              upsertSchedule({ active: false });
            }}
            disabled={saving}
          >
            Save Draft
          </Button>
          <Button
            variant="light"
            onClick={() => {
              upsertSchedule({ active: true });
            }}
            disabled={saving}
          >
            Finalise Schedule
          </Button>
          <Button
            variant="light"
            onClick={() => printSchedule({ ...form, programId: form.programId ? Number(form.programId) : null })}
          >
            Print
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-4 py-2 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6">
        {/* Form */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-4">
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
            <label className="text-sm font-medium text-gray-700">Description (optional)</label>
            <textarea
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              rows={2}
              placeholder="Note what this schedule covers"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between mt-4">
            <h3 className="font-medium text-gray-800">Divisions</h3>
            <Button
              variant="light"
              size="sm"
              onClick={() => setForm((f) => ({ ...f, divisions: [...f.divisions, emptyDivision()] }))}
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
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
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
                  {!div.isFree && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">Start</label>
                        <input
                          type="time"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          value={div.startTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateDivision(idx, (d) => ({ ...d, startTime: val }));
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">End</label>
                        <input
                          type="time"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          value={div.endTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            setForm((f) => {
                              const list = [...f.divisions];
                              list[idx] = { ...(list[idx] || {}), endTime: val };
                              // auto-chain: if next division exists and is not free, and start is empty or same as old start, set start to this end
                              const nextDiv = list[idx + 1];
                              if (nextDiv && !nextDiv.isFree) {
                                const shouldReplace = !nextDiv.startTime || nextDiv.startTime === (list[idx + 1]?.startTime || "");
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
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* List */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Existing schedules</h2>
            {isLoading && <span className="text-xs text-gray-500">Loading…</span>}
          </div>

          {!schedules.length && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
              Nothing yet. Create your first schedule on the left.
            </div>
          )}

          <div className="grid gap-3">
            {schedules.map((s) => (
              <div key={s.id} className="rounded-xl border border-gray-200 p-4 bg-gradient-to-br from-white to-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
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
                    {s.description && <p className="text-xs text-gray-700 mt-1">{s.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="light" onClick={() => startEdit(s)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteSchedule(s.id)} className="text-rose-600">
                      Delete
                    </Button>
                  </div>
                </div>
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
