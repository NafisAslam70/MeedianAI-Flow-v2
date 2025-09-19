"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  RefreshCw,
  Save,
  Users as UsersIcon,
  ShieldCheck,
  X,
  Trash2,
  UserPlus,
  Loader2,
} from "lucide-react";

const VIEW_FILTERS = [
  { value: "all", label: "Everyone" },
  { value: "members", label: "Members" },
  { value: "managers", label: "Managers" },
];

const TEACHER_FILTERS = [
  { value: "all", label: "Teacher status" },
  { value: "yes", label: "Teachers" },
  { value: "no", label: "Non-teachers" },
  { value: "unset", label: "Unset" },
];

const builtinRoleCategory = new Map([
  ["nmri_moderator", "NMRI"],
  ["msp_ele_moderator", "RMRI"],
  ["msp_pre_moderator", "RMRI"],
  ["mhcp1_moderator", "AMRI"],
  ["mhcp2_moderator", "AMRI"],
  ["events_moderator", "AMRI"],
  ["assessment_moderator", "AMRI"],
  ["sports_moderator", "AMRI"],
  ["util_moderator", "AMRI"],
  ["pt_moderator", "AMRI"],
]);

export default function Team({
  users,
  setUsers,
  userTimes,
  setUserTimes,
  loading,
  saving,
  setError,
  setSuccess,
  setConfirmDeleteUser,
  userTypes,
  roleTypes,
  memberScopes,
  teamManagerTypes,
  mriRoles,
  mriRoleLabels = {},
  userMriRoles = {},
  saveTeamChanges,
  saveUserTimesChanges,
  handleUserChange,
  handleUserTimeToggle,
  handleUserTimeChange,
  handleUserMriRoleChange,
  refreshTeam,
}) {
  const [viewFilter, setViewFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [activeUserId, setActiveUserId] = useState(null);
  const [passwordVisibility, setPasswordVisibility] = useState({});
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRole, setBulkRole] = useState("");
  const [bulkUserIds, setBulkUserIds] = useState([]);
  const [bulkTeacherFlag, setBulkTeacherFlag] = useState("none");
  const [bulkSaving, setBulkSaving] = useState(false);

  const saveAllChanges = async () => {
    await saveTeamChanges();
    await saveUserTimesChanges();
  };

  const allMriRoles = useMemo(() => {
    const list = Array.isArray(mriRoles) ? mriRoles : [];
    const fromAssignments = Object.values(userMriRoles)
      .flat()
      .filter(Boolean);
    return Array.from(new Set([...list, ...fromAssignments])).sort((a, b) => a.localeCompare(b));
  }, [mriRoles, userMriRoles]);

  const roleLabel = (roleKey) => {
    if (!roleKey) return "";
    return mriRoleLabels[roleKey] || roleKey.replaceAll("_", " ").toUpperCase();
  };

  const roleCategory = (roleKey) => {
    if (!roleKey) return "Other";
    const direct = builtinRoleCategory.get(roleKey);
    if (direct) return direct;
    const label = roleLabel(roleKey).toLowerCase();
    if (label.includes("nmri")) return "NMRI";
    if (label.includes("amri")) return "AMRI";
    if (label.includes("rmri")) return "RMRI";
    return "Other";
  };

  const stats = useMemo(() => {
    const total = users.length;
    const managers = users.filter((u) => ["admin", "team_manager"].includes(u.role)).length;
    const teachers = users.filter((u) => u.isTeacher === true).length;
    return { total, managers, teachers };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((user) => {
        if (viewFilter === "members") return user.role === "member";
        if (viewFilter === "managers") return user.role === "team_manager" || user.role === "admin";
        return true;
      })
      .filter((user) => {
        if (teacherFilter === "yes") return user.isTeacher === true;
        if (teacherFilter === "no") return user.isTeacher === false;
        if (teacherFilter === "unset") return user.isTeacher === null || user.isTeacher === undefined;
        return true;
      })
      .filter((user) => {
        if (roleFilter === "all") return true;
        const local = Array.isArray(user.mriRoles) ? user.mriRoles : userMriRoles[user.id] || [];
        return local.includes(roleFilter);
      })
      .filter((user) => {
        if (!q) return true;
        const haystack = `${user.name || ""} ${user.email || ""} ${user.whatsapp_number || ""}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [users, query, viewFilter, teacherFilter, roleFilter, userMriRoles]);

  const activeUser = useMemo(
    () => users.find((u) => u.id === activeUserId) || null,
    [users, activeUserId]
  );

  const activeTimes = activeUser
    ? userTimes?.[activeUser.id] || { dayOpenedAt: "", dayClosedAt: "", useCustomTimes: false }
    : { dayOpenedAt: "", dayClosedAt: "", useCustomTimes: false };

  const currentRoles = useMemo(() => {
    if (!activeUser) return new Set();
    const local = Array.isArray(activeUser.mriRoles)
      ? activeUser.mriRoles
      : userMriRoles[activeUser.id] || [];
    return new Set(local.filter(Boolean));
  }, [activeUser, userMriRoles]);

  const roleOwners = useMemo(() => {
    const map = new Map();
    users.forEach((user) => {
      const rolesForUser = Array.isArray(user.mriRoles)
        ? user.mriRoles
        : userMriRoles[user.id] || [];
      rolesForUser.forEach((role) => {
        map.set(role, user.name || `User #${user.id}`);
      });
    });
    return map;
  }, [users, userMriRoles]);

  const assignedElsewhere = useMemo(() => {
    const set = new Set();
    users.forEach((user) => {
      if (user.id === activeUserId) return;
      const rolesForUser = Array.isArray(user.mriRoles)
        ? user.mriRoles
        : userMriRoles[user.id] || [];
      rolesForUser.forEach((role) => set.add(role));
    });
    return set;
  }, [users, userMriRoles, activeUserId]);

  const handleToggleRole = (role) => {
    if (!activeUser) return;
    const next = new Set(currentRoles);
    if (next.has(role)) next.delete(role);
    else next.add(role);
    handleUserMriRoleChange(activeUser.id, Array.from(next));
  };

  const handlePasswordChange = (userId, value) => {
    setPasswordVisibility((prev) => ({ ...prev, [userId]: prev[userId] ?? false }));
    handleUserChange(userId, "password", value);
  };

  const massAssignRoles = async () => {
    if (!bulkRole || !bulkUserIds.length) {
      setError("Select a role and at least one user.");
      return;
    }
    setBulkSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=bulkAssignMriRole", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: bulkRole, userIds: bulkUserIds, teacherFlag: bulkTeacherFlag }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || `Bulk assign failed (${res.status})`);
      setSuccess(`Assigned ${roleLabel(bulkRole)} to ${payload.assignedTo} user(s).`);
      setTimeout(() => setSuccess(""), 4000);
      await refreshTeam();
      setBulkRole("");
      setBulkUserIds([]);
      setBulkTeacherFlag("none");
      setShowBulkModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  const closeDrawer = () => setActiveUserId(null);

  const renderDrawer = () => {
    if (!activeUser) return null;
    const supervisorOptions = users.filter((u) => u.id !== activeUser.id && ["admin", "team_manager"].includes(u.role));
    const localPasswordVisible = !!passwordVisibility[activeUser.id];

    const roleGroups = allMriRoles.reduce((acc, role) => {
      const cat = roleCategory(role);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(role);
      return acc;
    }, {});

    return (
      <AnimatePresence>
        <motion.div
          key="team-drawer"
          className="fixed inset-0 z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeDrawer} />
          <motion.aside
            className="absolute inset-y-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-medium text-slate-500">Editing user</p>
                <h3 className="text-xl font-semibold text-slate-900">{activeUser.name || `User #${activeUser.id}`}</h3>
                <p className="text-xs text-slate-500">{activeUser.email}</p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="h-[calc(100%-80px)] overflow-y-auto px-6 py-6 space-y-8">
              <section className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Profile</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600">Name</label>
                    <input
                      type="text"
                      value={activeUser.name || ""}
                      onChange={(e) => handleUserChange(activeUser.id, "name", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Email</label>
                    <input
                      type="email"
                      value={activeUser.email || ""}
                      onChange={(e) => handleUserChange(activeUser.id, "email", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">WhatsApp</label>
                    <input
                      type="tel"
                      value={activeUser.whatsapp_number || ""}
                      onChange={(e) => handleUserChange(activeUser.id, "whatsapp_number", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">New Password</label>
                    <div className="relative mt-1">
                      <input
                        type={localPasswordVisible ? "text" : "password"}
                        value={activeUser.password || ""}
                        onChange={(e) => handlePasswordChange(activeUser.id, e.target.value)}
                        placeholder="Leave blank to keep current"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm pr-10 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setPasswordVisibility((prev) => ({ ...prev, [activeUser.id]: !localPasswordVisible }))}
                        className="absolute inset-y-0 right-2 flex items-center text-xs text-slate-500"
                      >
                        {localPasswordVisible ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600">Role</label>
                    <select
                      value={activeUser.role}
                      onChange={(e) => handleUserChange(activeUser.id, "role", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      {roleTypes.map((role) => (
                        <option key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Member scope</label>
                    <select
                      value={activeUser.member_scope || ""}
                      onChange={(e) => handleUserChange(activeUser.id, "member_scope", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      {memberScopes.map((scope) => (
                        <option key={scope} value={scope}>
                          {scope.replaceAll("_", " ").toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">User type</label>
                    <select
                      value={activeUser.type || ""}
                      onChange={(e) => handleUserChange(activeUser.id, "type", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      {userTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.replaceAll("_", " ").toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Teacher</label>
                    <select
                      value={activeUser.isTeacher === true ? "true" : activeUser.isTeacher === false ? "false" : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleUserChange(activeUser.id, "isTeacher", val === "" ? null : val === "true");
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      <option value="">Not set</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  {activeUser.role === "team_manager" && (
                    <div>
                      <label className="text-sm font-medium text-slate-600">Team manager type</label>
                      <select
                        value={activeUser.team_manager_type || ""}
                        onChange={(e) => handleUserChange(activeUser.id, "team_manager_type", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      >
                        <option value="">None</option>
                        {teamManagerTypes.map((type) => (
                          <option key={type} value={type}>
                            {type.replaceAll("_", " ").toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-slate-600">Immediate supervisor</label>
                    <select
                      value={activeUser.immediate_supervisor || ""}
                      onChange={(e) => handleUserChange(activeUser.id, "immediate_supervisor", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      <option value="">None</option>
                      {supervisorOptions.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name} ({sup.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">MRI Roles</h4>
                  <p className="text-xs text-slate-500">
                    Assigned: {currentRoles.size || 0} / {allMriRoles.length}
                  </p>
                </div>
                {allMriRoles.length === 0 ? (
                  <p className="text-sm text-slate-500">No MRI roles defined yet.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(roleGroups).map(([category, roles]) => (
                      <div key={category}>
                        <p className="text-xs font-semibold text-slate-500 mb-2">{category}</p>
                        <div className="flex flex-wrap gap-2">
                          {roles.map((role) => {
                            const selected = currentRoles.has(role);
                            const locked = assignedElsewhere.has(role) && !selected;
                            const label = roleLabel(role);
                            return (
                              <button
                                key={role}
                                type="button"
                                onClick={() => handleToggleRole(role)}
                                disabled={locked}
                                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                  selected
                                    ? "border-teal-500 bg-teal-500 text-white shadow-sm"
                                    : locked
                                    ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-600"
                                }`}
                                title={locked ? `Currently assigned to ${roleOwners.get(role) || "another user"}` : label}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Day open / close</h4>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Use custom times</p>
                    <p className="text-xs text-slate-500">When off, defaults from the global Open & Close times are used.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={!!activeTimes.useCustomTimes}
                      onChange={(e) => handleUserTimeToggle(activeUser.id, e.target.checked)}
                      className="h-4 w-4"
                    />
                    Custom
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-600">Day open</label>
                    <input
                      type="time"
                      value={activeTimes.dayOpenedAt || ""}
                      disabled={!activeTimes.useCustomTimes}
                      onChange={(e) => handleUserTimeChange(activeUser.id, "dayOpenedAt", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Day close</label>
                    <input
                      type="time"
                      value={activeTimes.dayClosedAt || ""}
                      disabled={!activeTimes.useCustomTimes}
                      onChange={(e) => handleUserTimeChange(activeUser.id, "dayClosedAt", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50"
                    />
                  </div>
                </div>
              </section>

              <section className="flex flex-wrap justify-between gap-3 pt-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveAllChanges}
                    disabled={saving.team || saving.userTimes}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save size={16} />
                    {saving.team || saving.userTimes ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={refreshTeam}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
                  >
                    <RefreshCw size={16} /> Refresh data
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteUser(activeUser);
                    closeDrawer();
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 hover:border-rose-300 hover:text-rose-700"
                >
                  <Trash2 size={16} /> Remove user
                </button>
              </section>
            </div>
          </motion.aside>
        </motion.div>
      </AnimatePresence>
    );
  };

  if (loading.team || loading.userTimes) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading team members…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Manage Team</h2>
            <p className="text-sm text-slate-500">Search members, edit profiles and assign MRI roles with a single click.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshTeam}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              <RefreshCw size={14} /> Sync
            </button>
            <button
              type="button"
              onClick={saveAllChanges}
              disabled={saving.team || saving.userTimes}
              className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={14} />
              {saving.team || saving.userTimes ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-600">
              <UsersIcon size={20} />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Total team</p>
              <p className="text-lg font-semibold text-slate-900">{stats.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <ShieldCheck size={20} />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Managers</p>
              <p className="text-lg font-semibold text-slate-900">{stats.managers}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <UserPlus size={20} />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Teachers</p>
              <p className="text-lg font-semibold text-slate-900">{stats.teachers}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or WhatsApp"
              className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <select
            value={viewFilter}
            onChange={(e) => setViewFilter(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            {VIEW_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            {TEACHER_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="all">Any MRI role</option>
            {allMriRoles.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const headers = [
                "id",
                "name",
                "email",
                "role",
                "type",
                "member_scope",
                "whatsapp_number",
                "immediate_supervisor",
                "is_teacher",
              ];
              const rows = users.map((u) => headers.map((h) => u[h] ?? ""));
              const csv = [headers.join(","), ...rows.map((row) => row.map((v) => String(v).replaceAll('"', '""')).join(","))].join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "team.csv";
              link.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:border-slate-300"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            className="inline-flex items-center gap-2 rounded-full border border-teal-500 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-600 hover:border-teal-600"
          >
            Bulk assign role
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Supervisor</th>
              <th className="px-4 py-3">MRI roles</th>
              <th className="px-4 py-3">Teacher</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                  No users match the current filters.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const supervisor = users.find((u) => u.id === user.immediate_supervisor);
                const rolesForUser = Array.isArray(user.mriRoles)
                  ? user.mriRoles
                  : userMriRoles[user.id] || [];
                const isActive = user.id === activeUserId;
                return (
                  <tr
                    key={user.id}
                    className={`text-sm text-slate-700 transition hover:bg-slate-50 ${isActive ? "bg-teal-50/40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                      <div className="text-xs text-slate-400">{user.whatsapp_number || "–"}</div>
                    </td>
                    <td className="px-4 py-3 capitalize">{user.role.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{supervisor?.name || "None"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {rolesForUser.length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          rolesForUser.map((role) => (
                            <span
                              key={role}
                              className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                            >
                              {roleLabel(role)}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {user.isTeacher === true ? "Yes" : user.isTeacher === false ? "No" : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveUserId(user.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-teal-300 hover:text-teal-600"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {renderDrawer()}

      <AnimatePresence>
        {showBulkModal && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Bulk assign MRI role</h3>
                  <p className="text-sm text-slate-500">
                    Pick one role and assign it to multiple users. Anyone not selected will be unassigned for that role.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-600">Role</label>
                  <select
                    value={bulkRole}
                    onChange={(e) => setBulkRole(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="">Select a role…</option>
                    {allMriRoles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel(role)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Teacher flag</label>
                  <select
                    value={bulkTeacherFlag}
                    onChange={(e) => setBulkTeacherFlag(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="none">No change</option>
                    <option value="true">Set as teacher</option>
                    <option value="false">Set as non-teacher</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-600">Users</label>
                  <select
                    multiple
                    value={bulkUserIds.map(String)}
                    onChange={(e) => setBulkUserIds(Array.from(e.target.selectedOptions, (opt) => Number(opt.value)))}
                    className="mt-1 h-48 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} — {user.email}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">Hold Ctrl/Cmd to select multiple users.</p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={massAssignRoles}
                  disabled={bulkSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkSaving && <Loader2 className="h-4 w-4 animate-spin" />} Assign
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
