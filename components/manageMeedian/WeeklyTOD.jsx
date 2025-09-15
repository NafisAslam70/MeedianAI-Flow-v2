"use client";
import React from "react";
import useSWR from "swr";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const ROLE_LABELS = {
  nmri_moderator: "Moderator",
  nmri_guide_english: "Guide (English)",
  nmri_guide_discipline: "Guide (Discipline)",
};

export default function WeeklyTOD() {
  const { data: weekData, mutate: mutateWeek } = useSWR("/api/admin/manageMeedian?section=slotsWeekly", fetcher);
  const { data: teamData } = useSWR("/api/admin/manageMeedian?section=team", fetcher, { dedupingInterval: 30000 });
  const slots = React.useMemo(() => weekData?.week || [], [weekData]);
  const members = React.useMemo(() => teamData?.users || [], [teamData]);
  const [weekday, setWeekday] = React.useState(new Date().getDay());
  const [saving, setSaving] = React.useState(false);

  const rolesForDay = React.useMemo(() => {
    return slots.map(({ slot, roles }) => ({ slot, roles: roles.filter(r => Number(r.weekday) === Number(weekday)) }));
  }, [slots, weekday]);

  const upsertTemplates = async (rows) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/manageMeedian?section=slotsWeekly', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upserts: rows })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      await mutateWeek();
    } catch (e) {
      console.error('Save templates failed', e);
      alert('Failed to save.');
    } finally { setSaving(false); }
  };

  const saveRequired = (r, delta) => {
    const next = Math.max(1, Number(r.requiredCount || 1) + delta);
    upsertTemplates([{ slotId: r.slotId, weekday: r.weekday, role: r.role, requiredCount: next, active: r.active }]);
  };
  const toggleActive = (r) => {
    upsertTemplates([{ slotId: r.slotId, weekday: r.weekday, role: r.role, requiredCount: r.requiredCount, active: !r.active }]);
  };
  const addAssignment = async (slotWeeklyRoleId, userId) => {
    if (!userId) return; setSaving(true);
    try {
      const res = await fetch('/api/admin/manageMeedian?section=slotRoleAssignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slotWeeklyRoleId, userId })
      });
      const body = await res.json(); if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      await mutateWeek();
    } catch (e) { console.error('Add assignment failed', e); alert('Failed to assign member.'); }
    finally { setSaving(false); }
  };
  const removeAssignment = async (id) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/manageMeedian?section=slotRoleAssignments', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: [{ id, active: false }] })
      });
      const body = await res.json(); if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      await mutateWeek();
    } catch (e) { console.error('Remove assignment failed', e); alert('Failed to unassign.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Weekly TOD Coverage</h2>
          <p className="text-xs text-gray-600">Assign Moderator and Guides per weekday.</p>
        </div>
        <div className="flex gap-2">
          {WEEKDAYS.map((d, i) => (
            <button key={i} onClick={() => setWeekday(i)} className={`px-3 py-1 rounded-lg text-xs border ${weekday===i? 'bg-teal-600 text-white border-teal-600':'bg-white text-gray-800 border-gray-200'}`}>{d}</button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="font-semibold text-gray-900">All Slots — {WEEKDAYS[weekday]}</div>
            <div className="flex items-center gap-2">
              <Button variant="light" size="sm" onClick={() => {
                const rows = [];
                rolesForDay.forEach(({ roles }) => roles.forEach(r => {
                  for (let wd=0; wd<=6; wd++) rows.push({ slotId: r.slotId, weekday: wd, role: r.role, requiredCount: r.requiredCount, active: r.active });
                }));
                upsertTemplates(rows);
              }}>Apply to All Weekdays</Button>
              <Button variant="light" size="sm" onClick={() => {
                const rows = [];
                rolesForDay.forEach(({ slot, roles }) => {
                  if (!slot.isHighGathering) return;
                  const hasDisc = roles.some(r => r.role === 'nmri_guide_discipline');
                  if (!hasDisc) rows.push({ slotId: slot.id, weekday, role: 'nmri_guide_discipline', requiredCount: 1, active: true });
                });
                if (rows.length) upsertTemplates(rows);
              }}>Auto‑add Discipline</Button>
              <div className="text-xs text-gray-500">{saving ? 'Saving…' : ''}</div>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-4">
            {rolesForDay.map(({ slot, roles }) => (
              <div key={slot.id} className="border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{slot.name}</div>
                    <div className="text-xs text-gray-600">{String(slot.startTime).slice(0,5)} – {String(slot.endTime).slice(0,5)} {slot.isHighGathering ? '• High Gathering' : ''}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {roles.map((r) => {
                    const assignedCount = (r.members || []).filter(m => m.active !== false).length;
                    const ok = assignedCount >= (r.requiredCount || 1);
                    return (
                      <div key={r.id} className={`rounded-lg border p-3 ${ok? 'border-emerald-300':'border-amber-300'}`}>
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-gray-900">{ROLE_LABELS[r.role] || r.role}</div>
                          <label className="inline-flex items-center gap-1 text-xs text-gray-700">
                            <input type="checkbox" checked={!!r.active} onChange={() => toggleActive(r)} /> Active
                          </label>
                        </div>
                        <div className="mt-1 text-xs text-gray-600">Required: {r.requiredCount}
                          <span className="ml-2 inline-flex gap-1">
                            <button className="px-2 py-0.5 border rounded" onClick={() => saveRequired(r, -1)}>-</button>
                            <button className="px-2 py-0.5 border rounded" onClick={() => saveRequired(r, +1)}>+</button>
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(r.members || []).map((m) => (
                            <span key={m.id} className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-gray-100 border">
                              {members.find(u => String(u.id) === String(m.userId))?.name || `User ${m.userId}`}
                              <button className="text-red-600" title="Unassign" onClick={() => removeAssignment(m.id)}>×</button>
                            </span>
                          ))}
                        </div>
                        <div className="mt-2">
                          <select className="w-full text-sm border rounded-lg px-2 py-1" defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value = ''; if (v) addAssignment(r.id, v); }}>
                            <option value="" disabled>Assign member…</option>
                            {members.map((u) => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

