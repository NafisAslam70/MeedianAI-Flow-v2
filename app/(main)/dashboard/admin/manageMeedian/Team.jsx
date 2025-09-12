"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  userMriRoles = {},
  saveTeamChanges,
  saveUserTimesChanges,
  handleUserChange,
  handleUserTimeToggle,
  handleUserTimeChange,
  handleUserMriRoleChange,
  refreshTeam,
}) {
  const [teamFilter, setTeamFilter] = useState("members");
  const [search, setSearch] = useState("");
  const [expandedCard, setExpandedCard] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRole, setBulkRole] = useState("");
  const [bulkUserIds, setBulkUserIds] = useState([]);
  const [bulkTeacherFlag, setBulkTeacherFlag] = useState("none"); // none | true | false
  const [bulkSaving, setBulkSaving] = useState(false);

  const saveAllChanges = async () => {
    await saveTeamChanges();
    await saveUserTimesChanges();
  };

  const toggleCard = (id) => setExpandedCard((prev) => (prev === id ? null : id));
  const toggleShowPassword = (userId) =>
    setShowPasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  const toRoleLabel = (r) => r?.replaceAll("_", " ").toUpperCase();

  // Determine which MRI roles are assigned to other users
  const getAssignedRoles = (currentUserId) => {
    const assignedRoles = new Set();
    Object.entries(userMriRoles).forEach(([userId, roles]) => {
      if (parseInt(userId) !== currentUserId && Array.isArray(roles)) {
        roles.forEach((role) => assignedRoles.add(role));
      }
    });
    return assignedRoles;
  };

  return (
    <div className="space-y-6">
      {loading.team || loading.userTimes ? (
        <p className="text-gray-600 text-center text-lg">Loading team members...</p>
      ) : (
        <div>
          <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Manage Team</h2>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name/email/WhatsApp"
                className="p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base bg-white w-64"
              />
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base bg-white"
              >
                <option value="members">Normal Team Members</option>
                <option value="managers">Team Managers</option>
                <option value="all">All Users</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  const headers = ["id","name","email","role","type","member_scope","whatsapp_number","immediate_supervisor","is_teacher"]; 
                  const rows = users.map((u) => headers.map((h) => u[h] ?? ""));
                  const csv = [headers.join(","), ...rows.map((r) => r.map((v) => String(v).replaceAll('"','""')).join(","))].join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "team.csv"; a.click(); URL.revokeObjectURL(url);
                }}
                className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => setShowBulkModal(true)}
                className="p-2 border border-teal-500 text-teal-700 rounded-lg bg-white hover:bg-teal-50"
                title="Assign one MRI role to many users"
              >
                Bulk Assign MRI Role
              </button>
            </div>
          </div>
          {users.length === 0 ? (
            <p className="text-gray-600 text-center text-lg">
              No users found. Please check the database or authentication.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {users
                  .filter((user) => {
                    if (teamFilter === "members") return user.role === "member";
                    if (teamFilter === "managers") return user.role === "team_manager" || user.role === "admin";
                    return true;
                  })
                  .filter((user) => {
                    const q = search.trim().toLowerCase();
                    if (!q) return true;
                    const hay = `${user.name || ""} ${user.email || ""} ${user.whatsapp_number || ""}`.toLowerCase();
                    return hay.includes(q);
                  })
                  .map((user) => {
                    const times = userTimes?.[user.id] || {
                      dayOpenedAt: "",
                      dayClosedAt: "",
                      useCustomTimes: false,
                    };
                    // server-provided roles map (defensive)
                    const serverMriRoles = Array.isArray(userMriRoles?.[user.id])
                      ? userMriRoles[user.id]
                      : [];
                    // local-in-edit roles stored on user (if any)
                    const localMri = Array.isArray(user.mriRoles) ? user.mriRoles : serverMriRoles;
                    // effective roles to show
                    const effectiveMriRoles = localMri;
                    // Get roles assigned to other users
                    const assignedRoles = getAssignedRoles(user.id);
                    return (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white rounded-lg shadow-md p-4 flex flex-col gap-2"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-800">{user.name}</h3>
                            <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                            <p className="text-sm text-gray-500">
                              Supervisor: {users.find((u) => u.id === user.immediate_supervisor)?.name || "None"}
                            </p>
                            <p className="text-sm text-gray-500">
                              MRI Roles: {effectiveMriRoles.length > 0 ? effectiveMriRoles.map(toRoleLabel).join(", ") : "None"}
                            </p>
                            <p className="text-sm text-gray-500">
                              Teacher: {user.isTeacher === true ? "Yes" : user.isTeacher === false ? "No" : "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <motion.button
                              onClick={() => toggleCard(user.id)}
                              className="text-teal-600 hover:text-teal-700"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              title={expandedCard === user.id ? "Collapse" : "Expand"}
                            >
                              <svg
                                className={`w-5 h-5 transform ${expandedCard === user.id ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </motion.button>
                            <motion.button
                              onClick={() => setConfirmDeleteUser(user)}
                              className="text-red-600 hover:text-red-700"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              title="Remove user"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M6 7h12M9 7v10m6-10v10M4 7h16l-1 12a2 2 0 01-2 2H7a2 2 0 01-2-2L4 7zm5-3h6l1 3H8l1-3z"
                                />
                              </svg>
                            </motion.button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {expandedCard === user.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="space-y-4 pt-4 border-t border-gray-200"
                            >
                              {/* Name */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                <input
                                  type="text"
                                  value={user.name || ""}
                                  onChange={(e) => handleUserChange(user.id, "name", e.target.value)}
                                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                  placeholder="Enter name"
                                />
                              </div>
                              {/* Email */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <input
                                  type="email"
                                  value={user.email || ""}
                                  onChange={(e) => handleUserChange(user.id, "email", e.target.value)}
                                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                  placeholder="Enter email"
                                />
                              </div>
                              {/* WhatsApp */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">WhatsApp Number</label>
                                <input
                                  type="text"
                                  value={user.whatsapp_number || ""}
                                  onChange={(e) => handleUserChange(user.id, "whatsapp_number", e.target.value)}
                                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                  placeholder="+1234567890"
                                />
                              </div>
                              {/* Password */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Password (optional)</label>
                                <div className="mt-1 flex gap-2">
                                  <input
                                    type={showPasswords[user.id] ? "text" : "password"}
                                    value={user.password || ""}
                                    onChange={(e) => handleUserChange(user.id, "password", e.target.value)}
                                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                    placeholder="Enter new password"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => toggleShowPassword(user.id)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                                    title={showPasswords[user.id] ? "Hide password" : "Show password"}
                                  >
                                    {showPasswords[user.id] ? "Hide" : "Show"}
                                  </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Leave blank to keep current password.</p>
                              </div>
                              {/* Role */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Role</label>
                                <select
                                  value={user.role}
                                  onChange={(e) => handleUserChange(user.id, "role", e.target.value)}
                                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                >
                                  {roleTypes.map((role) => (
                                    <option key={role} value={role}>
                                      {role.charAt(0).toUpperCase() + role.slice(1)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {/* Teacher (tri-state) */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Teacher</label>
                                <select
                                  value={user.isTeacher === true ? "true" : user.isTeacher === false ? "false" : ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    handleUserChange(
                                      user.id,
                                      "isTeacher",
                                      v === "" ? null : v === "true"
                                    );
                                  }}
                                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                >
                                  <option value="">—</option>
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Blank means not set (null).</p>
                              </div>
                              {/* Team Manager Type */}
                              {user.role === "team_manager" && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Team Manager Type</label>
                                  <select
                                    value={user.team_manager_type || ""}
                                    onChange={(e) => handleUserChange(user.id, "team_manager_type", e.target.value)}
                                    className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                  >
                                    <option value="">Select Type</option>
                                    {teamManagerTypes.map((type) => (
                                      <option key={type} value={type}>
                                        {type.replaceAll("_", " ").toUpperCase()}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              {/* Type */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Type</label>
                                <select
                                  value={user.type}
                                  onChange={(e) => handleUserChange(user.id, "type", e.target.value)}
                                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                >
                                  {userTypes.map((type) => (
                                    <option key={type} value={type}>
                                      {type.replaceAll("_", " ").toUpperCase()}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {/* Member Scope */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Member Scope</label>
                                <select
                                  value={user.member_scope || ""}
                                  onChange={(e) => handleUserChange(user.id, "member_scope", e.target.value)}
                                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                >
                                  {memberScopes.map((scope) => (
                                    <option key={scope} value={scope}>
                                      {scope.replaceAll("_", " ").toUpperCase()}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {/* Supervisor */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Immediate Supervisor</label>
                                <select
                                  value={user.immediate_supervisor || ""}
                                  onChange={(e) => handleUserChange(user.id, "immediate_supervisor", e.target.value)}
                                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                >
                                  <option value="">None</option>
                                  {users
                                    .filter((u) => u.id !== user.id && (u.role === "admin" || u.role === "team_manager"))
                                    .map((supervisor) => (
                                      <option key={supervisor.id} value={supervisor.id}>
                                        {supervisor.name} ({supervisor.role})
                                      </option>
                                    ))}
                                </select>
                              </div>
                              {/* MRI Roles */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">MRI Roles</label>
                                <select
                                  multiple
                                  value={effectiveMriRoles}
                                  onChange={(e) =>
                                    handleUserMriRoleChange(
                                      user.id,
                                      Array.from(e.target.selectedOptions, (o) => o.value)
                                    )
                                  }
                                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base h-32 bg-white"
                                >
                                  {mriRoles.map((role) => (
                                    <option
                                      key={role}
                                      value={role}
                                      disabled={assignedRoles.has(role) && !effectiveMriRoles.includes(role)}
                                      className="py-1 px-2 hover:bg-teal-50"
                                    >
                                      {toRoleLabel(role)}
                                    </option>
                                  ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                  Hold Ctrl (Windows) or Cmd (Mac) to select multiple roles. Disabled roles are assigned to other users.
                                </p>
                              </div>
                              {/* Per-user open/close */}
                              <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                                <div className="flex items-center justify-between">
                                  <label className="text-sm font-semibold text-gray-700">
                                    Use custom Day Open / Day Close for this user
                                  </label>
                                  <input
                                    type="checkbox"
                                    checked={!!times.useCustomTimes}
                                    onChange={(e) => handleUserTimeToggle(user.id, e.target.checked)}
                                    className="h-4 w-4"
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  When off, this user follows the default <code>open_close_times</code> for their type.
                                </p>
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                  <div>
                                    <label className="block text-sm text-gray-700">Day Open</label>
                                    <input
                                      type="time"
                                      value={times.dayOpenedAt || ""}
                                      onChange={(e) => handleUserTimeChange(user.id, "dayOpenedAt", e.target.value)}
                                      className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base disabled:opacity-60"
                                      disabled={!times.useCustomTimes}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm text-gray-700">Day Close</label>
                                    <input
                                      type="time"
                                      value={times.dayClosedAt || ""}
                                      onChange={(e) => handleUserTimeChange(user.id, "dayClosedAt", e.target.value)}
                                      className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base disabled:opacity-60"
                                      disabled={!times.useCustomTimes}
                                    />
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
              </div>
              <motion.button
                onClick={saveAllChanges}
                disabled={saving.team || saving.userTimes || users.length === 0}
                className={`w-full sm:w-auto mt-4 px-6 py-3 rounded-lg text-white font-semibold text-lg transition-all duration-200 bg-teal-600 hover:bg-teal-700 shadow-md ${
                  saving.team || saving.userTimes || users.length === 0 ? "opacity-50 cursor-not-allowed" : ""
                }`}
                whileHover={{ scale: saving.team || saving.userTimes || users.length === 0 ? 1 : 1.05 }}
                whileTap={{ scale: saving.team || saving.userTimes || users.length === 0 ? 1 : 0.95 }}
              >
                {saving.team || saving.userTimes ? "Saving..." : "Save All Changes"}
              </motion.button>
            </>
          )}
        </div>
      )}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Bulk Assign MRI Role</h2>
            <p className="text-sm text-gray-600 mb-4">Pick one role and assign it to multiple users at once. Existing holders not selected will be unassigned for this role.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value)}
                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg bg-white"
                >
                  <option value="">Select a role…</option>
                  {mriRoles.map((r) => (
                    <option key={r} value={r}>{r.replaceAll("_"," ").toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Teacher flag</label>
                <select
                  value={bulkTeacherFlag}
                  onChange={(e) => setBulkTeacherFlag(e.target.value)}
                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg bg-white"
                >
                  <option value="none">No change</option>
                  <option value="true">Set as Teacher</option>
                  <option value="false">Set as Non-Teacher</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Optional: update Teacher flag for selected users.</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Users</label>
                <select
                  multiple
                  value={bulkUserIds.map(String)}
                  onChange={(e) => setBulkUserIds(Array.from(e.target.selectedOptions, (o) => parseInt(o.value)))}
                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg bg-white h-48"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.email}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple users.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowBulkModal(false)} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800">Cancel</button>
              <button
                onClick={async () => {
                  if (!bulkRole || bulkUserIds.length === 0) {
                    setError("Select a role and at least one user.");
                    return;
                  }
                  setBulkSaving(true);
                  setError("");
                  setSuccess("");
                  try {
                    const res = await fetch("/api/admin/manageMeedian?section=bulkAssignMriRole", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ role: bulkRole, userIds: bulkUserIds, teacherFlag: bulkTeacherFlag }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || `Failed: ${res.status}`);
                    setSuccess(`Assigned ${bulkRole.replaceAll('_',' ').toUpperCase()} to ${bulkUserIds.length} users`);
                    setShowBulkModal(false);
                    try { if (typeof refreshTeam === 'function') await refreshTeam(); } catch {}
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBulkSaving(false);
                  }
                }}
                disabled={bulkSaving}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60"
              >
                {bulkSaving ? "Assigning…" : "Assign Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
