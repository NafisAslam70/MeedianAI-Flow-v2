"use client";
import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function MRIFamiliesPage() {
  const { data, error } = useSWR("/api/admin/manageMeedian?section=metaFamilies", fetcher, { dedupingInterval: 30000 });
  const [families, setFamilies] = useState([]);
  const [form, setForm] = useState({ key: "", name: "", active: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { if (data?.families) setFamilies(data.families); if (error) setErr("Failed to load families"); }, [data, error]);

  const create = async (e) => {
    e?.preventDefault?.(); setBusy(true); setErr(""); setMsg("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=metaFamilies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg("Family created"); setForm({ key: "", name: "", active: true });
      mutate("/api/admin/manageMeedian?section=metaFamilies");
    } catch (e) { setErr(e.message); } finally { setBusy(false); setTimeout(() => setMsg(""), 2000); }
  };

  const toggleActive = async (fam) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=metaFamilies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updates: [{ id: fam.id, active: !fam.active }] }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      mutate("/api/admin/manageMeedian?section=metaFamilies");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const del = async (fam) => {
    if (!confirm(`Delete family ${fam.name}?`)) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=metaFamilies", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: fam.id }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      mutate("/api/admin/manageMeedian?section=metaFamilies");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">MRI Families</h1>
        <div className="flex items-center gap-2">
          <a href="/dashboard/admin/manageMeedian/mri-roles"><Button variant="light" size="sm">Back</Button></a>
          {err && <p className="text-sm text-red-600">{err}</p>}
          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        </div>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold text-gray-900">Create Family</h2></CardHeader>
        <CardBody>
          <form className="grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={create}>
            <Input label="Key" helper="amri|nmri|rmri|omri|custom" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} required />
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <SelectActive value={form.active} onChange={(v) => setForm({ ...form, active: v })} />
            <div className="md:col-span-4"><Button disabled={busy}>Create Family</Button></div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold text-gray-900">Families</h2></CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">Key</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(families || []).map((f) => (
                  <tr key={f.id} className="border-t border-gray-200">
                    <td className="py-2 pr-4 font-semibold">{f.key}</td>
                    <td className="py-2 pr-4">{f.name}</td>
                    <td className="py-2 pr-4">{f.active ? "Yes" : "No"}</td>
                    <td className="py-2 pr-4 flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(f)} disabled={busy}>{f.active ? "Deactivate" : "Activate"}</Button>
                      <Button variant="ghost" size="sm" onClick={() => del(f)} disabled={busy}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function SelectActive({ value, onChange }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">Active</span>
      <select className="w-full rounded-lg border text-sm px-3 py-2 bg-white border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" value={String(value)} onChange={(e) => onChange(e.target.value === "true") }>
        <option value="true">Active</option>
        <option value="false">Inactive</option>
      </select>
    </label>
  );
}
