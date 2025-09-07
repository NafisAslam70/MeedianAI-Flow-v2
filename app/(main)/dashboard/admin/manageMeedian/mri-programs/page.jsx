"use client";
import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function MRIProgramsPage() {
  const { data: famData } = useSWR("/api/admin/manageMeedian?section=metaFamilies", fetcher, { dedupingInterval: 30000 });
  const { data: progData } = useSWR("/api/admin/manageMeedian?section=metaPrograms", fetcher, { dedupingInterval: 30000 });
  const { data: roleData } = useSWR("/api/admin/manageMeedian?section=metaProgramRoles", fetcher, { dedupingInterval: 30000 });
  const { data: roleDefsData } = useSWR("/api/admin/manageMeedian?section=metaRoleDefs", fetcher, { dedupingInterval: 30000 });
  const { data: builtinRolesData } = useSWR("/api/admin/manageMeedian?section=mriRoles", fetcher, { dedupingInterval: 30000 });

  const families = famData?.families || [];
  const programs = progData?.programs || [];
  const programRoles = roleData?.programRoles || [];
  const roleDefs = roleDefsData?.roleDefs || [];
  const builtinRoleKeys = builtinRolesData?.mriRoles || builtinRolesData?.roles || [];
  const roleKeyOptions = useMemo(() => {
    const set = new Set();
    const out = [];
    for (const k of builtinRoleKeys) {
      if (k && !set.has(k)) { set.add(k); out.push({ value: k, label: `${k} (built-in)` }); }
    }
    for (const d of roleDefs) {
      const k = d?.roleKey;
      if (k && !set.has(k)) { set.add(k); out.push({ value: k, label: k }); }
    }
    return out;
  }, [builtinRoleKeys, roleDefs]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // Modals
  const [modal, setModal] = useState(null); // 'create' | 'edit' | 'roles' | null
  const [editingProgram, setEditingProgram] = useState(null); // row being edited or managed

  // Forms
  const [form, setForm] = useState({ familyId: "", programKey: "", name: "", scope: "both", aims: "", sop: "", active: true });
  const [roleForm, setRoleForm] = useState({ action: "open", roleKey: "" });

  const activeFamilies = useMemo(() => families.filter((f) => f.active), [families]);

  const rolesByProgram = useMemo(() => {
    const map = new Map();
    for (const r of programRoles) {
      const arr = map.get(r.programId) || [];
      map.set(r.programId, [...arr, r]);
    }
    return map;
  }, [programRoles]);

  const openCreate = () => {
    setForm({ familyId: activeFamilies[0]?.id || "", programKey: "", name: "", scope: "both", aims: "", sop: "", active: true });
    setModal("create");
  };

  const openEdit = (prog) => {
    setEditingProgram(prog);
    setForm({
      familyId: prog.familyId,
      programKey: prog.programKey,
      name: prog.name,
      scope: prog.scope || "both",
      aims: prog.aims || "",
      sop: prog.sop ? JSON.stringify(prog.sop, null, 2) : "",
      active: !!prog.active,
    });
    setModal("edit");
  };

  const openRoles = (prog) => {
    setEditingProgram(prog);
    setRoleForm({ action: "open", roleKey: (roleKeyOptions[0]?.value) || "" });
    setModal("roles");
  };

  const handleCreate = async (e) => {
    e?.preventDefault?.(); setErr(""); setMsg(""); setBusy(true);
    try {
      let sopJson = null;
      if (form.sop) {
        try { sopJson = JSON.parse(form.sop); }
        catch { return setErr("SOP must be valid JSON"), setBusy(false); }
      }
      const payload = {
        familyId: Number(form.familyId),
        programKey: String(form.programKey || "").trim().toUpperCase(),
        name: form.name,
        scope: form.scope,
        aims: form.aims || null,
        sop: sopJson,
        active: !!form.active,
      };
      const res = await fetch(`/api/admin/manageMeedian?section=metaPrograms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg("Program created");
      setModal(null);
      mutate("/api/admin/manageMeedian?section=metaPrograms");
    } catch (e) { setErr(e.message); } finally { setBusy(false); setTimeout(() => setMsg(""), 2000); }
  };

  const handleUpdate = async (e) => {
    e?.preventDefault?.(); setErr(""); setMsg(""); setBusy(true);
    try {
      let sopJson = undefined;
      if (form.sop !== undefined) {
        if (form.sop === "") sopJson = null; else {
          try { sopJson = JSON.parse(form.sop); }
          catch { return setErr("SOP must be valid JSON"), setBusy(false); }
        }
      }
      const updates = [{
        id: Number(editingProgram.id),
        familyId: Number(form.familyId),
        programKey: String(form.programKey || "").trim().toUpperCase(),
        name: form.name,
        scope: form.scope,
        aims: form.aims ?? null,
        sop: sopJson,
        active: !!form.active,
      }];
      const res = await fetch(`/api/admin/manageMeedian?section=metaPrograms`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updates }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg("Program updated");
      setModal(null); setEditingProgram(null);
      mutate("/api/admin/manageMeedian?section=metaPrograms");
    } catch (e) { setErr(e.message); } finally { setBusy(false); setTimeout(() => setMsg(""), 2000); }
  };

  const handleDelete = async (prog) => {
    if (!confirm(`Delete program ${prog.name}?`)) return;
    setErr(""); setBusy(true);
    try {
      const res = await fetch(`/api/admin/manageMeedian?section=metaPrograms`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: prog.id }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      mutate("/api/admin/manageMeedian?section=metaPrograms");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const addProgramRole = async (e) => {
    e?.preventDefault?.(); if (!editingProgram) return;
    setErr(""); setBusy(true);
    try {
      const payload = { programId: Number(editingProgram.id), action: roleForm.action, roleKey: roleForm.roleKey };
      const res = await fetch(`/api/admin/manageMeedian?section=metaProgramRoles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setRoleForm({ action: "open", roleKey: roleDefs[0]?.roleKey || "" });
      await mutate("/api/admin/manageMeedian?section=metaProgramRoles");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const updateProgramRole = async (id, patch) => {
    setErr(""); setBusy(true);
    try {
      const res = await fetch(`/api/admin/manageMeedian?section=metaProgramRoles`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updates: [{ id, ...patch }] }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      mutate("/api/admin/manageMeedian?section=metaProgramRoles");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const deleteProgramRole = async (id) => {
    if (!confirm("Delete this program role grant?")) return;
    setErr(""); setBusy(true);
    try {
      const res = await fetch(`/api/admin/manageMeedian?section=metaProgramRoles&id=${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, cache: "no-store" });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      await mutate("/api/admin/manageMeedian?section=metaProgramRoles");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Programs</h1>
        <div className="text-right">
          {err && <p className="text-sm text-red-600">{err}</p>}
          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Manage Programs</h2>
          <Button onClick={openCreate} variant="primary">Create Program</Button>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">Program Key</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Family</th>
                  <th className="py-2 pr-4">Scope</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(programs || []).map((p) => {
                  const fam = families.find((f) => f.id === p.familyId);
                  return (
                    <tr key={p.id} className="border-t border-gray-200">
                      <td className="py-2 pr-4 font-semibold">{p.programKey}</td>
                      <td className="py-2 pr-4">{p.name}</td>
                      <td className="py-2 pr-4">{fam ? `${fam.name} (${fam.key})` : p.familyId}</td>
                      <td className="py-2 pr-4">{p.scope}</td>
                      <td className="py-2 pr-4">{p.active ? "Yes" : "No"}</td>
                      <td className="py-2 pr-4 flex gap-2">
                        <Button variant="light" size="sm" onClick={() => openEdit(p)} disabled={busy}>Edit</Button>
                        <Button variant="light" size="sm" onClick={() => openRoles(p)} disabled={busy}>Roles</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(p)} disabled={busy}>Delete</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Create/Edit Modal */}
      {modal && (modal === "create" || modal === "edit") && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1000]">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{modal === "create" ? "Create Program" : `Edit Program — ${editingProgram?.programKey}`}</h3>
              <Button variant="light" onClick={() => { setModal(null); setEditingProgram(null); }}>Close</Button>
            </div>
            <form className="grid grid-cols-1 md:grid-cols-6 gap-3" onSubmit={modal === "create" ? handleCreate : handleUpdate}>
              <Select label="Family" value={form.familyId} onChange={(e) => setForm({ ...form, familyId: e.target.value })} required>
                <option value="">Select family</option>
                {activeFamilies.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.key})</option>
                ))}
              </Select>
              <Input label="Program Key" helper="e.g., MSP" value={form.programKey} onChange={(e) => setForm({ ...form, programKey: e.target.value })} required />
              <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Select label="Scope" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                <option value="both">Both</option>
                <option value="pre_primary">Pre-Primary</option>
                <option value="elementary">Elementary</option>
              </Select>
              <div className="md:col-span-6">
                <Input label="Aims (text)" value={form.aims} onChange={(e) => setForm({ ...form, aims: e.target.value })} />
              </div>
              <div className="md:col-span-6">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">SOP (JSON)</span>
                  <textarea className="w-full rounded-lg border text-sm px-3 py-2 bg-white border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono min-h-[140px]" value={form.sop} onChange={(e) => setForm({ ...form, sop: e.target.value })} placeholder='{"openers":["MSP-MOD"],"checks":["PCC1","PCC2"]}' />
                </label>
              </div>
              <div className="md:col-span-6 flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => { setModal(null); setEditingProgram(null); }}>Cancel</Button>
                <Button disabled={busy}>{modal === "create" ? "Create" : "Save Changes"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Roles Modal */}
      {modal === "roles" && editingProgram && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1000]">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Program Roles — {editingProgram.name} ({editingProgram.programKey})</h3>
              <Button variant="light" onClick={() => { setModal(null); setEditingProgram(null); }}>Close</Button>
            </div>
            <form className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4" onSubmit={addProgramRole}>
              <Select label="Action" value={roleForm.action} onChange={(e) => setRoleForm({ ...roleForm, action: e.target.value })}>
                <option value="open">open</option>
                <option value="close">close</option>
                <option value="substitute">substitute</option>
                <option value="approve">approve</option>
                <option value="check">check</option>
              </Select>
              <Select label="Role Key" value={roleForm.roleKey} onChange={(e) => setRoleForm({ ...roleForm, roleKey: e.target.value })}>
                <option value="">Select role key</option>
                {roleKeyOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
              <div className="md:col-span-5"><Button disabled={busy}>Add Role Grant</Button></div>
            </form>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2 pr-4">Role Key</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(rolesByProgram.get(editingProgram.id) || []).map((r) => (
                    <tr key={r.id} className="border-t border-gray-200">
                      <td className="py-2 pr-4">
                        <select className="px-2 py-1 rounded border border-gray-300" value={r.action} onChange={(e) => updateProgramRole(r.id, { action: e.target.value })}>
                          <option value="open">open</option>
                          <option value="close">close</option>
                          <option value="substitute">substitute</option>
                          <option value="approve">approve</option>
                          <option value="check">check</option>
                        </select>
                      </td>
                      <td className="py-2 pr-4">
                        <select className="px-2 py-1 rounded border border-gray-300" value={r.roleKey} onChange={(e) => updateProgramRole(r.id, { roleKey: e.target.value })}>
                          {roleKeyOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-4">
                        <Button variant="ghost" size="sm" onClick={() => deleteProgramRole(r.id)} disabled={busy}>Delete</Button>
                      </td>
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
