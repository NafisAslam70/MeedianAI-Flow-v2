"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Plus, RefreshCw, Save, Trash2, ArrowLeft, Megaphone } from "lucide-react";
import Link from "next/link";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

const todayIso = () => new Date().toISOString().slice(0, 10);

const normaliseActions = (actions) =>
  Array.isArray(actions) ? actions.filter(Boolean) : [];

const DEFAULT_CALL_RATE = 0.7;
const DEFAULT_CALL_PITCH = 1.0;

const romanToArabicWord = (label = "") => {
  const map = {
    I: "one",
    II: "two",
    III: "three",
    IV: "four",
    V: "five",
    VI: "six",
    VII: "seven",
    VIII: "eight",
    IX: "nine",
    X: "ten",
  };
  const parts = String(label).split(/\s+/);
  const converted = parts.map((part) => map[part.toUpperCase()] || part.toLowerCase());
  return converted.join(" ");
};

const speakifyName = (name = "") => {
  if (!name) return "";
  const clean = name.replace(/[^A-Za-z\s'-]/g, " ").replace(/\s+/g, " ").trim();
  return clean
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

export default function HostelDefaultersPage() {
  const { data: session } = useSession();
  const selfId = session?.user?.id ? String(session.user.id) : "";
  const selfName = session?.user?.name || "Assigned dean";
  const [form, setForm] = useState({
    reportDate: todayIso(),
    siteId: 1,
    assignedToUserId: "",
    defaulters: [
      { id: `df-${Date.now()}`, studentId: "", defaulterType: "", reason: "", actions: [] },
    ],
    actionsByCategory: [],
  });
  const lastLoadedKey = useRef("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callLines, setCallLines] = useState([]);
  const [callIndex, setCallIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("capture"); // capture | analysis
  const [voicePref, setVoicePref] = useState("female"); // female | male | auto
  const [statsRange, setStatsRange] = useState(() => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startObj = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);
    const start = startObj.toISOString().slice(0, 10);
    return { start, end };
  });

  const supportingKey =
    form.reportDate && form.assignedToUserId
      ? `/api/reports/academic-health?mode=supporting&reportDate=${form.reportDate}&assignedToUserId=${form.assignedToUserId}`
      : null;

  // Load existing report for the date/site (regardless of who created it)
  const existingKey =
    form.reportDate
      ? `/api/admin/admin-club/hostel-defaulters?reportDate=${form.reportDate}&siteId=${form.siteId || 1}`
      : null;

  const {
    data: supporting,
    error: supportingError,
    isLoading: supportLoading,
    mutate: refreshSupporting,
  } = useSWR(
    supportingKey,
    fetcher,
    { dedupingInterval: 0 }
  );

  const statsKey =
    form.assignedToUserId && statsRange.start && statsRange.end
      ? `/api/admin/admin-club/hostel-defaulters/stats?startDate=${statsRange.start}&endDate=${statsRange.end}&assignedToUserId=${form.assignedToUserId}`
      : null;
  const { data: statsData, isLoading: statsLoading, error: statsError, mutate: refreshStats } = useSWR(statsKey, fetcher, {
    dedupingInterval: 30_000,
  });

  const { data: existingReport, isLoading: existingLoading } = useSWR(existingKey, fetcher, {
    dedupingInterval: 5_000,
  });

  const teamOptions = useMemo(() => {
    const users = supporting?.teachers || [];
    return users
      .map((u) => ({ value: String(u.id), label: u.name || `User #${u.id}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [supporting?.teachers]);

  // Default to self when session arrives
  useEffect(() => {
    if (!form.assignedToUserId && selfId && !existingReport?.report?.assignedToUserId) {
      setForm((prev) => ({ ...prev, assignedToUserId: selfId }));
    }
  }, [selfId, form.assignedToUserId, existingReport?.report?.assignedToUserId]);

  // Load existing defaulters for the selected date/assignee so the form isn't blank.
  useEffect(() => {
    const key = existingKey || "";
    if (!key || existingLoading) return;
    if (lastLoadedKey.current === key) return;
    const rows = existingReport?.report?.defaulters || [];
    const actionsByCatMap = (existingReport?.report?.actionsByCategory || []).reduce((acc, row) => {
      if (row?.category) acc[row.category] = normaliseActions(row.actions);
      return acc;
    }, {});
    if (!rows.length) {
      lastLoadedKey.current = key;
      return;
    }
    const hydrated = rows.map((row, idx) => ({
      id: row.id || row.studentId || `df-${idx}-${Date.now()}`,
      studentId: row.studentId ? String(row.studentId) : "",
      defaulterType: row.defaulterType || "",
      reason: row.reason || "",
      actions: normaliseActions(row.actions)?.length
        ? normaliseActions(row.actions)
        : normaliseActions(actionsByCatMap[row.defaulterType]),
    }));
    setForm((prev) => ({
      ...prev,
      assignedToUserId:
        existingReport?.report?.assignedToUserId
          ? String(existingReport.report.assignedToUserId)
          : prev.assignedToUserId,
      defaulters: hydrated,
      actionsByCategory: existingReport?.report?.actionsByCategory || prev.actionsByCategory,
    }));
    setMessage("Loaded existing defaulters for this date.");
    lastLoadedKey.current = key;
  }, [existingKey, existingReport, existingLoading]);

  const classLabelById = useMemo(() => {
    const map = new Map();
    (supporting?.classes || []).forEach((klass) => {
      map.set(
        Number(klass.id),
        klass.label || klass.name || `Class #${klass.id}`
      );
    });
    return map;
  }, [supporting?.classes]);

  const studentOptions = useMemo(() => {
    return (supporting?.students || []).map((s) => ({
      id: s.id,
      name: s.name || `Student #${s.id}`,
      classId: s.classId,
      label: `${s.name || `Student #${s.id}`}${
        s.classId ? ` — ${classLabelById.get(Number(s.classId)) || `Class #${s.classId}`}` : ""
      }`,
    }));
  }, [supporting?.students, classLabelById]);
  const studentNameById = useMemo(() => {
    const map = new Map();
    (supporting?.students || []).forEach((s) => map.set(Number(s.id), s.name || `Student #${s.id}`));
    return map;
  }, [supporting?.students]);
  const defaulterOptions = useMemo(() => supporting?.defaulterTypes || [], [supporting?.defaulterTypes]);
  const actionsCatalog = useMemo(() => supporting?.actionsCatalog || [], [supporting?.actionsCatalog]);

  const rollcallRows = useMemo(() => {
    const rows = [];
    (form.defaulters || []).forEach((row) => {
      if (!row.studentId) return;
      const student = studentOptions.find((s) => String(s.id) === String(row.studentId));
      const name = student?.name || `Student #${row.studentId}`;
      const classLabel = student?.classId
        ? classLabelById.get(Number(student.classId)) || `Class #${student.classId}`
        : "—";
      rows.push({
        id: row.id || row.studentId,
        name,
        classLabel,
        category: row.defaulterType || "",
        reason: row.reason || "",
      });
    });
    return rows;
  }, [form.defaulters, studentOptions, classLabelById]);

  const setDefaulter = (idx, updater) => {
    setForm((prev) => {
      const rows = prev.defaulters.slice();
      rows[idx] = updater(rows[idx]);
      return { ...prev, defaulters: rows };
    });
  };

  const addDefaulter = () =>
    setForm((prev) => ({
      ...prev,
      defaulters: [
        ...prev.defaulters,
        { id: `df-${Date.now()}`, studentId: "", defaulterType: "", reason: "", actions: [] },
      ],
    }));

  const removeDefaulter = (idx) =>
    setForm((prev) => {
      const rows = prev.defaulters.slice();
      rows.splice(idx, 1);
      return {
        ...prev,
        defaulters:
          rows.length
            ? rows
            : [{ id: `df-${Date.now()}`, studentId: "", defaulterType: "", reason: "", actions: [] }],
      };
    });

  const toggleRowAction = (rowIdx, actionValue) => {
    setForm((prev) => {
      const rows = prev.defaulters.map((r) => ({
        ...r,
        actions: Array.isArray(r.actions) ? [...r.actions] : [],
      }));
      const current = rows[rowIdx] || { actions: [] };
      const set = new Set(current.actions || []);
      if (set.has(actionValue)) set.delete(actionValue);
      else set.add(actionValue);
      rows[rowIdx] = { ...current, actions: Array.from(set) };
      return { ...prev, defaulters: rows };
    });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        reportDate: form.reportDate,
        siteId: Number(form.siteId) || 1,
        assignedToUserId: Number(form.assignedToUserId),
        defaulters: form.defaulters
          .filter((row) => row.studentId && row.defaulterType)
          .map((row) => ({
            studentId: Number(row.studentId),
            defaulterType: row.defaulterType,
            reason: row.reason || "",
            actions: normaliseActions(row.actions),
          })),
        actionsByCategory: Object.values(
          form.defaulters.reduce((acc, row) => {
            if (!row.defaulterType) return acc;
            const key = row.defaulterType;
            const set = new Set(acc[key]?.actions || []);
            normaliseActions(row.actions).forEach((a) => set.add(a));
            acc[key] = { category: key, actions: Array.from(set) };
            return acc;
          }, {})
        ),
      };
      const send = async (extra = {}) => {
        const res = await fetch("/api/admin/admin-club/hostel-defaulters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, ...extra }),
        });
        const json = await res.json();
        if (!res.ok) throw Object.assign(new Error(json?.error || `HTTP ${res.status}`), { status: res.status, payload: json });
        return json;
      };

      let json;
      try {
        json = await send();
      } catch (err) {
        if (err.status === 409 && err.payload?.conflict) {
          const choice = window.prompt(
            "A report already exists for this date and dean.\nType O to override, E to extend, or anything else to cancel."
          );
          if (!choice || !["o", "O", "e", "E"].includes(choice.trim())) {
            throw new Error("Cancelled.");
          }
          const mode = choice.trim().toLowerCase() === "o" ? { override: true } : { extend: true };
          json = await send(mode);
        } else {
          throw err;
        }
      }

      setMessage("Saved and synced to AHR.");
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const disabled = !form.assignedToUserId || supportLoading;

  const statusBadge = supportLoading
    ? { text: "Loading data…", tone: "bg-amber-100 text-amber-800" }
    : supportingError
    ? { text: "Data load failed — retry", tone: "bg-rose-100 text-rose-700" }
    : { text: "Data ready", tone: "bg-emerald-100 text-emerald-800" };

  const buildCallLines = () => {
    const groups = new Map();
    (form.defaulters || []).forEach((row) => {
      if (!row.defaulterType || !row.studentId) return;
      const rawName = studentNameById.get(Number(row.studentId)) || `Student #${row.studentId}`;
      const name = speakifyName(rawName);
      const classLabel = (() => {
        const opt = studentOptions.find((s) => String(s.id) === String(row.studentId));
        if (!opt?.classId) return "";
        const cls = classLabelById.get(Number(opt.classId)) || `Class ${opt.classId}`;
        return romanToArabicWord(cls);
      })();
      const display = classLabel ? `${name} from class ${classLabel}` : name;
      const list = groups.get(row.defaulterType) || [];
      list.push(display);
      groups.set(row.defaulterType, list);
    });

    const header =
      "Hello dear students, hope you are well. We will gently call today's defaulters category by category. Please come forward calmly when your name is called.";

    const lines = [];
    defaulterOptions.forEach((opt) => {
      const names = groups.get(opt.value);
      if (names?.length) {
        lines.push(`${opt.label} defaulters:`);
        names.forEach((n, idx) => {
          lines.push(`${idx + 1}. ${n}, please come forward.`);
        });
      }
    });
    if (!lines.length) lines.push("No defaulters recorded for today.");

    const footer =
      "Dear Admin and Warden, kindly handle today’s defaulters. Students, thank you for listening — see you tomorrow, and let’s all stay off this list.";

    return [header, ...lines, footer];
  };

  const pickVoice = (gender = "auto") => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const english = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("en"));

    const maleNames = [
      "Google UK English Male",
      "Google US English",
      "Alex",
      "Daniel",
      "David",
      "Fred",
      "Aaron",
    ];
    const femaleNames = [
      "Google UK English Female",
      "Samantha",
      "Victoria",
      "Fiona",
      "Karen",
      "Moira",
    ];
    const neutralOrder = [
      // Prefer the clearer British female voice the team liked
      "Google UK English Female",
      "Google US English",
      "Samantha",
      "Victoria",
      "en-GB",
      "en-US",
      "English",
    ];

    const pickByNames = (list) => list.map((name) => english.find((v) => v.name === name)).find(Boolean);

    if (gender === "male") {
      const byName =
        pickByNames(maleNames) ||
        english.find((v) => /male/i.test(v.name)) ||
        english.find((v) => /Daniel|Alex|David|Fred/i.test(v.name));
      if (byName) return byName;
    } else if (gender === "female") {
      const byName = pickByNames(femaleNames) || english.find((v) => /female/i.test(v.name));
      if (byName) return byName;
    }

    for (const pref of neutralOrder) {
      const match = english.find((v) => v.name.includes(pref) || v.lang.includes(pref));
      if (match) return match;
    }
    return english[0] || voices[0] || null;
  };

  const speakLine = (line) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setError("Speech playback not supported in this browser.");
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(line);
      const voice = pickVoice(voicePref);
      if (voice) utter.voice = voice;
      utter.lang = voice?.lang || "en-US";
      utter.rate = DEFAULT_CALL_RATE;
      utter.pitch = DEFAULT_CALL_PITCH;
      utter.volume = 1.0;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    } catch (err) {
      setSpeaking(false);
      setError(err.message || "Failed to play script.");
    }
  };

  const openCallModal = () => {
    const lines = buildCallLines();
    setMessage(lines.join("\n"));
    setCallLines(lines);
    setCallIndex(0);
    setCallModalOpen(true);
    speakLine(lines[0] || "");
  };

  const stopScript = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const nextLine = () => {
    if (!callLines.length) return;
    const nextIdx = Math.min(callLines.length - 1, callIndex + 1);
    setCallIndex(nextIdx);
    speakLine(callLines[nextIdx]);
  };

  const prevLine = () => {
    if (!callLines.length) return;
    const prevIdx = Math.max(0, callIndex - 1);
    setCallIndex(prevIdx);
    speakLine(callLines[prevIdx]);
  };

  const closeModal = () => {
    stopScript();
    setCallModalOpen(false);
  };

  return (
    <>
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-600">Managerial Club</p>
            <h1 className="text-2xl font-semibold text-slate-900">Hostel Daily Defaulters</h1>
            <p className="text-sm text-slate-600">
              Capture hostel defaulters and sync directly into the Academic Health Report defaulter table.
            </p>
            <Link
              href="/dashboard/managersCommon/managerial-club"
              className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-teal-700 hover:text-teal-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Managerial Club
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refreshSupporting()} disabled={supportLoading || disabled}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={save} disabled={saving || disabled}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving…" : "Save & Sync"}
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-emerald-600">{message}</p>}
      </header>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
        {[
          { key: "capture", label: "Capture" },
          { key: "analysis", label: "Analysis" },
          { key: "rollcall", label: "Name Calls" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.key
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "capture" && (
        <>
          <Card className="border-slate-100">
            <CardBody>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report date</span>
                  <Input
                    type="date"
                    label=""
                    value={form.reportDate}
                    onChange={(e) => setForm((p) => ({ ...p, reportDate: e.target.value || todayIso() }))}
                    className="w-[170px]"
                  />
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${statusBadge.tone}`}>
                  {statusBadge.text}
                </span>
              </div>
            </CardBody>
          </Card>

          <Card className="border-slate-100">
            <CardHeader className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Defaulters</h2>
                <p className="text-xs text-slate-500">These rows are written into AHR defaulters.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={addDefaulter}>
                <Plus className="mr-1 h-4 w-4" />
                Add row
              </Button>
            </CardHeader>
            <CardBody className="space-y-3">
              {form.defaulters.map((row, idx) => (
                <div key={row.id || idx} className="space-y-2 rounded-xl border border-slate-100 p-3 shadow-[0_6px_18px_-12px_rgba(15,23,42,0.18)]">
                  <div className="grid items-center gap-3 md:grid-cols-4">
                    <div className="text-xs font-semibold text-slate-500">#{idx + 1}</div>
                    <Select
                      value={row.studentId}
                      onChange={(e) => setDefaulter(idx, (r) => ({ ...r, studentId: e.target.value }))}
                    >
                      <option value="">Select student</option>
                      {studentOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={row.defaulterType}
                      onChange={(e) => setDefaulter(idx, (r) => ({ ...r, defaulterType: e.target.value }))}
                    >
                      <option value="">Select category</option>
                      {defaulterOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Reason / notes"
                        value={row.reason}
                        onChange={(e) => setDefaulter(idx, (r) => ({ ...r, reason: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="rounded-md p-2 text-slate-400 hover:text-rose-600"
                        onClick={() => removeDefaulter(idx)}
                        disabled={form.defaulters.length === 1}
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {actionsCatalog.length > 0 && (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
                      <p className="font-semibold text-slate-700 mb-2">Actions for this defaulter</p>
                      <div className="flex flex-wrap gap-2">
                        {actionsCatalog.map((action) => {
                          const active = (row.actions || []).includes(action.value);
                          return (
                            <button
                              key={`${row.id || idx}-${action.value}`}
                              type="button"
                              onClick={() => toggleRowAction(idx, action.value)}
                              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                active
                                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {action.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>
        </>
      )}

      {activeTab === "analysis" && (
        <Card className="border-slate-100">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Defaulter Analysis</h2>
              <p className="text-xs text-slate-500">Snapshot of hostel defaulters pulled from AHR.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Input
                type="date"
                label=""
                value={statsRange.start}
                onChange={(e) => setStatsRange((p) => ({ ...p, start: e.target.value }))}
                className="w-[140px]"
              />
              <Input
                type="date"
                label=""
                value={statsRange.end}
                onChange={(e) => setStatsRange((p) => ({ ...p, end: e.target.value }))}
                className="w-[140px]"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refreshStats()}
                disabled={statsLoading || !statsKey}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Total defaulters</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {statsLoading ? "…" : statsData?.summary?.totalDefaulters ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Unique students</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {statsLoading ? "…" : statsData?.summary?.uniqueStudents ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Top category</p>
                <p className="text-lg font-semibold text-slate-900">
                  {statsLoading ? "…" : statsData?.summary?.topCategory || "—"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">By category</p>
                  {statsError && <span className="text-xs text-rose-600">Failed to load</span>}
                </div>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {(statsData?.categories || []).map((row) => (
                    <div key={row.type} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <span className="capitalize">{row.type.replace(/_/g, " ")}</span>
                      <span className="font-semibold">{row.count}</span>
                    </div>
                  ))}
                  {!statsLoading && !(statsData?.categories || []).length && (
                    <p className="text-xs text-slate-500">No defaulters in this range.</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Top students</p>
                  {statsError && <span className="text-xs text-rose-600">Failed to load</span>}
                </div>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {(statsData?.students || []).map((row) => (
                    <div key={row.studentId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <span>{row.name}</span>
                      <span className="font-semibold">{row.count}</span>
                    </div>
                  ))}
                  {!statsLoading && !(statsData?.students || []).length && (
                    <p className="text-xs text-slate-500">No defaulters in this range.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Trend (per day)</p>
                {statsError && <span className="text-xs text-rose-600">Failed to load</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-700">
                {(statsData?.trend || []).map((row) => (
                  <span
                    key={row.date}
                    className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100"
                  >
                    {row.date}: <span className="font-semibold">{row.count}</span>
                  </span>
                ))}
                {!statsLoading && !(statsData?.trend || []).length && (
                  <p className="text-xs text-slate-500">No activity in this range.</p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {activeTab === "rollcall" && (
        <Card className="border-slate-100">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Name / Class Defaulters</h2>
                <p className="text-xs text-slate-500">Call out students with their classes and categories.</p>
              </div>
              <div className="flex items-center gap-2">
                {speaking && (
                  <Button variant="ghost" size="xs" onClick={stopScript}>
                    Stop
                  </Button>
                )}
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                  <span className="uppercase tracking-wide">Voice</span>
                  {["female", "male", "auto"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setVoicePref(opt)}
                      className={`rounded px-2 py-1 font-semibold ${
                        voicePref === opt
                          ? "bg-teal-600 text-white"
                          : "bg-white text-slate-700 ring-1 ring-slate-200"
                      }`}
                    >
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={openCallModal}
                  className="inline-flex items-center gap-1"
                >
                  {speaking ? "Playing…" : "Play calls"}
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => {
                    const lines = buildCallLines();
                    setMessage(lines.join("\n"));
                  }}
                  className="inline-flex items-center gap-1"
                >
                  <Megaphone className="h-3.5 w-3.5" />
                  Generate script
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-emerald-700">
              {message ? "Script generated below in the message area." : "Play steps through each category slowly with names and classes."}
            </p>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Class</th>
                    <th className="pb-2">Category</th>
                    <th className="pb-2">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rollcallRows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 font-medium text-slate-800">{row.name}</td>
                      <td className="py-2 text-slate-700">{row.classLabel}</td>
                      <td className="py-2 text-slate-700 capitalize">{row.category || "—"}</td>
                      <td className="py-2 text-slate-600">{row.reason || "—"}</td>
                    </tr>
                  ))}
                  {!rollcallRows.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-sm text-slate-500">
                        No defaulters added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

    </div>

    {callModalOpen && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">Assembly Call</p>
              <p className="text-xs text-slate-500">
                Step through the script; click Next to call the next category.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={closeModal}>
              Close
            </Button>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Line {callIndex + 1} of {callLines.length || 1}
            </p>
            <p className="mt-2 text-sm text-slate-800 leading-relaxed">
              {callLines[callIndex] || "No lines to play."}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {speaking ? "Speaking…" : "Ready"}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={prevLine}
                disabled={callIndex === 0}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => speakLine(callLines[callIndex] || "")}
              >
                Replay
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={nextLine}
                disabled={callIndex >= callLines.length - 1}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
