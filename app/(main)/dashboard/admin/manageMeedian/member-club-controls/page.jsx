"use client";
import React from "react";
import useSWR from "swr";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

const MEMBER_FEATURES = [
  {
    key: "guardianGateLogs",
    label: "Guardian & Visitor Register",
    description: "Allow members to log guardian/visitor entries and queues.",
  },
  {
    key: "guardianCalls",
    label: "Guardian Call Log",
    description: "Allow members to log and view guardian call reports.",
  },
  {
    key: "grm",
    label: "Guardian Relationship Manager",
    description: "Allow members to access King's Place (GRM).",
  },
  {
    key: "ptAssist",
    label: "CCD / CDD Help",
    description: "Allow members to open CCD/CDD help tools.",
  },
  {
    key: "hostelDueReport",
    label: "Hostel Due Report",
    description: "Allow members to view hostel due reports (read-only).",
  },
  {
    key: "studentsRead",
    label: "Student Register (Read-only)",
    description: "Allow members to view student register without edits.",
  },
  {
    key: "mgcpLeads",
    label: "Student Enquiry",
    description: "Allow members to log admission enquiries (Random Leads).",
  },
];

export default function MemberClubControlsPage() {
  const { data, mutate } = useSWR("/api/admin/manageMeedian?section=memberClubShare", fetcher);
  const [saving, setSaving] = React.useState(false);
  const members = data?.members || [];
  const grants = data?.grants || [];
  const grantSet = React.useMemo(() => {
    const s = new Set();
    for (const g of grants) s.add(`${g.userId}|${g.section}`);
    return s;
  }, [grants]);
  const [draft, setDraft] = React.useState({});
  const grantSig = React.useMemo(
    () => JSON.stringify(grants.map((g) => [g.userId, g.section]).sort()),
    [grants]
  );

  React.useEffect(() => {
    const init = {};
    for (const g of grants) init[`${g.userId}|${g.section}`] = true;
    setDraft(init);
  }, [grantSig]);

  const toggle = (uid, section) =>
    setDraft((prev) => ({ ...prev, [`${uid}|${section}`]: !prev[`${uid}|${section}`] }));

  const onSave = async () => {
    setSaving(true);
    try {
      const items = [];
      for (const m of members) {
        for (const f of MEMBER_FEATURES) {
          const key = `${m.id}|${f.key}`;
          const want = !!draft[key];
          const had = grantSet.has(key);
          if (want && !had) items.push({ userId: m.id, section: f.key, canWrite: true });
          if (!want && had) items.push({ userId: m.id, section: f.key, remove: true });
        }
      }
      if (!items.length) return;
      const res = await fetch("/api/admin/manageMeedian?section=memberClubShare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grants: items }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      await mutate();
      alert("Saved");
    } catch (e) {
      console.error(e);
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Member Club Controls</h1>
          <p className="text-sm text-gray-600">
            Choose which Member Club tools to share with non-managers.
          </p>
        </div>
        <button
          className="px-3 py-1.5 rounded-lg border text-sm bg-teal-600 text-white border-teal-600 disabled:opacity-60"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div className="grid gap-4">
        {MEMBER_FEATURES.map((feature) => (
          <div key={feature.key} className="rounded-2xl border bg-white p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{feature.label}</h2>
              <p className="text-xs text-gray-600">{feature.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {members.length ? (
                members.map((m) => {
                  const key = `${m.id}|${feature.key}`;
                  const checked = !!draft[key] || grantSet.has(key);
                  return (
                    <label
                      key={key}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                        checked
                          ? "border-teal-200 bg-teal-50 text-teal-800"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(m.id, feature.key)}
                      />
                      {m.name || `User #${m.id}`}
                    </label>
                  );
                })
              ) : (
                <span className="text-xs text-slate-500">No members found.</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
