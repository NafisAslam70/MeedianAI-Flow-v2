"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { CheckCircle, ClipboardList, Users, AlertCircle, Save, Loader2, Search, X } from "lucide-react";
import { format } from "date-fns";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

const Tag = ({ children }) => (
  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 border border-teal-200">
    {children}
  </span>
);

export default function MRIStep({ handleNextStep, onMriClearedChange, onMriPayloadChange }) {
  const today = format(new Date(), "yyyy-MM-dd");

  // roles for current user
  const { data: roleData, error: roleErr, isLoading: roleLoading } = useSWR(
    "/api/member/mris/roles",
    fetcher
  );
  const roles = roleData?.roles ?? [];
  const roleSet = new Set(roles.map((r) => String(r).toLowerCase()));

  // ✅ match your schema & API value exactly
  const NMRI_ROLE = "nmri_moderator";
  const hasRMRI = roleSet.has(NMRI_ROLE);

  // classes for A-MRIs
  const { data: classesData, error: classesErr, isLoading: classesLoading } = useSWR(
    "/api/member/mris/classes",
    fetcher
  );
  const classes = classesData?.classes ?? [];
  const hasAMRI = classes.length > 0;

  // existing A-MRIs for today
  const {
    data: existingAMRI,
    isLoading: existingAMRILoading,
    mutate: mutateExistingAMRI,
  } = useSWR(`/api/member/mris/amri?date=${today}`, fetcher);

  const filledClasses = new Set(existingAMRI?.entries?.map((e) => String(e.classId)) ?? []);

  // students list (only when role applies) for R-MRIs
  const { data: studentsDataRMRI, error: studentsErrRMRI, isLoading: studentsLoadingRMRI } = useSWR(
    hasRMRI ? "/api/member/mris/students?status=active" : null,
    fetcher
  );
  const studentsRMRI = studentsDataRMRI?.students ?? [];

  // existing selections for R-MRIs today
  const {
    data: existingDataRMRI,
    isLoading: existingLoadingRMRI,
    mutate: mutateExistingRMRI,
  } = useSWR(hasRMRI ? `/api/member/mris/rmri?date=${today}` : null, fetcher);

  const [savingRMRI, setSavingRMRI] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [searchRMRI, setSearchRMRI] = useState("");
  const [noneRMRI, setNoneRMRI] = useState({ punctuality: false, language: false, discipline: false });
  const [picksRMRI, setPicksRMRI] = useState(() => ({
    punctuality: new Set(),
    language: new Set(),
    discipline: new Set(),
  }));
  const [isModalOpenRMRI, setIsModalOpenRMRI] = useState(false);

  // A-MRIs states
  const [isModalOpenAMRI, setIsModalOpenAMRI] = useState(false);
  const [currentClassId, setCurrentClassId] = useState(null);
  const [savingAMRI, setSavingAMRI] = useState(false);
  const [searchAMRI, setSearchAMRI] = useState("");
  const [noneAMRI, setNoneAMRI] = useState({});
  const [picksAMRI, setPicksAMRI] = useState({});
  const [absent, setAbsent] = useState(new Set());
  const [noneAbsent, setNoneAbsent] = useState(false);
  const [best, setBest] = useState("");
  const [signed, setSigned] = useState(false);
  const [ccdEntries, setCcdEntries] = useState([]);

  const cddCategories = ["assembly_uniform", "language", "homework", "discipline"];

  // hydrate R-MRIs
  useEffect(() => {
    if (!existingDataRMRI?.entries) return;
    const next = { punctuality: new Set(), language: new Set(), discipline: new Set() };
    for (const e of existingDataRMRI.entries) {
      const cat = String(e.defaulter_type || e.type || "").toLowerCase();
      const sid = String(e.studentId ?? e.student_id);
      if (cat === "punctuality") next.punctuality.add(sid);
      if (cat === "language") next.language.add(sid);
      if (cat === "discipline") next.discipline.add(sid);
    }
    setPicksRMRI(next);
    onMriClearedChange?.(true);
  }, [existingDataRMRI, onMriClearedChange]);

  const filteredStudentsRMRI = useMemo(() => {
    const q = searchRMRI.trim().toLowerCase();
    if (!q) return studentsRMRI;
    return studentsRMRI.filter(
      (s) =>
        String(s.name || "").toLowerCase().includes(q) ||
        String(s.class_name || "").toLowerCase().includes(q) ||
        String(s.admission_number || "").toLowerCase().includes(q)
    );
  }, [searchRMRI, studentsRMRI]);

  const togglePickRMRI = (cat, id) => {
    setPicksRMRI((prev) => {
      const next = { ...prev, [cat]: new Set(prev[cat]) };
      const key = String(id);
      if (next[cat].has(key)) next[cat].delete(key);
      else next[cat].add(key);
      return next;
    });
  };

  const countByCatRMRI = (cat) => picksRMRI[cat]?.size ?? 0;

  const handleSaveRMRI = async () => {
    setSavingRMRI(true);
    setSaveMsg("");
    setErrMsg("");
    try {
      const payload = {
        date: today,
        entries: [
          ...Array.from(picksRMRI.punctuality).map((sid) => ({ studentId: Number(sid), type: "punctuality" })),
          ...Array.from(picksRMRI.language).map((sid) => ({ studentId: Number(sid), type: "language" })),
          ...Array.from(picksRMRI.discipline).map((sid) => ({ studentId: Number(sid), type: "discipline" })),
        ],
        noneCategories: Object.entries(noneRMRI)
          .filter(([_, v]) => v)
          .map(([k]) => k),
      };

      const res = await fetch("/api/member/mris/rmri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed to save (HTTP ${res.status})`);
      }

      setSaveMsg("Saved NMRI defaulters for today.");
      onMriClearedChange?.(true);
      onMriPayloadChange?.({ rmri: payload });
      mutateExistingRMRI();
      setIsModalOpenRMRI(false);
    } catch (e) {
      setErrMsg(e.message);
    } finally {
      setSavingRMRI(false);
    }
  };

  // A-MRIs logic
  const currentClass = classes.find((c) => String(c.id) === String(currentClassId));

  const { data: studentsDataAMRI, error: studentsErrAMRI, isLoading: studentsLoadingAMRI } = useSWR(
    currentClassId ? `/api/member/mris/students?classId=${currentClassId}&status=active` : null,
    fetcher
  );
  const studentsAMRI = studentsDataAMRI?.students ?? [];

  const { data: timetableData, error: timetableErr, isLoading: timetableLoading } = useSWR(
    currentClassId ? `/api/member/mris/timetable?classId=${currentClassId}` : null,
    fetcher
  );

  const existingForClass = existingAMRI?.entries?.find((e) => String(e.classId) === String(currentClassId)) ?? {};

  useEffect(() => {
    if (!currentClassId) return;

    const nextPicks = cddCategories.reduce((acc, cat) => {
      acc[cat] = new Set(existingForClass.cdd?.defaulters?.filter((d) => d.type === cat).map((d) => String(d.studentId)) ?? []);
      return acc;
    }, {});

    setPicksAMRI(nextPicks);

    const nextNone = cddCategories.reduce((acc, cat) => {
      acc[cat] = existingForClass.cdd?.noneCategories?.includes(cat) ?? false;
      return acc;
    }, {});

    setNoneAMRI(nextNone);

    setAbsent(new Set(existingForClass.cdd?.absentStudentIds?.map(String) ?? []));
    setNoneAbsent(existingForClass.cdd?.noneAbsent ?? false);
    setBest(String(existingForClass.cdd?.bestStudentId ?? ""));
    setSigned(existingForClass.cdd?.signed ?? false);

  }, [currentClassId, existingForClass]);

  useEffect(() => {
    if (!timetableData || !existingForClass) return;

    const existingCcd = existingForClass.ccd ?? [];
    const periods = timetableData.periods ?? [];

    const nextCcd = periods.map((p) => {
      const ex = existingCcd.find((ex) => ex.periodNumber === p.periodNumber) ?? {};
      return {
        periodNumber: p.periodNumber,
        subject: p.subject,
        topic: ex.topic ?? "",
        cw: ex.cw ?? "",
        hw: ex.hw ?? "",
        ts: ex.ts ?? false,
      };
    });

    setCcdEntries(nextCcd);
  }, [timetableData, existingForClass]);

  const filteredStudentsAMRI = useMemo(() => {
    const q = searchAMRI.trim().toLowerCase();
    if (!q) return studentsAMRI;
    return studentsAMRI.filter(
      (s) =>
        String(s.name || "").toLowerCase().includes(q) ||
        String(s.admission_number || "").toLowerCase().includes(q)
    );
  }, [searchAMRI, studentsAMRI]);

  const togglePickAMRI = (cat, id) => {
    setPicksAMRI((prev) => {
      const next = { ...prev, [cat]: new Set(prev[cat]) };
      const key = String(id);
      if (next[cat].has(key)) next[cat].delete(key);
      else next[cat].add(key);
      return next;
    });
  };

  const toggleAbsent = (id) => {
    setAbsent((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const countByCatAMRI = (cat) => picksAMRI[cat]?.size ?? 0;

  const updateCcdEntry = (index, field, value) => {
    setCcdEntries((prev) => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const handleSaveAMRI = async () => {
    setSavingAMRI(true);
    setSaveMsg("");
    setErrMsg("");
    try {
      const defaulterEntries = cddCategories.flatMap((cat) =>
        Array.from(picksAMRI[cat] ?? []).map((sid) => ({ studentId: Number(sid), type: cat }))
      );

      const payload = {
        date: today,
        classId: Number(currentClassId),
        cdd: {
          defaulters: defaulterEntries,
          noneCategories: Object.entries(noneAMRI)
            .filter(([_, v]) => v)
            .map(([k]) => k),
          absentStudentIds: Array.from(absent).map(Number),
          noneAbsent,
          bestStudentId: best ? Number(best) : null,
          signed,
        },
        ccd: ccdEntries,
      };

      const res = await fetch("/api/member/mris/amri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed to save (HTTP ${res.status})`);
      }

      setSaveMsg(`Saved CCD and CDD for class ${currentClass?.name}.`);
      onMriClearedChange?.(true);
      onMriPayloadChange?.({ amri: payload });
      mutateExistingAMRI();
      setIsModalOpenAMRI(false);
    } catch (e) {
      setErrMsg(e.message);
    } finally {
      setSavingAMRI(false);
    }
  };

  const totalPicksRMRI = countByCatRMRI("punctuality") + countByCatRMRI("language") + countByCatRMRI("discipline");
  const someNoneRMRI = Object.values(noneRMRI).some(Boolean);

  const rmriFilled = !!existingDataRMRI;
  const amriFilled = classes.length === filledClasses.size;

  const nextDisabled =
    (hasRMRI && !rmriFilled && (totalPicksRMRI === 0 && !someNoneRMRI)) ||
    (hasAMRI && !amriFilled);

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <CheckCircle size={18} className="text-teal-600" />
        MRI Clearance
      </h3>

      {roleErr && (
        <div className="mb-3 flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={16} /> {roleErr.message}
        </div>
      )}
      {classesErr && (
        <div className="mb-3 flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={16} /> {classesErr.message}
        </div>
      )}
      {errMsg && (
        <div className="mb-3 flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={16} /> {errMsg}
        </div>
      )}
      {saveMsg && (
        <div className="mb-3 flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle size={16} /> {saveMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* A-MRIs */}
        <motion.div
          className="bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-6 border border-teal-100/50 hover:shadow-xl transition-shadow duration-300"
          whileHover={{ scale: 1.01 }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-blue-600" />
              <h4 className="text-base font-bold text-gray-800">A-MRIs (Academic)</h4>
            </div>
            <div className="flex gap-2">
              <Tag>MSP</Tag>
              <Tag>MHCP</Tag>
            </div>
          </div>

          {classesLoading || existingAMRILoading ? (
            <p className="text-sm text-gray-600">Loading...</p>
          ) : !hasAMRI ? (
            <p className="text-sm text-gray-600">No academic MRIs assigned to you for today. You may proceed.</p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Fill CCD and CDD logs for your assigned classes for {today}.
              </p>
              <ul className="divide-y">
                {classes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-gray-800">{c.name}</span>
                    {filledClasses.has(String(c.id)) ? (
                      <CheckCircle size={16} className="text-green-600" />
                    ) : (
                      <motion.button
                        onClick={() => {
                          setCurrentClassId(c.id);
                          setIsModalOpenAMRI(true);
                        }}
                        className="bg-blue-600 text-white px-3 py-1 rounded-md text-xs font-semibold hover:bg-blue-700"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Fill Logs
                      </motion.button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </motion.div>

        {/* R-MRIs */}
        <motion.div
          className="bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-6 border border-teal-100/50 hover:shadow-xl transition-shadow duration-300"
          whileHover={{ scale: 1.01 }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-teal-600" />
              <h4 className="text-base font-bold text-gray-800">R-MRIs (Role-based)</h4>
            </div>
            <div className="flex gap-2 flex-wrap">
              {roleLoading ? <Tag>loading…</Tag> : roles.length ? roles.map((r) => <Tag key={r}>{r}</Tag>) : <Tag>no-roles</Tag>}
            </div>
          </div>

          {!hasRMRI ? (
            <p className="text-sm text-gray-600">No role-based MRIs assigned to you for today. You may proceed.</p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                As an <span className="font-semibold">NMRI moderator</span>, mark defaulters for{" "}
                <b>Punctuality</b>, <b>Language</b>, and <b>Discipline</b> for {today}.
              </p>
              <motion.button
                onClick={() => setIsModalOpenRMRI(true)}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-teal-700"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Fill NMRI Logs
              </motion.button>
            </>
          )}
        </motion.div>
      </div>

      {/* Modal for R-MRIs (NMRI) */}
      {isModalOpenRMRI && hasRMRI && (
        <motion.div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-auto"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-800">Fill NMRI Logs</h4>
              <button onClick={() => setIsModalOpenRMRI(false)} className="text-gray-600 hover:text-gray-800">
                <X size={24} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                placeholder="Search by name, class, or admission…"
                value={searchRMRI}
                onChange={(e) => setSearchRMRI(e.target.value)}
                className="border border-teal-200 p-2 pl-9 rounded-lg w-full text-sm bg-teal-50/50 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div className="mb-4">
              <div className="border rounded-lg bg-white/80 overflow-auto max-h-48">
                {studentsLoadingRMRI || existingLoadingRMRI ? (
                  <div className="p-3 text-sm text-gray-500">Loading…</div>
                ) : studentsErrRMRI ? (
                  <div className="p-3 text-sm text-red-600">Failed to load students.</div>
                ) : (
                  <ul className="divide-y">
                    {filteredStudentsRMRI.map((s) => (
                      <li key={s.id} className="flex items-center justify-between px-3 py-2">
                        <div className="text-xs">
                          <div className="font-medium text-gray-800">{s.name}</div>
                          <div className="text-gray-500">
                            {s.class_name ? `Class ${s.class_name}` : ""}
                            {s.admission_number ? ` • ${s.admission_number}` : ""}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {["punctuality", "language", "discipline"].map((cat) => (
                            <button
                              key={cat}
                              onClick={() => togglePickRMRI(cat, s.id)}
                              className={`px-2 py-1 text-xs rounded-md ${
                                picksRMRI[cat].has(String(s.id))
                                  ? "bg-teal-600 text-white"
                                  : "bg-gray-100 text-gray-600 hover:bg-teal-100"
                              }`}
                            >
                              {cat.charAt(0).toUpperCase() + cat.slice(1, 3)}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["punctuality", "language", "discipline"].map((cat) => (
                <div key={cat} className="border border-teal-100/70 rounded-xl bg-white/80 overflow-hidden">
                  <div className="px-4 py-2 bg-teal-50/60 border-b border-teal-100/70 flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize text-teal-800">{cat}</span>
                    <span className="text-xs text-teal-700">{countByCatRMRI(cat)} selected</span>
                  </div>

                  <div className="p-3">
                    <label className="flex items-center gap-2 text-xs mb-2 text-gray-700">
                      <input
                        type="checkbox"
                        checked={noneRMRI[cat]}
                        onChange={(e) => setNoneRMRI((n) => ({ ...n, [cat]: e.target.checked }))}
                      />
                      No defaulters in this category
                    </label>

                    <div className={`border rounded-lg h-48 overflow-auto ${noneRMRI[cat] ? "opacity-40 pointer-events-none" : ""}`}>
                      {studentsLoadingRMRI || existingLoadingRMRI ? (
                        <div className="p-3 text-sm text-gray-500">Loading…</div>
                      ) : studentsErrRMRI ? (
                        <div className="p-3 text-sm text-red-600">Failed to load students.</div>
                      ) : (
                        <ul className="divide-y">
                          {studentsRMRI
                            .filter((s) => picksRMRI[cat].has(String(s.id)))
                            .map((s) => (
                              <li key={s.id} className="flex items-center justify-between px-3 py-2">
                                <div className="text-xs">
                                  <div className="font-medium text-gray-800">{s.name}</div>
                                  <div className="text-gray-500">
                                    {s.class_name ? `Class ${s.class_name}` : ""}
                                    {s.admission_number ? ` • ${s.admission_number}` : ""}
                                  </div>
                                </div>
                                <button
                                  onClick={() => togglePickRMRI(cat, s.id)}
                                  className="text-xs text-red-600 hover:text-red-800"
                                >
                                  Remove
                                </button>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-gray-600">
                Summary: Punctuality <b>{countByCatRMRI("punctuality")}</b> • Language <b>{countByCatRMRI("language")}</b> • Discipline <b>{countByCatRMRI("discipline")}</b>
              </div>
              <motion.button
                onClick={handleSaveRMRI}
                disabled={savingRMRI}
                className={`flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md ${
                  savingRMRI ? "opacity-60 cursor-not-allowed" : "hover:bg-teal-700"
                }`}
                whileHover={{ scale: savingRMRI ? 1 : 1.02 }}
                whileTap={{ scale: savingRMRI ? 1 : 0.98 }}
              >
                {savingRMRI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save NMRI
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Modal for A-MRIs (CCD & CDD) */}
      {isModalOpenAMRI && currentClass && (
        <motion.div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-auto"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-800">Fill CCD & CDD for {currentClass.name}</h4>
              <button onClick={() => setIsModalOpenAMRI(false)} className="text-gray-600 hover:text-gray-800">
                <X size={24} />
              </button>
            </div>

            {studentsErrAMRI && (
              <div className="mb-3 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={16} /> Failed to load students.
              </div>
            )}
            {timetableErr && (
              <div className="mb-3 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={16} /> Failed to load timetable.
              </div>
            )}

            <h5 className="text-md font-semibold text-gray-700 mb-2">Class Discipline Diary (CDD)</h5>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                placeholder="Search by name or admission…"
                value={searchAMRI}
                onChange={(e) => setSearchAMRI(e.target.value)}
                className="border border-teal-200 p-2 pl-9 rounded-lg w-full text-sm bg-teal-50/50 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div className="mb-4">
              <div className="border rounded-lg bg-white/80 overflow-auto max-h-48">
                {studentsLoadingAMRI || timetableLoading ? (
                  <div className="p-3 text-sm text-gray-500">Loading…</div>
                ) : (
                  <ul className="divide-y">
                    {filteredStudentsAMRI.map((s) => (
                      <li key={s.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center px-3 py-2 gap-4">
                        <div className="text-xs">
                          <div className="font-medium text-gray-800">{s.name}</div>
                          <div className="text-gray-500">{s.admission_number ? `${s.admission_number}` : ""}</div>
                        </div>
                        <div className="flex gap-2 col-span-1">
                          {cddCategories.map((cat) => (
                            <button
                              key={cat}
                              onClick={() => togglePickAMRI(cat, s.id)}
                              className={`px-2 py-1 text-xs rounded-md ${
                                picksAMRI[cat]?.has(String(s.id))
                                  ? "bg-teal-600 text-white"
                                  : "bg-gray-100 text-gray-600 hover:bg-teal-100"
                              }`}
                            >
                              {cat.split("_").map((w) => w.charAt(0).toUpperCase()).join("")}
                            </button>
                          ))}
                        </div>
                        <label className="flex items-center gap-1 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={absent.has(String(s.id))}
                            onChange={() => toggleAbsent(s.id)}
                          />
                          Absent
                        </label>
                        <label className="flex items-center gap-1 text-xs text-gray-700">
                          <input
                            type="radio"
                            checked={best === String(s.id)}
                            onChange={() => setBest(String(s.id))}
                          />
                          Best
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {cddCategories.map((cat) => (
                <div key={cat} className="border border-teal-100/70 rounded-xl bg-white/80 overflow-hidden">
                  <div className="px-4 py-2 bg-teal-50/60 border-b border-teal-100/70 flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize text-teal-800">{cat.replace("_", "/")}</span>
                    <span className="text-xs text-teal-700">{countByCatAMRI(cat)} selected</span>
                  </div>
                  <div className="p-3">
                    <label className="flex items-center gap-2 text-xs mb-2 text-gray-700">
                      <input
                        type="checkbox"
                        checked={noneAMRI[cat]}
                        onChange={(e) => setNoneAMRI((n) => ({ ...n, [cat]: e.target.checked }))}
                      />
                      No defaulters
                    </label>
                    <div className={`border rounded-lg h-32 overflow-auto ${noneAMRI[cat] ? "opacity-40 pointer-events-none" : ""}`}>
                      <ul className="divide-y">
                        {studentsAMRI
                          .filter((s) => picksAMRI[cat]?.has(String(s.id)))
                          .map((s) => (
                            <li key={s.id} className="flex items-center justify-between px-3 py-1 text-xs">
                              {s.name}
                              <button
                                onClick={() => togglePickAMRI(cat, s.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="border border-teal-100/70 rounded-xl bg-white/80 overflow-hidden">
                <div className="px-4 py-2 bg-teal-50/60 border-b border-teal-100/70 flex items-center justify-between">
                  <span className="text-sm font-semibold text-teal-800">Absent Students</span>
                  <span className="text-xs text-teal-700">{absent.size} selected</span>
                </div>
                <div className="p-3">
                  <label className="flex items-center gap-2 text-xs mb-2 text-gray-700">
                    <input
                      type="checkbox"
                      checked={noneAbsent}
                      onChange={(e) => setNoneAbsent(e.target.checked)}
                    />
                    No absent students
                  </label>
                  <div className={`border rounded-lg h-32 overflow-auto ${noneAbsent ? "opacity-40 pointer-events-none" : ""}`}>
                    <ul className="divide-y">
                      {studentsAMRI
                        .filter((s) => absent.has(String(s.id)))
                        .map((s) => (
                          <li key={s.id} className="flex items-center justify-between px-3 py-1 text-xs">
                            {s.name}
                            <button
                              onClick={() => toggleAbsent(s.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border border-teal-100/70 rounded-xl bg-white/80 overflow-hidden">
                <div className="px-4 py-2 bg-teal-50/60 border-b border-teal-100/70 flex items-center justify-between">
                  <span className="text-sm font-semibold text-teal-800">Best Student of the Day</span>
                </div>
                <div className="p-3">
                  {best ? (
                    <div className="flex items-center justify-between text-xs">
                      {studentsAMRI.find((s) => String(s.id) === best)?.name}
                      <button
                        onClick={() => setBest("")}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">No best student selected</p>
                  )}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 mb-6">
              <input
                type="checkbox"
                checked={signed}
                onChange={(e) => setSigned(e.target.checked)}
              />
              Class Teacher Sign (with principal stamp)
            </label>

            <h5 className="text-md font-semibold text-gray-700 mb-2">Class Curriculum Diary (CCD)</h5>

            <div className="overflow-auto mb-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-teal-50/60">
                    <th className="p-2 border">Period</th>
                    <th className="p-2 border">Subject</th>
                    <th className="p-2 border">Topic</th>
                    <th className="p-2 border">C.W</th>
                    <th className="p-2 border">H.W</th>
                    <th className="p-2 border">T.S</th>
                  </tr>
                </thead>
                <tbody>
                  {ccdEntries.map((entry, index) => (
                    <tr key={entry.periodNumber}>
                      <td className="p-2 border text-center">{entry.periodNumber}</td>
                      <td className="p-2 border">{entry.subject}</td>
                      <td className="p-2 border">
                        <input
                          type="text"
                          value={entry.topic}
                          onChange={(e) => updateCcdEntry(index, "topic", e.target.value)}
                          className="w-full border rounded p-1 text-xs"
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="text"
                          value={entry.cw}
                          onChange={(e) => updateCcdEntry(index, "cw", e.target.value)}
                          className="w-full border rounded p-1 text-xs"
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="text"
                          value={entry.hw}
                          onChange={(e) => updateCcdEntry(index, "hw", e.target.value)}
                          className="w-full border rounded p-1 text-xs"
                        />
                      </td>
                      <td className="p-2 border text-center">
                        <input
                          type="checkbox"
                          checked={entry.ts}
                          onChange={(e) => updateCcdEntry(index, "ts", e.target.checked)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ccdEntries.length === 0 && <p className="text-sm text-gray-600 mt-2">No periods defined.</p>}
            </div>

            <div className="flex justify-end mt-4">
              <motion.button
                onClick={handleSaveAMRI}
                disabled={savingAMRI}
                className={`flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md ${
                  savingAMRI ? "opacity-60 cursor-not-allowed" : "hover:bg-teal-700"
                }`}
                whileHover={{ scale: savingAMRI ? 1 : 1.02 }}
                whileTap={{ scale: savingAMRI ? 1 : 0.98 }}
              >
                {savingAMRI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save CCD & CDD
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="flex justify-end mt-6">
        <motion.button
          onClick={() => {
            if (!hasRMRI && !hasAMRI) onMriClearedChange?.(true);
            handleNextStep();
          }}
          disabled={nextDisabled}
          className={`bg-blue-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 ${
            nextDisabled ? "opacity-60 cursor-not-allowed" : "hover:bg-blue-700"
          }`}
          whileHover={{ scale: nextDisabled ? 1 : 1.02 }}
          whileTap={{ scale: nextDisabled ? 1 : 0.98 }}
        >
          Next
        </motion.button>
      </div>
    </div>
  );
}