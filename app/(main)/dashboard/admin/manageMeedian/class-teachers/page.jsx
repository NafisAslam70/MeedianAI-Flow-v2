"use client";
import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function ClassTeachersPage() {
  const { data: classData, error: classErr } = useSWR("/api/member/student?type=classes", fetcher, { dedupingInterval: 30000 });
  const { data: teamData, error: teamErr } = useSWR("/api/admin/manageMeedian?section=team", fetcher, { dedupingInterval: 30000 });
  const { data: cptData, error: cptErr } = useSWR("/api/admin/manageMeedian?section=classTeachers", fetcher, { dedupingInterval: 30000 });

  const classes = classData?.classes || [];
  const users = (teamData?.users || []).filter((u) => u.role === "member" || u.role === "team_manager");
  const cpt = cptData?.classTeachers || [];

  const [form, setForm] = useState({ classId: "", userId: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (classErr || teamErr || cptErr) setErr("Failed to load data");
  }, [classErr, teamErr, cptErr]);

  const currentMap = useMemo(() => {
    const m = new Map();
    for (const row of cpt) {
      if (row.active) m.set(row.classId, row.userId);
    }
    return m;
  }, [cpt]);

  const assign = async (e) => {
    e?.preventDefault?.();
    if (!form.classId || !form.userId) {
      setErr("Pick both class and teacher before assigning");
      return;
    }
    setBusy(true); setErr(""); setMsg("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=classTeachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: Number(form.classId), userId: Number(form.userId) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg("Class teacher assigned");
      setForm({ classId: "", userId: "" });
      mutate("/api/admin/manageMeedian?section=classTeachers");
    } catch (e) { setErr(e.message); } finally { setBusy(false); setTimeout(() => setMsg(""), 3000); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Class Teachers</h1>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Assign Parent Teacher (pt_moderator)</h2>
        </CardHeader>
        <CardBody>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={assign}>
            <Select label="Class" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} required>
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Select label="Teacher" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
              <option value="">Select teacher</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
            <div className="md:col-span-3"><Button disabled={busy || !form.classId || !form.userId}>Assign</Button></div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Current Assignments</h2>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">Class</th>
                  <th className="py-2 pr-4">Teacher</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => {
                  const uid = currentMap.get(c.id);
                  const teacher = users.find((u) => u.id === uid);
                  return (
                    <tr key={c.id} className="border-t border-gray-200">
                      <td className="py-2 pr-4 font-semibold">{c.name}</td>
                      <td className="py-2 pr-4">{teacher ? teacher.name : "—"}</td>
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
