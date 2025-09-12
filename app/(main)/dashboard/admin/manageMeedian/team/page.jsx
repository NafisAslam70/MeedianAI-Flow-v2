"use client";
import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import Team from "../Team";

const fetcher = (url) => fetch(url, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());
const toHHMM = (t) => (t ? String(t).split(":").slice(0, 2).map((x) => x.padStart(2, "0")).join(":") : "");
const ensureSeconds = (t) => (t && /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t || null);

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [userTimes, setUserTimes] = useState({});
  const [userMriRoles, setUserMriRoles] = useState({});
  const [loading, setLoading] = useState({ team: true, userTimes: true });
  const [saving, setSaving] = useState({ team: false, userTimes: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  const userTypes = ["residential", "non_residential", "semi_residential"];
  const roleTypes = ["member", "admin", "team_manager"];
  const memberScopes = ["i_member", "o_member", "s_member"];
  const teamManagerTypes = [
    "head_incharge",
    "coordinator",
    "accountant",
    "chief_counsellor",
    "hostel_incharge",
    "principal",
  ];
  const mriRoles = [
    "nmri_moderator",
    "msp_ele_moderator",
    "msp_pre_moderator",
    "mhcp1_moderator",
    "mhcp2_moderator",
    "events_moderator",
    "assessment_moderator",
    "sports_moderator",
    "util_moderator",
    "pt_moderator",
  ];

  const { data: userData, error: userError } = useSWR("/api/admin/manageMeedian?section=team", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
  const { data: userTimesData, error: userTimesError } = useSWR(
    "/api/admin/manageMeedian?section=userOpenCloseTimes",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  useEffect(() => {
    if (userData) {
      setUsers(userData.users || []);
      setUserMriRoles(userData.userMriRoles || {});
      setLoading((p) => ({ ...p, team: false }));
    }
    if (userError) {
      setError(`Failed to load users: ${userError.message}`);
      setLoading((p) => ({ ...p, team: false }));
    }
  }, [userData, userError]);

  useEffect(() => {
    if (userTimesData) {
      const list = userTimesData.userOpenCloseTimes || userTimesData.times || [];
      const mapped = {};
      list.forEach((row) => {
        mapped[row.userId] = {
          dayOpenedAt: toHHMM(row.dayOpenedAt),
          dayClosedAt: toHHMM(row.dayClosedAt),
          useCustomTimes: !!row.useCustomTimes,
        };
      });
      setUserTimes(mapped);
      setLoading((p) => ({ ...p, userTimes: false }));
    }
    if (userTimesError) {
      setError(`Failed to load open/close times: ${userTimesError.message}`);
      setLoading((p) => ({ ...p, userTimes: false }));
    }
  }, [userTimesData, userTimesError]);

  const handleUserChange = (id, field, value) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, [field]: field === "immediate_supervisor" ? (value ? parseInt(value) : null) : value } : u)));
  };

  const handleUserMriRoleChange = (userId, roles) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, mriRoles: roles.filter((role) => mriRoles.includes(role)) } : u)));
  };

  const handleUserTimeToggle = (userId, checked) => {
    setUserTimes((prev) => ({ ...prev, [userId]: { dayOpenedAt: prev[userId]?.dayOpenedAt || "", dayClosedAt: prev[userId]?.dayClosedAt || "", useCustomTimes: !!checked } }));
  };

  const handleUserTimeChange = (userId, field, value) => {
    setUserTimes((prev) => ({ ...prev, [userId]: { dayOpenedAt: field === "dayOpenedAt" ? value : prev[userId]?.dayOpenedAt || "", dayClosedAt: field === "dayClosedAt" ? value : prev[userId]?.dayClosedAt || "", useCustomTimes: prev[userId]?.useCustomTimes ?? true } }));
  };

  const saveTeamChanges = async () => {
    setSaving((p) => ({ ...p, team: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: users }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Save failed: ${res.status}`);
      setSuccess("Team changes saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=team");
    } catch (err) {
      setError(`Error saving team: ${err.message}`);
    } finally {
      setSaving((p) => ({ ...p, team: false }));
    }
  };

  const refreshTeam = async () => {
    await mutate("/api/admin/manageMeedian?section=team");
  };

  const saveUserTimesChanges = async () => {
    setSaving((p) => ({ ...p, userTimes: true }));
    setError("");
    setSuccess("");
    try {
      const updates = Object.entries(userTimes).map(([userId, v]) => ({
        userId: parseInt(userId, 10),
        useCustomTimes: !!v.useCustomTimes,
        dayOpenedAt: v.useCustomTimes ? ensureSeconds(v.dayOpenedAt) : null,
        dayClosedAt: v.useCustomTimes ? ensureSeconds(v.dayClosedAt) : null,
      }));
      const res = await fetch("/api/admin/manageMeedian?section=userOpenCloseTimes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Save failed: ${res.status}`);
      setSuccess("Per-user open/close times saved!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=userOpenCloseTimes");
    } catch (err) {
      setError(`Error saving per-user times: ${err.message}`);
    } finally {
      setSaving((p) => ({ ...p, userTimes: false }));
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
      <Team
        users={users}
        setUsers={setUsers}
        userTimes={userTimes}
        setUserTimes={setUserTimes}
        loading={loading}
        saving={saving}
        setError={setError}
        setSuccess={setSuccess}
        setConfirmDeleteUser={setConfirmDeleteUser}
        userTypes={userTypes}
        roleTypes={roleTypes}
        memberScopes={memberScopes}
        teamManagerTypes={teamManagerTypes}
        mriRoles={mriRoles}
        userMriRoles={userMriRoles}
        saveTeamChanges={saveTeamChanges}
        saveUserTimesChanges={saveUserTimesChanges}
        handleUserChange={handleUserChange}
        handleUserTimeToggle={handleUserTimeToggle}
        handleUserTimeChange={handleUserTimeChange}
        handleUserMriRoleChange={handleUserMriRoleChange}
        refreshTeam={refreshTeam}
      />

      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Remove User</h2>
            <p className="text-gray-600">
              Are you sure you want to permanently remove <span className="font-semibold">{confirmDeleteUser.name}</span>?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteUser(null)} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800">Cancel</button>
              <button
                onClick={async () => {
                  setSaving((p) => ({ ...p, team: true }));
                  setError("");
                  setSuccess("");
                  try {
                    const res = await fetch("/api/admin/manageMeedian?section=team", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId: confirmDeleteUser.id }),
                    });
                    const responseData = await res.json();
                    if (!res.ok) throw new Error(responseData.error || `Delete failed: ${res.status}`);
                    setUsers((prev) => prev.filter((u) => u.id !== confirmDeleteUser.id));
                    setUserTimes((prev) => {
                      const c = { ...prev };
                      delete c[confirmDeleteUser.id];
                      return c;
                    });
                    setUserMriRoles((prev) => {
                      const c = { ...prev };
                      delete c[confirmDeleteUser.id];
                      return c;
                    });
                    setSuccess(`Deleted user: ${confirmDeleteUser.name}`);
                    setTimeout(() => setSuccess(""), 3000);
                    await mutate("/api/admin/manageMeedian?section=team");
                    await mutate("/api/admin/manageMeedian?section=userOpenCloseTimes");
                  } catch (err) {
                    setError(`Error deleting user: ${err.message}`);
                  } finally {
                    setSaving((p) => ({ ...p, team: false }));
                    setConfirmDeleteUser(null);
                  }
                }}
                disabled={saving.team}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
              >
                {saving.team ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
