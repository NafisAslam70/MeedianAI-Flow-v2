"use client";
import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function MSPCodesPage() {
  const { data: codeData, error: codeErr } = useSWR("/api/admin/manageMeedian?section=mspCodes", fetcher, { dedupingInterval: 30000 });
  const { data: asgData, error: asgErr } = useSWR("/api/admin/manageMeedian?section=mspCodeAssignments", fetcher, { dedupingInterval: 30000 });
  const { data: teamData } = useSWR("/api/admin/manageMeedian?section=team", fetcher, { dedupingInterval: 30000 });
  const [codes, setCodes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const users = (teamData?.users || []).filter((u) => u.role === "member" || u.role === "team_manager");
  const [form, setForm] = useState({ code: "", program: "MSP", familyKey: "", track: "", title: "", parentSlice: "", active: true });
  const [assignForm, setAssignForm] = useState({ mspCodeId: "", userId: "", startDate: "", endDate: "", isPrimary: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("assign"); // assign | create | editCode
  const [modalFamily, setModalFamily] = useState("");
  const [editCodeId, setEditCodeId] = useState(null);
  const [view, setView] = useState("status"); // status | modify | create
  const { data: progData } = useSWR("/api/admin/manageMeedian?section=metaPrograms", fetcher, { dedupingInterval: 30000 });
  const mspProgram = useMemo(() => (progData?.programs || []).find((p) => String(p.programKey).toUpperCase() === "MSP"), [progData]);
  // UI filters
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all"); // all | assigned | unassigned
  const [mode, setMode] = useState("cards"); // cards | tables

  useEffect(() => { if (codeData?.codes) setCodes(codeData.codes); if (codeErr) setErr("Failed to load MSP codes"); }, [codeData, codeErr]);
  useEffect(() => { if (asgData?.assignments) setAssignments(asgData.assignments); if (asgErr) setErr("Failed to load assignments"); }, [asgData, asgErr]);

  const activeAssignees = useMemo(() => {
    const map = new Map();
    for (const a of assignments) {
      if (a.active) {
        const arr = map.get(a.mspCodeId) || [];
        map.set(a.mspCodeId, [...arr, a]);
      }
    }
    return map;
  }, [assignments]);

  const filteredCodes = useMemo(() => {
    let list = codes;
    if (q) {
      const qq = q.toLowerCase();
      list = list.filter((c) =>
        String(c.code).toLowerCase().includes(qq) ||
        String(c.title || "").toLowerCase().includes(qq) ||
        String(c.familyKey || "").toLowerCase().includes(qq)
      );
    }
    if (tab === "assigned") list = list.filter((c) => (activeAssignees.get(c.id) || []).length > 0);
    if (tab === "unassigned") list = list.filter((c) => (activeAssignees.get(c.id) || []).length === 0);
    return list;
  }, [codes, q, tab, activeAssignees]);

  const submit = async (e) => {
    e?.preventDefault?.(); setBusy(true); setErr(""); setMsg("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=mspCodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg("MSP code created"); setForm({ code: "", program: "MSP", familyKey: "", track: "", title: "", parentSlice: "", active: true });
      mutate("/api/admin/manageMeedian?section=mspCodes");
    } catch (e) { setErr(e.message); } finally { setBusy(false); setTimeout(() => setMsg(""), 2500); }
  };

  const toggleActive = async (code) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=mspCodes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updates: [{ id: code.id, active: !code.active }] }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      mutate("/api/admin/manageMeedian?section=mspCodes");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const openEditCode = (codeRow) => {
    setForm({
      code: codeRow.code || "",
      program: codeRow.program || "MSP",
      familyKey: codeRow.familyKey || "",
      track: codeRow.track || "",
      title: codeRow.title || "",
      parentSlice: codeRow.parentSlice || "",
      active: !!codeRow.active,
    });
    setEditCodeId(codeRow.id);
    setModalType("editCode");
    setModalFamily("");
    setModalOpen(true);
  };

  const updateCode = async (e) => {
    e?.preventDefault?.(); setBusy(true); setErr(""); setMsg("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=mspCodes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ id: editCodeId, ...form }] }),
      });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg("MSP code updated");
      setModalOpen(false);
      setEditCodeId(null);
      mutate("/api/admin/manageMeedian?section=mspCodes");
    } catch (e) { setErr(e.message); } finally { setBusy(false); setTimeout(() => setMsg(""), 2500); }
  };

  const createAssignment = async (e) => {
    e?.preventDefault?.(); setBusy(true); setErr(""); setMsg("");
    try {
      const payload = { ...assignForm, mspCodeId: Number(assignForm.mspCodeId), userId: Number(assignForm.userId) };
      const res = await fetch("/api/admin/manageMeedian?section=mspCodeAssignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg("Assignment created"); setAssignForm({ mspCodeId: "", userId: "", startDate: "", endDate: "", isPrimary: true });
      mutate("/api/admin/manageMeedian?section=mspCodeAssignments");
    } catch (e) { setErr(e.message); } finally { setBusy(false); setTimeout(() => setMsg(""), 2500); }
  };

  const endAssignment = async (assignment) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=mspCodeAssignments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updates: [{ id: assignment.id, endDate: new Date().toISOString().slice(0,10), active: false }] }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      mutate("/api/admin/manageMeedian?section=mspCodeAssignments");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const quickAssign = async (mspCodeId, userId) => {
    if (!mspCodeId || !userId) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const payload = { mspCodeId: Number(mspCodeId), userId: Number(userId), startDate: new Date().toISOString().slice(0,10), isPrimary: true };
      const res = await fetch("/api/admin/manageMeedian?section=mspCodeAssignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg("Assigned");
      mutate("/api/admin/manageMeedian?section=mspCodeAssignments");
    } catch (e) { setErr(e.message); } finally { setBusy(false); setTimeout(() => setMsg(""), 1800); }
  };

  // family dashboard
  const families = useMemo(() => Array.from(new Set(codes.map((c) => c.familyKey))).sort(), [codes]);
  const countsByFamily = useMemo(() => {
    const out = new Map();
    for (const fam of families) {
      const famCodes = codes.filter((c) => c.familyKey === fam);
      const total = famCodes.length;
      let assigned = 0;
      for (const c of famCodes) {
        if ((activeAssignees.get(c.id) || []).length > 0) assigned += 1;
      }
      out.set(fam, { total, assigned, unassigned: total - assigned });
    }
    return out;
  }, [families, codes, activeAssignees]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-gray-900">MSP Codes</h1>
        <div className="flex items-center gap-2">
          <Button variant="light" onClick={async () => {
            setBusy(true); setErr(""); setMsg("");
            try {
              const res = await fetch("/api/admin/manageMeedian?section=seedMSPCodes", { method: "POST", headers: { "Content-Type": "application/json" } });
              const j = await res.json();
              if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
              setMsg(j.message || "Seeded standard MSP codes");
              mutate("/api/admin/manageMeedian?section=mspCodes");
            } catch (e) { setErr(e.message); } finally { setBusy(false); setTimeout(() => setMsg(""), 2500); }
          }}>Seed Standard Codes</Button>
          {mspProgram && (
            <>
              <a href={`/dashboard/admin/manageMeedian/programs/${mspProgram.id}?track=elementary#schedule`}><Button variant="light">Open MSP-R (Ele)</Button></a>
              <a href={`/dashboard/admin/manageMeedian/programs/${mspProgram.id}?track=pre_primary#schedule`}><Button variant="light">Open MSP-R (Pre)</Button></a>
            </>
          )}
          <Button variant="light" onClick={() => { setModalType("create"); setModalFamily(""); setModalOpen(true); }}>Create MSP Code</Button>
          <Button onClick={() => { setModalType("assign"); setModalFamily(""); setModalOpen(true); }}>Assign MSP Code</Button>
        </div>
      </div>
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, title, family…"
            className="w-64 bg-transparent outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-1 text-sm">
          {[
            { k: "all", label: "All" },
            { k: "assigned", label: "Assigned" },
            { k: "unassigned", label: "Unassigned" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`px-3 py-1.5 rounded-lg border text-sm ${tab === t.k ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
            >{t.label}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button className={`px-3 py-1.5 rounded-lg border text-sm ${mode === "cards" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`} onClick={() => setMode("cards")}>
            Cards
          </button>
          <button className={`px-3 py-1.5 rounded-lg border text-sm ${mode === "tables" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`} onClick={() => setMode("tables")}>
            Tables
          </button>
        </div>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}

      <Card>
          <CardHeader><h2 className="font-semibold text-gray-900">Codes & Current Assignees (by Family)</h2></CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {families.map((fam) => {
                const ct = countsByFamily.get(fam) || { total: 0, assigned: 0, unassigned: 0 };
                return (
                  <div key={fam} className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-500">Family</div>
                        <div className="text-base font-semibold text-gray-900">{fam}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Assigned / Total</div>
                        <div className="text-base font-semibold text-gray-900">{ct.assigned} / {ct.total}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="light" size="sm" onClick={() => { setModalType("assign"); setModalFamily(fam); setModalOpen(true); }}>Assign</Button>
                      <Button variant="light" size="sm" onClick={() => { setModalType("create"); setModalFamily(fam); setModalOpen(true); }}>Create</Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {families.map((fam) => (
              <div key={fam} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">{fam}</h3>
                  {mode === "tables" && <div className="text-xs text-gray-500">Table view</div>}
                </div>
                {mode === "tables" ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="py-2 pr-4">Code</th>
                          <th className="py-2 pr-4">Track</th>
                          <th className="py-2 pr-4">Title</th>
                          <th className="py-2 pr-4">Assigned To</th>
                          <th className="py-2 pr-4">Quick Assign</th>
                          <th className="py-2 pr-4">Active</th>
                          <th className="py-2 pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCodes.filter((c) => c.familyKey === fam).map((r) => (
                          <tr key={r.id} className="border-t border-gray-200">
                            <td className="py-2 pr-4 font-semibold">{r.code}</td>
                            <td className="py-2 pr-4">{r.track}</td>
                            <td className="py-2 pr-4">{r.title}</td>
                            <td className="py-2 pr-4">
                              {(activeAssignees.get(r.id) || []).length === 0 ? (
                                <span className="text-gray-500">—</span>
                              ) : (
                                <ul className="list-disc list-inside">
                                  {(activeAssignees.get(r.id) || []).map((a) => {
                                    const u = users.find((x) => x.id === a.userId);
                                    return (
                                      <li key={a.id} className="flex items-center gap-2">
                                        <span>{u ? u.name : a.userId}</span>
                                        <Button variant="ghost" size="sm" onClick={() => endAssignment(a)} disabled={busy}>End</Button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </td>
                            <td className="py-2 pr-4">
                              <select className="px-2 py-1 border rounded text-sm" defaultValue="" onChange={(e) => quickAssign(r.id, e.target.value)}>
                                <option value="">Pick member…</option>
                                {users.map((u) => (
                                  <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 pr-4">{r.active ? "Yes" : "No"}</td>
                            <td className="py-2 pr-4 flex gap-2">
                              <Button variant="light" size="sm" onClick={() => openEditCode(r)} disabled={busy}>Edit</Button>
                              <Button variant="ghost" size="sm" onClick={() => toggleActive(r)} disabled={busy}>{r.active ? "Deactivate" : "Activate"}</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredCodes.filter((c) => c.familyKey === fam).map((r) => {
                      const asgs = activeAssignees.get(r.id) || [];
                      return (
                        <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-semibold">{r.code}</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${r.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{r.active ? "Active" : "Inactive"}</span>
                              </div>
                              <div className="mt-1 text-sm font-semibold text-gray-900">{r.title}</div>
                              <div className="text-xs text-gray-600">Track: {r.track} • Family: {r.familyKey}</div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Button variant="light" size="sm" onClick={() => openEditCode(r)} disabled={busy}>Edit</Button>
                              <Button variant="ghost" size="sm" onClick={() => toggleActive(r)} disabled={busy}>{r.active ? "Deactivate" : "Activate"}</Button>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="text-xs font-semibold text-gray-700 mb-1">Assigned</div>
                            {asgs.length === 0 ? (
                              <div className="text-xs text-gray-500">—</div>
                            ) : (
                              <ul className="space-y-1">
                                {asgs.map((a) => {
                                  const u = users.find((x) => x.id === a.userId);
                                  return (
                                    <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                                      <span>{u ? u.name : a.userId}</span>
                                      <Button variant="ghost" size="sm" onClick={() => endAssignment(a)} disabled={busy}>End</Button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                          <div className="mt-3">
                            <label className="block text-xs text-gray-600 mb-1">Quick Assign</label>
                            <select className="w-full px-2 py-2 border rounded text-sm" defaultValue="" onChange={(e) => quickAssign(r.id, e.target.value)}>
                              <option value="">Pick member…</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </CardBody>
        </Card>

      <Card>
          <CardHeader><h2 className="font-semibold text-gray-900">Modify Assignments</h2></CardHeader>
          <CardBody>
            <form className="grid grid-cols-1 md:grid-cols-5 gap-3" onSubmit={createAssignment}>
              <Select label="MSP Code" value={assignForm.mspCodeId} onChange={(e) => setAssignForm({ ...assignForm, mspCodeId: e.target.value })} required>
                <option value="">Select code</option>
                {codes.map((c) => (<option key={c.id} value={c.id}>{c.code} — {c.title}</option>))}
              </Select>
              <Select label="User" value={assignForm.userId} onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })} required>
                <option value="">Select user</option>
                {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
              </Select>
              <Input label="Start Date" type="date" value={assignForm.startDate} onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })} required />
              <Input label="End Date" type="date" value={assignForm.endDate} onChange={(e) => setAssignForm({ ...assignForm, endDate: e.target.value })} />
              <Select label="Primary?" value={String(assignForm.isPrimary)} onChange={(e) => setAssignForm({ ...assignForm, isPrimary: e.target.value === "true" })}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
              <div className="md:col-span-5"><Button disabled={busy}>Create Assignment</Button></div>
            </form>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-2 pr-4">Code</th>
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Start</th>
                    <th className="py-2 pr-4">End</th>
                    <th className="py-2 pr-4">Primary</th>
                    <th className="py-2 pr-4">Active</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => {
                    const role = codes.find((r) => r.id === a.mspCodeId);
                    const user = users.find((u) => u.id === a.userId);
                    return (
                      <tr key={a.id} className="border-t border-gray-200">
                        <td className="py-2 pr-4 font-semibold">{role ? `${role.code} — ${role.title}` : a.mspCodeId}</td>
                        <td className="py-2 pr-4">{user ? user.name : a.userId}</td>
                        <td className="py-2 pr-4">{a.startDate?.slice?.(0,10) || ""}</td>
                        <td className="py-2 pr-4">{a.endDate?.slice?.(0,10) || ""}</td>
                        <td className="py-2 pr-4">{a.isPrimary ? "Yes" : "No"}</td>
                        <td className="py-2 pr-4">{a.active ? "Yes" : "No"}</td>
                        <td className="py-2 pr-4">
                          {a.active && (<Button variant="ghost" size="sm" onClick={() => endAssignment(a)} disabled={busy}>End</Button>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1000]">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {modalType === "create" && "Create MSP Code"}
                {modalType === "assign" && "Assign MSP Code"}
                {modalType === "editCode" && "Edit MSP Code"}
                {modalFamily ? ` — ${modalFamily}` : ""}
              </h3>
              <Button variant="light" onClick={() => setModalOpen(false)}>Close</Button>
            </div>
            {modalType === "create" ? (
              <form className="grid grid-cols-1 md:grid-cols-6 gap-3" onSubmit={(e) => { if (modalFamily) setForm((f) => ({ ...f, familyKey: modalFamily })); submit(e); }}>
                <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
                <Input label="Program" value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} />
                <Input label="Family Key" helper="EMS/ESLC/EUA/EHO/PGL/PRL" value={form.familyKey} onChange={(e) => setForm({ ...form, familyKey: e.target.value })} required />
                <Select label="Track" value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} required>
                  <option value="">Select track</option>
                  <option value="pre_primary">Pre-Primary</option>
                  <option value="elementary">Elementary</option>
                  <option value="both">Both</option>
                </Select>
                <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                <Input label="Parent Slice" value={form.parentSlice} onChange={(e) => setForm({ ...form, parentSlice: e.target.value })} />
                <div className="md:col-span-6"><Button disabled={busy}>Create MSP Code</Button></div>
              </form>
            ) : modalType === "assign" ? (
              <form className="grid grid-cols-1 md:grid-cols-5 gap-3" onSubmit={(e) => { createAssignment(e); }}>
                <Select label="MSP Code" value={assignForm.mspCodeId} onChange={(e) => setAssignForm({ ...assignForm, mspCodeId: e.target.value })} required>
                  <option value="">Select code</option>
                  {codes.filter((c) => !modalFamily || c.familyKey === modalFamily).map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                  ))}
                </Select>
                <Select label="User" value={assignForm.userId} onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })} required>
                  <option value="">Select user</option>
                  {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
                </Select>
                <Input label="Start Date" type="date" value={assignForm.startDate} onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })} required />
                <Input label="End Date" type="date" value={assignForm.endDate} onChange={(e) => setAssignForm({ ...assignForm, endDate: e.target.value })} />
                <Select label="Primary?" value={String(assignForm.isPrimary)} onChange={(e) => setAssignForm({ ...assignForm, isPrimary: e.target.value === "true" })}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </Select>
                <div className="md:col-span-5"><Button disabled={busy}>Create Assignment</Button></div>
              </form>
            ) : (
              <form className="grid grid-cols-1 md:grid-cols-6 gap-3" onSubmit={updateCode}>
                <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
                <Input label="Program" value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} />
                <Input label="Family Key" helper="EMS/ESLC/EUA/EHO/PGL/PRL" value={form.familyKey} onChange={(e) => setForm({ ...form, familyKey: e.target.value })} required />
                <Select label="Track" value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} required>
                  <option value="pre_primary">Pre-Primary</option>
                  <option value="elementary">Elementary</option>
                  <option value="both">Both</option>
                </Select>
                <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                <Input label="Parent Slice" value={form.parentSlice} onChange={(e) => setForm({ ...form, parentSlice: e.target.value })} />
                <div className="md:col-span-6 flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button disabled={busy}>Save Changes</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
