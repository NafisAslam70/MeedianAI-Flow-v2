"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function ProgramDetailPage() {
  // ...existing hooks and state...

  // Extract and save the entire day's grid as a seed (for copy-paste reuse)
  function extractAndSaveCurrentSeed(day) {
    const codeById = new Map((codeData?.codes || []).map(c => [c.id, c.code]));
    const seed = {};
    Object.entries(staged).forEach(([k, cid]) => {
      const [d, cls, pk] = k.split('|');
      if (d !== day) return;
      if (!seed[cls]) seed[cls] = {};
      seed[cls][pk] = codeById.get(cid) || null;
    });
    if (Object.keys(seed).length === 0) {
      alert('No data for this day.');
      return;
    }
    navigator.clipboard.writeText(JSON.stringify(seed, null, 2));
    alert('Seed copied to clipboard!\n' + JSON.stringify(seed, null, 2));
  if (typeof refreshCells === 'function') refreshCells();
  }
  const params = useParams();
  const id = Number(params?.id);
  const { data: progData } = useSWR(id ? `/api/admin/manageMeedian?section=metaPrograms` : null, fetcher);
  const program = useMemo(() => (progData?.programs || []).find((p) => p.id === id), [progData, id]);

  const searchParams = useSearchParams();
  const [track, setTrack] = useState("pre_primary");
  const trackOptions = [
    { value: "pre_primary", label: "Pre-Primary" },
    { value: "elementary", label: "Elementary" },
  ];
  const [periodTrack, setPeriodTrack] = useState("pre_primary");
  const [periodCache, setPeriodCache] = useState({});
  const [periodLoading, setPeriodLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(null); // null => show all / cards view
  const [view, setView] = useState("cards"); // cards | detail
  const [preview, setPreview] = useState({ open: false, track: "pre_primary" });

  // Update active section from URL hash so clicking sidebar sublinks shows only that section
  useEffect(() => {
    const readHash = () => {
      const h = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
      if (["overview", "schedule", "trackers"].includes(h)) setActiveSection(h);
      else setActiveSection(null);
      setView(["overview", "schedule", "trackers"].includes(h) ? "detail" : "cards");
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);
  // Respect ?track=pre_primary|elementary from quick buttons
  useEffect(() => {
    const t = (searchParams?.get("track") || "").toLowerCase();
    if (t === "pre_primary" || t === "elementary") setTrack(t);
  }, [searchParams]);
  const { data: periodData, mutate: refreshPeriods } = useSWR(id ? `/api/admin/manageMeedian?section=programPeriods&programId=${id}&track=${track}` : null, fetcher);
  const { data: cellData, mutate: refreshCells } = useSWR(id ? `/api/admin/manageMeedian?section=programScheduleCells&programId=${id}&track=${track}` : null, fetcher);
  const { data: asgData, mutate: refreshAsg } = useSWR(`/api/admin/manageMeedian?section=mspCodeAssignments`, fetcher);
  const { data: teamData } = useSWR(`/api/admin/manageMeedian?section=team`, fetcher);
  const { data: codeData } = useSWR(`/api/admin/manageMeedian?section=mspCodes`, fetcher);
  const { data: klassData, mutate: refreshKlass } = useSWR(`/api/admin/manageMeedian?section=classes&track=${track}`, fetcher);
  // Derive classes (SOP override -> cells -> fallback)
  const classes = useMemo(() => {
    const fromDb =
      (klassData?.classes || [])
        .filter((c) => {
          const rowTrack = String(c.track || "").toLowerCase();
          return rowTrack === String(track).toLowerCase() || rowTrack === "both";
        })
        .map((c) => String(c.name || c.id || ""))
        .filter(Boolean);

    if (fromDb.length) return fromDb;

    const fromSop = program?.sop?.classList?.[track];
    if (Array.isArray(fromSop) && fromSop.length) {
      return fromSop.map(String).filter(Boolean);
    }

    if (track === "pre_primary") {
      return ["Nursery", "LKG", "UKG"];
    }
    if (track === "elementary") {
      const cells = cellData?.cells || [];
      const cls = Array.from(new Set(cells.map((c) => String(c.className || c.classId))))
        .filter((v) => /^\d+$/.test(v));
      return cls.length ? cls : ["1", "2", "3", "4", "5", "6", "7", "8"];
    }

    return [];
  }, [klassData, program, cellData, track]);

  const effectiveClasses = useMemo(() => {
    const normalizeTrack = (value) => String(value || "").toLowerCase();
    const isPrePrimaryName = (value) => {
      const v = String(value || "").trim().toLowerCase();
      if (!v) return false;
      if (v === "lkg" || v === "ukg" || v === "nur" || v === "nursery") return true;
      return v.startsWith("nur");
    };
    const romanRegex = /^(i|ii|iii|iv|v|vi|vii|viii)$/i;

    const belongsToTrack = (cls) => {
      const selectedTrack = normalizeTrack(track);
      const clsTrack = normalizeTrack(cls.track);
      const name = String(cls.name || cls.id || "").trim();
      const nameLower = name.toLowerCase();

      if (!selectedTrack) return true;
      if (clsTrack === selectedTrack || clsTrack === "both") return true;

      if (!clsTrack) {
        if (selectedTrack === "pre_primary") {
          return isPrePrimaryName(nameLower);
        }
        if (selectedTrack === "elementary") {
          return /^\d+$/.test(name) || romanRegex.test(nameLower);
        }
      }

      return false;
    };

    const base = (klassData?.classes && klassData.classes.length)
      ? klassData.classes
      : (classes || []).map((name) => ({ name, track }));

    const seen = new Set();
    const list = [];
    (base || []).forEach((c) => {
      if (!belongsToTrack(c)) return;
      const nm = String(c.name || c.id || "");
      const tr = normalizeTrack(c.track) || normalizeTrack(track);
      const displayTrack = c.trackLabel || (tr === "pre_primary" ? "pre-primary" : tr);
      const key = c.id != null ? String(c.id) : `${nm}|${tr}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ ...c, name: nm, track: tr, displayTrack, _key: key, id: c.id });
      }
    });

    if (!list.length) return [];

    return list.sort((a, b) => {
      const an = Number(a.name);
      const bn = Number(b.name);
      const anNum = !Number.isNaN(an);
      const bnNum = !Number.isNaN(bn);
      if (anNum && bnNum) return an - bn;
      if (anNum) return -1;
      if (bnNum) return 1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [klassData, classes, track]);
  const [fullscreen, setFullscreen] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [schedTab, setSchedTab] = useState("base"); // base | weekly
  const [weekDay, setWeekDay] = useState("Mon");
  const [manageCodesOpen, setManageCodesOpen] = useState(false);
  const [dragMemberId, setDragMemberId] = useState(null);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [showDefaultSeedModal, setShowDefaultSeedModal] = useState(false);
  const [periodDraft, setPeriodDraft] = useState([]);
  const [periodSnapshot, setPeriodSnapshot] = useState("");
  const [periodSaving, setPeriodSaving] = useState(false);
  const [periodError, setPeriodError] = useState("");
  const timeToInput = (value) => {
    if (!value) return "";
    const str = String(value);
    const match = str.match(/^(\d{2}:\d{2})/);
    if (match) return match[1];
    if (str.length >= 5) return str.slice(0, 5);
    return str;
  };

  const ensureSeconds = (value) => {
    if (!value) return "";
    const str = String(value);
    if (/^\d{2}:\d{2}:\d{2}$/.test(str)) return str;
    if (/^\d{2}:\d{2}$/.test(str)) return `${str}:00`;
    return str;
  };

  const serializePeriods = (rows) =>
    JSON.stringify(
      rows.map((row) => ({
        periodKey: String(row.periodKey || "").trim(),
        startTime: String(row.startTime || ""),
        endTime: String(row.endTime || ""),
      }))
    );

  const parsePeriodNumber = (key) => {
    const match = String(key || "").match(/(\d+)/);
    return match ? Number(match[1]) : null;
  };

  const sortPeriodRows = (rows) => {
    return [...rows].sort((a, b) => {
      const na = parsePeriodNumber(a.periodKey);
      const nb = parsePeriodNumber(b.periodKey);
      const aHasNum = Number.isFinite(na);
      const bHasNum = Number.isFinite(nb);
      if (aHasNum && bHasNum && na !== nb) return na - nb;
      if (aHasNum && !bHasNum) return -1;
      if (!aHasNum && bHasNum) return 1;
      return String(a.periodKey || "").localeCompare(String(b.periodKey || ""));
    });
  };

  const deriveNextPeriodKey = (rows) => {
    const numbers = rows
      .map((row) => parsePeriodNumber(row.periodKey))
      .filter((n) => Number.isFinite(n));
    if (!numbers.length) return `P${rows.length + 1}`;
    return `P${Math.max(...numbers) + 1}`;
  };

  const handleModalTrackChange = (nextTrack) => {
    if (nextTrack === periodTrack) return;
    const proceed = !periodDirty ||
      (typeof window === "undefined" || window.confirm("Discard unsaved period changes?"));
    if (!proceed) return;
    setPeriodDraft([]);
    setPeriodSnapshot(serializePeriods([]));
    setPeriodError("");
    setPeriodTrack(nextTrack);
  };

  const [selfSchedOpen, setSelfSchedOpen] = useState(false);
  const [selfStageOpen, setSelfStageOpen] = useState(false);
  const [selfPlanMode, setSelfPlanMode] = useState('fixed_all_days'); // fixed_all_days | split_same_subject | same_period_diff_subject
  const [selfSchedFull, setSelfSchedFull] = useState(false);
  const lockPushRef = useRef(null);
  // Scheduler day selection (for header controls)
  const [daysMode, setDaysMode] = useState('all'); // all | split
  const [daysSel, setDaysSel] = useState({ Mon:true, Tue:true, Wed:true, Thu:true, Fri:false, Sat:true });
  const [mspRMode, setMspRMode] = useState("class"); // class | teacher
  const [selectedTeacher, setSelectedTeacher] = useState("ALL");
  const [routineOpen, setRoutineOpen] = useState(false);
  const [rmPrompt, setRmPrompt] = useState("Draft an MSP routine matrix JSON for the selected track. Use period keys P1..P8 and map each class to {P#: [\"CODE\", \"SUBJECT\"]}. Only return JSON.");
  const [rmOut, setRmOut] = useState("");
  const [rmBusy, setRmBusy] = useState(false);
  const [rmEngine, setRmEngine] = useState("default"); // default = DELU-GPT env
  const [rmModel, setRmModel] = useState("gpt-4o-mini");
  const { data: dayData, mutate: refreshDays } = useSWR(fullscreen && id ? `/api/admin/manageMeedian?section=programScheduleDays&programId=${id}&track=${track}&day=${weekDay}` : null, fetcher);

  useEffect(() => {
    if (!track || !Array.isArray(periodData?.periods)) return;
    setPeriodCache((prev) => {
      if (prev[track] === periodData.periods) return prev;
      return { ...prev, [track]: periodData.periods };
    });
  }, [track, periodData]);

  const periodDirty = useMemo(() => {
    if (!showPeriodModal) return false;
    return serializePeriods(periodDraft) !== periodSnapshot;
  }, [showPeriodModal, periodDraft, periodSnapshot]);

  const trackLabel = track === "pre_primary" ? "Pre-Primary" : track === "elementary" ? "Elementary" : String(track || "");
  const periodTrackLabel = periodTrack === "pre_primary" ? "Pre-Primary" : periodTrack === "elementary" ? "Elementary" : String(periodTrack || "");

  useEffect(() => {
    if (!showPeriodModal || !periodTrack || !id) return;
    if (Object.prototype.hasOwnProperty.call(periodCache, periodTrack)) return;
    let cancelled = false;
    (async () => {
      try {
        setPeriodLoading(true);
        const res = await fetch(`/api/admin/manageMeedian?section=programPeriods&programId=${id}&track=${periodTrack}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Failed to load periods (HTTP ${res.status})`);
        if (cancelled) return;
        setPeriodCache((prev) => ({ ...prev, [periodTrack]: json.periods || [] }));
      } catch (error) {
        if (!cancelled) setPeriodError(error.message || "Failed to load periods.");
      } finally {
        if (!cancelled) setPeriodLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showPeriodModal, periodTrack, id, periodCache]);

  useEffect(() => {
    if (!showPeriodModal) return;
    const sourceRows = sortPeriodRows(
      (periodCache[periodTrack] || [])
        .filter((row) => {
          if (!periodTrack) return true;
          const rowTrack = String(row.track || "").toLowerCase();
          return rowTrack === String(periodTrack).toLowerCase() || !rowTrack;
        })
    );
    const base = sourceRows.map((row) => ({
      track: row.track || periodTrack,
      periodKey: row.periodKey || "",
      startTime: timeToInput(row.startTime),
      endTime: timeToInput(row.endTime),
    }));
    const rows = base.length ? base : [{ track: periodTrack, periodKey: "P1", startTime: "", endTime: "" }];
    const serialized = serializePeriods(rows);
    if (periodDirty && periodSnapshot) return;
    if (serialized === periodSnapshot) return;
    setPeriodDraft(rows);
    setPeriodSnapshot(serialized);
    setPeriodError("");
  }, [showPeriodModal, periodCache, periodTrack, track, periodDirty, periodSnapshot]);

  const handlePeriodFieldChange = (index, field, value) => {
    setPeriodDraft((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        if (field === "periodKey") {
          return {
            ...row,
            periodKey: String(value || "").toUpperCase().replace(/\s+/g, ""),
          };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const handleAddPeriod = () => {
    setPeriodDraft((prev) => {
      const nextKey = deriveNextPeriodKey(prev);
      const last = prev[prev.length - 1];
      const carryTime = last ? (last.endTime || last.startTime || "") : "";
      return [
        ...prev,
        {
          track: periodTrack,
          periodKey: nextKey,
          startTime: carryTime,
          endTime: "",
        },
      ];
    });
  };

  const handleRemovePeriod = (index) => {
    setPeriodDraft((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleAutoReindexPeriods = () => {
    setPeriodDraft((prev) => prev.map((row, idx) => ({ ...row, periodKey: `P${idx + 1}` })));
  };

  const handleSavePeriods = async () => {
    if (!id) return;
    setPeriodSaving(true);
    setPeriodError("");
    try {
      const activeTrack = periodTrack || track || "pre_primary";
      const prepared = sortPeriodRows(
        periodDraft.map((row) => ({
          track: row.track || activeTrack,
          periodKey: String(row.periodKey || "").trim(),
          startTime: String(row.startTime || "").trim(),
          endTime: String(row.endTime || "").trim(),
        }))
      );
      if (!prepared.length) throw new Error("Add at least one period before saving.");
      for (const row of prepared) {
        if (!row.periodKey) throw new Error("Each period needs a key.");
        if (!row.startTime || !row.endTime) throw new Error(`Fill start and end time for ${row.periodKey}.`);
      }
      const payload = prepared.map((row) => ({
        track: row.track || activeTrack,
        periodKey: row.periodKey,
        startTime: ensureSeconds(row.startTime),
        endTime: ensureSeconds(row.endTime),
      }));
      const res = await fetch(`/api/admin/manageMeedian?section=programPeriods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: id, periods: payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed to save periods (HTTP ${res.status})`);
      if (periodTrack === track) await refreshPeriods?.();
      setPeriodCache((prev) => ({ ...prev, [activeTrack]: payload }));
      const normalizedDraft = prepared.map((row) => ({
        ...row,
        track: row.track || activeTrack,
        startTime: timeToInput(row.startTime),
        endTime: timeToInput(row.endTime),
      }));
      setPeriodDraft(normalizedDraft);
      setPeriodSnapshot(serializePeriods(normalizedDraft));
    } catch (error) {
      setPeriodError(error.message || "Failed to save periods.");
    } finally {
      setPeriodSaving(false);
    }
  };

  // --- Manage Classes state ---
  const [manageClassesOpen, setManageClassesOpen] = useState(false);
  const [manageClassesStep, setManageClassesStep] = useState('pick'); // pick | list
  const [newClassName, setNewClassName] = useState("");
  const [classLoading, setClassLoading] = useState(false);
  // removed: section selector for Manage Classes
  const [editedClasses, setEditedClasses] = useState({});
  const [rowSaving, setRowSaving] = useState(null);
  const [bulkSaving, setBulkSaving] = useState(false);


  // Adapter for the modal’s current rendering (id/name fields)
  const classList = useMemo(
    () => classes.map((name) => ({ id: name, name })),
    [classes]
  );

  async function saveClassList(nextList) {
    setClassLoading(true);
    try {
      // fetch current programs to get the latest SOP
      const mp = await fetch("/api/admin/manageMeedian?section=metaPrograms", { cache: "no-store" });
      const mj = await mp.json().catch(() => ({}));
      const prog = (mj?.programs || []).find((p) => p.id === id);
      const sop = prog?.sop || {};

      // write classes per track
      sop.classList = sop.classList || {};
      sop.classList[track] = nextList.map(String);

      const pr = await fetch("/api/admin/manageMeedian?section=programSOP", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: id, sop }),
      });
      const pj = await pr.json().catch(() => ({}));
      if (!pr.ok) throw new Error(pj.error || `HTTP ${pr.status}`);

      // Optional: refresh schedule data if needed
      await Promise.all([refreshCells?.(), refreshPeriods?.()]);
    } finally {
      setClassLoading(false);
    }
  }

  async function handleAddClass() {
    const base = newClassName.trim();
    const name = base; // ignore section in name
    if (!name) return;
    const next = Array.from(new Set([...classes.map(String), name]));
    await saveClassList(next);
    setNewClassName("");
    setEditedClasses({});
    // keep section as-is so multiple classes can be added quickly
  }

  async function handleDeleteClass(target) {
    const klass = typeof target === "object" && target !== null
      ? target
      : { name: String(target), track };
    const className = String(klass.name || klass.id);
    const classTrack = String(klass.track || track);
    const classKey = klass._key || (klass.id != null ? String(klass.id) : `${className}|${classTrack}`);
    if (!className) return;
    if (typeof window !== "undefined") {
      const confirmDelete = window.confirm(`Delete class "${className}"? This removes related schedule entries.`);
      if (!confirmDelete) return;
    }
    setRowSaving(classKey);
    try {
      const res = await fetch('/api/admin/manageMeedian?section=classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: klass.id, name: className, track: classTrack, remove: true })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);

      const next = classes.filter((c) => String(c) !== String(className));
      await saveClassList(next);
      setEditedClasses((prev) => {
        const copy = { ...prev };
        delete copy[classKey];
        return copy;
      });
      await refreshKlass?.();
      await syncSOPFromDB();
    } catch (e) {
      const msg = e?.message || 'Failed to delete class';
      if (typeof window !== 'undefined') window.alert(msg);
    } finally {
      setRowSaving(null);
    }
  }

  const hasPendingEdits = useMemo(() => {
    return effectiveClasses.some((cls) => {
      const key = cls._key || (cls.id != null ? String(cls.id) : String(cls.name || cls.id));
      const edited = editedClasses[key];
      if (!edited) return false;
      const currentName = String(cls.name || cls.id || "");
      const currentTrack = String(cls.track || track);
      const currentActive = cls.active !== false;
      const nextNameRaw = edited.name ?? currentName;
      const nextName = nextNameRaw.trim();
      const nextTrack = edited.track || currentTrack;
      const nextActive = typeof edited.active === 'boolean' ? edited.active : currentActive;

      if (nextName !== currentName && nextName.length > 0) return true;
      if (nextName.length === 0 && nextNameRaw !== currentName) return true;
      if (nextTrack !== currentTrack) return true;
      if (nextActive !== currentActive) return true;
      return false;
    });
  }, [editedClasses, effectiveClasses, track]);

  async function handlePersistEdits() {
    if (!hasPendingEdits) return;
    setBulkSaving(true);
    let appliedChanges = false;
    try {
      for (const cls of effectiveClasses) {
        const key = cls._key || (cls.id != null ? String(cls.id) : String(cls.name || cls.id));
        const edited = editedClasses[key];
        if (!edited) continue;

        const currentName = String(cls.name || cls.id || "");
        const currentTrack = String(cls.track || track);
        const currentActive = cls.active !== false;

        const nextNameRaw = edited.name ?? currentName;
        const trimmedName = nextNameRaw.trim();
        if (trimmedName.length === 0) {
          if (nextNameRaw !== currentName && typeof window !== 'undefined') {
            window.alert(`Class name cannot be blank for "${currentName}".`);
          }
          throw new Error("validation");
        }

        const nextName = trimmedName;
        const nextTrack = edited.track || currentTrack;
        const nextActive = typeof edited.active === 'boolean' ? edited.active : currentActive;

        if (nextName === currentName && nextTrack === currentTrack && nextActive === currentActive) {
          continue;
        }

        const payload = {
          id: cls.id,
          name: nextName,
          track: nextTrack,
          active: nextActive,
        };
        if (cls.id == null) {
          payload.oldName = currentName;
          payload.oldTrack = currentTrack;
        }

        const res = await fetch('/api/admin/manageMeedian?section=classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Failed: HTTP ${res.status}`);
        }

        appliedChanges = true;
      }

    } catch (e) {
      if (e?.message !== 'validation' && typeof window !== 'undefined') {
        window.alert(e?.message || 'Failed to save changes');
      }
    } finally {
      if (appliedChanges) {
        try {
          await refreshKlass?.();
          await syncSOPFromDB();
          setEditedClasses({});
        } catch (err) {
          if (typeof window !== 'undefined') {
            window.alert(err?.message || 'Failed to refresh classes after saving');
          }
        }
      }
      setBulkSaving(false);
    }
  }

  async function syncSOPFromDB() {
    try {
      const res = await fetch(`/api/admin/manageMeedian?section=classes&track=${track}`);
      const j = await res.json();
      const list = (j?.classes || []).filter((c) => c.active !== false).map((c) => String(c.name));
      if (list.length) await saveClassList(list);
    } catch {}
  }

  const generateRoutine = async () => {
    try {
      setRmBusy(true);
      const families = new Map();
      (codeData?.codes || []).forEach((c) => {
        if (!families.has(c.familyKey)) families.set(c.familyKey, []);
        families.get(c.familyKey).push(c.code);
      });
      const famText = Array.from(families.entries())
        .map(([fam, codes]) => `${fam}: ${codes.slice(0, 20).join(", ")}${codes.length > 20 ? " …" : ""}`)
        .join("\n");
      const periodKeys = (periodData?.periods || [])
        .filter((p) => /^P\d+$/i.test(p.periodKey))
        .map((p) => p.periodKey)
        .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
      const classes = (() => {
        if (track === "pre_primary") return ["Nursery", "LKG", "UKG"];
        // derive from existing cells
        const cells = cellData?.cells || [];
        const cls = Array.from(new Set(cells.map((c) => String(c.className || c.classId))));
        return cls.length ? cls : ["1", "2", "3", "4", "5", "6", "7"];
      })();

      const content = [
        rmPrompt,
        "Constraints:",
        `- Track: ${track}`,
        `- Classes: ${classes.join(", ")}`,
        `- Periods: ${periodKeys.join(", ")}`,
        "- Available code families and examples:",
        famText,
        "Output JSON only. Shape: { [className]: { [periodKey]: [\"CODE\", \"Subject\"] } }",
      ].join("\n");

      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content }],
          model: rmEngine === "default" ? undefined : rmModel,
        }),
      });
      const j = await res.json().catch(() => ({}));
      const reply = j?.reply || "";
      // Try to extract JSON
      const m = reply.match(/```json\n([\s\S]*?)\n```/) || reply.match(/```\n([\s\S]*?)\n```/);
      setRmOut(m ? m[1] : reply);
    } catch (e) {
      setRmOut(`// Failed to generate: ${e.message}`);
    } finally {
      setRmBusy(false);
    }
  };
  // MSP-R seed editor

  // --- Manage Classes Modal State ---
  const [openSeed, setOpenSeed] = useState(false);
  const [seedText, setSeedText] = useState("");
  const sampleMatrix = useMemo(() => {
    const cells = cellData?.cells || [];
    const periods = (periodData?.periods || [])
      .filter((p) => /^P\d+$/i.test(p.periodKey))
      .sort((a, b) => Number(a.periodKey.slice(1)) - Number(b.periodKey.slice(1)));
    const classList = Array.from(new Set(cells.map((c) => String(c.className || c.classId))));
    const map = new Map();
    for (const c of cells) map.set(`${c.className || c.classId}|${c.periodKey}`, c);
    const m = {};
    for (const cls of classList) {
      const row = {};
      for (const p of periods) {
        const c = map.get(`${cls}|${p.periodKey}`);
        if (c?.mspCode || c?.subject) row[p.periodKey] = [c?.mspCode || null, c?.subject || null];
      }
      if (Object.keys(row).length) m[cls] = row;
    }
    return Object.keys(m).length ? m : { "1": { P1: ["ESL1","English"] } };
  }, [cellData, periodData]);
  useEffect(() => {
    if (!seedText) setSeedText(JSON.stringify(sampleMatrix, null, 2));
  }, [sampleMatrix]);
  const { data: previewPeriods } = useSWR(
    preview.open && id ? `/api/admin/manageMeedian?section=programPeriods&programId=${id}&track=${preview.track}` : null,
    fetcher
  );

  const seed = async (seedTrack) => {
    if (!confirm(`Seed ${seedTrack === "pre_primary" ? "Pre-Primary" : "Elementary"} schedule for ${program?.programKey}?`)) return;
    const res = await fetch(`/api/admin/manageMeedian?section=seedMSPSchedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programId: id, track: seedTrack }),
    });
    const j = await res.json();
    if (!res.ok) {
      alert(j.error || `Failed: HTTP ${res.status}`);
      return;
    }
    await Promise.all([refreshPeriods(), refreshCells()]);
  };

  // --- Manage Classes Modal State ---

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-gray-900">Program — {program?.name} ({program?.programKey})</h1>
        {view === "detail" && (
          <Button
            variant="light"
            onClick={() => {
              setView("cards");
              setActiveSection(null);
              if (typeof window !== "undefined") window.location.hash = "";
            }}
          >Back to Cards</Button>
        )}
      </div>

      {view === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Aim & SOP</div>
            </CardHeader>
            <CardBody>
              <div className="text-sm text-gray-700 line-clamp-4 whitespace-pre-wrap min-h-[72px]">{program?.aims || "—"}</div>
            </CardBody>
            <CardFooter className="flex items-center justify-end gap-2">
              <Button variant="light" size="sm" onClick={() => { setView("detail"); setActiveSection("overview"); if (typeof window !== "undefined") window.location.hash = "overview"; }}>Open Aim & SOP</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Schedule / Duties</div>
            </CardHeader>
            <CardBody>
              <div className="text-xs text-gray-600 mb-2">Period Structure preview</div>
              <div className="flex items-center gap-2">
                <Button size="xs" variant="light" onClick={() => setPreview({ open: true, track: "pre_primary" })}>Pre-Primary</Button>
                <Button size="xs" variant="light" onClick={() => setPreview({ open: true, track: "elementary" })}>Elementary</Button>
              </div>
            </CardBody>
            <CardFooter className="flex items-center justify-end gap-2">
              <Link href={`?track=${track}#schedule`}>
                <Button variant="light" size="sm" onClick={() => { setView("detail"); setActiveSection("schedule"); }}>View Full Schedule</Button>
              </Link>

              <Button variant="light" size="sm" onClick={() => { setManageClassesStep('pick'); setManageClassesOpen(true); }}>Manage Classes</Button>
              <Button variant="primary" size="sm" onClick={() => setSelfStageOpen(true)}>Self‑Scheduler</Button>

              {/* --- Manage Classes Modal --- */}
              {manageClassesOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
                  <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
                    <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-700" onClick={() => setManageClassesOpen(false)}>&times;</button>
                    <h2 className="text-lg font-semibold mb-2">Manage Classes</h2>
                    {manageClassesStep === 'pick' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <button className="border rounded-lg p-3 text-left hover:bg-gray-50" onClick={()=> { setTrack('pre_primary'); setManageClassesStep('list'); }}>
                          <div className="text-sm font-semibold text-gray-900">Pre‑Primary</div>
                          <div className="text-xs text-gray-600">Nursery, LKG, UKG</div>
                        </button>
                        <button className="border rounded-lg p-3 text-left hover:bg-gray-50" onClick={()=> { setTrack('elementary'); setManageClassesStep('list'); }}>
                          <div className="text-sm font-semibold text-gray-900">Elementary</div>
                          <div className="text-xs text-gray-600">I .. VIII (or 1 .. 8)</div>
                        </button>
                      </div>
                    )}
                    {manageClassesStep === 'list' && (
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button className="text-xs px-2 py-1 rounded border" onClick={()=> setManageClassesStep('pick')}>← Back</button>
                          <span className="text-xs text-gray-700">Track:</span>
                          <select className="border rounded px-2 py-1 text-xs" value={track} onChange={(e)=> setTrack(e.target.value)}>
                            <option value="pre_primary">Pre‑Primary</option>
                            <option value="elementary">Elementary</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="light" size="sm" onClick={async()=>{ try{ const res = await fetch('/api/admin/manageMeedian?section=classesNormalize', { method:'POST' }); const j = await res.json().catch(()=>({})); if(!res.ok) throw new Error(j.error||`HTTP ${res.status}`); await refreshKlass?.(); await syncSOPFromDB(); } catch(e){ alert('Normalize failed: '+(e.message||e)); } }}>Normalize</Button>
                          <Button variant="light" size="sm" onClick={async()=>{ await refreshKlass?.(); await syncSOPFromDB(); }}>Refresh</Button>
                        </div>
                      </div>
                    )}
                    {manageClassesStep === 'list' && (
                      <div className="mb-4">
                        <input
                          type="text"
                          className="border rounded px-3 py-2 w-full"
                          placeholder="New class name"
                          value={newClassName}
                          onChange={e => setNewClassName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddClass(); }}
                          disabled={classLoading}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={async ()=>{ try { const name = newClassName.trim(); if(!name) return; const res = await fetch('/api/admin/manageMeedian?section=classes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, track, active: true }) }); const j = await res.json().catch(()=>({})); if(!res.ok) throw new Error(j.error||`HTTP ${res.status}`); await refreshKlass?.(); await syncSOPFromDB(); handleAddClass(); } catch(e){ alert(e.message||'Failed'); } }}
                          disabled={classLoading || !newClassName.trim()}
                        >Add Class</Button>
                      </div>
                    )}
                    {manageClassesStep === 'list' && (
                    <div className="max-h-60 overflow-y-auto border rounded">
                      {classLoading ? (
                        <div className="text-center py-4 text-gray-500">Loading…</div>
                      ) : ((effectiveClasses.filter(c => String(c.track||track)===track && (c.active !== false))).length === 0) ? (
                        <div className="text-center py-4 text-gray-500">No classes found.</div>
                      ) : (
                        <ul>
                          {effectiveClasses
                            .filter((c) => String(c.track || track) === track && (c.active !== false))
                            .map((cls) => {
                              const key = cls._key || (cls.id != null ? String(cls.id) : String(cls.name || cls.id));
                              const originalName = String(cls.name || cls.id);
                              const edited = editedClasses[key] || {
                                name: originalName,
                                active: cls.active !== false,
                                track: String(cls.track || track),
                              };
                              return (
                                <li key={key} className="flex items-center gap-2 px-4 py-2 border-b last:border-b-0">
                                  <input
                                    className="w-24 border rounded px-2 py-1 text-xs"
                                    value={edited.name}
                                    onChange={(e) =>
                                      setEditedClasses((m) => ({
                                        ...m,
                                        [key]: { ...edited, name: e.target.value },
                                      }))
                                    }
                                    placeholder="Name"
                                    title="Class name"
                                  />
                                  <select
                                    className="w-28 border rounded px-2 py-1 text-xs"
                                    value={edited.track}
                                    onChange={(e) =>
                                      setEditedClasses((m) => ({
                                        ...m,
                                        [key]: { ...edited, track: e.target.value },
                                      }))
                                    }
                                    title="Track"
                                  >
                                    <option value="pre_primary">Pre‑Primary</option>
                                    <option value="elementary">Elementary</option>
                                  </select>
                                  <label className="text-xs flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={edited.active}
                                      onChange={(e) =>
                                        setEditedClasses((m) => ({
                                          ...m,
                                          [key]: { ...edited, active: e.target.checked },
                                        }))
                                      }
                                    />
                                    Active
                                  </label>
                                  <button
                                    className="ml-auto text-red-500 hover:underline text-xs disabled:opacity-50"
                                    onClick={() => handleDeleteClass(cls)}
                                    disabled={rowSaving === key || bulkSaving}
                                  >
                                    {rowSaving === key ? 'Deleting…' : 'Delete'}
                                  </button>
                                </li>
                              );
                            })}
                        </ul>
                      )}
                    </div>
                    )}
                    {manageClassesStep === 'list' && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={handlePersistEdits}
                        disabled={!hasPendingEdits || bulkSaving}
                      >
                        {bulkSaving ? 'Saving Changes…' : 'Save Changes'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {/* section state removed */}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Track / Evaluate</div>
            </CardHeader>
            <CardBody>
              <div className="text-sm text-gray-700">Configure trackers (forms/logs) and evaluator roles/rubrics.</div>
            </CardBody>
            <CardFooter className="flex items-center justify-end gap-2">
              <Button variant="light" size="sm" onClick={() => { setView("detail"); setActiveSection("trackers"); if (typeof window !== "undefined") window.location.hash = "trackers"; }}>Open Tracker Setup</Button>
            </CardFooter>
          </Card>

          {/* Meta Features card (Period Grid + Routine Manager) */}
          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Meta Features</div>
            </CardHeader>
            <CardBody>
              <div className="text-xs text-gray-600 mb-2">Tools to assist design and verification.</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => {
                    setPeriodTrack(track);
                    setShowPeriodModal(true);
                  }}
                >
                  Open Period Grid
                </Button>
                <Button size="xs" variant="light" onClick={() => setShowMatrixModal(true)}>Open Matrix</Button>
                <Button size="xs" variant="light" onClick={() => setRoutineOpen(true)}>Routine Manager (AI)</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {(view === "detail" && (activeSection === null || activeSection === "overview")) && (
      <Card id="overview">
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Aim & SOP</h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-1">Aim / Objectives</div>
              <div className="text-sm whitespace-pre-wrap bg-white border rounded p-3 min-h-[72px]">{program?.aims || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-1">SOP (JSON)</div>
              <pre className="text-xs bg-white border rounded p-3 overflow-x-auto min-h-[72px]">{JSON.stringify(program?.sop || {}, null, 2)}</pre>
            </div>
          </div>
        </CardBody>
      </Card>
      )}

      {(view === "detail" && (activeSection === null || activeSection === "schedule")) && (
      <Card id="schedule">
        <CardHeader className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Schedule / Duties</h2>
          <div className="flex items-center gap-2">
            <select className="px-3 py-2 border rounded" value={track} onChange={(e) => setTrack(e.target.value)}>
              <option value="pre_primary">Pre-Primary</option>
              <option value="elementary">Elementary</option>
            </select>
            {/* Viewing only: meta actions moved to root Meta Features card */}
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} /> Show teacher names
            </label>
            <Button variant="light" onClick={() => setFullscreen(true)}>Full Screen Table</Button>
          </div>
        </CardHeader>
        <CardBody>
          {/* MSP-R: embedded full table + seed editor */}
          {(() => {
            const periods = (periodData?.periods || [])
              .filter((p) => /^P\d+$/i.test(p.periodKey))
              .sort((a, b) => Number(a.periodKey.slice(1)) - Number(b.periodKey.slice(1)));
            const cells = cellData?.cells || [];
            const classList = Array.from(new Set(cells.map((c) => String(c.className || c.classId)))).sort((a, b) => {
              const na = Number(a); const nb = Number(b);
              if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
              return String(a).localeCompare(String(b));
            });
            const map = new Map();
            for (const c of cells) map.set(`${c.className || c.classId}|${c.periodKey}`, c);

            const applySeed = async () => {
              try {
                const matrix = JSON.parse(seedText);
                const res = await fetch(`/api/admin/manageMeedian?section=seedMSPSchedule`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ programId: id, track, customMatrix: matrix }),
                });
                const j = await res.json();
                if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
                await Promise.all([refreshPeriods(), refreshCells()]);
              } catch (e) {
                alert(`Invalid seed JSON or failed to apply: ${e.message}`);
              }
            };

            return (
              <div className="grid grid-cols-1 gap-3">
                <Card>
                  <CardHeader className="flex items-center justify-between">
                    <div className="font-semibold text-gray-900">MSP-R</div>
                    <div className="flex items-center gap-2">
                      <div className="hidden md:flex items-center gap-1 mr-2">
                        <button
                          className={`px-2.5 py-1 text-xs rounded-lg border ${mspRMode === "class" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
                          onClick={() => setMspRMode("class")}
                          type="button"
                        >Class-wise</button>
                        <button
                          className={`px-2.5 py-1 text-xs rounded-lg border ${mspRMode === "teacher" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
                          onClick={() => setMspRMode("teacher")}
                          type="button"
                        >Teacher-wise</button>
                        <button
                          className={`px-2.5 py-1 text-xs rounded-lg border ${mspRMode === "day" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
                          onClick={() => setMspRMode("day")}
                          type="button"
                        >Day-wise</button>
                      </div>
                      <Button size="sm" variant="light" onClick={() => setOpenSeed((v) => !v)}>{openSeed ? "Hide Seed Editor" : "Paste / Modify Seed"}</Button>
                      <Button size="sm" variant="light" onClick={() => seed(track)}>Seed Default</Button>
                      <Button size="sm" variant="primary" onClick={applySeed}>Apply Seed</Button>
                    </div>
                  </CardHeader>
                  <CardBody>
                    {openSeed && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-600 mb-1">Paste matrix JSON (e.g. {"{"}"1":{"{"}P1:["ESL1","English"]{"}"}{"}"})</div>
                        <textarea value={seedText} onChange={(e) => setSeedText(e.target.value)} className="w-full h-40 border rounded p-2 font-mono text-xs" />
                      </div>
                    )}
                    {mspRMode === "class" ? (
                      <div className="overflow-auto">
                        <table className="min-w-[900px] w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-gray-50 text-gray-700">
                              <th className="border px-3 py-2 sticky left-0 bg-gray-50 z-10">Class</th>
                              {periods.map((p) => (
                                <th key={p.periodKey} className="border px-3 py-2 text-center">
                                  {p.periodKey}
                                  <div className="text-[11px] text-gray-500">{p.startTime?.slice?.(0,5)}–{p.endTime?.slice?.(0,5)}</div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {classList.map((cls) => (
                              <tr key={cls}>
                                <td className="border px-3 py-2 sticky left-0 bg-white z-10 font-semibold">{cls}</td>
                                {periods.map((p) => {
                                  const c = map.get(`${cls}|${p.periodKey}`);
                                  const code = c?.mspCode || c?.mspCodeId || "—";
                                  const subj = c?.subject || "";
                                  const activeAsg = (asgData?.assignments || []).find((a) => a.active && a.mspCodeId === c?.mspCodeId);
                                const teacher = activeAsg ? (teamData?.users || []).find((u) => u.id === activeAsg.userId)?.name || activeAsg.userId : null;
                                  return (
                                    <td key={`${cls}-${p.periodKey}`} className="border px-3 py-2 align-top">
                                      <div className="font-medium text-gray-900">{showNames ? (teacher || "—") : code}</div>
                                      {subj && <div className="text-[12px] text-gray-600">{subj}</div>}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : mspRMode === "teacher" ? (
                      <div className="space-y-4">
                        {(() => {
                          const usersMap = new Map((teamData?.users || []).map((u) => [u.id, u]));
                          const byTeacher = new Map();
                          for (const c of cells) {
                            if (!c?.mspCodeId) continue;
                            const asg = (asgData?.assignments || []).find((a) => a.active && a.mspCodeId === c.mspCodeId);
                            const tName = asg ? (usersMap.get(asg.userId)?.name || String(asg.userId)) : "— Unassigned";
                            if (!byTeacher.has(tName)) byTeacher.set(tName, []);
                            byTeacher.get(tName).push({
                              className: String(c.className || c.classId),
                              periodKey: c.periodKey,
                              code: c.mspCode || c.mspCodeId,
                              subject: c.subject || "",
                            });
                          }
                          const names = Array.from(byTeacher.keys()).sort((a, b) => {
                            if (a === "— Unassigned") return 1;
                            if (b === "— Unassigned") return -1;
                            return String(a).localeCompare(String(b));
                          });
                          const displayNames = selectedTeacher === "ALL" ? names : names.filter((n) => n === selectedTeacher);
                          return (
                            <>
                              {/* Teacher chips */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedTeacher("ALL")}
                                  className={`px-2.5 py-1 text-xs rounded-full border ${selectedTeacher === "ALL" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
                                >All</button>
                                {names.map((n) => (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => setSelectedTeacher(n)}
                                    className={`px-2.5 py-1 text-xs rounded-full border ${selectedTeacher === n ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
                                    title={n}
                                  >{n}</button>
                                ))}
                                <div className="ml-auto flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!names.length) return;
                                      const idx = selectedTeacher === "ALL" ? -1 : names.indexOf(selectedTeacher);
                                      const next = names[(idx + 1 + names.length) % names.length];
                                      setSelectedTeacher(next);
                                    }}
                                    className="px-2.5 py-1 text-xs rounded-lg border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                  >Next</button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!names.length) return;
                                      const next = names[Math.floor(Math.random() * names.length)];
                                      setSelectedTeacher(next);
                                    }}
                                    className="px-2.5 py-1 text-xs rounded-lg border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                  >Shuffle</button>
                                </div>
                              </div>

                              {/* Teacher sections */}
                              {displayNames.map((name) => (
                                <div key={name} className="border rounded-lg p-3 bg-white">
                                  <div className="text-sm font-semibold text-gray-900 mb-2">{name}</div>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                      <thead>
                                        <tr className="text-left text-gray-600">
                                          <th className="py-2 pr-4">Class</th>
                                          <th className="py-2 pr-4">Period</th>
                                          <th className="py-2 pr-4">MSP Code</th>
                                          <th className="py-2 pr-4">Subject</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {byTeacher.get(name)
                                          .sort((a, b) => String(a.className).localeCompare(String(b.className)) || String(a.periodKey).localeCompare(String(b.periodKey)))
                                          .map((row, idx) => (
                                            <tr key={idx} className="border-t border-gray-200">
                                              <td className="py-2 pr-4">{row.className}</td>
                                              <td className="py-2 pr-4">{row.periodKey}</td>
                                              <td className="py-2 pr-4">{row.code}</td>
                                              <td className="py-2 pr-4">{row.subject}</td>
                                            </tr>
                                          ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                    ) : mspRMode === "day" ? (
                      <div className="overflow-auto">
                        <div className="mb-2 flex items-center gap-2">
                          <label className="text-xs font-semibold">Select Day:</label>
                          <select className="border rounded px-2 py-1 text-xs" value={weekDay} onChange={e => setWeekDay(e.target.value)}>
                            {["Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <table className="min-w-[900px] w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-gray-50 text-gray-700">
                              <th className="border px-3 py-2 sticky left-0 bg-gray-50 z-10">Class</th>
                              {periods.map((p) => (
                                <th key={p.periodKey} className="border px-3 py-2 text-center">
                                  {p.periodKey}
                                  <div className="text-[11px] text-gray-500">{p.startTime?.slice?.(0,5)}–{p.endTime?.slice?.(0,5)}</div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {classList.map(cls => (
                              <tr key={cls}>
                                <td className="border px-3 py-2 sticky left-0 bg-white z-10 font-semibold">{cls}</td>
                                {periods.map((p) => {
                                  const c = cells.find(cell => (cell.className || cell.classId) == cls && cell.day === weekDay && cell.periodKey === p.periodKey);
                                  const code = c?.mspCode || c?.mspCodeId || "—";
                                  const subj = c?.subject || "";
                                  return (
                                    <td key={`${cls}-${p.periodKey}`} className="border px-3 py-2 align-top">
                                      <div className="font-medium text-gray-900">{code}</div>
                                      {subj && <div className="text-[12px] text-gray-600">{subj}</div>}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </CardBody>
                </Card>
              </div>
            );
          })()}

          {/* Meta Features moved to root cards */}
        </CardBody>
      </Card>
      )}

      {/* Period Grid modal */}
      {showPeriodModal && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-start justify-center" onClick={() => setShowPeriodModal(false)}>
          <div className="mt-10 w-[92vw] max-w-xl" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">Period Grid — {periodTrackLabel}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    {trackOptions.map((opt) => (
                      <Button
                        key={opt.value}
                        size="sm"
                        variant={periodTrack === opt.value ? "primary" : "light"}
                        onClick={() => handleModalTrackChange(opt.value)}
                        disabled={periodTrack === opt.value || periodSaving}
                        className={periodTrack === opt.value ? "shadow" : ""}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <Button size="sm" variant="light" onClick={handleAddPeriod} disabled={periodSaving}>Add Period</Button>
                  <Button
                    size="sm"
                    variant="light"
                    onClick={handleAutoReindexPeriods}
                    disabled={periodDraft.length <= 1 || periodSaving}
                  >
                    Reindex Keys
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-3">
                  <div className="text-xs text-gray-600">Adjust the period slots for the selected track.</div>
                  {periodLoading && <div className="text-xs text-gray-500">Loading periods…</div>}
                  {periodError && <div className="text-sm text-red-600">{periodError}</div>}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="py-2 pr-4">Period</th>
                          <th className="py-2 pr-4">Start</th>
                          <th className="py-2 pr-4">End</th>
                          <th className="py-2 pr-0 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periodDraft.map((row, idx) => (
                          <tr key={`${row.periodKey || ""}-${idx}`} className="border-t border-gray-200">
                            <td className="py-2 pr-4">
                              <input
                                type="text"
                                value={row.periodKey || ""}
                                onChange={(e) => handlePeriodFieldChange(idx, "periodKey", e.target.value)}
                                className="w-24 border rounded px-2 py-1 text-sm"
                                maxLength={16}
                                disabled={periodSaving}
                              />
                            </td>
                            <td className="py-2 pr-4">
                              <input
                                type="time"
                                value={row.startTime || ""}
                                onChange={(e) => handlePeriodFieldChange(idx, "startTime", e.target.value)}
                                className="w-28 border rounded px-2 py-1 text-sm"
                                disabled={periodSaving}
                              />
                            </td>
                            <td className="py-2 pr-4">
                              <input
                                type="time"
                                value={row.endTime || ""}
                                onChange={(e) => handlePeriodFieldChange(idx, "endTime", e.target.value)}
                                className="w-28 border rounded px-2 py-1 text-sm"
                                disabled={periodSaving}
                              />
                            </td>
                            <td className="py-2 pr-0 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemovePeriod(idx)}
                                className="text-xs text-red-600 hover:text-red-700 disabled:text-gray-400"
                                disabled={periodDraft.length <= 1 || periodSaving}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardBody>
              <CardFooter className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-gray-500">Changes apply to the {periodTrackLabel} track.</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSavePeriods}
                    disabled={!periodDirty || periodSaving}
                  >
                    {periodSaving ? "Saving…" : "Save Changes"}
                  </Button>
                  <Button size="sm" variant="light" onClick={() => setShowPeriodModal(false)} disabled={periodSaving}>Close</Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}

      {/* Routine Manager Modal */}
      {routineOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-start justify-center" onClick={() => setRoutineOpen(false)}>
          <div className="mt-8 w-[96vw] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Routine Manager (AI) — {trackLabel}</div>
                <div className="flex items-center gap-2">
                  <select className="px-2 py-1 border rounded text-sm" value={track} onChange={(e) => setTrack(e.target.value)}>
                    <option value="pre_primary">Pre-Primary</option>
                    <option value="elementary">Elementary</option>
                  </select>
                  {/* AI engine/model selector */}
                  <select className="px-2 py-1 border rounded text-sm" value={rmEngine} onChange={(e) => setRmEngine(e.target.value)}>
                    <option value="default">DELU‑GPT (default)</option>
                    <option value="openai">OpenAI model…</option>
                  </select>
                  {rmEngine === "openai" && (
                    <select className="px-2 py-1 border rounded text-sm" value={rmModel} onChange={(e) => setRmModel(e.target.value)}>
                      <option value="gpt-4o-mini">gpt‑4o‑mini</option>
                      <option value="gpt-4o">gpt‑4o</option>
                      <option value="gpt-4.1-mini">gpt‑4.1‑mini</option>
                      <option value="gpt-4.1">gpt‑4.1</option>
                      <option value="o4-mini">o4‑mini</option>
                    </select>
                  )}
                  <Button size="sm" variant="light" onClick={generateRoutine} disabled={rmBusy}>{rmBusy ? "Generating…" : "Generate"}</Button>
                  <Button size="sm" variant="primary" onClick={async () => { try { const matrix = JSON.parse(rmOut); const res = await fetch(`/api/admin/manageMeedian?section=seedMSPSchedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ programId: id, track, customMatrix: matrix }) }); const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`); await Promise.all([refreshPeriods(), refreshCells()]); setRoutineOpen(false); } catch (e) { alert(`Invalid JSON or failed: ${e.message}`); } }}>Apply Seed</Button>
                  <Button size="sm" variant="light" onClick={() => setRoutineOpen(false)}>Close</Button>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Instructions</div>
                    <textarea className="w-full h-40 border rounded p-2 text-sm" value={rmPrompt} onChange={(e) => setRmPrompt(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">AI Output (editable JSON)</div>
                    <textarea
                      className="w-full h-40 border rounded p-2 font-mono text-xs"
                      value={rmOut}
                      onChange={(e) => setRmOut(e.target.value)}
                      placeholder={`{\n  "1": { "P1": ["ESL1", "English"] }\n}`}
                    />
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* Matrix modal */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-start justify-center" onClick={() => setShowMatrixModal(false)}>
          <div className="mt-8 w-[96vw] max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Matrix — {track === "pre_primary" ? "Pre-Primary" : "Elementary"}</div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} /> Show teacher names
                  </label>
                  <Button size="sm" variant="light" onClick={() => setShowMatrixModal(false)}>Close</Button>
                </div>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th className="py-2 pr-4">Class</th>
                        <th className="py-2 pr-4">Period</th>
                        <th className="py-2 pr-4">{showNames ? 'Teacher' : 'MSP Code'}</th>
                        <th className="py-2 pr-4">Subject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cellData?.cells || []).map((c) => {
                        const activeAsg = (asgData?.assignments || []).find((a) => a.active && a.mspCodeId === c.mspCodeId);
                        const teacher = activeAsg ? (teamData?.users || []).find((u) => u.id === activeAsg.userId)?.name || activeAsg.userId : null;
                        return (
                          <tr key={c.id} className="border-t border-gray-200">
                            <td className="py-2 pr-4">{c.className || c.classId}</td>
                            <td className="py-2 pr-4">{c.periodKey}</td>
                            <td className="py-2 pr-4">{showNames ? (teacher || '—') : (c.mspCode || c.mspCodeId || '—')}</td>
                            <td className="py-2 pr-4">{c.subject || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {(view === "detail" && (activeSection === null || activeSection === "trackers")) && (
      <Card id="trackers">
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Track / Evaluate</h2>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-600">Configure trackers (forms/logs) and evaluator roles/rubrics here (coming soon).</p>
        </CardBody>
      </Card>
      )}

      {/* Fullscreen Schedule Modal */}
      {fullscreen && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex flex-col">
          <div className="bg-white shadow-xl w-full p-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">
              {program?.programKey} — Schedule / Duties ({track === "pre_primary" ? "Pre-Primary" : "Elementary"})
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button className={`px-2 py-1 rounded ${schedTab==='base'?'bg-white shadow font-semibold':'text-gray-700'}`} onClick={()=>setSchedTab('base')}>Base Matrix</button>
                <button className={`px-2 py-1 rounded ${schedTab==='weekly'?'bg-white shadow font-semibold':'text-gray-700'}`} onClick={()=>setSchedTab('weekly')}>Weekly</button>
              </div>
              <select className="px-2 py-1 border rounded text-sm" value={track} onChange={(e) => setTrack(e.target.value)}>
                <option value="pre_primary">Pre-Primary</option>
                <option value="elementary">Elementary</option>
              </select>
              {schedTab === 'weekly' && (
                <select className="px-2 py-1 border rounded text-sm" value={weekDay} onChange={(e)=>setWeekDay(e.target.value)}>
                  {['Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} /> Show teacher names
              </label>
              <Button variant="light" onClick={() => setFullscreen(false)}>Close</Button>
            </div>
          </div>
          <div className="flex-1 bg-white overflow-auto p-3">
            {schedTab === 'base' ? (() => {
              const periods = (periodData?.periods || [])
                .filter((p) => /^P\d+$/i.test(p.periodKey))
                .sort((a, b) => Number(a.periodKey.slice(1)) - Number(b.periodKey.slice(1)));
              const cells = cellData?.cells || [];
              const classList = Array.from(new Set(cells.map((c) => String(c.className || c.classId)))).sort((a, b) => {
                const na = Number(a); const nb = Number(b);
                if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
                return String(a).localeCompare(String(b));
              });
              const map = new Map();
              for (const c of cells) {
                const key = `${c.className || c.classId}|${c.periodKey}`;
                map.set(key, c);
              }
              return (
                <div className="min-w-[1200px]">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-700">
                        <th className="border px-3 py-2 sticky left-0 bg-gray-50 z-10">Class</th>
                        {periods.map((p) => (
                          <th key={p.periodKey} className={`border px-3 py-2 text-center ${p.periodKey==='P5' ? 'border-l-4 border-l-rose-400' : ''}`}>{p.periodKey}<div className="text-[11px] text-gray-500">{p.startTime?.slice?.(0,5)}–{p.endTime?.slice?.(0,5)}</div></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classList.map((cls) => (
                        <tr key={cls}>
                          <td className="border px-3 py-2 sticky left-0 bg-white z-10 font-semibold">{cls}</td>
                          {periods.map((p) => {
                            const c = map.get(`${cls}|${p.periodKey}`);
                            const code = c?.mspCode || c?.mspCodeId || "—";
                            const subj = c?.subject || "";
                            const activeAsg = (asgData?.assignments || []).find((a) => a.active && a.mspCodeId === c?.mspCodeId);
                            const teacher = activeAsg ? (teamData?.users || []).find((u) => u.id === activeAsg.userId)?.name || activeAsg.userId : null;
                            return (
                              <td key={`${cls}-${p.periodKey}`} className={`border px-3 py-2 align-top ${p.periodKey==='P5' ? 'border-l-4 border-l-rose-400' : ''}`}>
                                <div className="font-medium text-gray-900">{showNames ? (teacher || "—") : code}</div>
                                {subj && <div className="text-[12px] text-gray-600">{subj}</div>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Legend and controls */}
                  {(() => {
                    const usersById = new Map((teamData?.users || []).map((u) => [u.id, u]));
                    const codesById = new Map((codeData?.codes || []).map((c) => [c.id, c]));
                    const usedCodeIds = Array.from(new Set((cellData?.cells || []).map((c) => c.mspCodeId).filter(Boolean)));
                    const activeAsgByCode = new Map((asgData?.assignments || []).filter((a) => a.active).map((a) => [a.mspCodeId, a]));
                    const legend = usedCodeIds.map((cid) => {
                      const code = codesById.get(cid);
                      const asg = activeAsgByCode.get(cid);
                      return {
                        id: cid,
                        code: code?.code || cid,
                        title: code?.title || "",
                        family: code?.familyKey || "",
                        teacher: asg ? (usersById.get(asg.userId)?.name || asg.userId) : "—",
                        asgId: asg?.id,
                      };
                    }).sort((a,b) => String(a.family).localeCompare(String(b.family)) || String(a.code).localeCompare(String(b.code)));
                    return (
                      <div className="mt-4 border-t pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-gray-900">Legend — Code → Teacher (Family)</div>
                          <Button size="sm" variant="light" onClick={() => setManageCodesOpen(true)}>Manage Codes</Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {legend.map((row) => (
                            <div key={row.id} className="border rounded-lg p-2 bg-gray-50">
                              <div className="text-sm font-semibold text-gray-900">{row.code} <span className="text-xs text-gray-600">({row.family})</span></div>
                              <div className="text-xs text-gray-700">{row.title}</div>
                              <div className="text-sm mt-1"><span className="text-gray-600">Teacher:</span> {row.teacher}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
              })() : (()=>{
                const periods = (periodData?.periods || [])
                  .filter((p) => /^P\d+$/i.test(p.periodKey))
                  .sort((a, b) => Number(a.periodKey.slice(1)) - Number(b.periodKey.slice(1)));
                const rows = dayData?.days || [];
                const classList = Array.from(new Set(rows.map((r) => String(r.className || r.classId)))).sort((a,b)=>{ const na=Number(a), nb=Number(b); if(!isNaN(na)&&!isNaN(nb)) return na-nb; return String(a).localeCompare(String(b));});
                const map = new Map();
                for (const r of rows) map.set(`${r.className || r.classId}|${r.periodKey}`, r);
                return (
                  <div className="min-w-[1200px]">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-gray-700">
                          <th className="border px-3 py-2 sticky left-0 bg-gray-50 z-10">Class</th>
                          {periods.map((p) => (
                          <th key={p.periodKey} className={`border px-3 py-2 text-center ${p.periodKey==='P5' ? 'border-l-4 border-l-rose-400' : ''}`}>{p.periodKey}<div className="text-[11px] text-gray-500">{p.startTime?.slice?.(0,5)}–{p.endTime?.slice?.(0,5)}</div></th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {classList.map((cls) => (
                          <tr key={cls}>
                            <td className="border px-3 py-2 sticky left-0 bg-white z-10 font-semibold">{cls}</td>
                            {periods.map((p)=>{
                              const c = map.get(`${cls}|${p.periodKey}`);
                              const code = c?.mspCode || c?.mspCodeId || '—';
                              const subj = c?.subject || '';
                              const activeAsg = (asgData?.assignments || []).find((a)=> a.active && a.mspCodeId === c?.mspCodeId);
                              const teacher = activeAsg ? (teamData?.users || []).find((u)=> u.id === activeAsg.userId)?.name || activeAsg.userId : null;
                              return (
                                <td key={`${cls}-${p.periodKey}`} className={`border px-3 py-2 align-top ${p.periodKey==='P5' ? 'border-l-4 border-l-rose-400' : ''}`}>
                                  <div className="font-medium text-gray-900">{showNames ? (teacher || '—') : code}</div>
                                  {subj && <div className="text-[12px] text-gray-600">{subj}</div>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {rows.length === 0 && (
                          <tr><td className="px-3 py-6 text-gray-500" colSpan={periods.length+1}>No weekly plan saved for {weekDay}.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
          </div>
        </div>
      )}

      {/* Manage Codes modal (drag members onto codes) */}
      {manageCodesOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-start justify-center" onClick={() => setManageCodesOpen(false)}>
          <div className="mt-10 w-[96vw] max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Manage Code Assignments — {track === "pre_primary" ? "Pre-Primary" : "Elementary"}</div>
                <Button size="sm" variant="light" onClick={() => setManageCodesOpen(false)}>Close</Button>
              </CardHeader>
              <CardBody>
                {(() => {
                  const codesById = new Map((codeData?.codes || []).map((c) => [c.id, c]));
                  const activeAsgByCode = new Map((asgData?.assignments || []).filter((a) => a.active).map((a) => [a.mspCodeId, a]));
                  const usedCodeIds = Array.from(new Set((cellData?.cells || []).map((c) => c.mspCodeId).filter(Boolean)));
                  const usedAssignmentsUserIds = new Set(Array.from(activeAsgByCode.values()).map((a) => a.userId));
                  const members = (teamData?.users || []).filter((u) => u.role === "member" || u.role === "team_manager");
                  const availableMembers = members.filter((u) => !usedAssignmentsUserIds.has(u.id));

                  const onDropAssign = async (codeId) => {
                    const uid = dragMemberId;
                    if (!uid) return;
                    try {
                      // End existing assignment (if any)
                      const existing = activeAsgByCode.get(codeId);
                      if (existing) {
                        await fetch(`/api/admin/manageMeedian?section=mspCodeAssignments`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ updates: [{ id: existing.id, endDate: new Date().toISOString().slice(0,10), active: false }] }),
                        });
                      }
                      // Create new assignment
                      await fetch(`/api/admin/manageMeedian?section=mspCodeAssignments`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mspCodeId: Number(codeId), userId: Number(uid), startDate: new Date().toISOString().slice(0,10), isPrimary: true })
                      });
                      await refreshAsg();
                      setDragMemberId(null);
                    } catch (_) {}
                  };

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4">
                      {/* Available members */}
                      <div className="border rounded-lg p-3">
                        <div className="text-sm font-semibold text-gray-900 mb-2">Available Members</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {availableMembers.map((u) => (
                            <div key={u.id}
                                 draggable
                                 onDragStart={() => setDragMemberId(u.id)}
                                 className="cursor-move border rounded p-2 bg-white text-sm">
                              {u.name}
                            </div>
                          ))}
                          {availableMembers.length === 0 && <div className="text-xs text-gray-500">No unassigned members</div>}
                        </div>
                      </div>

                      {/* Codes grouped by family */}
                      <div className="border rounded-lg p-3">
                        <div className="text-sm font-semibold text-gray-900 mb-2">Codes (drop a member to assign) — grouped by family</div>
                        {(() => {
                          const groups = new Map();
                          usedCodeIds.forEach((cid) => {
                            const c = codesById.get(cid);
                            const fam = c?.familyKey || "Other";
                            if (!groups.has(fam)) groups.set(fam, []);
                            groups.get(fam).push({ cid, code: c });
                          });
                          const sortedFamilies = Array.from(groups.keys()).sort((a,b) => String(a).localeCompare(String(b)));
                          return (
                            <div className="mt-4 border-t pt-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-semibold text-gray-900">Legend — Code → Teacher (Family)</div>
                                <Button size="sm" variant="light" onClick={() => setManageCodesOpen(true)}>Manage Codes</Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {sortedFamilies.map((fam) => (
                                  <div key={fam}>
                                    <div className="text-xs font-semibold text-gray-600 mb-1">{fam}</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {groups.get(fam)
                                        .sort((a,b) => String(a.code?.code || "").localeCompare(String(b.code?.code || "")))
                                        .map(({ cid, code }) => {
                                          const asg = activeAsgByCode.get(cid);
                                          const teacher = asg ? (members.find((m) => m.id === asg.userId)?.name || asg.userId) : "—";
                                          const clear = async () => {
                                            if (!asg) return;
                                            try {
                                              await fetch(`/api/admin/manageMeedian?section=mspCodeAssignments`, {
                                                method: "PATCH",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ updates: [{ id: asg.id, endDate: new Date().toISOString().slice(0,10), active: false }] })
                                              });
                                              await refreshAsg();
                                            } catch (_) {}
                                          };
                                          return (
                                            <div key={cid}
                                                 onDragOver={(e) => e.preventDefault()}
                                                 onDrop={() => onDropAssign(cid)}
                                                 className="border rounded-lg p-2 bg-gray-50">
                                              <div className="text-sm font-semibold text-gray-900">{code?.code || cid}</div>
                                              <div className="text-xs text-gray-700">{code?.title || ""}</div>
                                              <div className="text-sm mt-1 flex items-center gap-2">
                                                <span className="text-gray-600">Teacher:</span> {teacher}
                                                {asg && <button className="text-xs text-red-600 hover:underline" onClick={clear}>Remove</button>}
                                              </div>
                                              <div className="text-[11px] text-gray-500">Drop member here to assign</div>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* Period preview modal */}
      {preview.open && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-start justify-center" onClick={() => setPreview({ open: false, track: "pre_primary" })}>
          <div className="mt-10 w-[92vw] max-w-xl" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Periods — {preview.track === "pre_primary" ? "Pre-Primary" : "Elementary"}</div>
                <div className="flex items-center gap-2">
                  <Link href={`?track=${preview.track}#schedule`}>
                    <Button size="sm" variant="light" onClick={() => { setPreview({ open: false, track: "pre_primary" }); setView("detail"); setActiveSection("schedule"); }}>View Full Schedule</Button>
                  </Link>
                  <Button size="sm" variant="light" onClick={() => setPreview({ open: false, track: "pre_primary" })}>Close</Button>
                </div>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th className="py-2 pr-4">Period</th>
                        <th className="py-2 pr-4">Start</th>
                        <th className="py-2 pr-4">End</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(previewPeriods?.periods || []).map((p) => (
                        <tr key={`${p.track}-${p.periodKey}`} className="border-t border-gray-200">
                          <td className="py-2 pr-4 font-semibold">{p.periodKey}</td>
                          <td className="py-2 pr-4">{p.startTime}</td>
                          <td className="py-2 pr-4">{p.endTime}</td>
                        </tr>
                      ))}
                      {!previewPeriods && (
                        <tr><td className="py-2 text-gray-500" colSpan={3}>Loading...</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* Self‑Scheduler: Stage picker */}
      {selfStageOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4" onClick={()=> setSelfStageOpen(false)}>
          <div className="w-[96vw] max-w-3xl bg-white rounded-2xl border shadow-2xl overflow-hidden" onClick={(e)=> e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold text-gray-900">Plan MSP‑R — Choose Stage</div>
              <button className="px-2 py-1 rounded bg-gray-100" onClick={()=> setSelfStageOpen(false)}>Close</button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className={`border rounded-lg p-3 ${selfPlanMode==='fixed_all_days'?'ring-2 ring-teal-500':''}`} onClick={()=> setSelfPlanMode('fixed_all_days')} role="button">
                <div className="text-sm font-semibold">Fixed Subjects</div>
                <p className="text-xs text-gray-600">One teacher takes a subject for all classes across Mon–Fri (same period).</p>
              </div>
              <div className={`border rounded-lg p-3 ${selfPlanMode==='split_same_subject'?'ring-2 ring-teal-500':''}`} onClick={()=> setSelfPlanMode('split_same_subject')} role="button">
                <div className="text-sm font-semibold">Split Same Subject</div>
                <p className="text-xs text-gray-600">Same subject shared by multiple teachers for the same period.</p>
              </div>
              <div className={`border rounded-lg p-3 ${selfPlanMode==='same_period_diff_subject'?'ring-2 ring-teal-500':''}`} onClick={()=> setSelfPlanMode('same_period_diff_subject')} role="button">
                <div className="text-sm font-semibold">Same Period, Diff Subjects</div>
                <p className="text-xs text-gray-600">One class, different subjects on different days.</p>
              </div>
            </div>
            <div className="px-4 pb-4 flex items-center justify-end gap-2">
              <button className="px-3 py-1.5 rounded bg-gray-100" onClick={()=> setSelfStageOpen(false)}>Cancel</button>
              <button className="px-3 py-1.5 rounded bg-teal-600 text-white" onClick={()=> { setSelfStageOpen(false); setSelfSchedOpen(true); }}>Start</button>
            </div>
          </div>
        </div>
      )}

      {/* Default Seed preview modal */}
      {showDefaultSeedModal && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-start justify-center" onClick={() => setShowDefaultSeedModal(false)}>
          <div className="mt-10 w-[92vw] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Default Seed — {track === "pre_primary" ? "Pre-Primary" : "Elementary"}</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="primary" onClick={async () => { await seed(track); setShowDefaultSeedModal(false); }}>Seed Default</Button>
                  <Button size="sm" variant="light" onClick={() => setShowDefaultSeedModal(false)}>Close</Button>
                </div>
              </CardHeader>
              <CardBody>
                {(() => {
                  const defaultMatrix = (() => {
                    if (track === "pre_primary") {
                      return {
                        Nursery: { P1: ["PGL1","English"], P2: ["PGL1","Eng-Writing"], P3: ["PGL1","GK"], P4: ["PRL1","Hindi"], P5: ["PRL2","Hindi-Writing"], P6: ["PRL1","Urdu"], P7: ["PGL3","Math"], P8: ["PGL1","Table Math"] },
                        LKG:     { P1: ["PRL1","Hindi"], P2: ["PRL1","Hindi"],        P3: ["PGL2","GK"], P4: ["PGL2","Math"],       P5: ["PGL2","Math"],          P6: ["PGL1","English"], P7: ["PRL1","Urdu"], P8: [null, null] },
                        UKG:     { P1: ["PGL2","Math"],  P2: ["PGL2","Math"],         P3: ["PGL3","GK"], P4: ["PGL3","English"],    P5: ["PGL3","English"],       P6: ["PRL2","Hindi"],  P7: ["PRL2","Hindi"], P8: ["PRL2","Urdu"] },
                      };
                    }
                    return {
                      "1": { P1: ["EHO1","Hin"],   P2: ["EMS1","Sci"],  P3: ["EUA1","Arb"],  P4: ["ESL1","English"], P5: ["EHO2(1)","GK"],   P6: ["EUA1","U/QT"], P7: ["EMS1","Math"], P8: ["ESL2(1)","S.St"] },
                      "2": { P1: ["ESL2(2)","S.St"], P2: ["EHO1","Hin"],  P3: ["EMS1","Sci"],  P4: ["EUA2","Arb"],     P5: ["ESL1","English"], P6: ["EHO2(2)","Computer"], P7: ["EUA1","U/QT"], P8: ["EMS2","Math"] },
                      "3": { P1: ["EMS2","Math"], P2: ["ESL2(1)","S.St"], P3: ["EHO1","Hin"],  P4: ["EHO2(1)","GK"],   P5: ["EMS2","Sci"],     P6: ["ESL1","English"], P7: ["EUA2","Arb"], P8: ["EUA1","U/QT"] },
                      "4": { P1: ["EUA1","U/QT"], P2: ["EMS2","Math"], P3: ["ESL2(2)","S.St"], P4: ["EHO1","Hin"],  P5: ["EUA2","Arb"],     P6: ["EMS1","Sci"],     P7: ["ESL1","English"], P8: ["EHO2(2)","Computer"] },
                      "5": { P1: ["EMS1","Sci"], P2: ["EUA1","U/QT"], P3: ["EMS2","Math"], P4: ["ESL2(1)","S.St"], P5: ["EHO1","Hin"],  P6: ["EUA2","Arb"],     P7: ["EHO2(1)","GK"],   P8: ["ESL1","English"] },
                      "6": { P1: ["ESL1","English"], P2: ["EHO2(2)","Computer"], P3: ["EUA2","U/QT"], P4: ["EMS2","Math"], P5: ["ESL2(2)","S.St"], P6: ["EHO1","Hin"], P7: ["EMS2","Sci"], P8: ["EUA2","Arb"] },
                      "7": { P1: ["EUA2","Arb"], P2: ["ESL1","English"], P3: ["EHO2(1)","GK"], P4: ["EUA1","U/QT"], P5: ["EMS1","Math"], P6: ["ESL2(1)","S.St"], P7: ["EHO1","Hin"], P8: ["EMS1","Sci"] },
                    };
                  })();
                  return (
                    <pre className="text-xs bg-gray-50 border rounded p-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(defaultMatrix, null, 2)}</pre>
                  );
                })()}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* Self‑Scheduler Modal */}
      {selfSchedOpen && (
        <div className={`fixed inset-0 z-[1000] bg-black/60 ${selfSchedFull ? 'p-0' : 'flex items-center justify-center p-4 sm:p-6'}`} onClick={()=> { setSelfSchedOpen(false); setSelfSchedFull(false); }}>
          <div
            className={`${selfSchedFull ? 'w-screen h-screen bg-white border-t border-slate-200 rounded-none' : 'w-[96vw] max-w-7xl my-6 sm:my-8 bg-white rounded-2xl border'} shadow-2xl overflow-hidden`}
            style={selfSchedFull ? undefined : { maxHeight: 'calc(100vh - 96px)' }}
            onClick={(e)=> e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="text-sm font-semibold text-gray-900">Self‑Scheduler — {track === 'pre_primary' ? 'Pre‑Primary' : 'Elementary'}</div>
              <div className="flex items-center gap-2 flex-wrap">
                <select className="px-2 py-1 border rounded text-sm" value={track} onChange={(e)=> setTrack(e.target.value)}>
                  <option value="pre_primary">Pre‑Primary</option>
                  <option value="elementary">Elementary</option>
                </select>
                {/* Days selection (top bar) */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-600">Days:</span>
                  <button
                    className={`px-2 py-1 rounded text-xs border ${daysMode==='all' ? 'bg-gray-900 text-white' : 'bg-white'}`}
                    onClick={()=> setDaysMode('all')}
                    title="Use default days (Mon, Tue, Wed, Thu, Sat)"
                  >
                    Default
                  </button>
                  <button
                    className={`px-2 py-1 rounded text-xs border ${daysMode==='split' ? 'bg-gray-900 text-white' : 'bg-white'}`}
                    onClick={()=> setDaysMode('split')}
                    title="Pick custom days"
                  >
                    Custom
                  </button>
                  {daysMode === 'split' && (
                    <div className="flex items-center gap-1 ml-1">
                      {['Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                        <button
                          key={d}
                          className={`px-1.5 py-0.5 rounded text-[11px] border ${daysSel[d] ? 'bg-teal-600 text-white' : 'bg-white'}`}
                          onClick={()=> setDaysSel(prev => ({ ...prev, [d]: !prev[d] }))}
                          title={d}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="px-2 py-1 rounded bg-sky-700 text-white text-sm" title="Lock current work, save seed and push" onClick={()=>{ try{ lockPushRef.current && lockPushRef.current(); } catch(e){ alert('Lock & Push failed: ' + (e.message||e)); } }}>Lock & Push Stage</button>
                <button className="px-2 py-1 rounded bg-gray-100" onClick={()=> setSelfSchedFull(v=> !v)}>{selfSchedFull ? 'Exit Full Screen' : 'Full Screen'}</button>
                <button className="px-2 py-1 rounded bg-gray-100" onClick={()=> setSelfSchedOpen(false)}>Close</button>
              </div>
            </div>
            <div className={`${selfSchedFull ? 'h-[calc(100vh-44px)]' : 'max-h-[78vh]'} overflow-auto`}>
              <SelfScheduler
                programId={id}
                track={track}
                periodData={periodData}
                codeData={codeData}
                asgData={asgData}
                teamData={teamData}
                classes={classes}
                planMode={selfPlanMode}
                setPlanMode={setSelfPlanMode}
                daysMode={daysMode}
                setDaysMode={setDaysMode}
                daysSel={daysSel}
                setDaysSel={setDaysSel}
                registerLockPush={(fn)=> { lockPushRef.current = fn; }}
                onSaved={async()=> { await Promise.all([refreshCells()]); setSelfSchedOpen(false); setFullscreen(true); setSchedTab('weekly'); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SelfScheduler({ programId, track, periodData, codeData, asgData, teamData, classes, planMode, setPlanMode, onSaved, daysMode, setDaysMode, daysSel, setDaysSel, registerLockPush }) {
  const [fallbackCode, setFallbackCode] = useState('');
  const [viewDay, setViewDay] = useState('Mon');
  const [staged, setStaged] = useState({}); // key: day|class|period -> codeId
  const [errorMsg, setErrorMsg] = useState('');
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedText, setSeedText] = useState('');
  const [seedMsg, setSeedMsg] = useState('');
  const [clearedInfo, setClearedInfo] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [codeFilter, setCodeFilter] = useState('');
  const [showLeisure, setShowLeisure] = useState(false);
  const [leisurePeriod, setLeisurePeriod] = useState('');
  const [activePeriod, setActivePeriod] = useState('');
  const [stageIdx, setStageIdx] = useState(1); // 1 -> 2 -> 3
  const [lockedMap, setLockedMap] = useState({}); // key: day|class|period -> true
  const [fixedActiveCodes, setFixedActiveCodes] = useState([]); // stage1: collected fixed codes
  // Saved seeds
  const [savedSeeds, setSavedSeeds] = useState([]);
  const [selectedSeedId, setSelectedSeedId] = useState('');
  const [seedsLoading, setSeedsLoading] = useState(false);
  const baselineRef = useRef(null); // snapshot of initial load for resets
  // History for undo/redo
  const histRef = useRef([]); // snapshots array
  const hiRef = useRef(-1);   // current index
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateStaged = (mutator) => {
    setStaged((prev) => {
      const next = mutator({ ...prev });
      const trimmed = histRef.current.slice(0, hiRef.current + 1);
      trimmed.push(next);
      histRef.current = trimmed;
      hiRef.current = trimmed.length - 1;
      setCanUndo(hiRef.current > 0);
      setCanRedo(false);
      return next;
    });
  };
  const undo = () => {
    if (hiRef.current <= 0) return;
    hiRef.current -= 1;
    setStaged(histRef.current[hiRef.current] || {});
    setCanUndo(hiRef.current > 0);
    setCanRedo(hiRef.current < histRef.current.length - 1);
  };
  const redo = () => {
    if (hiRef.current >= histRef.current.length - 1) return;
    hiRef.current += 1;
    setStaged(histRef.current[hiRef.current] || {});
    setCanUndo(hiRef.current > 0);
    setCanRedo(hiRef.current < histRef.current.length - 1);
  };
  // Load draft if present; else load last saved weekly into staged on open
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        if (!programId || !track) return;
        // Check SOP draft first
        const mp = await fetch('/api/admin/manageMeedian?section=metaPrograms', { cache: 'no-store' });
        const mj = await mp.json().catch(() => ({}));
        const prog = (mj?.programs || []).find((p) => p.id === programId);
        const key = track === 'pre_primary' ? 'pre_primary' : 'elementary';
        const draft = prog?.sop?.selfSchedulerDraft?.[key];
        if (draft) {
          const codeLookup = new Map((codeData?.codes || []).map((c) => [c.code, c.id]));
          const next = {};
          Object.keys(draft).forEach((day) => {
            const byClass = draft[day] || {};
            Object.keys(byClass).forEach((cls) => {
              const byPeriod = byClass[cls] || {};
              Object.keys(byPeriod).forEach((pk) => {
                const code = Array.isArray(byPeriod[pk]) ? byPeriod[pk][0] : byPeriod[pk];
                const id = codeLookup.get(code);
                if (id) next[`${day}|${cls}|${pk}`] = id;
              });
            });
          });
          if (!aborted) {
            setStaged(next);
            histRef.current = [next];
            hiRef.current = 0; setCanUndo(false); setCanRedo(false);
            baselineRef.current = next;
          }
          return;
        }
        // Fallback: load weekly cells
        const res = await fetch(`/api/admin/manageMeedian?section=programScheduleDays&programId=${programId}&track=${track}`, { cache: 'no-store' });
        const j = await res.json().catch(() => ({}));
        if (!aborted && Array.isArray(j?.days)) {
          const next = {};
          j.days.forEach((r) => {
            const cls = String(r.className || r.classId);
            next[`${r.dayName}|${cls}|${r.periodKey}`] = r.mspCodeId || null;
          });
          setStaged(next);
          histRef.current = [next];
          hiRef.current = 0; setCanUndo(false); setCanRedo(false);
          baselineRef.current = next;
        }
      } catch { /* ignore */ }
    })();
    return () => { aborted = true; };
  }, [programId, track, codeData]);

  // Default active period when periods load
  useEffect(() => {
    const first = (periodData?.periods || []).find((p) => /^P\d+$/i.test(p.periodKey));
    if (!activePeriod && first) setActivePeriod(first.periodKey);
  }, [periodData, activePeriod]);

  // Expose Lock & Push handler to parent header button
  useEffect(() => {
    if (!registerLockPush) return;
    registerLockPush(async () => {
      // 1) Save a seed snapshot for default days
      const DEFAULT_DAYS = ['Mon','Tue','Wed','Thu','Sat'];
      const codeById = new Map((codeData?.codes || []).map(c => [c.id, c.code]));
      const matrix = {};
      Object.entries(staged).forEach(([k, cid]) => {
        const [day, cls, pk] = k.split('|');
        if (!DEFAULT_DAYS.includes(day)) return;
        if (!matrix[cls]) matrix[cls] = {};
        const code = codeById.get(cid) || null;
        if (code) matrix[cls][pk] = code;
      });
      try { await saveSeedToSOP(matrix, `Stage ${stageIdx} Seed — ${new Date().toLocaleString()}`); } catch {}

      // 2) Persist staged days (weekly)
      await saveWeekly();

      // 3) Lock current filled cells
      const newLocks = {};
      Object.keys(staged).forEach((k) => { if (staged[k]) newLocks[k] = true; });
      setLockedMap((prev) => ({ ...prev, ...newLocks }));

      // 4) Advance stage or finalize
      const next = Math.min(3, stageIdx + 1);
      if (next > stageIdx) setStageIdx(next);
      // Auto-switch quick tools mode to guide user
      if (setPlanMode) {
        if (next === 2) setPlanMode('split_same_subject');
        if (next === 3) setPlanMode('same_period_diff_subject');
      }
      // Finalize on Stage 3 → push base MSP-R and close
      if (stageIdx >= 3) {
        try {
          // Build classId mapping from existing programScheduleCells
          const qRes = await fetch(`/api/admin/manageMeedian?section=programScheduleCells&programId=${programId}&track=${track}`);
          const qj = await qRes.json().catch(()=>({}));
          const classMap = new Map();
          (qj?.cells || []).forEach((r)=> { const key = String(r.className || r.classId); classMap.set(key, Number(r.classId)); });
          const baseDays = DEFAULT_DAYS;
          const cellsMap = new Map();
          Object.entries(staged).forEach(([k, cid])=>{
            const [day, cls, pk] = k.split('|');
            if (!baseDays.includes(day)) return;
            let classId = null; const parsed = Number(cls);
            if (!Number.isNaN(parsed) && String(parsed) === String(cls)) classId = parsed;
            if (classId === null) classId = classMap.get(String(cls));
            if (!classId) return;
            const mapKey = `${classId}|${pk}`;
            if (!cellsMap.has(mapKey) || cid) cellsMap.set(mapKey, cid ? Number(cid) : null);
          });
          const cells = Array.from(cellsMap.entries()).map(([k, mspCodeId]) => { const [classId, periodKey] = k.split('|'); return { classId: Number(classId), periodKey, mspCodeId: mspCodeId ? Number(mspCodeId) : null }; });
          const payload = { programId, track, cells };
          const res = await fetch('/api/admin/manageMeedian?section=programScheduleCells', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          const j = await res.json().catch(()=>({}));
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        } catch(e) { /* surface non-fatal */ }
        // Close via onSaved to refresh and exit
        onSaved && onSaved();
      }
    });
  }, [registerLockPush, staged, stageIdx, programId, track, codeData, saveWeekly]);

  // Load saved seeds for this program & track
  const fetchSeeds = async () => {
    try {
      setSeedsLoading(true);
      const mp = await fetch('/api/admin/manageMeedian?section=metaPrograms');
      const mj = await mp.json().catch(() => ({}));
      const prog = (mj?.programs || []).find((p) => p.id === programId);
      const key = track === 'pre_primary' ? 'pre_primary' : 'elementary';
      const seeds = (prog?.sop?.selfSchedulerSeeds && prog.sop.selfSchedulerSeeds[key]) || [];
      setSavedSeeds(Array.isArray(seeds) ? seeds : []);
      setSelectedSeedId((seeds && seeds[0] && seeds[0].id) || '');
    } catch (e) {
      setSavedSeeds([]);
    } finally {
      setSeedsLoading(false);
    }
  };

  useEffect(() => {
    if (programId) fetchSeeds();
  }, [programId, track]);

  const saveSeedToSOP = async (matrix, name) => {
    try {
      const mp = await fetch('/api/admin/manageMeedian?section=metaPrograms');
      const mj = await mp.json().catch(() => ({}));
      const prog = (mj?.programs || []).find((p) => p.id === programId);
      const sop = prog?.sop || {};
      const key = track === 'pre_primary' ? 'pre_primary' : 'elementary';
      sop.selfSchedulerSeeds = sop.selfSchedulerSeeds || {};
      sop.selfSchedulerSeeds[key] = sop.selfSchedulerSeeds[key] || [];
      const seedObj = { id: Date.now().toString(), name: name || `Seed ${new Date().toLocaleString()}`, matrix, createdAt: new Date().toISOString() };
      // prepend so newest appear at top
      sop.selfSchedulerSeeds[key] = [seedObj, ...sop.selfSchedulerSeeds[key]];
      const pr = await fetch('/api/admin/manageMeedian?section=programSOP', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ programId, sop }) });
      const pj = await pr.json().catch(() => ({}));
      if (!pr.ok) throw new Error(pj.error || `HTTP ${pr.status}`);

      // Optional: refresh schedule data if needed
      await Promise.all([refreshCells?.(), refreshPeriods?.()]);
      return seedObj;
    } catch (e) {
      throw e;
    }
  };

  const loadSeedById = async (id) => {
    try {
      const seed = (savedSeeds || []).find(s => s.id === id);
      if (!seed) return;
      const codeLookup = new Map((codeData?.codes || []).map(c => [c.code, c.id]));
      // Determine target days: selected days; fallback to full week if none selected
      const selDays = Object.keys(daysSel).filter((d) => daysSel[d]);
      const targetDays = selDays.length ? selDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      updateStaged((next) => {
        Object.keys(seed.matrix || {}).forEach((cls) => {
          const byPeriod = seed.matrix[cls] || {};
          Object.keys(byPeriod).forEach((pk) => {
            const val = byPeriod[pk];
            const code = Array.isArray(val) ? val[0] : (typeof val === 'string' ? val : val?.code);
            const cid = codeLookup.get(code);
            if (cid) {
              // apply to each target day
              targetDays.forEach((d) => {
                next[`${d}|${cls}|${pk}`] = cid;
              });
            }
          });
        });
        return next;
      });
      // Ensure grid view shows one of the days we applied
      if (targetDays.length) setViewDay(targetDays[0]);
      setSeedMsg('Seed loaded');
    } catch (e) {
      setErrorMsg(e.message || 'Failed to load seed');
    }
  };

  const deleteSeedById = async (id) => {
    try {
      const mp = await fetch('/api/admin/manageMeedian?section=metaPrograms');
      const mj = await mp.json().catch(() => ({}));
      const prog = (mj?.programs || []).find((p) => p.id === programId);
      const sop = prog?.sop || {};
      const key = track === 'pre_primary' ? 'pre_primary' : 'elementary';
      sop.selfSchedulerSeeds = sop.selfSchedulerSeeds || {};
      sop.selfSchedulerSeeds[key] = (sop.selfSchedulerSeeds[key] || []).filter(s => s.id !== id);
      const pr = await fetch('/api/admin/manageMeedian?section=programSOP', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ programId, sop }) });
      const pj = await pr.json().catch(() => ({}));
      if (!pr.ok) throw new Error(pj.error || `HTTP ${pr.status}`);
      await fetchSeeds();
      setSeedMsg('Seed deleted');
    } catch (e) {
      setErrorMsg(e.message || 'Failed to delete seed');
    }
  };

  const extractAndSaveCurrentSeed = async () => {
    try {
      // Build class-wise matrix from staged
      const codeById = new Map((codeData?.codes || []).map(c => [c.id, c.code]));
      const matrix = {};
      Object.entries(staged).forEach(([k, cid]) => {
        const [day, cls, pk] = k.split('|');
        if (!matrix[cls]) matrix[cls] = {};
        matrix[cls][pk] = codeById.get(cid) || null;
      });
      const name = prompt('Name for the new seed (optional):', `Seed ${new Date().toLocaleString()}`) || `Seed ${new Date().toLocaleString()}`;
      await saveSeedToSOP(matrix, name);
      setSeedMsg('Seed saved');
    } catch (e) {
      setErrorMsg(e.message || 'Failed to save seed');
    }
  };

  const periods = useMemo(() => (periodData?.periods || []).filter(p=>/^P\d+$/i.test(p.periodKey)).sort((a,b)=> Number(a.periodKey.slice(1))-Number(b.periodKey.slice(1))), [periodData]);
  // Always show full class list provided by parent; do not filter by staged
  const classList = useMemo(() => {
    if (Array.isArray(classes) && classes.length) {
      return [...classes.map(String)].sort((a,b) => { const na = Number(a), nb = Number(b); if (!Number.isNaN(na) && !Number.isNaN(nb)) return na-nb; return String(a).localeCompare(String(b)); });
    }
    if (track === 'pre_primary') return ['Nursery','LKG','UKG'];
    return ['1','2','3','4','5','6','7'];
  }, [classes, track]);

  const familyGroups = useMemo(() => {
    const codes = (codeData?.codes || [])
      .filter(c => (c.track === track || c.track === 'both'))
      .filter(c => c.active);
    const map = new Map();
    codes.forEach(c => { if (!map.has(c.familyKey)) map.set(c.familyKey, []); map.get(c.familyKey).push(c); });
    return Array.from(map.entries()).map(([fam, list]) => ({ fam, list }));
  }, [codeData, track]);

  // Helpers for reset-by-teacher
  const activeAsgByCode = useMemo(() => {
    const map = new Map();
    (asgData?.assignments || []).forEach((a) => { if (a.active && a.mspCodeId) map.set(a.mspCodeId, a); });
    return map;
  }, [asgData]);

  // Color classes per family (static strings so Tailwind keeps them)
  const colorByFamily = (fam) => {
    switch (fam) {
      case 'ESL': return 'bg-indigo-50 border-indigo-200 text-indigo-800';
      case 'EMS': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'EUA': return 'bg-rose-50 border-rose-200 text-rose-800';
      case 'EHO': return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'PGL': return 'bg-violet-50 border-violet-200 text-violet-800';
      case 'PRL': return 'bg-sky-50 border-sky-200 text-sky-800';
      default:    return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };
  const colorByCodeId = (id) => {
    const c = (codeData?.codes || []).find(x => x.id === id);
    return colorByFamily(c?.familyKey);
  };

  // Occurrence count: how many boxes each code occupies in the staged grid
  const occByCode = useMemo(() => {
    const m = new Map();
    Object.values(staged || {}).forEach((cid) => {
      if (!cid) return;
      m.set(cid, (m.get(cid) || 0) + 1);
    });
    return m;
  }, [staged]);

  const codeTeacher = useMemo(() => {
    const active = (asgData?.assignments || []).filter(a=> a.active);
    const map = new Map();
    active.forEach(a => { if (!map.has(a.mspCodeId)) map.set(a.mspCodeId, a.userId); });
    return map; // mspCodeId -> userId
  }, [asgData]);
  const teacherGroup = useMemo(() => {
    const codesById = new Map((codeData?.codes || []).map(c => [c.id, c]));
    const result = new Map(); // userId -> 'pre' | 'ele'
    (asgData?.assignments || []).forEach(a => {
      if (!a.active) return;
      const c = codesById.get(a.mspCodeId);
      const fam = c?.familyKey;
      const trk = c?.track;
      const g = (fam === 'PGL' || fam === 'PRL' || trk === 'pre_primary') ? 'pre' : 'ele';
      // prefer primary assignment when available
      if (!result.has(a.userId) || a.isPrimary) result.set(a.userId, g);
    });
    return result;
  }, [asgData, codeData]);

  const onDragStart = (ev, codeId) => {
    ev.dataTransfer.setData('text/plain', String(codeId));
  };
  const onDropInto = (ev, cls, pk) => {
    ev.preventDefault();
    setErrorMsg('');
    const codeId = Number(ev.dataTransfer.getData('text/plain'));
    if (!codeId) return;

    const targetDays = daysMode === 'split' ? Object.keys(daysSel).filter(k=> daysSel[k]) : ['Mon','Tue','Wed','Thu','Sat'];
    // Prevent editing locked cell(s) for this class/period
    for (const d of targetDays) {
      const key = `${d}|${cls}|${pk}`;
      if (lockedMap[key]) return;
    }
    // Constraint 1: same code cannot appear twice at same day/period across classes (teacher/code clash)
    for (const d of targetDays) {
      for (const c of classList) {
        const key = `${d}|${c}|${pk}`;
        if (staged[key] === codeId && c !== cls) {
          setErrorMsg('Conflict: same code in same period across classes.');
          return;
        }
      }
    }
    // Constraint 2: teacher workload ≤ 7 periods/day across codes
    const userId = codeTeacher.get(codeId);
    if (userId) {
      for (const d of targetDays) {
        let count = 0;
        for (const c of classList) {
          for (const p of periods) {
            const key = `${d}|${c}|${p.periodKey}`;
            const cid = staged[key];
            if (cid && codeTeacher.get(cid) === userId) count++;
          }
        }
        if (count >= 7) {
          setErrorMsg('Workload cap: teacher already at 7 periods for that day.');
          return;
        }
      }
    }

    updateStaged((next) => {
      const applyDays = targetDays;
      const others = ['Mon','Tue','Wed','Thu','Fri','Sat'].filter(d => !applyDays.includes(d));
      for (const d of applyDays) next[`${d}|${cls}|${pk}`] = codeId;
      if (fallbackCode) {
        for (const d of others) next[`${d}|${cls}|${pk}`] = Number(fallbackCode);
      }
      return next;
    });
    // Stage 1: collect active fixed codes (for reference/lock view in next stages)
    if (planMode === 'fixed_all_days') {
      setFixedActiveCodes((prev) => (prev.includes(codeId) ? prev : [...prev, codeId]));
    }
  };
  const allowDrop = (ev) => ev.preventDefault();
  const onDragStartAssigned = (ev, day, cls, pk) => {
    const k = `${day}|${cls}|${pk}`;
    ev.dataTransfer.setData('text/removeKey', k);
    const cid = staged[k];
    if (cid) ev.dataTransfer.setData('text/codeIdAssigned', String(cid));
  };
  const onDropRemove = (ev) => {
    ev.preventDefault();
    const key = ev.dataTransfer.getData('text/removeKey');
    // If a placed chip was dragged, we set text/codeIdAssigned
    let codeId = Number(ev.dataTransfer.getData('text/codeIdAssigned')) || 0;
    // If a code pill from the code list was dragged, it carries 'text/plain' with codeId
    if (!codeId) {
      const maybe = Number(ev.dataTransfer.getData('text/plain'));
      if (!Number.isNaN(maybe)) codeId = maybe;
    }
    const selectedDays = daysMode === 'split' ? Object.keys(daysSel).filter(d => daysSel[d]) : ['Mon','Tue','Wed','Thu','Sat'];

    updateStaged((next) => {
      if (codeId) {
        // Clear all placements of this code across selected days
        Object.keys(next).forEach((k) => {
          const d = k.split('|')[0];
          if (selectedDays.includes(d) && Number(next[k]) === codeId) delete next[k];
        });
      } else if (key) {
        // Fallback: remove only this cell
        delete next[key];
      }
      return next;
    });
  };

  async function saveWeekly() {
    try {
      setErrorMsg('');
      const usedDays = Object.keys(staged).map(k => k.split('|')[0]);
      const days = Array.from(new Set(usedDays)).filter(Boolean);
      if (!days.length) { setErrorMsg('No changes to save.'); return; }
      // Compile rows: include staged; resolve class names to numeric classId
      // Fetch current programScheduleCells to map className -> classId
      const qRes = await fetch(`/api/admin/manageMeedian?section=programScheduleCells&programId=${programId}&track=${track}`);
      const qj = await qRes.json().catch(() => ({}));
      const classMap = new Map();
      (qj?.cells || []).forEach((r) => {
        const key = String(r.className || r.classId);
        classMap.set(key, Number(r.classId));
      });

      const unresolved = new Set();
      const rows = Object.entries(staged).map(([k, cid]) => {
        const [dayName, cls, periodKey] = k.split('|');
        // cls might be a numeric string (class id) or a class name; try numeric first
        let classId = null;
        const parsed = Number(cls);
        if (!Number.isNaN(parsed) && String(parsed) === String(cls)) classId = parsed;
        if (classId === null) {
          const mapped = classMap.get(String(cls));
          if (mapped) classId = mapped;
        }
        if (!classId) unresolved.add(cls);
        return { classId: classId || null, dayName, periodKey, mspCodeId: cid ? Number(cid) : null, subject: null };
      });
      if (unresolved.size) {
        setErrorMsg(`Cannot resolve classes to IDs: ${Array.from(unresolved).slice(0,8).join(', ')}. Ensure classes exist in base schedule.`);
        return;
      }
      // Map class names to ids
      const payload = { programId: programId, track, days, cells: rows.filter(r => r.classId) };
      const res = await fetch(`/api/admin/manageMeedian?section=programScheduleDays`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      // Clear draft for this track after finalizing
      try {
        const mp = await fetch('/api/admin/manageMeedian?section=metaPrograms');
        const mj = await mp.json();
        const prog = (mj.programs||[]).find(p=> p.id === programId);
        const sop = prog?.sop || {};
        const key = track === 'pre_primary' ? 'pre_primary' : 'elementary';
        if (sop.selfSchedulerDraft && sop.selfSchedulerDraft[key]) {
          delete sop.selfSchedulerDraft[key];
          await fetch('/api/admin/manageMeedian?section=programSOP', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ programId, sop }) });
        }
      } catch {}
      onSaved && onSaved();
    } catch (e) {
      setErrorMsg(e.message || 'Failed to save');
    }
  }

  const applySeed = () => {
    setSeedMsg(''); setErrorMsg('');
    let parsed;
    try {
      parsed = JSON.parse(seedText);
    } catch (e) {
      setSeedMsg('Invalid JSON');
      return;
    }
    const dayKeys = ['Mon','Tue','Wed','Thu','Fri','Sat'];
    const hasDays = parsed && typeof parsed === 'object' && Object.keys(parsed).some(k => dayKeys.includes(k));
    const targetDays = hasDays
      ? Object.keys(parsed).filter(k => dayKeys.includes(k))
      : Object.keys(daysSel).filter(k => daysSel[k]);

    // Build code lookup
    const codeLookup = new Map((codeData?.codes || []).map(c => [c.code, c.id]));

    updateStaged((next) => {
      if (hasDays) {
        for (const d of targetDays) {
          const byClass = parsed[d] || {};
          for (const cls of Object.keys(byClass)) {
            const byPeriod = byClass[cls] || {};
            for (const pk of Object.keys(byPeriod)) {
              const val = byPeriod[pk];
              const code = Array.isArray(val) ? val[0] : (typeof val === 'string' ? val : val?.code);
              const id = codeLookup.get(code);
              if (id) next[`${d}|${cls}|${pk}`] = id;
            }
          }
        }
      } else {
        // class-wise seed → apply to selected days
        for (const cls of Object.keys(parsed)) {
          const byPeriod = parsed[cls] || {};
          for (const pk of Object.keys(byPeriod)) {
            const val = byPeriod[pk];
            const code = Array.isArray(val) ? val[0] : (typeof val === 'string' ? val : val?.code);
            const id = codeLookup.get(code);
            if (!id) continue;
            for (const d of targetDays) next[`${d}|${cls}|${pk}`] = id;
          }
        }
      }
      return next;
    });
    setSeedMsg('Seed applied to staged grid');
  };

  // Function to extract seed of any day from the grid and save it at the bottom
  async function extractSeedFromGrid(day) {
    try {
      const gridData = cellData?.cells || [];
      const seed = gridData.filter((cell) => cell.day === day).map((cell) => cell.seed);

      // Save the extracted seed at the bottom
      const updatedSeed = [...(program?.sop?.seeds || []), ...seed];

      const response = await fetch("/api/admin/manageMeedian?section=programSOP", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: id, sop: { ...program.sop, seeds: updatedSeed } }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      console.log("Seed saved successfully at the bottom.");
    } catch (error) {
      console.error("Failed to extract and save seed:", error);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12">
      <div className="md:col-span-4 border-r p-3 space-y-2">
        {/* Remove drop zone (drag a placed code or a code pill to clear) */}
        <div className="mb-2">
          <div className="text-xs text-gray-600 mb-1">Drop here to remove/reset</div>
          <div className="border-2 border-dashed rounded-lg p-2 text-center text-xs text-gray-500 bg-gray-50"
               onDragOver={allowDrop}
               onDrop={onDropRemove}
          >
            Drop a placed code to remove that cell, or drop a code to clear it across selected days.
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-800">Codes</div>
          <input
            className="ml-2 flex-1 border rounded px-2 py-1 text-xs"
            placeholder="Search code/title"
            value={codeFilter}
            onChange={(e)=> setCodeFilter(e.target.value)}
          />
        </div>
        <div className="text-xs text-gray-600">Drag a code onto the timetable.</div>
        {/* Quick tools based on planMode */}
        <div className="mt-2 space-y-2">
          {planMode !== 'fixed_all_days' ? (
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-700">Active Period</div>
              <div className="flex flex-wrap gap-1">
                {(periodData?.periods||[]).filter(p=>/^P\d+$/i.test(p.periodKey)).map(p => (
                  <button key={p.periodKey} className={`px-2 py-0.5 rounded text-[11px] border ${activePeriod===p.periodKey?'bg-gray-900 text-white':'bg-white'}`} onClick={()=> setActivePeriod(p.periodKey)}>
                    {p.periodKey}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-700">Active Fixed Codes</div>
                <span className="text-[10px] text-gray-500">Stage {stageIdx}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {fixedActiveCodes.length === 0 ? (
                  <span className="text-[11px] text-gray-500">Drag codes into grid to collect</span>
                ) : (
                  fixedActiveCodes.map(id => {
                    const c = (codeData?.codes||[]).find(x=> x.id === id);
                    return <span key={id} className="px-2 py-0.5 rounded border bg-white text-[11px]">{c?.code || id}</span>;
                  })
                )}
              </div>
            </div>
          )}
          {planMode === 'fixed_all_days' && (
            <div>
              <div className="text-xs text-gray-700 mb-1">Bulk fill (drop a code here): all classes, selected days, active period</div>
              <div className="border-2 border-dashed rounded p-2 text-center text-xs text-gray-500 bg-gray-50" onDragOver={allowDrop} onDrop={(e)=>{
                e.preventDefault();
                const cid = Number(e.dataTransfer.getData('text/plain'));
                if (!cid || !activePeriod) return;
                const targetDays = (daysMode==='split'? Object.keys(daysSel).filter(d=> daysSel[d]) : ['Mon','Tue','Wed','Thu','Sat']);
                updateStaged((next)=>{
                  classes.forEach(cls => {
                    targetDays.forEach(d => { next[`${d}|${cls}|${activePeriod}`] = cid; });
                  });
                  return next;
                });
              }}>Drop code to fill</div>
            </div>
          )}
          {planMode === 'split_same_subject' && (
            <div className="space-y-1">
              <div className="text-xs text-gray-700">Distribution bucket (drop multiple teacher-variants)</div>
              <div className="border-2 border-dashed rounded p-2 min-h-[38px] flex flex-wrap gap-1 bg-gray-50" onDragOver={allowDrop} onDrop={(e)=>{ e.preventDefault(); const cid = Number(e.dataTransfer.getData('text/plain')); if (!cid) return; setBucketCodes(b => b.includes(cid)? b : [...b, cid]); }}>
                {bucketCodes.map(id => { const c = (codeData?.codes||[]).find(x=> x.id===id); return <span key={id} className="px-2 py-0.5 text-xs rounded border bg-white">{c?.code||id}</span>; })}
              </div>
              <button className="px-2.5 py-1 rounded bg-gray-900 text-white text-xs" onClick={()=>{
                if (!bucketCodes.length || !activePeriod) return;
                const targetDays = (daysMode==='split'? Object.keys(daysSel).filter(d=> daysSel[d]) : ['Mon','Tue','Wed','Thu','Sat']);
                updateStaged((next)=>{
                  classes.forEach((cls, idx) => {
                    const codeId = bucketCodes[idx % bucketCodes.length];
                    targetDays.forEach(d => { next[`${d}|${cls}|${activePeriod}`] = codeId; });
                  });
                  return next;
                });
              }}>Distribute to classes</button>
            </div>
          )}
          {planMode === 'same_period_diff_subject' && (
            <div className="space-y-1">
              <div className="text-xs text-gray-700">One class, one period — split days between two subjects</div>
              <select className="w-full border rounded px-2 py-1 text-xs" value={spdsClass} onChange={(e)=> setSpdsClass(e.target.value)}>
                <option value="">Select class…</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-gray-600">Drop Subject A</div>
                  <div className="border-2 border-dashed rounded p-2 min-h-[34px] bg-gray-50" onDragOver={allowDrop} onDrop={(e)=>{ e.preventDefault(); const cid = Number(e.dataTransfer.getData('text/plain')); if (cid) setSpdsA(cid); }}>
                    {spdsA ? (codeData?.codes||[]).find(c=> c.id===spdsA)?.code : '—'}
                  </div>
                  <input type="number" min="0" max="5" className="mt-1 w-full border rounded px-2 py-1 text-xs" value={spdsACount} onChange={(e)=> setSpdsACount(Math.max(0, Math.min(5, Number(e.target.value)||0)))} />
                </div>
                <div>
                  <div className="text-[11px] text-gray-600">Drop Subject B</div>
                  <div className="border-2 border-dashed rounded p-2 min-h-[34px] bg-gray-50" onDragOver={allowDrop} onDrop={(e)=>{ e.preventDefault(); const cid = Number(e.dataTransfer.getData('text/plain')); if (cid) setSpdsB(cid); }}>
                    {spdsB ? (codeData?.codes||[]).find(c=> c.id===spdsB)?.code : '—'}
                  </div>
                  <input type="number" min="0" max="5" className="mt-1 w-full border rounded px-2 py-1 text-xs" value={spdsBCount} onChange={(e)=> setSpdsBCount(Math.max(0, Math.min(5, Number(e.target.value)||0)))} />
                </div>
              </div>
              <button className="px-2.5 py-1 rounded bg-gray-900 text-white text-xs" onClick={()=>{
                if (!spdsClass || !activePeriod || (!spdsA && !spdsB)) return;
                const targetDays = (daysMode==='split'? Object.keys(daysSel).filter(d=> daysSel[d]) : ['Mon','Tue','Wed','Thu','Sat']);
                const seq = [];
                for (let i=0;i<spdsACount && seq.length<targetDays.length;i++) seq.push(spdsA);
                for (let i=0;i<spdsBCount && seq.length<targetDays.length;i++) seq.push(spdsB);
                while (seq.length < targetDays.length) seq.push(spdsA || spdsB);
                updateStaged((next)=>{
                  targetDays.forEach((d, i) => { const cid = seq[i]; if (cid) next[`${d}|${spdsClass}|${activePeriod}`] = cid; });
                  return next;
                });
              }}>Apply split</button>
            </div>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {familyGroups
            .map(({ fam, list }) => ({ fam, list: list.filter(c => {
              const q = codeFilter.trim().toLowerCase();
              if (!q) return true;
              return c.code.toLowerCase().includes(q) || (c.title||'').toLowerCase().includes(q);
            }) }))
            .filter(({ list }) => list.length)
            .map(({ fam, list }) => (
            <div key={fam} className="mb-2">
              <div className="text-xs font-bold text-gray-700 mb-1">{fam}</div>
              <div className="flex flex-wrap gap-2">
                 {list.map(c => {
                   const count = occByCode.get(c.id) || 0;
                   const asgs = (asgData?.assignments||[]).filter(a=> a.active && Number(a.mspCodeId) === Number(c.id));
                   const names = asgs.map(a => (teamData?.users||[]).find(u => u.id === a.userId)?.name || a.userId);
                   return (
                     <div
                       key={c.id}
                       draggable
                       onDragStart={(e)=> onDragStart(e, c.id)}
                      className={`px-2 py-1 rounded-lg border text-xs cursor-grab hover:brightness-105 ${colorByFamily(c.familyKey)} flex items-center justify-between gap-2 min-w-[84px]`}
                      title={`${c.title || c.code}${names.length ? ` — Teacher: ${names.join(', ')}`:''} — placed ${count} time${count===1?'':'s'}`}
                     >
                      <span>{c.code}</span>
                      {names.length > 0 && <span className="text-[9px] px-1 py-0.5 rounded bg-white/80 border border-black/10 text-gray-700">{names[0]}</span>}
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/80 border border-black/10 text-gray-800 min-w-[18px] text-center">{count}</span>
                     </div>
                   );
                 })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-800">Tools</div>
            <button className="text-xs text-gray-600 underline" onClick={()=> setShowAdvanced(v=> !v)}>{showAdvanced ? 'Hide Advanced' : 'Show Advanced'}</button>
          </div>
          {showAdvanced && (
            <div className="grid grid-cols-3 gap-1 text-xs">
              {['Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <label key={d} className="inline-flex items-center gap-1"><input type="checkbox" checked={!!daysSel[d]} onChange={(e)=> setDaysSel(s=> ({...s, [d]: e.target.checked}))} /> {d}</label>
              ))}
              <div className="col-span-3">
                <div className="text-xs text-gray-700 mb-1">Fallback code for other days (optional)</div>
                <select className="w-full border rounded px-2 py-1 text-xs" value={fallbackCode} onChange={(e)=> setFallbackCode(e.target.value)}>
                  <option value="">(none)</option>
                  {(codeData?.codes||[]).filter(c=> (c.track===track || c.track==='both') && c.active).map(c=> (
                    <option key={c.id} value={c.id}>{c.code}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {errorMsg && <div className="text-xs text-rose-600">{errorMsg}</div>}
          <div className="pt-2 flex items-center gap-2 flex-wrap">
            <button className="px-3 py-1.5 rounded bg-gray-900 text-white text-xs" onClick={saveWeekly}>Validate & Save</button>
            {/* Push as MSP-R moved to header button */}
            <button className="px-3 py-1.5 rounded bg-gray-100 text-gray-800 text-xs" onClick={() => {
              // Determine visible days: split selection or Mon-Fri for 'all'
              const visibleDays = daysMode === 'split' ? Object.keys(daysSel).filter(d => daysSel[d]) : ['Mon','Tue','Wed','Thu','Sat'];
              const targets = visibleDays.length > 1 ? visibleDays : [viewDay];
              if (!confirm(`Clear placements for ${targets.length} day(s)?`)) return;
              const removed = [];
              updateStaged((next) => {
                Object.keys(next).forEach((k) => {
                  const d = k.split('|')[0];
                  if (targets.includes(d)) { removed.push(k); delete next[k]; }
                });
                return next;
              });
              setClearedInfo({ count: removed.length, sample: removed.slice(0, 6) });
              setTimeout(() => setClearedInfo(null), 6000);
            }}>Clear Day</button>
            {daysMode === 'split' && (
              <button className="px-3 py-1.5 rounded bg-gray-100 text-gray-800 text-xs" onClick={() => {
                const targets = Object.keys(daysSel).filter(d => daysSel[d]);
                if (!targets.length) return alert('No days selected');
                if (!confirm(`Clear placements for ${targets.length} selected day(s)?`)) return;
                const removed = [];
                updateStaged((next) => {
                  Object.keys(next).forEach((k) => {
                    const d = k.split('|')[0];
                    if (targets.includes(d)) { removed.push(k); delete next[k]; }
                  });
                  return next;
                });
                setClearedInfo({ count: removed.length, sample: removed.slice(0, 6) });
                setTimeout(() => setClearedInfo(null), 6000);
              }}>Clear Selected Days</button>
            )}
            <button className="px-3 py-1.5 rounded bg-gray-100 text-gray-800 text-xs" onClick={()=> {
              if (!confirm('Clear all placements for the week?')) return;
              const removed = [];
              updateStaged(() => { return {}; });
              // We cannot easily capture removed keys here after clearing; show generic message
              setClearedInfo({ count: null, sample: [] });
              setTimeout(() => setClearedInfo(null), 6000);
            }} >Clear All</button>
            <button className="px-3 py-1.5 rounded bg-gray-100 text-gray-800 text-xs disabled:opacity-50" onClick={undo} disabled={!canUndo}>Undo</button>
            <button className="px-3 py-1.5 rounded bg-gray-100 text-gray-800 text-xs disabled:opacity-50" onClick={redo} disabled={!canRedo}>Redo</button>
            {showAdvanced && (
            <button className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs" onClick={async()=>{
              try {
                setSeedMsg(''); setErrorMsg('');
                // Build draft JSON day->class->period->code
                const codeById = new Map((codeData?.codes||[]).map(c=> [c.id, c.code]));
                const draft = {};
                Object.entries(staged).forEach(([k, cid])=>{
                  const [day, cls, pk] = k.split('|');
                  if (!draft[day]) draft[day] = {};
                  if (!draft[day][cls]) draft[day][cls] = {};
                  draft[day][cls][pk] = codeById.get(cid) || null;
                });
                // Fetch current program SOP, merge
                const mp = await fetch('/api/admin/manageMeedian?section=metaPrograms');
                const mj = await mp.json();
                const prog = (mj.programs||[]).find(p=> p.id === programId);
                const sop = prog?.sop || {};
                sop.selfSchedulerDraft = sop.selfSchedulerDraft || {};
                sop.selfSchedulerDraft[key] = draft;
                const pr = await fetch('/api/admin/manageMeedian?section=programSOP', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ programId, sop }) });
                const pj = await pr.json().catch(() => ({}));
                if (!pr.ok) throw new Error(pj.error || `HTTP ${pr.status}`);
                setSeedMsg('Draft saved');
              } catch(e) {
                setErrorMsg(e.message || 'Failed to save draft');
              }
            }}>Save Draft</button>
            )}
            {showAdvanced && (
            <button className="px-3 py-1.5 rounded bg-gray-100 border text-gray-800 text-xs" onClick={async()=>{
              try {
                setSeedMsg(''); setErrorMsg('');
                const mp = await fetch('/api/admin/manageMeedian?section=metaPrograms');
                const mj = await mp.json();
                const prog = (mj.programs||[]).find(p=> p.id === programId);
                const key = track === 'pre_primary' ? 'pre_primary' : 'elementary';
                const draft = prog?.sop?.selfSchedulerDraft?.[key];
                if (!draft) { setSeedMsg('No draft found'); return; }
                const codeLookup = new Map((codeData?.codes || []).map(c => [c.code, c.id]));
                updateStaged((next)=>{
                  Object.keys(draft).forEach(day => {
                    const byClass = draft[day] || {};
                    Object.keys(byClass).forEach(cls => {
                      const byPeriod = byClass[cls] || {};
                      Object.keys(byPeriod).forEach(pk => {
                        const id = codeLookup.get(byPeriod[pk]);
                        if (id) next[`${day}|${cls}|${pk}`] = id;
                      });
                    });
                  });
                  return next;
                });
                setSeedMsg('Draft loaded');
              } catch(e) { setErrorMsg(e.message || 'Failed to load draft'); }
            }}>Load Draft</button>
            )}
            <span className="text-[11px] text-emerald-700">{seedMsg}</span>
            {clearedInfo && (
              <div className="text-[11px] text-rose-600 ml-2">
                Cleared {clearedInfo.count === null ? 'all' : `${clearedInfo.count} cells`} {clearedInfo.sample && clearedInfo.sample.length ? ` (e.g. ${clearedInfo.sample.join(',')})` : ''}
              </div>
            )}
            {errorMsg && <span className="text-[11px] text-rose-600">{errorMsg}</span>}
          </div>
          {/* Advanced tools */}
          {showAdvanced && (
          <div className="pt-3 border-t mt-3 space-y-2">
            <div className="text-sm font-semibold text-gray-800">Reset Tools</div>
            <ResetControls
              classes={classes}
              team={teamData?.users || []}
              codes={(codeData?.codes || []).filter(c => (c.track===track || c.track==='both') && c.active).map(c => ({ id: c.id, code: c.code, count: occByCode.get(c.id) || 0 }))}
              onResetClass={(cls) => {
                const base = baselineRef.current || {};
                if (!cls) return;
                updateStaged((next) => {
                  ['Mon','Tue','Wed','Thu','Fri','Sat'].forEach((d) => {
                    periods.forEach((p) => {
                      const k = `${d}|${cls}|${p.periodKey}`;
                      if (k in base) next[k] = base[k]; else delete next[k];
                    });
                  });
                  return next;
                });
              }}
              onClearTeacher={(userId) => {
                if (!userId) return;
                updateStaged((next) => {
                  Object.keys(next).forEach((k) => {
                    const cid = next[k];
                    const asg = activeAsgByCode.get(cid);
                    if (asg && Number(asg.userId) === Number(userId)) delete next[k];
                  });
                  return next;
                });
              }}
              onClearCode={(codeId) => {
                if (!codeId) return;
                updateStaged((next) => {
                  Object.keys(next).forEach((k) => {
                    if (Number(next[k]) === Number(codeId)) delete next[k];
                  });
                  return next;
                });
              }}
              extractAndSaveCurrentSeed={extractAndSaveCurrentSeed}
            />
          </div>
          )}
          {showAdvanced && (
          <div className="pt-3">
            <button className="px-2 py-1.5 rounded border text-xs" onClick={()=> setSeedOpen(v=> !v)}>{seedOpen ? 'Hide' : 'Paste'} Seed JSON</button>
            {seedOpen && (
              <div className="mt-2 space-y-2">
                <div className="text-[11px] text-gray-600">
                  Format A (day-wise): {`{"Mon": { "1": { "P1": "ESL1" } } }`} • Format B (class-wise): {`{"1": { "P1": "ESL1" } }`} (applies to selected days)
                </div>
                <textarea className="w-full h-28 border rounded p-2 text-xs font-mono" value={seedText} onChange={(e)=> setSeedText(e.target.value)} placeholder='{"Mon":{"1":{"P1":"ESL1"}}}' />
                <div className="flex items-center justify-between">
                  <button className="px-3 py-1.5 rounded bg-teal-600 text-white text-xs" onClick={applySeed}>Apply Seed to Grid</button>
                  {seedMsg && <div className="text-[11px] text-emerald-700">{seedMsg}</div>}
                </div>
              </div>
            )}
          </div>
          )}
          {/* Saved Seeds panel */}
          {showAdvanced && (
          <div className="pt-3 border-t mt-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Saved Seeds</div>
              <div className="text-xs text-gray-500">{seedsLoading ? 'Loading…' : `${savedSeeds.length} saved`}</div>
            </div>
            <div className="mt-2 space-y-2">
              {savedSeeds.length === 0 && <div className="text-xs text-gray-500">No saved seeds</div>}
              {savedSeeds.map(s => (
                <div key={s.id} className="flex items-center gap-2 justify-between border rounded p-2 bg-gray-50">
                  <div className="text-xs">{s.name}</div>
                  <div className="flex items-center gap-1">
                    <button className="px-2 py-0.5 text-xs rounded bg-white border" onClick={() => { setSelectedSeedId(s.id); loadSeedById(s.id); }}>Load</button>
                    <button className="px-2 py-0.5 text-xs rounded bg-white border text-rose-600" onClick={() => { if (confirm('Delete seed?')) deleteSeedById(s.id); }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>
      <div className="md:col-span-8 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-800">Timetable (view day)</div>
          <div className="flex items-center gap-2">
            <label className="text-xs inline-flex items-center gap-1">
              <input type="checkbox" onChange={(e)=> setShowLeisure(e.target.checked)} checked={showLeisure} /> Show leisure
            </label>
            <select className="px-2 py-1 border rounded text-sm" value={viewDay} onChange={(e)=> setViewDay(e.target.value)}>
              {['Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[800px] text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-700">
                <th className="border px-3 py-2 sticky left-0 bg-gray-50 z-10">Class</th>
                {periods.map(p => (
                            <th key={p.periodKey} className={`border px-3 py-2 text-center ${p.periodKey==='P5' ? 'border-l-4 border-l-rose-400' : ''}`}>{p.periodKey}<div className="text-[11px] text-gray-500">{p.startTime?.slice?.(0,5)}–{p.endTime?.slice?.(0,5)}</div></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classList.map(cls => (
                <tr key={cls}>
                  <td className="border px-3 py-2 sticky left-0 bg-white z-10 font-semibold">{cls}</td>
                  {periods.map(p => {
                    const val = staged[`${viewDay}|${cls}|${p.periodKey}`];
                    const codeObj = (codeData?.codes || []).find(c=> c.id === val);
                    const code = codeObj?.code;
                    return (
                      <td key={`${cls}-${p.periodKey}`} className={`border align-top ${p.periodKey==='P5' ? 'border-l-4 border-l-rose-400' : ''}`}>
                        <div className="min-h-[40px] px-2 py-1" onDragOver={allowDrop} onDrop={(e)=> onDropInto(e, cls, p.periodKey)}>
                          {code ? (
                            <div className="flex items-center gap-1">
                              <div
                                className={`inline-block px-2 py-1 text-xs rounded border ${colorByFamily(codeObj?.familyKey)}`}
                                draggable
                                onDragStart={(e)=> onDragStartAssigned(e, viewDay, cls, p.periodKey)}
                                title="Drag back to remove zone"
                              >
                                {code}
                              </div>
                              <button
                                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 border hover:bg-gray-200"
                                title="Remove from this cell"
                                onClick={()=> setStaged(prev => { const next = { ...prev }; delete next[`${viewDay}|${cls}|${p.periodKey}`]; return next; })}
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400">Drop here</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Leisure preview (simple, based on staged only) */}
        {showLeisure && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-800">Leisure (free teachers)</div>
            <div className="flex flex-wrap gap-1">
              {periods.map(p => (
                <button key={p.periodKey} className={`px-2 py-1 rounded text-xs border ${leisurePeriod === p.periodKey ? 'bg-gray-900 text-white' : 'bg-white'}`} onClick={()=> setLeisurePeriod(p.periodKey)}>
                  {p.periodKey}
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const targetPk = leisurePeriod || (periods[0]?.periodKey || 'P1');
            const teachers = new Set((asgData?.assignments||[]).filter(a=> a.active).map(a=> a.userId));
            // remove those used in staged for this day/period
            classList.forEach(cls => {
              const cid = staged[`${viewDay}|${cls}|${targetPk}`];
              if (cid) {
                const uid = codeTeacher.get(cid);
                if (uid) teachers.delete(uid);
              }
            });
            const pre = Array.from(teachers).filter(uid => teacherGroup.get(uid) === 'pre');
            const ele = Array.from(teachers).filter(uid => teacherGroup.get(uid) !== 'pre');
            const preNames = pre.map(uid => (teamData?.users||[]).find(u=> u.id === uid)?.name || uid);
            const eleNames = ele.map(uid => (teamData?.users||[]).find(u=> u.id === uid)?.name || uid);
            const Chip = ({ name }) => <span className="px-2 py-1 rounded-full border bg-gray-50 text-[11px]">{name}</span>;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border rounded-lg p-2">
                  <div className="text-xs font-semibold text-sky-700 mb-1">Pre‑Primary — {targetPk}</div>
                  <div className="flex flex-wrap gap-1.5">{preNames.length ? preNames.slice(0, 24).map((n,i)=> <Chip key={i} name={n}/>) : <span className="text-[11px] text-gray-500">—</span>}</div>
                </div>
                <div className="border rounded-lg p-2">
                  <div className="text-xs font-semibold text-indigo-700 mb-1">Elementary — {targetPk}</div>
                  <div className="flex flex-wrap gap-1.5">{eleNames.length ? eleNames.slice(0, 24).map((n,i)=> <Chip key={i} name={n}/>) : <span className="text-[11px] text-gray-500">—</span>}</div>
                </div>
              </div>
            );
          })()}
        </div>
        )}
      </div>
    </div>
  );
}

function ResetControls({ classes, team, codes, onResetClass, onClearTeacher, onClearCode, extractAndSaveCurrentSeed }) {
  const [cls, setCls] = useState('');
  const [userId, setUserId] = useState('');
  const [codeId, setCodeId] = useState('');
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <div className="text-xs text-gray-600">Reset a class row from current plan</div>
          <div className="flex items-center gap-2">
            <select className="flex-1 border rounded px-2 py-1 text-xs" value={cls} onChange={(e)=> setCls(e.target.value)}>
              <option value="">Select class…</option>
              {classes.map((c)=> <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="px-2.5 py-1.5 rounded bg-white border text-xs" onClick={()=> onResetClass && onResetClass(cls)} disabled={!cls}>Reset Class</button>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-600">Clear all placements for a teacher</div>
          <div className="flex items-center gap-2">
            <select className="flex-1 border rounded px-2 py-1 text-xs" value={userId} onChange={(e)=> setUserId(e.target.value)}>
              <option value="">Select teacher…</option>
              {team.map((u)=> <option key={u.id} value={u.id}>{u.name || u.id}</option>)}
            </select>
            <button className="px-2.5 py-1.5 rounded bg-white border text-xs" onClick={()=> onClearTeacher && onClearTeacher(Number(userId))} disabled={!userId}>Clear Teacher</button>
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-gray-600">Clear all placements of a code (reset load to 0)</div>
        <div className="flex items-center gap-2">
          <select className="flex-1 border rounded px-2 py-1 text-xs" value={codeId} onChange={(e)=> setCodeId(e.target.value)}>
            <option value="">Select code…</option>
            {(codes || []).map((c)=> (
              <option key={c.id} value={c.id}>{c.code}{typeof c.count==='number' ? ` (x${c.count})` : ''}</option>
            ))}
          </select>
          <button className="px-2.5 py-1.5 rounded bg-white border text-xs" onClick={()=> onClearCode && onClearCode(Number(codeId))} disabled={!codeId}>Clear Code</button>
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-gray-600">Extract and save the entire day's grid as a seed (for copy-paste reuse)</div>
        <div className="flex items-center gap-2">
          <select className="flex-1 border rounded px-2 py-1 text-xs" value={userId} onChange={(e)=> setUserId(e.target.value)}>
            <option value="">Select day…</option>
            {["Mon","Tue","Wed","Thu","Fri","Sat"].map((d)=> <option key={d} value={d}>{d}</option>)}
          </select>
          <button className="px-2.5 py-1.5 rounded bg-indigo-600 text-white text-xs" onClick={()=> userId && extractAndSaveCurrentSeed(userId)} disabled={!userId}>Extract Seed</button>
        </div>
      </div>
    </div>
  );
}
