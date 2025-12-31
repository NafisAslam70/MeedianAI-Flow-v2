"use client";

import { Fragment, useMemo, useState } from "react";
import useSWR from "swr";
import { ShieldCheck, Layers, BarChart2, Users } from "lucide-react";
import { subDays } from "date-fns";

const fetcher = async (url) => {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = payload?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json();
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const defaultMonthIso = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
};

const rangeLabelMap = {
  day: "Day",
  week: "Week (rolling 7d)",
  month: "Month (rolling 30d)",
};

const isPrePrimaryName = (value) => {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return false;
  if (v === "lkg" || v === "ukg") return true;
  if (v === "nur" || v === "nursery") return true;
  return v.startsWith("nur");
};

const isElementaryName = (value) => {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return false;
  if (/^\d+$/.test(v)) return true;
  return /^(i|ii|iii|iv|v|vi|vii|viii)$/i.test(v);
};

const resolveTrack = (row) => {
  const stored = (row?.track || "").trim();
  if (stored) return stored;
  const name = row?.name || "";
  if (isPrePrimaryName(name)) return "pre_primary";
  if (isElementaryName(name)) return "elementary";
  return "";
};

const compareDateDesc = (a, b) => {
  const da = a ? new Date(a) : null;
  const db = b ? new Date(b) : null;
  const va = da && !Number.isNaN(da.getTime()) ? da.getTime() : 0;
  const vb = db && !Number.isNaN(db.getTime()) ? db.getTime() : 0;
  return vb - va;
};

const formatDayLabel = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  return `${day} ${value}`;
};

const formatCcdRows = (rows = []) => {
  if (!Array.isArray(rows) || !rows.length) return "No CCD rows";
  return rows
    .map((r) => {
      const period = r?.period ? `P${r.period}` : "P?";
      const subject = r?.subject || "Subject ?";
      const topic = r?.topic ? ` · ${r.topic}` : "";
      const teacher = r?.teacherName ? ` · ${r.teacherName}` : "";
      return `${period} · ${subject}${topic}${teacher}`;
    })
    .join("\n");
};

const formatCddRows = (rows = []) => {
  if (!Array.isArray(rows) || !rows.length) return "No CDD rows";
  const toLine = (label, val) => (val && val.length ? `${label}: ${val.join(", ")}` : null);
  return rows
    .map((r, idx) => {
      const parts = [
        toLine("Assembly/Uniform", r?.assemblyUniformDefaulters || []),
        toLine("Language", r?.languageDefaulters || []),
        toLine("Homework", r?.homeworkDefaulters || []),
        toLine("Discipline", r?.disciplineDefaulters || []),
        toLine("Absent", r?.absentStudents || []),
      ].filter(Boolean);
      return `Day ${idx + 1}: ${parts.join(" | ") || "No categories"}`;
    })
    .join("\n");
};

