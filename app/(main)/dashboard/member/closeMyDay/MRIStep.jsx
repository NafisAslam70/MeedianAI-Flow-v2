"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, AlertCircle, X } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

const toTitle = (value, fallback = "") => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const DEFAULT_AMRI_PROGRAMS = [
  { key: "MSP", label: "MSP" },
  { key: "MHCP", label: "MHCP" },
  { key: "MNP", label: "MNP" },
  { key: "MAP", label: "MAP" },
  { key: "MGHP", label: "MGHP" },
];

const BUILTIN_CATEGORY_FALLBACK = new Map(
  [
    ["nmri_moderator", "nmri"],
    ["msp_ele_moderator", "rmri"],
    ["msp_pre_moderator", "rmri"],
    ["mhcp1_moderator", "amri"],
    ["mhcp2_moderator", "amri"],
    ["events_moderator", "amri"],
    ["assessment_moderator", "amri"],
    ["sports_moderator", "amri"],
    ["util_moderator", "amri"],
    ["pt_moderator", "amri"],
  ].map(([key, value]) => [key.toLowerCase(), value])
);

const Tag = ({ children }) => (
  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 border border-teal-200">
    {children}
  </span>
);

const MODAL_ACCENT_STYLES = {
  teal: {
    title: "text-teal-700",
    badge: "bg-teal-100 text-teal-700",
    item: "border-teal-100 bg-teal-50/60",
    close: "hover:bg-teal-50",
  },
  rose: {
    title: "text-rose-700",
    badge: "bg-rose-100 text-rose-700",
    item: "border-rose-100 bg-rose-50/60",
    close: "hover:bg-rose-50",
  },
  amber: {
    title: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
    item: "border-amber-100 bg-amber-50/60",
    close: "hover:bg-amber-50",
  },
  indigo: {
    title: "text-indigo-700",
    badge: "bg-indigo-100 text-indigo-700",
    item: "border-indigo-100 bg-indigo-50/60",
    close: "hover:bg-indigo-50",
  },
};

