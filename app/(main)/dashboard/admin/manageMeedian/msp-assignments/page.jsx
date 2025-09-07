"use client";
import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function MSPCodeAssignmentsPage() {
  const { data: rolesData } = useSWR("/api/admin/manageMeedian?section=mspCodes", fetcher, { dedupingInterval: 30000 });
  const { data: teamData } = useSWR("/api/admin/manageMeedian?section=team", fetcher, { dedupingInterval: 30000 });
  const { data: asgData, error: asgErr } = useSWR("/api/admin/manageMeedian?section=mspCodeAssignments", fetcher, { dedupingInterval: 30000 });

  const roles = rolesData?.codes || [];
  const users = (teamData?.users || []).filter((u) => u.role === "member" || u.role === "team_manager");
  const assignments = asgData?.assignments || [];

  const [form, setForm] = useState({ mspRoleId: "", userId: "", startDate: "", endDate: "", isPrimary: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(asgErr ? "Failed to load assignments" : "");

  useEffect(() => { if (asgErr) setErr("Failed to load assignments"); }, [asgErr]);

  const submit = async (e) => {
    e?.preventDefault?.(); setBusy(true); setErr(""); setMsg("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=mspCodeAssignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, mspCodeId: Number(form.mspRoleId), userId: Number(form.userId) }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg("Assignment created"); setForm({ mspRoleId: "", userId: "", startDate: "", endDate: "", isPrimary: true });
      mutate("/api/admin/manageMeedian?section=mspCodeAssignments");
    } catch (e) { setErr(e.message); } finally { setBusy(false); setTimeout(() => setMsg(""), 2500); }
  };

  const endAssignment = async (a) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=mspCodeAssignments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updates: [{ id: a.id, endDate: new Date().toISOString().slice(0,10), active: false }] }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      mutate("/api/admin/manageMeedian?section=mspCodeAssignments");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">MSP Code Assignments</h1>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}

      <Card>
        <CardHeader><h2 className="font-semibold text-gray-900">Assign MSP Code</h2></CardHeader>
        <CardBody>
          <form className="grid grid-cols-1 md:grid-cols-5 gap-3" onSubmit={submit}>
            <Select label="MSP Code" value={form.mspRoleId} onChange={(e) => setForm({ ...form, mspRoleId: e.target.value })} required>
              <option value="">Select role</option>
              {roles.map((r) => (<option key={r.id} value={r.id}>{r.code} — {r.title}</option>))}
            </Select>
            <Select label="User" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
              <option value="">Select user</option>
              {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
            </Select>
            <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            <Input label="End Date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            <Select label="Primary?" value={String(form.isPrimary)} onChange={(e) => setForm({ ...form, isPrimary: e.target.value === "true" })}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
            <div className="md:col-span-5"><Button disabled={busy}>Create Assignment</Button></div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold text-gray-900">Existing Assignments</h2></CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">MSP Role</th>
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
                  const role = roles.find((r) => r.id === a.mspRoleId);
                  const user = users.find((u) => u.id === a.userId);
                  return (
                    <tr key={a.id} className="border-t border-gray-200">
                      <td className="py-2 pr-4 font-semibold">{role ? `${role.code} — ${role.title}` : a.mspRoleId}</td>
                      <td className="py-2 pr-4">{user ? user.name : a.userId}</td>
                      <td className="py-2 pr-4">{a.startDate?.slice?.(0,10) || ""}</td>
                      <td className="py-2 pr-4">{a.endDate?.slice?.(0,10) || ""}</td>
                      <td className="py-2 pr-4">{a.isPrimary ? "Yes" : "No"}</td>
                      <td className="py-2 pr-4">{a.active ? "Yes" : "No"}</td>
                      <td className="py-2 pr-4">{a.active && (<Button variant="ghost" size="sm" onClick={() => endAssignment(a)} disabled={busy}>End</Button>)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
