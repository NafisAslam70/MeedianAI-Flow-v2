"use client";
import useSWR from "swr";
import { useState, useMemo } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function ResourceManagementPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const { data, mutate } = useSWR(`/api/admin/resources?query=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`, fetcher, { dedupingInterval: 20000 });
  const rows = data?.resources || [];
  const { data: catData } = useSWR(`/api/admin/resources/categories`, fetcher, { dedupingInterval: 60000 });
  const categories = catData?.categories || [];
  const { data: teamData } = useSWR(`/api/admin/manageMeedian?section=team`, fetcher, { dedupingInterval: 30000 });

  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [simpleMode, setSimpleMode] = useState(true);
  const [issueNow, setIssueNow] = useState(false);
  const [categorySimple, setCategorySimple] = useState("school");
  const [createErr, setCreateErr] = useState("");
  const [form, setForm] = useState({
    name: "",
    assetTag: "",
    categoryId: "",
    type: "",
    serialNo: "",
    vendor: "",
    purchaseDate: "",
    warrantyEnd: "",
    cost: "",
    building: "",
    room: "",
    status: "available",
    assignedTo: "",
    notes: "",
  });
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };
  const submit = async (e) => {
    e?.preventDefault?.();
    if (!form.name.trim()) { setCreateErr("Name is required"); return; }
    setBusy(true);
    try {
      // Resolve category (existing or quick)
      let categoryId = form.categoryId ? Number(form.categoryId) : undefined;
      if (!categoryId && categorySimple) {
        const label = categorySimple === "school" ? "School" : categorySimple === "office" ? "Office" : "General";
        const match = (categories || []).find((c) => String(c.name).toLowerCase() === label.toLowerCase());
        if (match) categoryId = match.id;
        else {
          const cres = await fetch(`/api/admin/resources/categories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: label })
          });
          const cj = await cres.json().catch(() => ({}));
          if (cres.ok && cj?.category?.id) categoryId = cj.category.id;
        }
      }

      const defaultPurchase = "2025-01-01";
      const payload = {
        name: form.name.trim(),
        assetTag: (form.assetTag && form.assetTag.trim()) || undefined,
        categoryId,
        type: simpleMode ? undefined : (form.type.trim() || undefined),
        serialNo: simpleMode ? undefined : (form.serialNo.trim() || undefined),
        vendor: simpleMode ? undefined : (form.vendor.trim() || undefined),
        purchaseDate: simpleMode ? defaultPurchase : (form.purchaseDate || defaultPurchase),
        warrantyEnd: simpleMode ? undefined : (form.warrantyEnd || undefined),
        cost: form.cost ? Number(form.cost) : undefined,
        building: form.building.trim() || undefined,
        room: form.room.trim() || undefined,
        status: form.status || undefined,
        assignedTo: form.assignedTo ? Number(form.assignedTo) : undefined,
        notes: form.notes || undefined,
      };
      const res = await fetch(`/api/admin/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);

      const newRes = Array.isArray(j.resources) ? j.resources[0] : (j.resource || j);
      if (issueNow && newRes?.id && payload.assignedTo) {
        try {
          await fetch(`/api/admin/resources/${newRes.id}/logs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "assign", toUserId: payload.assignedTo, notes: "Issued on creation" })
          });
        } catch {}
      }

      setCreateOpen(false);
      setForm({ name: "", assetTag: "", categoryId: "", type: "", serialNo: "", vendor: "", purchaseDate: "", warrantyEnd: "", cost: "", building: "", room: "", status: "available", assignedTo: "", notes: "" });
      setIssueNow(false);
      mutate();
    } catch (err) {
      setCreateErr(err.message || "Failed to create resource");
    } finally { setBusy(false); }
  };

  const metrics = useMemo(() => {
    const total = rows.length;
    const by = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
    return { total, ...by };
  }, [rows]);

  return (
    <>
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-gray-900">Resource Management</h1>
        <div className="flex items-center gap-2">
          <Button variant="light" onClick={() => mutate()}>Refresh</Button>
          <Button onClick={() => setCreateOpen(true)}>Add Resource</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name/asset tag…" className="px-3 py-2 border rounded w-64" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border rounded">
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="in_use">In Use</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
            <div className="ml-auto text-sm text-gray-600">
              Total: <span className="font-semibold text-gray-900">{metrics.total}</span>
              <span className="ml-3">Available: {metrics.available || 0}</span>
              <span className="ml-3">In Use: {metrics.in_use || 0}</span>
              <span className="ml-3">Maint.: {metrics.maintenance || 0}</span>
              <span className="ml-3">Retired: {metrics.retired || 0}</span>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Asset Tag</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Location</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-200">
                    <td className="py-2 pr-4 font-semibold">{r.name}</td>
                    <td className="py-2 pr-4">{r.assetTag || "—"}</td>
                    <td className="py-2 pr-4">{r.status}</td>
                    <td className="py-2 pr-4">{r.building || "—"}{r.room ? `, ${r.room}` : ""}</td>
                    <td className="py-2 pr-4 flex gap-2">
                      <a className="underline text-teal-700" href={`./resources/${r.id}`}>Open</a>
                      <button className="underline text-gray-600" onClick={() => alert("Coming soon: Quick assign")}>Assign</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td className="py-6 text-center text-gray-500" colSpan={5}>No resources</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
    {createOpen && (
      <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4 sm:p-6" onClick={() => !busy && setCreateOpen(false)}>
        <div
          className="w-[96vw] max-w-5xl my-6 sm:my-8"
          style={{ maxHeight: "calc(100vh - 96px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="overflow-hidden">
            <CardHeader className="flex items-center justify-between">
              <div className="font-semibold text-gray-900">Add Resource</div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="light" onClick={() => setCreateOpen(false)} disabled={busy}>Close</Button>
              </div>
            </CardHeader>
            <CardBody className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className="text-gray-600">Mode:</span>
                <button type="button" className={`px-2 py-1 rounded border ${simpleMode ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-gray-200 text-gray-700'}`} onClick={() => setSimpleMode(true)}>Quick Add</button>
                <button type="button" className={`px-2 py-1 rounded border ${!simpleMode ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-gray-200 text-gray-700'}`} onClick={() => setSimpleMode(false)}>Full Form</button>
              </div>
              <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={submit}>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Name</label>
                  <input name="name" value={form.name} onChange={onChange} className="w-full px-3 py-2 border rounded" required />
                </div>
                {simpleMode ? (
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Desk</label>
                    <input name="assetTag" value={form.assetTag} onChange={onChange} className="w-full px-3 py-2 border rounded" />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Assign Tag</label>
                    <input name="assetTag" value={form.assetTag} onChange={onChange} className="w-full px-3 py-2 border rounded" />
                  </div>
                )}
                {categories.length > 0 ? (
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Category</label>
                    <select name="categoryId" value={form.categoryId} onChange={onChange} className="w-full px-3 py-2 border rounded">
                      <option value="">(none)</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Category</label>
                    <select value={categorySimple} onChange={(e) => setCategorySimple(e.target.value)} className="w-full px-3 py-2 border rounded">
                      <option value="school">School</option>
                      <option value="office">Office</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                )}
                {!simpleMode && (
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Purchase Date</label>
                    <input type="date" name="purchaseDate" value={form.purchaseDate} onChange={onChange} className="w-full px-3 py-2 border rounded" />
                  </div>
                )}
                {!simpleMode && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">Type</label>
                      <input name="type" value={form.type} onChange={onChange} className="w-full px-3 py-2 border rounded" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">Serial No</label>
                      <input name="serialNo" value={form.serialNo} onChange={onChange} className="w-full px-3 py-2 border rounded" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">Vendor</label>
                      <input name="vendor" value={form.vendor} onChange={onChange} className="w-full px-3 py-2 border rounded" />
                    </div>
                  </>
                )}
                {!simpleMode && (
                  <>
                    <div className="md:col-span-1">
                      <label className="block text-xs text-gray-700 mb-1">Purchase Date</label>
                      <input type="date" name="purchaseDate" value={form.purchaseDate} onChange={onChange} className="w-full px-3 py-2 border rounded" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs text-gray-700 mb-1">Warranty End</label>
                      <input type="date" name="warrantyEnd" value={form.warrantyEnd} onChange={onChange} className="w-full px-3 py-2 border rounded" />
                    </div>
                  </>
                )}
                <div className="md:col-span-1">
                  <label className="block text-xs text-gray-700 mb-1">Cost</label>
                  <input type="number" name="cost" value={form.cost} onChange={onChange} className="w-full px-3 py-2 border rounded" />
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
                {!simpleMode && (
                  <>
                    <div className="md:col-span-3">
                      <label className="block text-xs text-gray-700 mb-1">Assigned To</label>
                      <select name="assignedTo" value={form.assignedTo} onChange={onChange} className="w-full px-3 py-2 border rounded">
                        <option value="">(none)</option>
                        {(teamData?.users || []).filter((u) => u.role === 'member' || u.role === 'team_manager').map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs text-gray-700 mb-1">Notes</label>
                      <textarea name="notes" value={form.notes} onChange={onChange} className="w-full px-3 py-2 border rounded" rows={3} />
                    </div>
                    <div className="md:col-span-3">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                        <input type="checkbox" checked={issueNow} onChange={(e) => setIssueNow(e.target.checked)} /> Issue now (create assign log)
                      </label>
                    </div>
                  </>
                )}
                <div className="md:col-span-3 flex justify-end gap-2">
                  <Button type="button" variant="light" onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</Button>
                  <Button disabled={busy}>{busy ? "Saving…" : "Create Resource"}</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    )}
    </>
  );
}