export default function MRIStep({ handleNextStep, onMriClearedChange, onMriPayloadChange }) {
  const { data, error, isLoading } = useSWR("/api/member/mris/role-tasks", fetcher);
  const roleTaskBundles = Array.isArray(data?.roles) ? data.roles : [];

  const [activeAmriProgramKey, setActiveAmriProgramKey] = useState(null);
  const [modalData, setModalData] = useState(null);
  const router = useRouter();

  const { amriRoleBundles, rmriRoleBundles, omriRoleBundles, otherRoleBundles } = useMemo(() => {
    const amri = [];
    const rmri = [];
    const omri = [];
    const other = [];
    const normalizeCategory = (value) => {
      if (!value) return "";
      const raw = String(value).trim().toLowerCase();
      if (!raw) return "";
      const positiveMatches = [
        { tokens: ["amri", "academic", "academics", "acad"], result: "amri" },
        { tokens: ["rmri", "role-based", "role based", "rolebased"], result: "rmri" },
        { tokens: ["omri", "operational", "operations", "ops"], result: "omri" },
        { tokens: ["nmri"], result: "nmri" },
      ];
      for (const { tokens, result } of positiveMatches) {
        if (tokens.some((token) => raw.includes(token))) return result;
      }
      const stripped = raw.replace(/[^a-z]/g, "");
      if (["amri", "rmri", "omri", "nmri"].includes(stripped)) return stripped;
      if (stripped.endsWith("s")) {
        const singular = stripped.slice(0, -1);
        if (["amri", "rmri", "omri", "nmri"].includes(singular)) return singular;
      }
      return stripped;
    };

    for (const bundle of roleTaskBundles) {
      const rawCategory = bundle?.category;
      let cat = normalizeCategory(rawCategory);
      if (!cat) {
        if (bundle?.program) {
          cat = "amri";
        } else {
          const fallback = BUILTIN_CATEGORY_FALLBACK.get(String(bundle?.roleKey || "").toLowerCase());
          cat = fallback || "rmri";
        }
      }

      if (cat === "amri") {
        amri.push(bundle);
        continue;
      }
      if (cat === "rmri") {
        rmri.push(bundle);
        continue;
      }
      if (cat === "omri") {
        omri.push(bundle);
        continue;
      }
      if (cat === "nmri") {
        other.push({ ...bundle, category: "nmri" });
        continue;
      }
      other.push(bundle);
    }
    return { amriRoleBundles: amri, rmriRoleBundles: rmri, omriRoleBundles: omri, otherRoleBundles: other };
  }, [roleTaskBundles]);

  const amriProgramOptions = useMemo(() => {
    const map = new Map();
    for (const bundle of amriRoleBundles) {
      const subKey = String(bundle?.subCategory || "").trim().toUpperCase();
      const programKey = String(bundle?.program?.programKey || "").trim().toUpperCase();
      const key = subKey || programKey || "GENERAL";
      const label =
        bundle?.program?.name ||
        (subKey && subKey !== "GENERAL"
          ? subKey
          : programKey
          ? programKey
          : key === "GENERAL"
          ? "General"
          : key);
      if (!map.has(key)) {
        map.set(key, { key, label, roles: [] });
      }
      map.get(key).roles.push(bundle);
    }

    const ordered = DEFAULT_AMRI_PROGRAMS.map((preset) => {
      const existing = map.get(preset.key);
      return existing ? { ...existing, label: existing.label || preset.label } : { key: preset.key, label: preset.label, roles: [] };
    });

    const extras = Array.from(map.values())
      .filter((program) => !DEFAULT_AMRI_PROGRAMS.some((preset) => preset.key === program.key))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [...ordered, ...extras];
  }, [amriRoleBundles]);

  const rmriGroupList = useMemo(() => {
    const map = new Map();
    rmriRoleBundles.forEach((bundle) => {
      const key = (bundle?.subCategory || "General").trim() || "General";
      const norm = key.toUpperCase();
      if (!map.has(norm)) {
        map.set(norm, { key: norm, label: toTitle(key, "General"), roles: [] });
      }
      map.get(norm).roles.push(bundle);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [rmriRoleBundles]);

  const omriGroupList = useMemo(() => {
    const map = new Map();
    omriRoleBundles.forEach((bundle) => {
      const subKey = (bundle?.subCategory || "Ops").trim() || "Ops";
      const norm = subKey.toUpperCase();
      if (!map.has(norm)) {
        map.set(norm, { key: norm, label: toTitle(subKey, "Ops"), roles: [] });
      }
      map.get(norm).roles.push(bundle);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [omriRoleBundles]);

  const otherCategorySections = useMemo(() => {
    const categoryMap = new Map();
    otherRoleBundles.forEach((bundle) => {
      const catKey = "other";
      if (!categoryMap.has(catKey)) {
        categoryMap.set(catKey, {
          key: catKey,
          label: "Other Roles",
          groups: new Map(),
        });
      }
      const container = categoryMap.get(catKey);
      const subKeyRaw = (bundle?.subCategory || "General").trim();
      const subKey = subKeyRaw ? subKeyRaw : "General";
      const subNorm = subKey.toUpperCase();
      if (!container.groups.has(subNorm)) {
        container.groups.set(subNorm, {
          key: subNorm,
          label: toTitle(subKey, "General"),
          roles: [],
        });
      }
      container.groups.get(subNorm).roles.push(bundle);
    });

    return Array.from(categoryMap.values())
      .map((section) => ({
        ...section,
        groups: Array.from(section.groups.values()).sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [otherRoleBundles]);

  useEffect(() => {
    if (!amriProgramOptions.length) {
      if (activeAmriProgramKey !== null) setActiveAmriProgramKey(null);
      return;
    }
    const exists = amriProgramOptions.some((program) => program.key === activeAmriProgramKey);
    if (!exists) {
      const firstWithRoles = amriProgramOptions.find((program) => program.roles.length > 0);
      setActiveAmriProgramKey((firstWithRoles || amriProgramOptions[0]).key);
    }
  }, [amriProgramOptions, activeAmriProgramKey]);

  useEffect(() => {
    if (isLoading) return;
    onMriClearedChange?.(true);
    onMriPayloadChange?.({ groupedRoles: roleTaskBundles.length });
  }, [isLoading, roleTaskBundles.length, onMriClearedChange, onMriPayloadChange]);

  const openRolesModal = (config) => {
    setModalData({
      accent: "teal",
      emptyMessage: "No roles assigned yet.",
      ...config,
    });
  };

  const closeModal = () => setModalData(null);

  const modalAccent = MODAL_ACCENT_STYLES[modalData?.accent] || MODAL_ACCENT_STYLES.teal;

  const todayIso = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const { data: todayMRIsData, error: todayMRIsError } = useSWR(
    "/api/member/myMRIs?section=today",
    fetcher
  );
  const { data: weeklyMRIsData, error: weeklyMRIsError } = useSWR(
    "/api/member/myMRIs?section=weekly",
    fetcher
  );
  const todayNMRIs = todayMRIsData?.nMRIs || [];
  const weeklyNMRIs = weeklyMRIsData?.nMRIs || [];

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <CheckCircle size={18} className="text-teal-600" />
        MRI Clearance
      </h3>

      {error && (
        <div className="mb-3 flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={16} /> {error.message}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading your MRI roles…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Academic MRIs Card */}
          <motion.div
            className="h-full bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-5 border border-teal-100/50"
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-blue-600" />
                <h4 className="text-base font-bold text-gray-800">A-MRIs (Academic)</h4>
              </div>
              <div className="flex gap-2">
                <Tag>MSP</Tag>
                <Tag>MHCP</Tag>
              </div>
            </div>

            {amriProgramOptions.length === 0 ? (
              <p className="text-sm text-gray-600">No academic MRIs assigned to you right now.</p>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Tap a program below to review the roles you carry before continuing.
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                  {amriProgramOptions.map((program, index) => {
                    const isActive = program.key === activeAmriProgramKey;
                    const hasRoles = program.roles.length > 0;
                    return (
                      <motion.button
                        type="button"
                        key={program.key}
                        className={`rounded-lg px-3 py-2 flex flex-col items-center justify-center text-xs font-semibold transition-all duration-300 text-center ${
                          isActive ? "bg-teal-600 text-white shadow" : "bg-teal-50/80 text-teal-800 hover:bg-teal-100"
                        }`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => {
                          setActiveAmriProgramKey(program.key);
                          openRolesModal({
                            title: `${program.label} • Academic MRIs`,
                            subtitle: hasRoles
                              ? `${program.roles.length} role${program.roles.length > 1 ? "s" : ""} assigned`
                              : "No roles assigned",
                            roles: program.roles,
                            emptyMessage: `No AMRI roles assigned for ${program.label}.`,
                            accent: "teal",
                          });
                        }}
                      >
                        <span className="text-sm">{program.label}</span>
                        <span className={`mt-1 text-[0.6rem] font-medium ${isActive ? "text-teal-100" : "text-teal-600/70"}`}>
                          {hasRoles ? `${program.roles.length} role${program.roles.length > 1 ? "s" : ""}` : "No roles"}
                        </span>
                        <span className={`mt-1 text-[0.55rem] ${isActive ? "text-teal-100/80" : "text-teal-600/60"}`}>
                          View details
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>

          {/* N-MRIs Card */}
          <motion.div
            className="h-full bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-5 border border-green-100/60"
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <h4 className="text-base font-bold text-gray-800">N-MRIs (Non-Academic)</h4>
              </div>
              <Tag>Non-Academic</Tag>
            </div>
            {/* Show today's N-MRIs */}
            <div className="mb-2">
              <span className="text-xs font-semibold text-green-700">Today's N-MRIs:</span>
              {todayNMRIs.length === 0 ? (
                <p className="text-sm text-gray-600">No N-MRIs for today.</p>
              ) : (
                <ul className="list-disc ml-4 mt-1">
                  {todayNMRIs.map((n, i) => (
                    <li key={i} className="text-xs text-slate-600">{n.name || n.title || n}</li>
                  ))}
                </ul>
              )}
            </div>
            {/* Show weekly N-MRIs */}
            <div className="mb-2">
              <span className="text-xs font-semibold text-green-700">Weekly N-MRIs:</span>
              {weeklyNMRIs.length === 0 ? (
                <p className="text-sm text-gray-600">No N-MRIs for this week.</p>
              ) : (
                <ul className="list-disc ml-4 mt-1">
                  {weeklyNMRIs.map((n, i) => (
                    <li key={i} className="text-xs text-slate-600">{n.name || n.title || n}</li>
                  ))}
                </ul>
              )}
            </div>
            {/* Show N-MRI roles as before */}
            {otherRoleBundles.filter(r => r.category === "nmri").length === 0 ? (
              <p className="text-sm text-gray-600">No N-MRIs assigned to you right now.</p>
            ) : (
              <div className="space-y-3">
                {otherRoleBundles.filter(r => r.category === "nmri").map((role, idx) => (
                  <motion.button
                    type="button"
                    key={role.roleKey || role.id || idx}
                    className="w-full rounded-xl border border-green-100 bg-green-50/80 p-3 text-left shadow-sm"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      openRolesModal({
                        title: `${role.roleName || role.roleKey || "N-MRI Role"} • Non-Academic MRI`,
                        subtitle: role.tasks?.length ? `${role.tasks.length} task${role.tasks.length > 1 ? "s" : ""}` : "No tasks assigned",
                        roles: [role],
                        emptyMessage: `No tasks assigned for this N-MRI role.`,
                        accent: "green",
                      })
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-green-700">{role.roleName || role.roleKey || "N-MRI Role"}</span>
                      <span className="text-[0.65rem] text-green-600/80 font-medium">
                        {role.tasks?.length ? `${role.tasks.length} task${role.tasks.length > 1 ? "s" : ""}` : "No tasks"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-green-600/80">Tap to view tasks.</p>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Role-Based MRIs Card */}
          <motion.div
            className="h-full bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-5 border border-rose-100/60"
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-rose-500" />
                <h4 className="text-base font-bold text-gray-800">R-MRIs (Role-Based)</h4>
              </div>
              <Tag>Roles</Tag>
            </div>
            {rmriGroupList.length === 0 ? (
              <p className="text-sm text-gray-600">No role-based MRIs assigned to you right now.</p>
            ) : (
              <div className="space-y-3">
                {rmriGroupList.map((group) => (
                  <motion.button
                    type="button"
                    key={group.key}
                    className="w-full rounded-xl border border-rose-100 bg-rose-50/80 p-3 text-left shadow-sm"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      openRolesModal({
                        title: `${group.label} • Role-Based MRIs`,
                        subtitle: `${group.roles.length} role${group.roles.length > 1 ? "s" : ""} assigned`,
                        roles: group.roles,
                        emptyMessage: `No role-based MRIs assigned for ${group.label}.`,
                        accent: "rose",
                      })
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-rose-700">{group.label}</span>
                      <span className="text-[0.65rem] text-rose-600/80 font-medium">
                        {group.roles.length} role{group.roles.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-rose-600/80">Tap to view assigned roles.</p>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Office MRIs Card */}
          <motion.div
            className="h-full bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-5 border border-amber-100/60"
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-amber-500" />
                <h4 className="text-base font-bold text-gray-800">O-MRIs (Office)</h4>
              </div>
              <Tag>Office</Tag>
            </div>
            {omriGroupList.length === 0 ? (
              <p className="text-sm text-gray-600">No office MRIs assigned to you right now.</p>
            ) : (
              <div className="space-y-3">
                {omriGroupList.map((group) => (
                  <motion.button
                    type="button"
                    key={group.key}
                    className="w-full rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-left shadow-sm"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      openRolesModal({
                        title: `${group.label} • Office MRIs`,
                        subtitle: `${group.roles.length} role${group.roles.length > 1 ? "s" : ""} assigned`,
                        roles: group.roles,
                        emptyMessage: `No office MRIs assigned for ${group.label}.`,
                        accent: "amber",
                      })
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-amber-700">{group.label}</span>
                      <span className="text-[0.65rem] text-amber-600/80 font-medium">
                        {group.roles.length} role{group.roles.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-amber-600/80">Tap to view assigned roles.</p>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Other MRI Roles Card */}
          {otherCategorySections.length > 0 && (
            <motion.div
              className="lg:col-span-3 h-full bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-5 border border-indigo-100/60"
              whileHover={{ scale: 1.01 }}
            >
              <h4 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-indigo-500" /> Other MRI Roles
              </h4>
              <div className="space-y-4">
                {otherCategorySections.map((section) => (
                  <div key={section.key} className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3">
                    <p className="text-sm font-semibold text-indigo-700 mb-2">{section.label}</p>
                    <div className="space-y-3">
                      {section.groups.map((group) => (
                        <motion.button
                          type="button"
                          key={`${section.key}-${group.key}`}
                          className="w-full rounded-xl bg-white/90 p-3 text-left shadow-sm border border-indigo-100"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() =>
                            openRolesModal({
                              title: `${group.label} • ${section.label}`,
                              subtitle: `${group.roles.length} role${group.roles.length > 1 ? "s" : ""} assigned`,
                              roles: group.roles,
                              emptyMessage: `No MRI roles recorded for ${group.label}.`,
                              accent: "indigo",
                            })
                          }
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-indigo-800">{group.label}</span>
                            <span className="text-[0.65rem] text-indigo-600/80 font-medium">
                              {group.roles.length} role{group.roles.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-indigo-600/80">Tap to view assigned roles.</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      <div className="flex justify-center fixed bottom-6 left-0 w-full z-40">
        <motion.button
          onClick={handleNextStep}
          className="bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-300 hover:bg-blue-700 shadow-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Next
        </motion.button>
      </div>

      <AnimatePresence>
        {modalData && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl md:p-8"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeModal}
                className={`absolute right-4 top-4 rounded-full p-2 text-slate-500 transition ${modalAccent.close}`}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="space-y-3 pr-6">
                <h3 className={`text-lg font-semibold leading-tight ${modalAccent.title}`}>
                  {modalData.title}
                </h3>
                {modalData.subtitle && (
                  <span className={`inline-flex w-max items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${modalAccent.badge}`}>
                    {modalData.subtitle}
                  </span>
                )}
                {modalData.description && (
                  <p className="text-sm text-slate-600">{modalData.description}</p>
                )}
              </div>

              {modalData.roles && modalData.roles.length > 0 ? (
                <div className="mt-5 grid grid-cols-1 gap-2">
                  {modalData.roles.map((role, index) => {
                    const roleKey = role?.roleKey || role?.id || `${modalData.title}-role-${index}`;
                    return (
                      <button
                        key={roleKey}
                        className={`w-full text-left rounded-xl border px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 ${modalAccent.item}`}
                        onClick={() => setModalData({
                          title: role?.roleName || role?.roleKey || "Role",
                          subtitle: role?.program?.name ? `Program: ${role.program.name}` : undefined,
                          description: role?.subCategory ? `Category: ${toTitle(role.subCategory)}` : undefined,
                          tasks: Array.isArray(role.tasks) ? role.tasks : [],
                          accent: modalData.accent,
                          isTaskModal: true,
                          emptyMessage: "No tasks assigned to this role."
                        })}
                      >
                        <span>{role?.roleName || role?.roleKey || "Role"}</span>
                        {role?.program?.name && (
                          <p className="mt-1 text-[0.7rem] text-slate-500">Program: {role.program.name}</p>
                        )}
                        {role?.subCategory && (
                          <p className="text-[0.7rem] text-slate-500">Category: {toTitle(role.subCategory)}</p>
                        )}
                        <span className="block mt-1 text-xs text-blue-600 underline">View tasks</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">{modalData.emptyMessage}</p>
              )}

              {/* Show tasks modal if opened */}
              {modalData?.isTaskModal && (
                <AnimatePresence>
                  <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={closeModal}
                  >
                    <motion.div
                      className="relative w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl md:p-6"
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 40, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={closeModal}
                        className={`absolute right-3 top-3 rounded-full p-1 text-slate-500 transition ${modalAccent.close}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <h3 className={`text-base font-semibold leading-tight ${modalAccent.title}`}>{modalData.title}</h3>
                      {modalData.subtitle && (
                        <span className={`inline-flex w-max items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold ${modalAccent.badge}`}>{modalData.subtitle}</span>
                      )}
                      {modalData.description && (
                        <p className="text-xs text-slate-600">{modalData.description}</p>
                      )}
                      {modalData.tasks && modalData.tasks.length > 0 ? (
                        <div className="mt-4 grid grid-cols-1 gap-2">
                          {modalData.tasks.map((task, i) => (
                            <div key={i} className="rounded-lg border border-blue-100 bg-blue-50/60 p-2 shadow-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle className="w-3 h-3 text-blue-600" />
                                <span className="text-sm font-bold text-blue-800">{task.title || task.name || `Task ${i + 1}`}</span>
                              </div>
                              {task.description && (
                                <p className="text-xs text-blue-700 mb-1">{task.description}</p>
                              )}
                              {task.status && (
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[0.6rem] font-semibold ${task.status === "completed" ? "bg-green-100 text-green-700" : task.status === "in_progress" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-700"}`}>
                                  {toTitle(task.status)}
                                </span>
                              )}
                              {task.time && (
                                <div className="mt-1 text-[0.7rem] text-blue-500">Time: {task.time}</div>
                              )}
                              {task.details && (
                                <div className="mt-1 text-[0.7rem] text-blue-500">Details: {task.details}</div>
                              )}
                              <div className="mt-2 flex justify-end">
                                <button
                                  type="button"
                                  className="bg-blue-600 text-white px-3 py-1 rounded-md font-semibold text-[0.7rem] shadow hover:bg-blue-700 transition"
                                  onClick={() => {
                                    if (typeof window !== "undefined") {
                                      localStorage.setItem("mri:executeTask", JSON.stringify(task));
                                    }
                                    router.push("/dashboard/member/myMeedRituals?executeTask=1");
                                  }}
                                >
                                  Execute
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-xs text-slate-500">{modalData.emptyMessage}</p>
                      )}
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={closeModal}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Close
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
