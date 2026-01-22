"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { AlertTriangle, RefreshCw, ShieldAlert, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

const fetcher = async (url) => {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (res.status === 401) {
    const payload = await res.json().catch(() => ({}));
    const error = new Error(payload?.error || "unauthorized");
    error.status = 401;
    throw error;
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || `HTTP ${res.status}`);
  }
  return res.json();
};

const AD_CATEGORIES = [
  { key: "punctuality", label: "Punctuality" },
  { key: "academics", label: "Academics" },
  { key: "obedienceDiscipline", label: "Obedience & Discipline" },
  { key: "languagePersonality", label: "Language & Personality" },
  { key: "willSkill", label: "Will Skill" },
];
const IPR_METRICS = [
  { key: "punctuality", label: "Punctuality" },
  { key: "academics", label: "Academics" },
  { key: "obedienceDiscipline", label: "Obedience & Discipline" },
  { key: "languagePersonality", label: "Language & Personality" },
  { key: "willSkill", label: "Will Skill" },
];

const CATEGORY_LABELS = AD_CATEGORIES.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {});

const POINTS_PER_AD = 5;

const pad2 = (value) => String(value).padStart(2, "0");

const toLocalInput = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const toMonthInput = (date = new Date()) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [form, setForm] = useState({
    memberId: "",
    category: "punctuality",
    occurredAt: toLocalInput(),
    evidence: "",
    notes: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(toMonthInput());
  const [convertTarget, setConvertTarget] = useState(null);
  const [convertForm, setConvertForm] = useState({ title: "", note: "", l1AssigneeId: "" });
  const [convertBusy, setConvertBusy] = useState(false);
  const [convertError, setConvertError] = useState("");
  const [showIprModal, setShowIprModal] = useState(false);
  const [iprDate, setIprDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, error: loadError, isLoading, mutate } = useSWR("/api/managersCommon/ads", fetcher);
  const { data: usersData } = useSWR("/api/member/users", fetcher, { dedupingInterval: 60000 });
  const {
    data: iprData,
    error: iprError,
    isLoading: iprLoading,
    mutate: mutateIpr,
  } = useSWR(showIprModal ? `/api/member/ipr?date=${iprDate}&summary=all` : null, fetcher);

  const entries = useMemo(() => data?.entries || [], [data?.entries]);
  const canWrite = isAdmin || data?.canWrite === true;
  const canWriteResolved = isAdmin || typeof data?.canWrite === "boolean";
  const users = useMemo(() => usersData?.users || [], [usersData?.users]);
  const members = useMemo(
    () =>
      users
        .filter((user) => user.active !== false && user.role !== "admin")
        .slice()
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [users]
  );
  const assigners = useMemo(
    () =>
      users
        .filter((user) => ["admin", "team_manager"].includes(user.role))
        .slice()
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [users]
  );

  const unauthorized = loadError?.status === 401;

  const filteredEntries = useMemo(() => {
    const queryText = query.trim().toLowerCase();
    const monthValue = monthFilter ? monthFilter.split("-") : [];
    const filterYear = monthValue.length === 2 ? Number(monthValue[0]) : null;
    const filterMonth = monthValue.length === 2 ? Number(monthValue[1]) : null;
    return entries.filter((entry) => {
      if (categoryFilter !== "all" && entry.category !== categoryFilter) return false;
      if (queryText) {
        const haystack = [
          entry.memberName,
          entry.createdByName,
          entry.evidence,
          entry.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(queryText)) return false;
      }
      if (filterYear && filterMonth) {
        const baseDate = entry.occurredAt || entry.createdAt;
        const parsed = baseDate ? new Date(baseDate) : null;
        if (!parsed || Number.isNaN(parsed.getTime())) return false;
        if (parsed.getFullYear() !== filterYear || parsed.getMonth() + 1 !== filterMonth) {
          return false;
        }
      }
      return true;
    });
  }, [entries, categoryFilter, query, monthFilter]);

  const memberTotals = useMemo(() => {
    const map = new Map();
    filteredEntries.forEach((entry) => {
      const key = entry.memberId || "unknown";
      const points = Number.isFinite(entry.points) ? entry.points : POINTS_PER_AD;
      if (!map.has(key)) {
        map.set(key, {
          memberId: entry.memberId,
          memberName: entry.memberName || `User #${entry.memberId}`,
          ads: 0,
          points: 0,
        });
      }
      const current = map.get(key);
      current.ads += 1;
      current.points += points;
    });
    return Array.from(map.values()).sort((a, b) => (a.memberName || "").localeCompare(b.memberName || ""));
  }, [filteredEntries]);

  const resetForm = () =>
    setForm((prev) => ({
      ...prev,
      memberId: "",
      occurredAt: toLocalInput(),
      evidence: "",
      notes: "",
    }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setMessage("");

    if (!canWrite) {
      setError("You are not allowed to log ADs.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    if (!form.memberId || !form.category || !form.occurredAt || !form.evidence.trim()) {
      setError("Member, category, time, and evidence are required.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/managersCommon/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: Number(form.memberId),
          category: form.category,
          occurredAt: form.occurredAt,
          evidence: form.evidence.trim(),
          notes: form.notes.trim(),
          points: POINTS_PER_AD,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to save AD.");
      setMessage("AD logged successfully.");
      resetForm();
      await mutate();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to log AD.");
    } finally {
      setSaving(false);
      setTimeout(() => {
        setMessage("");
        setError("");
      }, 2500);
    }
  };

  const openConvert = (entry) => {
    if (!entry) return;
    setConvertTarget(entry);
    setConvertForm({
      title: `AD: ${entry.memberName || "Member"} - ${CATEGORY_LABELS[entry.category] || entry.category}`,
      note: entry.evidence ? `Evidence: ${entry.evidence}` : "",
      l1AssigneeId: "",
    });
    setConvertError("");
  };

  const closeConvert = () => {
    if (convertBusy) return;
    setConvertTarget(null);
    setConvertError("");
  };

  const closeIprModal = () => setShowIprModal(false);

  const handleToggleHidden = async (entry) => {
    if (!entry || !isAdmin) return;
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/managersCommon/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: entry.id, hidden: !entry.isHidden }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update visibility.");
      setMessage(entry.isHidden ? "AD is now visible." : "AD is now hidden.");
      await mutate();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to update AD visibility.");
    } finally {
      setTimeout(() => {
        setMessage("");
        setError("");
      }, 2500);
    }
  };

  const handleConvert = async () => {
    if (!convertTarget) return;
    if (!convertForm.title.trim()) {
      setConvertError("Escalation title is required.");
      return;
    }
    if (!convertForm.l1AssigneeId) {
      setConvertError("Select an L1 escalation owner.");
      return;
    }

    setConvertBusy(true);
    setConvertError("");
    try {
      const involvedUserIds = Array.from(
        new Set([convertTarget.memberId, convertTarget.createdBy].filter(Boolean))
      );
      const res = await fetch("/api/managersCommon/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: convertForm.title.trim(),
          description: convertForm.note.trim() || null,
          l1AssigneeId: Number(convertForm.l1AssigneeId),
          involvedUserIds,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to create escalation.");

      const linkRes = await fetch("/api/managersCommon/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: convertTarget.id, matterId: payload.id }),
      });
      const linkPayload = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok) throw new Error(linkPayload?.error || "Failed to link escalation.");

      setMessage("Escalation created and linked.");
      await mutate();
      closeConvert();
    } catch (err) {
      console.error(err);
      setConvertError(err.message || "Failed to convert AD to escalation.");
    } finally {
      setConvertBusy(false);
      setTimeout(() => {
        setMessage("");
        setConvertError("");
      }, 2500);
    }
  };

  if (unauthorized) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Card>
          <CardHeader>
            <h1 className="text-lg font-semibold text-gray-900">AD Tracker</h1>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">
              You do not have access to AD tracking. Please contact the admin team for access.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-800">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="text-2xl font-semibold">AD Tracker</h1>
          </div>
          <Button variant="light" size="sm" onClick={() => setShowIprModal(true)}>
            Show IPR
          </Button>
        </div>
        <p className="text-sm text-slate-600">
          Log discrepancies or deviations from plan against IPR categories, attach evidence, and convert to escalation when needed.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Raise an AD</h2>
                <p className="text-sm text-gray-600">Each AD deducts {POINTS_PER_AD} marks from the IPR scorecard.</p>
              </div>
              <Button
                variant="light"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => mutate()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
              {!canWrite && canWriteResolved && (
                <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Only selected managers can log ADs. Contact the admin team for access.
                </div>
              )}
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor="ad-member">
                  Member
                </label>
                <select
                  id="ad-member"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.memberId}
                  onChange={(event) => setForm((prev) => ({ ...prev, memberId: event.target.value }))}
                  disabled={!canWrite}
                >
                  <option value="">Select member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name || `User #${member.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor="ad-category">
                  Category
                </label>
                <select
                  id="ad-category"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  disabled={!canWrite}
                >
                  {AD_CATEGORIES.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor="ad-occurred">
                  When
                </label>
                <input
                  id="ad-occurred"
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.occurredAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, occurredAt: event.target.value }))}
                  disabled={!canWrite}
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor="ad-evidence">
                  Evidence
                </label>
                <input
                  id="ad-evidence"
                  type="text"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.evidence}
                  onChange={(event) => setForm((prev) => ({ ...prev, evidence: event.target.value }))}
                  placeholder="CCTV link, attendance log, or witness note"
                  disabled={!canWrite}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="ad-notes">
                  Notes (optional)
                </label>
                <textarea
                  id="ad-notes"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Context, follow-up, or IS remarks"
                  disabled={!canWrite}
                />
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={saving || !canWrite}>
                  {saving ? "Saving..." : "Log AD"}
                </Button>
                {(message || error) && (
                  <span className={`text-sm ${error ? "text-red-600" : "text-emerald-600"}`}>
                    {error || message}
                  </span>
                )}
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-rose-100 p-2 text-rose-700">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">AD scoring guidance</h2>
                <p className="text-sm text-gray-600">
                  ADs flag deviations from plan. Each AD deducts 5 marks from the member it is raised against; IPR totals are tracked at 250 per week and 1000 per month.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span>Active month</span>
              <input
                type="month"
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
              />
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span>Member totals</span>
                <span>Ads / Points</span>
              </div>
              {memberTotals.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">No ADs logged for this month.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {memberTotals.map((row) => (
                    <div key={row.memberId || row.memberName} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{row.memberName}</span>
                      <span className="font-semibold text-gray-900">
                        {row.ads} / -{Math.abs(row.points)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Use the ledger below to audit repeated deviations and convert serious matters into escalations.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">AD ledger</h2>
              <p className="text-sm text-gray-600">Filter, review evidence, and escalate recurring deviations.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Search name or evidence"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">All categories</option>
                {AD_CATEGORIES.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <p className="text-sm text-gray-600">Loading ADs...</p>
          ) : filteredEntries.length === 0 ? (
            <p className="text-sm text-gray-600">No ADs logged for the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2">Member</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Evidence</th>
                    <th className="px-3 py-2">Points deducted</th>
                    <th className="px-3 py-2">Raised by</th>
                    <th className="px-3 py-2">Escalation</th>
                    {isAdmin && <th className="px-3 py-2">Visibility</th>}
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="px-3 py-2 text-gray-900">{entry.memberName || `User #${entry.memberId}`}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {CATEGORY_LABELS[entry.category] || entry.category || "-"}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{formatDateTime(entry.occurredAt)}</td>
                      <td className="px-3 py-2 text-gray-600">
                        <span className="block max-w-[220px] truncate">{entry.evidence || "-"}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">-{Math.abs(entry.points ?? POINTS_PER_AD)}</td>
                      <td className="px-3 py-2 text-gray-600">{entry.createdByName || "-"}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {entry.escalationMatterId ? (
                          <span className="text-emerald-700">
                            Matter #{entry.escalationMatterId}
                            {entry.escalationStatus ? ` - ${entry.escalationStatus}` : ""}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not linked</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2 text-gray-600">
                          {entry.isHidden ? (
                            <span className="text-rose-600">Hidden</span>
                          ) : (
                            <span className="text-emerald-700">Visible</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {entry.escalationMatterId ? (
                            <span className="text-xs text-gray-500">-</span>
                          ) : (
                            <Button size="xs" variant="light" onClick={() => openConvert(entry)}>
                              Convert
                            </Button>
                          )}
                          {isAdmin && (
                            <Button size="xs" variant="light" onClick={() => handleToggleHidden(entry)}>
                              {entry.isHidden ? "Unhide" : "Hide"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {convertTarget && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Convert AD to escalation</h3>
                <p className="text-xs text-gray-500">
                  {convertTarget.memberName || `User #${convertTarget.memberId}`} -{" "}
                  {CATEGORY_LABELS[convertTarget.category] || convertTarget.category}
                </p>
              </div>
              <button
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={closeConvert}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Escalation title</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={convertForm.title}
                  onChange={(event) => setConvertForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">L1 owner</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={convertForm.l1AssigneeId}
                  onChange={(event) => setConvertForm((prev) => ({ ...prev, l1AssigneeId: event.target.value }))}
                >
                  <option value="">Select owner</option>
                  {assigners.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || `User #${user.id}`} ({user.role?.replace("_", " ")})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Escalation note</label>
                <textarea
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={convertForm.note}
                  onChange={(event) => setConvertForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="Summary for escalation owners"
                />
              </div>
              {convertError && <p className="text-sm text-red-600">{convertError}</p>}
              <div className="flex items-center justify-end gap-3">
                <Button variant="light" onClick={closeConvert} disabled={convertBusy}>
                  Cancel
                </Button>
                <Button onClick={handleConvert} disabled={convertBusy}>
                  {convertBusy ? "Converting..." : "Create escalation"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showIprModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">IPR Overview</h3>
                <p className="text-xs text-gray-500">Existing IPR scores for the selected date.</p>
              </div>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={closeIprModal}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Date</span>
                  <input
                    type="date"
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    value={iprDate}
                    onChange={(event) => setIprDate(event.target.value)}
                  />
                </div>
                <Button variant="light" size="sm" onClick={() => mutateIpr()} disabled={iprLoading}>
                  <RefreshCw className={`h-4 w-4 ${iprLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {iprError ? (
                <p className="text-sm text-red-600">{iprError.message || "Failed to load IPR."}</p>
              ) : iprLoading ? (
                <p className="text-sm text-gray-600">Loading IPR...</p>
              ) : !iprData?.scores?.length ? (
                <p className="text-sm text-gray-600">No IPR scores found for this date.</p>
              ) : (
                <div className="overflow-auto border border-amber-100 rounded-xl max-h-[60vh]">
                  <table className="min-w-full text-xs">
                    <thead className="bg-amber-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-amber-800">Member</th>
                        {IPR_METRICS.map((metric) => (
                          <th key={metric.key} className="px-3 py-2 text-center font-semibold text-amber-800">
                            {metric.label}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center font-semibold text-amber-800">Total</th>
                        <th className="px-3 py-2 text-left font-semibold text-amber-800">Evaluator</th>
                      </tr>
                    </thead>
                    <tbody>
                      {iprData.scores.map((entry) => (
                        <tr key={entry.userId} className="odd:bg-white even:bg-amber-50/40">
                          <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">
                            {entry.userName || `Member #${entry.userId}`}
                          </td>
                          {IPR_METRICS.map((metric) => (
                            <td key={metric.key} className="px-3 py-2 text-center text-gray-700">
                              {entry.metrics?.[metric.key] ?? 0}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center font-semibold text-amber-700">
                            {entry.total ?? 0} / 50
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {entry.evaluator?.name || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
