"use client";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useState } from "react";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function ResourceDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const router = useRouter();
  const { data, mutate } = useSWR(id ? `/api/admin/resources/${id}` : null, fetcher);
  const { data: catData } = useSWR(`/api/admin/resources/categories`, fetcher, { dedupingInterval: 60000 });
  const { data: teamData } = useSWR(`/api/admin/manageMeedian?section=team`, fetcher, { dedupingInterval: 30000 });
  const r = data?.resource;
  const logs = data?.logs || [];
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", assetTag: "", categoryId: "", building: "", room: "", status: "available", assignedTo: "", notes: "" });
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [err, setErr] = useState("");
  const categories = catData?.categories || [];
  const members = (teamData?.users || []).filter((u) => u.role === "member" || u.role === "team_manager");
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const submitAssign = async (e) => {
    e?.preventDefault?.();
    setErr("");
    if (!assignUserId) { setErr("Please choose a user"); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/resources/${id}/logs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "assign", toUserId: Number(assignUserId), notes: assignNotes || "" }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setAssignOpen(false);
      setAssignUserId("");
      setAssignNotes("");
      mutate();
    } catch (e2) {
      setErr(e2.message);
    } finally { setBusy(false); }
  };

  if (!r) return <div className="text-sm text-gray-600">Loading…</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="light" onClick={() => (history.length > 1 ? router.back() : router.push('/dashboard/managersCommon/resources'))}>Back</Button>
          <h1 className="text-lg font-bold text-gray-900">{r.name} ({r.status})</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="light" onClick={() => { setForm({ name: r.name || "", assetTag: r.assetTag || "", categoryId: r.categoryId || "", building: r.building || "", room: r.room || "", status: r.status || "available", assignedTo: r.assignedTo || "", notes: r.notes || "" }); setEditOpen(true); }} disabled={busy}>Edit</Button>
          <Button variant="light" onClick={() => setAssignOpen(true)} disabled={busy}>Assign</Button>
          <Button variant="light" onClick={() => mutate()} disabled={busy}>Refresh</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="font-semibold text-gray-900">Overview</div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-600">Asset Tag:</span> {r.assetTag || "—"}</div>
            <div><span className="text-gray-600">Location:</span> {r.building || "—"}{r.room ? `, ${r.room}` : ""}</div>
            <div><span className="text-gray-600">Category:</span> {r.categoryId || "—"}</div>
            <div><span className="text-gray-600">Assigned To:</span> {r.assignedTo || "—"}</div>
            <div><span className="text-gray-600">Created:</span> {new Date(r.createdAt).toLocaleString()}</div>
          </div>
        </CardBody>
      </Card>

      {editOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/50 flex items-start justify-center" onClick={() => !busy && setEditOpen(false)}>
          <div className="mt-8 w-[96vw] max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">Edit Resource</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="light" onClick={() => setEditOpen(false)} disabled={busy}>Close</Button>
                </div>
              </CardHeader>
              <CardBody>
                <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    const patch = {
                      id,
                      name: form.name || undefined,
                      assetTag: form.assetTag || undefined,
                      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
                      building: form.building || undefined,
                      room: form.room || undefined,
                      status: form.status || undefined,
                      assignedTo: form.assignedTo ? Number(form.assignedTo) : null,
                      notes: form.notes || undefined,
                    };
                    const res = await fetch(`/api/admin/resources`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updates: [patch] }) });
                    const j = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
                    setEditOpen(false);
                    mutate();
                  } catch (err) {
                    alert(err.message);
                  } finally { setBusy(false); }
                }}>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Name</label>
                    <input name="name" value={form.name} onChange={onChange} className="w-full px-3 py-2 border rounded" required />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Assign Tag</label>
                    <input name="assetTag" value={form.assetTag} onChange={onChange} className="w-full px-3 py-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Category</label>
                    <select name="categoryId" value={form.categoryId} onChange={onChange} className="w-full px-3 py-2 border rounded">
                      <option value="">(none)</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Building</label>
                    <input name="building" value={form.building} onChange={onChange} className="w-full px-3 py-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Room</label>
                    <input name="room" value={form.room} onChange={onChange} className="w-full px-3 py-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Status</label>
                    <select name="status" value={form.status} onChange={onChange} className="w-full px-3 py-2 border rounded">
                      <option value="available">Available</option>
                      <option value="in_use">In Use</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="retired">Retired</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-700 mb-1">Assigned To</label>
                    <select name="assignedTo" value={form.assignedTo} onChange={onChange} className="w-full px-3 py-2 border rounded">
                      <option value="">(none)</option>
                      {members.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-700 mb-1">Notes</label>
                    <textarea name="notes" value={form.notes} onChange={onChange} className="w-full px-3 py-2 border rounded" rows={3} />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-2">
                    <Button type="button" variant="light" onClick={() => setEditOpen(false)} disabled={busy}>Cancel</Button>
                    <Button disabled={busy}>{busy ? "Saving…" : "Save Changes"}</Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="font-semibold text-gray-900">Activity</div>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Kind</th>
                  <th className="py-2 pr-4">By</th>
                  <th className="py-2 pr-4">To</th>
                  <th className="py-2 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-gray-200">
                    <td className="py-2 pr-4">{new Date(l.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">{l.kind}</td>
                    <td className="py-2 pr-4">{l.byUserId || "—"}</td>
                    <td className="py-2 pr-4">{l.toUserId || "—"}</td>
                    <td className="py-2 pr-4">{l.notes || ""}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td className="py-4 text-gray-500" colSpan={5}>No activity yet</td></tr>}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {assignOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/50 flex items-start justify-center" onClick={() => !busy && setAssignOpen(false)}>
          <div className="mt-12 w-[92vw] max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">Assign Resource</div>
                <Button size="sm" variant="light" onClick={() => setAssignOpen(false)} disabled={busy}>Close</Button>
              </CardHeader>
              <CardBody>
                {err && <div className="mb-2 text-sm text-red-600">{err}</div>}
                <form className="space-y-3" onSubmit={submitAssign}>
                  <div className="flex items-center gap-2">
                    <label className="w-28 text-xs text-gray-700">User</label>
                    <select className="flex-1 px-3 py-2 border rounded" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} required>
                      <option value="">Select user</option>
                      {members.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-28 text-xs text-gray-700">Notes</label>
                    <input className="flex-1 px-3 py-2 border rounded" value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} placeholder="Optional" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="light" onClick={() => setAssignOpen(false)} disabled={busy}>Cancel</Button>
                    <Button disabled={busy}>{busy ? "Assigning…" : "Assign"}</Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