export default function AnalyseClassPage() {
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayIso()); // day anchor
  const [weekInput, setWeekInput] = useState("");
  const [monthInput, setMonthInput] = useState(defaultMonthIso());
  const [rangeMode, setRangeMode] = useState("month"); // day | week | month
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [detail, setDetail] = useState(null);
  const [openLayers, setOpenLayers] = useState({ 1: true, 2: false, 3: false });
  const [rowDetail, setRowDetail] = useState(null);

  const { data: classData, error: classError, isLoading: classesLoading } = useSWR(
    "/api/admin/manageMeedian?section=classes",
    fetcher,
    { dedupingInterval: 60_000 }
  );

  const classes = useMemo(() => {
    const rows = Array.isArray(classData?.classes) ? classData.classes : [];
    return rows
      .map((row) => ({
        id: Number(row.id),
        name: row.name || `Class #${row.id}`,
        section: row.section || "",
        track: resolveTrack(row),
      }))
      .filter((row) => Number.isFinite(row.id));
  }, [classData]);

  const sortedClasses = useMemo(
    () =>
      classes.slice().sort((a, b) => {
        const nameA = `${a.name}${a.section ? ` ${a.section}` : ""}`;
        const nameB = `${b.name}${b.section ? ` ${b.section}` : ""}`;
        return nameA.localeCompare(nameB);
      }),
    [classes]
  );

  const selectedClass = useMemo(() => {
    if (!selectedClassId && sortedClasses.length) return sortedClasses[0];
    return sortedClasses.find((c) => c.id === selectedClassId) || null;
  }, [selectedClassId, sortedClasses]);

  const range = useMemo(() => {
    const anchorDay = selectedDate || todayIso();
    if (rangeMode === "week") {
      const src = weekInput && /^\d{4}-W\d{2}$/.test(weekInput) ? `${weekInput}-1` : `${anchorDay}`;
      const startDate = new Date(src);
      const startIso = Number.isNaN(startDate.getTime()) ? anchorDay : startDate.toISOString().slice(0, 10);
      return { start: startIso, end: subDays(new Date(startIso), -6).toISOString().slice(0, 10) };
    }
    if (rangeMode === "month") {
      const src = monthInput && /^\d{4}-\d{2}$/.test(monthInput) ? `${monthInput}-01` : `${anchorDay.slice(0, 7)}-01`;
      const startDate = new Date(src);
      const startIso = Number.isNaN(startDate.getTime()) ? `${anchorDay.slice(0, 7)}-01` : startDate.toISOString().slice(0, 10);
      return { start: startIso, end: subDays(new Date(startIso), -29).toISOString().slice(0, 10) };
    }
    return { start: anchorDay, end: anchorDay };
  }, [rangeMode, selectedDate, weekInput, monthInput]);

  const {
    data: historyData,
    error: historyError,
    isLoading: historyLoading,
  } = useSWR(
    showAnalysis && selectedClass
      ? `/api/admin/admin-club/pt-history?classId=${selectedClass.id}&startDate=${range.start}&endDate=${range.end}`
      : null,
    fetcher,
    { dedupingInterval: 30_000 }
  );

  const totals = historyData?.totals || {
    assignments: 0,
    filled: 0,
    submitted: 0,
    approved: 0,
    ccdRows: 0,
    cddRows: 0,
    statuses: [],
    latestUpdate: null,
  };

  const defaulterBuckets = historyData?.cdd?.defaulters || {};
  const cddPerDay = historyData?.cdd?.perDay || [];
  const ccdPerDay = historyData?.ccd?.perDay || [];
  const statusList = totals.statuses || [];
  const rangeLabel = rangeLabelMap[rangeMode] || "Day";
  const instances = historyData?.instances || [];

  const assignmentStats = useMemo(() => {
    const map = new Map();
    for (const inst of instances) {
      const key = inst.assignmentId;
      if (!map.has(key)) {
        map.set(key, {
          assignmentId: inst.assignmentId,
          teacher: inst.teacherName || `Assignment #${inst.assignmentId}`,
          assistant: inst.assistantName || (inst.assistantUserId ? `Assistant #${inst.assistantUserId}` : "Not set"),
          instances: 0,
          filled: 0,
          submitted: 0,
          approved: 0,
        });
      }
      const entry = map.get(key);
      entry.instances += 1;
      if (inst.filled) entry.filled += 1;
      if (inst.submitted) entry.submitted += 1;
      if (inst.approved) entry.approved += 1;
    }
    return Array.from(map.values()).sort((a, b) => a.teacher.localeCompare(b.teacher));
  }, [instances]);

  const openDetail = (title, rows = [], columns = []) => {
    setDetail({
      title,
      rows,
      columns: columns.length
        ? columns
        : [
            { key: "teacher", label: "PT" },
            { key: "date", label: "Date" },
            { key: "status", label: "Status" },
            { key: "ccd", label: "CCD rows" },
            { key: "cdd", label: "CDD rows" },
          ],
    });
  };

  const instanceColumns = [
    { key: "teacher", label: "PT" },
    { key: "assistant", label: "Assistant" },
    { key: "date", label: "Date" },
    { key: "status", label: "Status" },
    { key: "ccd", label: "CCD" },
    { key: "cdd", label: "CDD" },
    { key: "attendance", label: "Attendance" },
  ];

  const buildInstanceRows = (list) =>
    list
      .map((inst) => ({
        key: `${inst.instanceId}`,
        teacher: inst.teacherName || `Assignment #${inst.assignmentId}`,
        assistant: inst.assistantName || (inst.assistantUserId ? `Assistant #${inst.assistantUserId}` : "—"),
        date: formatDayLabel(inst.targetDate),
        status: inst.status,
        ccd: inst.ccdCount,
        cdd: inst.cddCount,
        attendance: inst.attendanceCount,
        ccdRows: inst.ccdRows || [],
        cddRows: inst.cddRows || [],
      }))
      .sort((a, b) => compareDateDesc(a.date, b.date));

  const buildBucketRows = (entries = []) =>
    entries.map((item, idx) => ({
      key: `${item.key}-${idx}`,
      name: item.key,
      count: item.count,
    }));

  const bucketColumns = [
    { key: "name", label: "Student" },
    { key: "count", label: "Mentions" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex md:items-center md:justify-between md:gap-6 md:space-y-0">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-600">
            <ShieldCheck size={16} />
            Admin Club · Class Analysis
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Analyse Class</h1>
          <p className="mt-1 text-sm text-slate-600">
            Check CCD/CDD coverage and approvals first; then spot repeat defaulters by category.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <BarChart2 size={16} className="text-teal-600" />
          <span>Built on PT daily report data</span>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Classes</p>
            <h2 className="text-lg font-semibold text-slate-900">Pick a class</h2>
          </div>
        </div>

        {classError ? (
          <p className="mt-3 text-sm text-red-600">Failed to load classes: {classError.message}</p>
        ) : null}

        <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2 md:grid-cols-2">
          {classesLoading && !sortedClasses.length ? (
            <p className="text-sm text-slate-500">Loading classes…</p>
          ) : sortedClasses.length ? (
            <>
              <div className="flex flex-col gap-3 text-sm">
                <label className="text-xs font-semibold text-slate-600">Pick a class</label>
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-teal-600" />
                  <select
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-teal-400 focus:outline-none"
                    value={selectedClass?.id || sortedClasses[0]?.id || ""}
                    onChange={(e) => {
                      const nextId = Number(e.target.value);
                      if (Number.isFinite(nextId)) {
                        setSelectedClassId(nextId);
                        setShowAnalysis(true);
                      }
                    }}
                  >
                    {sortedClasses.map((klass) => (
                      <option key={klass.id} value={klass.id}>
                        Class {klass.name}
                        {klass.section ? ` ${klass.section}` : ""} · Track: {klass.track || "—"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800">
                  <p className="text-xs font-semibold text-slate-500">Selected</p>
                  <p className="text-base font-semibold text-slate-900">
                    {selectedClass ? `Class ${selectedClass.name}${selectedClass.section ? ` ${selectedClass.section}` : ""}` : "—"}
                  </p>
                  <p className="text-xs text-slate-500">Track: {selectedClass?.track || "—"}</p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAnalysis(true)}
                    className="inline-flex items-center justify-center rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100"
                  >
                    Open analysis
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Range</p>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
                  {["day", "week", "month"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setRangeMode(mode)}
                      className={`rounded-md px-3 py-1 transition ${
                        rangeMode === mode
                          ? "bg-teal-50 text-teal-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
                {rangeMode === "day" ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-600">Day</span>
                    <input
                      type="date"
                      className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700 shadow-inner focus:border-teal-400 focus:outline-none"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value || todayIso())}
                    />
                  </div>
                ) : null}
                {rangeMode === "week" ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-600">Week</span>
                    <input
                      type="week"
                      className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700 shadow-inner focus:border-teal-400 focus:outline-none"
                      value={weekInput}
                      onChange={(e) => setWeekInput(e.target.value)}
                    />
                  </div>
                ) : null}
                {rangeMode === "month" ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-600">Month</span>
                    <input
                      type="month"
                      className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700 shadow-inner focus:border-teal-400 focus:outline-none"
                      value={monthInput}
                      onChange={(e) => setMonthInput(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              No classes available. Add classes in Manage Meedian first.
            </div>
          )}
        </div>
      </section>

      {showAnalysis && selectedClass ? (
        <section className="space-y-4">
          {/* Layer 1 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layer 1 · Report submissions & approvals</p>
                <h3 className="text-lg font-semibold text-slate-900">
                  PT coverage · {selectedClass.name}
                  {selectedClass.section ? ` ${selectedClass.section}` : ""} ({rangeLabel})
                </h3>
                <p className="text-sm text-slate-600">
                  Monitor assistant fills, submissions, and approvals for the selected range.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenLayers((prev) => ({ ...prev, 1: !prev[1] }))}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-teal-200"
              >
                {openLayers[1] ? "Collapse" : "Expand"}
              </button>
            </div>

            {historyError ? (
              <p className="mt-3 text-sm text-red-600">Failed to load PT data: {historyError.message}</p>
            ) : null}

            {openLayers[1] ? (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  <button
                    type="button"
                    onClick={() =>
                      openDetail(
                        "Assignments (range)",
                        assignmentStats.map((row) => ({
                          key: row.assignmentId,
                          teacher: row.teacher,
                          assistant: row.assistant,
                          date: `${row.instances} entries`,
                          status: `${row.filled} filled / ${row.submitted} submitted / ${row.approved} approved`,
                        })),
                        [
                          { key: "teacher", label: "PT (Class Teacher)" },
                          { key: "assistant", label: "Assistant" },
                          { key: "date", label: "Entries" },
                          { key: "status", label: "Coverage" },
                        ]
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-teal-200 hover:shadow-sm"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">Assignments</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                      {historyLoading && !totals.assignments ? "…" : totals.assignments}
                    </p>
                    <p className="text-xs text-slate-500">PT daily report owners for this class</p>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openDetail(
                        "Filled by assistant",
                        buildInstanceRows(instances.filter((inst) => inst.filled)),
                        instanceColumns
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-teal-200 hover:shadow-sm"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">Filled by assistant</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                      {historyLoading && !totals.assignments ? "…" : totals.filled}
                    </p>
                    <p className="text-xs text-slate-500">Payload captured (CCD/CDD/attendance)</p>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openDetail(
                        "CCD rows",
                        buildInstanceRows(instances.filter((inst) => inst.ccdCount > 0)),
                        instanceColumns
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-teal-200 hover:shadow-sm"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">CCD rows</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                      {historyLoading && !totals.assignments ? "…" : totals.ccdRows}
                    </p>
                    <p className="text-xs text-slate-500">Captured periods for the range</p>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openDetail(
                        "CDD rows",
                        buildInstanceRows(instances.filter((inst) => inst.cddCount > 0)),
                        instanceColumns
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-teal-200 hover:shadow-sm"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">CDD rows</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                      {historyLoading && !totals.assignments ? "…" : totals.cddRows}
                    </p>
                    <p className="text-xs text-slate-500">Discipline diary entries</p>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openDetail(
                        "Approved / waived",
                        buildInstanceRows(instances.filter((inst) => inst.approved)),
                        instanceColumns
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-teal-200 hover:shadow-sm"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">Approved (PT close)</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                      {historyLoading && !totals.assignments ? "…" : totals.approved}
                    </p>
                    <p className="text-xs text-slate-500">Verified / waived after day close</p>
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-inner">
                  {historyLoading && !totals.assignments ? (
                    <p className="text-sm text-slate-500">Loading PT capture for this class…</p>
                  ) : totals.assignments ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {(statusList || []).map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() =>
                              openDetail(
                                `Status: ${item.key}`,
                                buildInstanceRows(instances.filter((inst) => inst.status === item.key)),
                                instanceColumns
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium capitalize text-slate-700 transition hover:border-teal-200"
                          >
                            {item.key}
                            <span className="text-slate-500">·</span>
                            {item.count}
                          </button>
                        ))}
                        {totals.latestUpdate ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                            Updated {new Date(totals.latestUpdate).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">Coverage checks</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                          <li>{totals.filled}/{totals.assignments} assignments have assistant data.</li>
                          <li>{totals.submitted}/{totals.assignments} are submitted; {totals.approved} approved/waived.</li>
                          <li>Use PT Assistant to capture gaps, then PT day close to approve.</li>
                        </ul>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <a
                          className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 font-medium text-teal-700 transition hover:bg-teal-100"
                          href="/dashboard/managersCommon/pt-assist"
                        >
                          Open PT Assistant
                        </a>
                        <a
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-teal-200"
                          href="/dashboard/member/closeMyDay"
                        >
                          View PT in day close
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No PT daily report data for this class in the selected range. Check the assignment or try another date.
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* Layer 2 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layer 2 · Student focus (CDD)</p>
                <h3 className="text-lg font-semibold text-slate-900">Daily defaulters by category</h3>
                <p className="text-sm text-slate-600">
                  Day-wise CDD mentions and an overall class health rollup.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenLayers((prev) => ({ ...prev, 2: !prev[2] }))}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-teal-200"
              >
                {openLayers[2] ? "Collapse" : "Expand"}
              </button>
            </div>
            {openLayers[2] ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Daily view</p>
                  {cddPerDay.length ? (
                    <div className="mt-2 space-y-2">
                      {cddPerDay.map((day) => (
                        <div key={day.date} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-semibold text-slate-900">{formatDayLabel(day.date)}</span>
                            <span className="text-slate-500">Tap categories for details</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {[
                              { key: "languageDefaulters", label: "Language" },
                              { key: "homeworkDefaulters", label: "Homework" },
                              { key: "disciplineDefaulters", label: "Discipline" },
                              { key: "assemblyUniformDefaulters", label: "Assembly/Uniform" },
                              { key: "absentStudents", label: "Absent" },
                            ].map((bucket) => {
                              const entries = day.categories?.[bucket.key] || [];
                              return (
                                <button
                                  type="button"
                                  key={`${day.date}-${bucket.key}`}
                                onClick={() => openDetail(`${bucket.label} · ${formatDayLabel(day.date)}`, entries, bucketColumns)}
                                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-teal-200"
                              >
                                <span className="text-slate-700">{bucket.label}</span>
                                <span className="rounded-full bg-white px-2 py-0.5 text-slate-800">
                                  {entries.length}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No PT CDD entries for the selected range.</p>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overall class health (range)</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    {[
                      { key: "languageDefaulters", label: "Language defaulters" },
                      { key: "homeworkDefaulters", label: "Homework defaulters" },
                      { key: "disciplineDefaulters", label: "Discipline defaulters" },
                      { key: "assemblyUniformDefaulters", label: "Assembly/Uniform" },
                      { key: "absentStudents", label: "Absent students" },
                    ].map((bucket) => {
                      const entries = defaulterBuckets[bucket.key] || [];
                      return (
                        <button
                          type="button"
                          key={bucket.key}
                          onClick={() => openDetail(bucket.label, buildBucketRows(entries), bucketColumns)}
                          className="rounded-lg border border-slate-200 bg-white p-3 text-left text-sm text-slate-700 transition hover:border-teal-200"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-slate-900">{bucket.label}</p>
                            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
                              {entries.length}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">Top repeat mentions in this range.</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Layer 3 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layer 3 · CCD (Curriculum)</p>
                <h3 className="text-lg font-semibold text-slate-900">Subjects by period (per day)</h3>
                <p className="text-sm text-slate-600">
                  Review what was taught each period for dates in range. Tap a day to drill in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenLayers((prev) => ({ ...prev, 3: !prev[3] }))}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-teal-200"
              >
                {openLayers[3] ? "Collapse" : "Expand"}
              </button>
            </div>
            {openLayers[3] ? (
              <div className="mt-4 space-y-2">
                {ccdPerDay.length ? (
                  ccdPerDay.map((day) => (
                    <div key={day.date} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{formatDayLabel(day.date)}</span>
                        <span className="text-xs text-slate-500">Periods: {day.lessons.length || 0}</span>
                      </div>
                      {day.lessons.length ? (
                        <div className="grid gap-2 md:grid-cols-2">
                          {day.lessons
                            .slice()
                            .sort((a, b) => (a.period || "").localeCompare(b.period || ""))
                            .map((lesson, idx) => (
                              <div key={`${day.date}-${idx}`} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <span>Period {lesson.period || "—"}</span>
                                  <span>{lesson.teacherName || "—"}</span>
                                </div>
                                <p className="text-sm font-semibold text-slate-900">{lesson.subject || "—"}</p>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No CCD entries for this date.</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No CCD data for the selected range.</p>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Details</p>
                <h4 className="text-lg font-semibold text-slate-900">{detail.title}</h4>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:border-teal-200 hover:text-teal-700"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto px-4 py-3">
              {detail.rows && detail.rows.length ? (
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      {detail.columns.map((col) => (
                        <th key={col.key} className="px-2 py-2 font-semibold">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.rows.map((row, idx) => {
                      const rowKey = row.key || idx;
                      const hasDetail = (row.ccdRows && row.ccdRows.length) || (row.cddRows && row.cddRows.length);
                      return (
                        <tr
                          key={rowKey}
                          className={`hover:bg-slate-50 ${hasDetail ? "cursor-pointer" : ""}`}
                          onClick={() => {
                            if (!hasDetail) return;
                            setRowDetail({
                              title: `${row.teacher || "PT"} · ${row.date || ""}`,
                              ccdRows: row.ccdRows || [],
                              cddRows: row.cddRows || [],
                            });
                          }}
                        >
                          {detail.columns.map((col) => (
                            <td key={col.key} className="px-2 py-2 text-slate-800">
                              {row[col.key] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-600">No data available for this selection.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {rowDetail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Row details</p>
                <h4 className="text-lg font-semibold text-slate-900">{rowDetail.title || "CCD / CDD rows"}</h4>
              </div>
              <button
                type="button"
                onClick={() => setRowDetail(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:border-teal-200 hover:text-teal-700"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto px-4 py-3 text-sm text-slate-800">
              {rowDetail.ccdRows?.length ? (
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">CCD rows</p>
                  <pre className="mt-1 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-800">
                    {formatCcdRows(rowDetail.ccdRows)}
                  </pre>
                </div>
              ) : null}
              {rowDetail.cddRows?.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">CDD rows</p>
                  <pre className="mt-1 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-800">
                    {formatCddRows(rowDetail.cddRows)}
                  </pre>
                </div>
              ) : null}
              {!rowDetail.ccdRows?.length && !rowDetail.cddRows?.length ? (
                <p className="text-sm text-slate-600">No CCD/CDD rows captured.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
