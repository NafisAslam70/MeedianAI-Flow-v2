"use client";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

// Category options will be derived dynamically from MRI families (fallback to defaults)
const DEFAULT_CATEGORY_OPTIONS = [
  { value: "amri", label: "AMRI (Academic)" },
  { value: "rmri", label: "RMRI (Role-based)" },
  { value: "nmri", label: "NMRI (Non-academic)" },
];

const builtinCategoryMap = {
  nmri_moderator: "nmri",
  msp_ele_moderator: "rmri",
  msp_pre_moderator: "rmri",
  mhcp1_moderator: "amri",
  mhcp2_moderator: "amri",
  events_moderator: "amri",
  assessment_moderator: "amri",
  sports_moderator: "amri",
  util_moderator: "amri",
  pt_moderator: "amri",
};

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function RoleDefinitionsPage() {
  const [loading, setLoading] = useState(false);
  const [builtin, setBuiltin] = useState([]);
  const [defs, setDefs] = useState([]);
  const [tab, setTab] = useState("amri");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ roleKey: "", name: "", category: "rmri" });
  const [message, setMessage] = useState(null);
  const [families, setFamilies] = useState([]);

  // derive category options from families (active only); fallback to defaults
  const categoryOptions = useMemo(() => {
    // Always include defaults; merge in active families; dedupe by value (defaults win)
    const fam = (families || [])
      .filter((f) => f.active)
      .map((f) => ({ value: String(f.key || "").toLowerCase(), label: String(f.key || "").toUpperCase() }))
      .filter((x) => x.value);
    const merged = [...DEFAULT_CATEGORY_OPTIONS, ...fam];
    const seen = new Set();
    const out = [];
    for (const o of merged) {
      if (o.value && !seen.has(o.value)) {
        seen.add(o.value);
        out.push(o);
      }
    }
    return out;
  }, [families]);

  const groupedBuiltin = useMemo(() => {
    const groups = (categoryOptions || []).reduce((acc, c) => {
      acc[c.value] = [];
      return acc;
    }, {});
    builtin.forEach((key) => {
      const cat = builtinCategoryMap[key] || "rmri";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(key);
    });
    return groups;
  }, [builtin, categoryOptions]);

  const groupedDefs = useMemo(() => {
    const groups = (categoryOptions || []).reduce((acc, c) => {
      acc[c.value] = [];
      return acc;
    }, {});
    defs.forEach((d) => {
      const cat = d.category || "rmri";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    });
    return groups;
  }, [defs, categoryOptions]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`/api/admin/manageMeedian?section=mriRoles`),
        fetch(`/api/admin/manageMeedian?section=metaRoleDefsList`),
        fetch(`/api/admin/manageMeedian?section=metaFamilies`),
      ]);
      const j1 = await r1.json();
      const j2 = await r2.json();
      const j3 = await r3.json();
      setBuiltin(j1?.mriRoles || j1?.roles || []);
      setDefs(j2?.roleDefs || []);
      setFamilies(j3?.families || []);
      // ensure current tab is valid; prefer AMRI, else first available category
      const available = new Set(["amri", "rmri", "nmri", ...(j3?.families || []).filter((f) => f.active).map((f) => String(f.key || "").toLowerCase())]);
      if (!available.has(tab)) {
        setTab(available.has("amri") ? "amri" : Array.from(available)[0]);
      }
    } catch (e) {
      setMessage({ type: "error", text: `Failed to load roles: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openCreate = (presetCategory) => {
    setForm({ roleKey: "", name: "", category: presetCategory || (categoryOptions[0]?.value || "rmri") });
    setModalOpen(true);
  };

  const createRole = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/manageMeedian?section=metaRoleDefs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to create role");
      setModalOpen(false);
      await fetchAll();
      setMessage({ type: "success", text: `Role ${form.roleKey} created` });
    } catch (e) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (id, patch) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/manageMeedian?section=metaRoleDefs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ id, ...patch }] }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to update role");
      await fetchAll();
    } catch (e) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const deleteRole = async (id) => {
    if (!confirm("Delete this custom role definition?")) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/manageMeedian?section=metaRoleDefs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to delete role");
      await fetchAll();
    } catch (e) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const Tab = ({ value, label }) => (
    <button
      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
        tab === value ? "bg-teal-600/10 text-teal-700 border-teal-300" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
      }`}
      onClick={() => setTab(value)}
    >
      {label}
    </button>
  );

  const CategorySection = ({ cat }) => {
    const builtinList = groupedBuiltin[cat] || [];
    const customList = groupedDefs[cat] || [];
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader>Built-in Roles</CardHeader>
          <CardBody>
            {builtinList.length === 0 && <div className="text-sm text-gray-500">No built-in roles in this category.</div>}
            <ul className="divide-y divide-gray-200">
              {builtinList.map((r) => (
                <li key={r} className="py-2 text-sm flex items-center justify-between">
                  <span className="text-gray-800">{r}</span>
                  <span className="text-xs text-gray-500">read-only</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Custom Role Definitions</CardHeader>
          <CardBody>
            {customList.length === 0 && <div className="text-sm text-gray-500">No custom roles defined.</div>}
            <ul className="divide-y divide-gray-200">
              {customList.map((d) => (
                <li key={d.id} className="py-2 text-sm flex items-center gap-2 justify-between">
                  <div className="flex-1">
                    <div className="text-gray-900 font-medium">{d.roleKey}</div>
                    <div className="text-gray-600">{d.name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select label="Category" value={d.category || "rmri"} onChange={(e) => updateRole(d.id, { category: e.target.value })}>
                      {(categoryOptions || DEFAULT_CATEGORY_OPTIONS).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    <Button onClick={() => updateRole(d.id, { active: !d.active })} variant={d.active ? "secondary" : "primary"}>
                      {d.active ? "Disable" : "Enable"}
                    </Button>
                    <Button onClick={() => deleteRole(d.id)} variant="ghost">Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Role Definitions</h1>
          <p className="text-sm text-gray-500">View built-in MRI roles, add custom roles, and categorize by AMRI/RMRI/NMRI.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/dashboard/admin/manageMeedian/mri-roles"><button className="inline-flex items-center justify-center rounded-lg font-semibold transition-colors px-3 py-1.5 text-sm bg-white text-gray-900 border border-gray-200 hover:bg-gray-50">Back</button></a>
          <Button onClick={() => openCreate(tab)} variant="primary">Create Role</Button>
        </div>
      </div>

      {message && (
        <div className={`text-sm ${message.type === "error" ? "text-red-600" : "text-emerald-600"}`}>{message.text}</div>
      )}

      <div className="flex items-center gap-2">
        {(categoryOptions || DEFAULT_CATEGORY_OPTIONS).map((c) => (
          <Tab key={c.value} value={c.value} label={c.label} />
        ))}
      </div>

      <CategorySection cat={tab} />

      <Modal open={modalOpen} title="Create Role" onClose={() => setModalOpen(false)}>
        <form onSubmit={createRole} className="space-y-3">
          <Input label="Role Key" value={form.roleKey} onChange={(e) => setForm({ ...form, roleKey: e.target.value })} required />
          <Input label="Display Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {(categoryOptions || DEFAULT_CATEGORY_OPTIONS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} variant="primary">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
