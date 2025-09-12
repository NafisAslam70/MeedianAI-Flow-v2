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

const generateTaskWithAI = async (context) => {
  try {
    const res = await fetch("/api/admin/manageMeedian/generateTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
    });
    if (!res.ok) throw new Error("Failed to generate task with AI");
    return await res.json();
  } catch (err) {
    console.error("AI Task Generation Error:", err);
    return null;
  }
};

export default function RoleDefinitionsPage() {
  const [loading, setLoading] = useState(false);
  const [builtin, setBuiltin] = useState([]);
  const [defs, setDefs] = useState([]);
  const [tab, setTab] = useState("amri");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ roleKey: "", name: "", category: "rmri" });
  const [message, setMessage] = useState(null);
  const [families, setFamilies] = useState([]);
  const [taskModal, setTaskModal] = useState({ open: false, role: null, tasks: [], loading: false });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", submissables: "", action: "", timeSensitive: false, timeMode: 'none', execAt: '', windowStart: '', windowEnd: '' });
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", submissables: "", action: "", active: true, timeSensitive: false, timeMode: 'none', execAt: '', windowStart: '', windowEnd: '' });
  const [submissablesList, setSubmissablesList] = useState([]);

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

  // Ensure a roleDef exists for a built-in role key, then return it
  const ensureRoleDefForBuiltin = async (roleKey) => {
    const pretty = String(roleKey).replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    const category = builtinCategoryMap[roleKey] || "rmri";
    try {
      const res = await fetch(`/api/admin/manageMeedian?section=metaRoleDefs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleKey, name: pretty, category }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to ensure role def");
      return j.roleDef || j.role || j.created || j; // be tolerant of response shape
    } catch (e) {
      setMessage({ type: "error", text: e.message });
      return null;
    }
  };

  const openTasks = async (role) => {
    setTaskModal({ open: true, role, tasks: [], loading: true });
    try {
      const res = await fetch(`/api/admin/manageMeedian?section=metaRoleTasks&roleDefId=${role.id}`);
      const j = await res.json();
      setTaskModal({ open: true, role, tasks: j.tasks || [], loading: false });
    } catch (e) {
      setTaskModal({ open: true, role, tasks: [], loading: false });
      setMessage({ type: "error", text: `Failed to load tasks: ${e.message}` });
    }
  };

  // Open tasks for a built-in role key by ensuring roleDef first
  const openBuiltinTasks = async (roleKey) => {
    const rd = await ensureRoleDefForBuiltin(roleKey);
    if (rd) openTasks(rd);
  };

  const openTaskModal = (role) => {
    setTaskModal({ open: true, role, tasks: [], loading: true });
    fetch(`/api/admin/manageMeedian?section=metaRoleTasks&roleDefId=${role.id}`)
      .then((res) => res.json())
      .then((data) => {
        setTaskModal((prev) => ({ ...prev, tasks: data.tasks || [], loading: false }));
      })
      .catch((err) => {
        console.error("Failed to fetch tasks:", err);
        setTaskModal((prev) => ({ ...prev, loading: false }));
      });
  };

  const createTask = async (e) => {
    e.preventDefault();
    setTaskModal((prev) => ({ ...prev, loading: true }));
    try {
      // Transform submissables: accept comma or newline separated -> array
      let subs = null;
      if (taskForm.submissables && String(taskForm.submissables).trim()) {
        subs = String(taskForm.submissables)
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      // time fields
      let execAt = null, windowStart = null, windowEnd = null;
      if (taskForm.timeSensitive) {
        if (taskForm.timeMode === 'timestamp') execAt = taskForm.execAt ? new Date(taskForm.execAt).toISOString() : null;
        if (taskForm.timeMode === 'window') {
          windowStart = taskForm.windowStart ? new Date(taskForm.windowStart).toISOString() : null;
          windowEnd = taskForm.windowEnd ? new Date(taskForm.windowEnd).toISOString() : null;
        }
      }
      const res = await fetch(`/api/admin/manageMeedian?section=metaRoleTasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleDefId: taskModal.role.id,
          title: taskForm.title,
          description: taskForm.description,
          submissables: subs,
          action: taskForm.action || null,
          timeSensitive: !!taskForm.timeSensitive,
          execAt,
          windowStart,
          windowEnd,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to create task");
      setTaskForm({ title: "", description: "", submissables: "", action: "", timeSensitive: false, timeMode: 'none', execAt: '', windowStart: '', windowEnd: '' });
      await openTaskModal(taskModal.role);
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setTaskModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const updateTask = async (id, patch) => {
    try {
      // Use POST with updates[] as per current API implementation
      const res = await fetch(`/api/admin/manageMeedian?section=metaRoleTasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ id, ...patch }] }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to update task");
      const res2 = await fetch(`/api/admin/manageMeedian?section=metaRoleTasks&roleDefId=${taskModal.role.id}`);
      const j2 = await res2.json();
      setTaskModal((m) => ({ ...m, tasks: j2.tasks || [] }));
    } catch (e) {
      setMessage({ type: "error", text: e.message });
    }
  };

  const deleteTask = async (id) => {
    if (!confirm("Delete this task?")) return;
    try {
      const res = await fetch(`/api/admin/manageMeedian?section=metaRoleTasks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to delete task");
      const res2 = await fetch(`/api/admin/manageMeedian?section=metaRoleTasks&roleDefId=${taskModal.role.id}`);
      const j2 = await res2.json();
      setTaskModal((m) => ({ ...m, tasks: j2.tasks || [] }));
    } catch (e) {
      setMessage({ type: "error", text: e.message });
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
                <li key={r} className="py-2 text-sm flex items-center justify-between gap-2">
                  <span className="text-gray-800">{r}</span>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => openBuiltinTasks(r)} variant="secondary">Tasks</Button>
                  </div>
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
                    <Button onClick={() => openTasks(d)} variant="secondary">Tasks</Button>
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

  const addSubmissable = () => {
    if (taskForm.submissables.trim()) {
      setSubmissablesList((prev) => [...prev, taskForm.submissables.trim()]);
      setTaskForm((prev) => ({ ...prev, submissables: '' }));
    }
  };

  const removeSubmissable = (index) => {
    setSubmissablesList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerateWithAI = async () => {
    setTaskModal((prev) => ({ ...prev, loading: true }));
    const context = `Role: ${taskModal.role.name}, Existing Tasks: ${taskModal.tasks.map((t) => t.title).join(", ")}`;
    const aiGeneratedTask = await generateTaskWithAI(context);
    if (aiGeneratedTask) {
      setTaskForm({
        title: aiGeneratedTask.title || "",
        description: aiGeneratedTask.description || "",
        submissables: aiGeneratedTask.submissables?.join(", ") || "",
        action: aiGeneratedTask.action || "",
      });
    }
    setTaskModal((prev) => ({ ...prev, loading: false }));
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

      <Modal open={taskModal.open} title={taskModal.role ? `Tasks: ${taskModal.role.roleKey || taskModal.role.name}` : "Tasks"} onClose={() => { setTaskModal({ open: false, role: null, tasks: [], loading: false }); setEditingTaskId(null); }}>
        {!taskModal.role ? (
          <div className="text-sm text-gray-500">No role selected.</div>
        ) : (
          <div className="space-y-4">
            <form onSubmit={createTask} className="space-y-3">
              <Input label="Task Title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required />
              <Input label="Description" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
              <div>
                <label htmlFor="submissables">Submissables</label>
                <input
                  type="text"
                  id="submissables"
                  value={taskForm.submissables}
                  onChange={(e) => setTaskForm({ ...taskForm, submissables: e.target.value })}
                />
                <button type="button" onClick={addSubmissable}>Add Submissable</button>
              </div>
              <ul>
                {submissablesList.map((item, index) => (
                  <li key={index}>
                    {item} <button type="button" onClick={() => removeSubmissable(index)}>Remove</button>
                  </li>
                ))}
              </ul>
              <Input label="Action (optional)" value={taskForm.action} onChange={(e) => setTaskForm({ ...taskForm, action: e.target.value })} />
              <div className="border border-gray-200 rounded-lg p-3">
                <label className="text-sm font-medium text-gray-700 inline-flex items-center gap-2">
                  <input type="checkbox" checked={taskForm.timeSensitive} onChange={(e)=> setTaskForm({ ...taskForm, timeSensitive: e.target.checked })} /> Time sensitive
                </label>
                {taskForm.timeSensitive && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-3 text-sm">
                      <label className="inline-flex items-center gap-1"><input type="radio" checked={taskForm.timeMode==='timestamp'} onChange={()=> setTaskForm({ ...taskForm, timeMode: 'timestamp' })} /> Exact time</label>
                      <label className="inline-flex items-center gap-1"><input type="radio" checked={taskForm.timeMode==='window'} onChange={()=> setTaskForm({ ...taskForm, timeMode: 'window' })} /> Time window</label>
                      <label className="inline-flex items-center gap-1"><input type="radio" checked={taskForm.timeMode==='none'} onChange={()=> setTaskForm({ ...taskForm, timeMode: 'none' })} /> None</label>
                    </div>
                    {taskForm.timeMode === 'timestamp' && (
                      <div className="text-sm">
                        <label className="block">Execute at (local)</label>
                        <input type="datetime-local" className="border rounded px-2 py-1" value={taskForm.execAt} onChange={(e)=> setTaskForm({ ...taskForm, execAt: e.target.value })} />
                      </div>
                    )}
                    {taskForm.timeMode === 'window' && (
                      <div className="flex items-center gap-3 text-sm">
                        <div>
                          <label className="block">Window start</label>
                          <input type="datetime-local" className="border rounded px-2 py-1" value={taskForm.windowStart} onChange={(e)=> setTaskForm({ ...taskForm, windowStart: e.target.value })} />
                        </div>
                        <div>
                          <label className="block">Window end</label>
                          <input type="datetime-local" className="border rounded px-2 py-1" value={taskForm.windowEnd} onChange={(e)=> setTaskForm({ ...taskForm, windowEnd: e.target.value })} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end">
                <Button type="button" onClick={handleGenerateWithAI} disabled={taskModal.loading}>
                  {taskModal.loading ? "Generating..." : "Generate with AI"}
                </Button>
                <Button type="submit" variant="primary">Add Task</Button>
              </div>
            </form>
            <div>
              {taskModal.loading ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : (taskModal.tasks || []).length === 0 ? (
                <div className="text-sm text-gray-500">No tasks yet.</div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {taskModal.tasks.map((t) => (
                    <li key={t.id} className="py-2 flex flex-col gap-2">
                      {editingTaskId === t.id ? (
                        <div className="space-y-2">
                          <Input label="Title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                          <Input label="Description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                          <Input label="Submissables (comma/newline separated)" value={editForm.submissables} onChange={(e) => setEditForm({ ...editForm, submissables: e.target.value })} />
                          <Input label="Action" value={editForm.action} onChange={(e) => setEditForm({ ...editForm, action: e.target.value })} />
                          <div className="border border-gray-200 rounded-lg p-3">
                            <label className="text-sm font-medium text-gray-700 inline-flex items-center gap-2">
                              <input type="checkbox" checked={editForm.timeSensitive} onChange={(e)=> setEditForm({ ...editForm, timeSensitive: e.target.checked })} /> Time sensitive
                            </label>
                            {editForm.timeSensitive && (
                              <div className="mt-2 space-y-2">
                                <div className="flex items-center gap-3 text-sm">
                                  <label className="inline-flex items-center gap-1"><input type="radio" checked={editForm.timeMode==='timestamp'} onChange={()=> setEditForm({ ...editForm, timeMode: 'timestamp' })} /> Exact time</label>
                                  <label className="inline-flex items-center gap-1"><input type="radio" checked={editForm.timeMode==='window'} onChange={()=> setEditForm({ ...editForm, timeMode: 'window' })} /> Time window</label>
                                  <label className="inline-flex items-center gap-1"><input type="radio" checked={editForm.timeMode==='none'} onChange={()=> setEditForm({ ...editForm, timeMode: 'none' })} /> None</label>
                                </div>
                                {editForm.timeMode === 'timestamp' && (
                                  <div className="text-sm">
                                    <label className="block">Execute at (local)</label>
                                    <input type="datetime-local" className="border rounded px-2 py-1" value={editForm.execAt} onChange={(e)=> setEditForm({ ...editForm, execAt: e.target.value })} />
                                  </div>
                                )}
                                {editForm.timeMode === 'window' && (
                                  <div className="flex items-center gap-3 text-sm">
                                    <div>
                                      <label className="block">Window start</label>
                                      <input type="datetime-local" className="border rounded px-2 py-1" value={editForm.windowStart} onChange={(e)=> setEditForm({ ...editForm, windowStart: e.target.value })} />
                                    </div>
                                    <div>
                                      <label className="block">Window end</label>
                                      <input type="datetime-local" className="border rounded px-2 py-1" value={editForm.windowEnd} onChange={(e)=> setEditForm({ ...editForm, windowEnd: e.target.value })} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              onClick={async () => {
                                let subs = null;
                                if (editForm.submissables && String(editForm.submissables).trim()) {
                                  subs = String(editForm.submissables)
                                    .split(/\n|,/)
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                }
                                let patch = { title: editForm.title, description: editForm.description, submissables: subs, action: editForm.action || null, active: !!editForm.active, timeSensitive: !!editForm.timeSensitive };
                                if (editForm.timeSensitive) {
                                  if (editForm.timeMode === 'timestamp') patch.execAt = editForm.execAt ? new Date(editForm.execAt).toISOString() : null;
                                  if (editForm.timeMode === 'window') {
                                    patch.windowStart = editForm.windowStart ? new Date(editForm.windowStart).toISOString() : null;
                                    patch.windowEnd = editForm.windowEnd ? new Date(editForm.windowEnd).toISOString() : null;
                                  }
                                } else { patch.execAt = null; patch.windowStart = null; patch.windowEnd = null; }
                                await updateTask(t.id, patch);
                                setEditingTaskId(null);
                              }}
                              variant="primary"
                            >
                              Save
                            </Button>
                            <Button onClick={() => setEditingTaskId(null)} variant="ghost">Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="text-gray-900 font-medium">{t.title}</div>
                            {t.description ? <div className="text-gray-600 text-sm">{t.description}</div> : null}
                            {/* Display submissables and action if present */}
                            {t.submissables ? (
                              <div className="text-gray-600 text-xs mt-1">
                                <span className="font-medium">Submissables:</span>
                                {(() => {
                                  try {
                                    const arr = JSON.parse(t.submissables || "null");
                                    if (Array.isArray(arr) && arr.length) {
                                      return (
                                        <ol className="list-decimal pl-5 mt-1">
                                          {arr.map((item, idx) => (
                                            <li key={idx} className="leading-5">{String(item)}</li>
                                          ))}
                                        </ol>
                                      );
                                    }
                                    return <span> {String(t.submissables)}</span>;
                                  } catch {
                                    return <span> {String(t.submissables)}</span>;
                                  }
                                })()}
                              </div>
                            ) : null}
                            {t.action ? (
                              <div className="text-gray-600 text-xs"><span className="font-medium">Action:</span> {t.action}</div>
                            ) : null}
                            {t.timeSensitive ? (
                              <div className="text-gray-600 text-xs mt-1">
                                <span className="font-medium">Time Sensitive:</span> Yes
                                {t.execAt ? (
                                  <span className="ml-2"><span className="font-medium">Exec At:</span> {new Date(t.execAt).toLocaleString()}</span>
                                ) : (
                                  t.windowStart ? (
                                    <span className="ml-2"><span className="font-medium">Window:</span> {new Date(t.windowStart).toLocaleString()} – {t.windowEnd ? new Date(t.windowEnd).toLocaleString() : ''}</span>
                                  ) : null
                                )}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button onClick={() => updateTask(t.id, { active: !t.active })} variant={t.active ? "secondary" : "primary"}>
                              {t.active ? "Disable" : "Enable"}
                            </Button>
                            <Button
                              onClick={() => {
                                setEditingTaskId(t.id);
                                setEditForm({
                                  title: t.title || "",
                                  description: t.description || "",
                                  submissables: (() => { try { const arr = JSON.parse(t.submissables || "null"); return Array.isArray(arr) ? arr.join(", ") : String(t.submissables || ""); } catch { return String(t.submissables || ""); } })(),
                                  action: t.action || "",
                                  active: !!t.active,
                                  timeSensitive: !!t.timeSensitive,
                                  timeMode: t.execAt ? 'timestamp' : ((t.windowStart || t.windowEnd) ? 'window' : 'none'),
                                  execAt: t.execAt ? new Date(t.execAt).toISOString().slice(0,16) : '',
                                  windowStart: t.windowStart ? new Date(t.windowStart).toISOString().slice(0,16) : '',
                                  windowEnd: t.windowEnd ? new Date(t.windowEnd).toISOString().slice(0,16) : '',
                                });
                              }}
                              variant="secondary"
                            >
                              Edit
                            </Button>
                            <Button onClick={() => deleteTask(t.id)} variant="ghost">Delete</Button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
