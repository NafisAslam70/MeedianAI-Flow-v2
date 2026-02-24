"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LeaveRequestPage({ basePath = "/dashboard/member/profile" }) {
  const { data: session } = useSession();
  const router = useRouter();
  const proofRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [users, setUsers] = useState([]);
  const [config, setConfig] = useState({
    proofRequired: false,
    noticePolicy: { allowAnytime: false, minNoticeDays: 2 },
  });
  const [form, setForm] = useState({
    startDate: "",
    endDate: "",
    reason: "",
    category: "personal",
    transferTo: "",
    convertToCl: false,
    proof: null,
  });

  const isTeamManager = session?.user?.role === "team_manager";

  const noticeText = useMemo(() => {
    if (config.noticePolicy?.allowAnytime) return "Other leave types can be applied anytime.";
    const d = Number(config.noticePolicy?.minNoticeDays || 2);
    return `Other leave types require at least ${d} day${d === 1 ? "" : "s"} notice.`;
  }, [config.noticePolicy]);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await fetch("/api/member/leave-request", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (!dead) setConfig(data?.config || config);
      } catch (e) {
        if (!dead) setError(e.message || "Failed to load leave settings");
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isTeamManager) return;
    let dead = false;
    (async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch("/api/member/users", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (!dead) setUsers(Array.isArray(data?.users) ? data.users : []);
      } catch (e) {
        if (!dead) setError(e.message || "Failed to load users");
      } finally {
        if (!dead) setLoadingUsers(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [isTeamManager]);

  const onChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setForm((p) => ({
      ...p,
      [name]: files ? files[0] : type === "checkbox" ? checked : value,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const fd = new FormData();
      fd.append("startDate", form.startDate);
      fd.append("endDate", form.endDate);
      fd.append("reason", form.reason);
      fd.append("category", form.category);
      fd.append("convertToCl", form.convertToCl ? "true" : "false");
      if (form.proof) fd.append("proof", form.proof);
      if (isTeamManager && form.transferTo) fd.append("transferTo", form.transferTo);

      const res = await fetch("/api/member/leave-request", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSuccess("Leave request submitted.");
      setForm({
        startDate: "",
        endDate: "",
        reason: "",
        category: "personal",
        transferTo: "",
        convertToCl: false,
        proof: null,
      });
      if (proofRef.current) proofRef.current.value = "";
    } catch (e2) {
      setError(e2.message || "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 md:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Leave Request</h1>
        <button
          type="button"
          onClick={() => router.push(basePath)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600"
        >
          Back to Profile
        </button>
      </div>
      {error && <p className="mb-3 text-sm text-red-700 bg-red-100 rounded p-2">{error}</p>}
      {success && <p className="mb-3 text-sm text-green-700 bg-green-100 rounded p-2">{success}</p>}

      <form onSubmit={submit} className="grid gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium">Start Date</label>
            <input className="w-full mt-1 px-3 py-2 border rounded-lg" type="date" name="startDate" value={form.startDate} onChange={onChange} required />
          </div>
          <div>
            <label className="text-xs font-medium">End Date</label>
            <input className="w-full mt-1 px-3 py-2 border rounded-lg" type="date" name="endDate" value={form.endDate} onChange={onChange} required />
          </div>
          <div>
            <label className="text-xs font-medium">Category</label>
            <select className="w-full mt-1 px-3 py-2 border rounded-lg" name="category" value={form.category} onChange={onChange}>
              <option value="health">Health</option>
              <option value="event">Event</option>
              <option value="break">Break</option>
              <option value="personal">Personal</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500">{noticeText}</p>
        <div>
          <label className="text-xs font-medium">Reason</label>
          <textarea className="w-full mt-1 px-3 py-2 border rounded-lg min-h-[120px]" name="reason" value={form.reason} onChange={onChange} required />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="convertToCl" checked={form.convertToCl} onChange={onChange} />
          Convert to monthly CL
        </label>
        <div>
          <label className="text-xs font-medium">Supporting Document {config.proofRequired ? "(Required)" : "(Optional)"}</label>
          <input ref={proofRef} className="w-full mt-1 px-3 py-2 border rounded-lg" type="file" name="proof" accept=".pdf,.doc,.docx,.jpg,.png" onChange={onChange} required={config.proofRequired} />
        </div>
        {isTeamManager && (
          <div>
            <label className="text-xs font-medium">Transfer Role To (Optional)</label>
            <select className="w-full mt-1 px-3 py-2 border rounded-lg" name="transferTo" value={form.transferTo} onChange={onChange}>
              <option value="">Select user</option>
              {!loadingUsers &&
                users
                  .filter((u) => Number(u.id) !== Number(session?.user?.id) && (u.role === "admin" || u.role === "team_manager"))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
            </select>
          </div>
        )}
        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm disabled:opacity-60">
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </form>
    </div>
  );
}

