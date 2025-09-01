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

  // students list (only when role applies)
  const { data: studentsData, error: studentsErr, isLoading: studentsLoading } = useSWR(
    hasRMRI ? "/api/member/mris/students?status=active" : null,
    fetcher
  );
  const students = studentsData?.students ?? [];

  // existing selections for today
  const {
    data: existingData,
    isLoading: existingLoading,
    mutate: mutateExisting,
  } = useSWR(hasRMRI ? `/api/member/mris/rmri?date=${today}` : null, fetcher);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [search, setSearch] = useState("");
  const [none, setNone] = useState({ punctuality: false, language: false, discipline: false });
  const [picks, setPicks] = useState(() => ({
    punctuality: new Set(),
    language: new Set(),
    discipline: new Set(),
  }));
  const [isModalOpen, setIsModalOpen] = useState(false);

  // hydrate from existing once loaded
  useEffect(() => {
    if (!existingData?.entries) return;
    const next = { punctuality: new Set(), language: new Set(), discipline: new Set() };
    for (const e of existingData.entries) {
      const cat = String(e.defaulter_type || e.type || "").toLowerCase();
      const sid = String(e.studentId ?? e.student_id);
      if (cat === "punctuality") next.punctuality.add(sid);
      if (cat === "language") next.language.add(sid);
      if (cat === "discipline") next.discipline.add(sid);
    }
    setPicks(next);
    onMriClearedChange?.(true);
  }, [existingData, onMriClearedChange]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        String(s.name || "").toLowerCase().includes(q) ||
        String(s.class_name || "").toLowerCase().includes(q) ||
        String(s.admission_number || "").toLowerCase().includes(q)
    );
  }, [search, students]);

  const togglePick = (cat, id) => {
    setPicks((prev) => {
      const next = { ...prev, [cat]: new Set(prev[cat]) };
      const key = String(id);
      if (next[cat].has(key)) next[cat].delete(key);
      else next[cat].add(key);
      return next;
    });
  };

  const countByCat = (cat) => picks[cat]?.size ?? 0;

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg("");
    setErrMsg("");
    try {
      const payload = {
        date: today,
        entries: [
          ...Array.from(picks.punctuality).map((sid) => ({ studentId: Number(sid), type: "punctuality" })),
          ...Array.from(picks.language).map((sid) => ({ studentId: Number(sid), type: "language" })),
          ...Array.from(picks.discipline).map((sid) => ({ studentId: Number(sid), type: "discipline" })),
        ],
        noneCategories: Object.entries(none)
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
      mutateExisting();
      setIsModalOpen(false);
    } catch (e) {
      setErrMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const nextDisabled =
    hasRMRI &&
    !existingData &&
    (countByCat("punctuality") + countByCat("language") + countByCat("discipline") === 0 &&
      !Object.values(none).some(Boolean));

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
        {/* A-MRIs placeholder */}
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
          <p className="text-sm text-gray-600">Coming soon in this step. You can proceed after completing R-MRIs.</p>
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
                onClick={() => setIsModalOpen(true)}
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

      {/* Modal for NMRI Logs */}
      {isModalOpen && hasRMRI && (
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
              <button onClick={() => setIsModalOpen(false)} className="text-gray-600 hover:text-gray-800">
                <X size={24} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                placeholder="Search by name, class, or admission…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-teal-200 p-2 pl-9 rounded-lg w-full text-sm bg-teal-50/50 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div className="mb-4">
              <div className="border rounded-lg bg-white/80 overflow-auto max-h-48">
                {studentsLoading || existingLoading ? (
                  <div className="p-3 text-sm text-gray-500">Loading…</div>
                ) : studentsErr ? (
                  <div className="p-3 text-sm text-red-600">Failed to load students.</div>
                ) : (
                  <ul className="divide-y">
                    {filteredStudents.map((s) => (
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
                              onClick={() => togglePick(cat, s.id)}
                              className={`px-2 py-1 text-xs rounded-md ${
                                picks[cat].has(String(s.id))
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
                    <span className="text-xs text-teal-700">{countByCat(cat)} selected</span>
                  </div>

                  <div className="p-3">
                    <label className="flex items-center gap-2 text-xs mb-2 text-gray-700">
                      <input
                        type="checkbox"
                        checked={none[cat]}
                        onChange={(e) => setNone((n) => ({ ...n, [cat]: e.target.checked }))}
                      />
                      No defaulters in this category
                    </label>

                    <div className={`border rounded-lg h-48 overflow-auto ${none[cat] ? "opacity-40 pointer-events-none" : ""}`}>
                      {studentsLoading || existingLoading ? (
                        <div className="p-3 text-sm text-gray-500">Loading…</div>
                      ) : studentsErr ? (
                        <div className="p-3 text-sm text-red-600">Failed to load students.</div>
                      ) : (
                        <ul className="divide-y">
                          {students
                            .filter((s) => picks[cat].has(String(s.id)))
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
                                  onClick={() => togglePick(cat, s.id)}
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
                Summary: Punctuality <b>{countByCat("punctuality")}</b> • Language <b>{countByCat("language")}</b> • Discipline <b>{countByCat("discipline")}</b>
              </div>
              <motion.button
                onClick={handleSave}
                disabled={saving}
                className={`flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md ${
                  saving ? "opacity-60 cursor-not-allowed" : "hover:bg-teal-700"
                }`}
                whileHover={{ scale: saving ? 1 : 1.02 }}
                whileTap={{ scale: saving ? 1 : 0.98 }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save NMRI
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="flex justify-end mt-6">
        <motion.button
          onClick={() => {
            if (!hasRMRI) onMriClearedChange?.(true);
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