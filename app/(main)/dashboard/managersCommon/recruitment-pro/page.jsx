"use client";

import React from "react";
import useSWR from "swr";

const fetcher = (url) => fetch(url).then((res) => res.json());

const apiCall = async (section, method, payload) => {
  const res = await fetch(`/api/managersCommon/recruitment-pro?section=${section}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body;
};

const toDateInput = (value) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value);
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
};

const statusBadge = (openCount) => {
  if (openCount <= 0) return "FILLED";
  if (openCount <= 1) return "URGENT";
  if (openCount <= 3) return "IN PROGRESS";
  return "OPEN";
};

const COMM_METHOD_OPTIONS = ["Call", "WhatsApp", "Email", "SMS", "In-Person", "Video Call"];
const COMM_OUTCOME_OPTIONS = ["Interested", "Not Interested", "Will Call Back", "Pending", "Callback Required"];

const TAB_LIST = [
  { key: "meta", label: "Meta Controls" },
  { key: "candidates", label: "Shortlisted Candidates" },
  { key: "pipeline", label: "Pipeline Tracker" },
  { key: "dashboard", label: "Dashboard" },
  { key: "programTracking", label: "Program Tracking" },
];

const SectionCard = ({ title, subtitle, children, className = "" }) => (
  <div className={`rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur ${className}`}>
    {(title || subtitle) && (
      <div className="border-b border-slate-100 px-5 py-4">
        {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
);

export default function RecruitmentProPage() {
  const [activeTab, setActiveTab] = React.useState("home");

  const programsSwr = useSWR("/api/managersCommon/recruitment-pro?section=metaPrograms", fetcher);
  const stagesSwr = useSWR("/api/managersCommon/recruitment-pro?section=metaStages", fetcher);
  const countrySwr = useSWR("/api/managersCommon/recruitment-pro?section=metaCountryCodes", fetcher);
  const locationsSwr = useSWR("/api/managersCommon/recruitment-pro?section=metaLocations", fetcher);
  const vacantCodesSwr = useSWR(
    activeTab === "meta" || activeTab === "candidates"
      ? "/api/managersCommon/recruitment-pro?section=vacantMspCodes"
      : null,
    fetcher
  );

  const candidatesSwr = useSWR(activeTab === "candidates" || activeTab === "pipeline" ? "/api/managersCommon/recruitment-pro?section=candidates" : null, fetcher);
  const pipelineSwr = useSWR(activeTab === "pipeline" || activeTab === "programTracking" ? "/api/managersCommon/recruitment-pro?section=pipeline" : null, fetcher);
  const dashboardSwr = useSWR(activeTab === "dashboard" ? "/api/managersCommon/recruitment-pro?section=dashboard" : null, fetcher);
  const requirementsSwr = useSWR(
    activeTab === "programTracking" || activeTab === "meta" || activeTab === "bench"
      ? "/api/managersCommon/recruitment-pro?section=programRequirements"
      : null,
    fetcher
  );
  const benchSwr = useSWR(activeTab === "bench" ? "/api/managersCommon/recruitment-pro?section=bench" : null, fetcher);
  const [benchSearch, setBenchSearch] = React.useState("");
  const [benchFilterLocation, setBenchFilterLocation] = React.useState("");
  const [benchFilterApplied, setBenchFilterApplied] = React.useState("");

  const programs = programsSwr.data?.programs || [];
  const activePrograms = React.useMemo(() => programs.filter((p) => p.isActive !== false), [programs]);
  const stages = stagesSwr.data?.stages || [];
  const countryCodes = countrySwr.data?.codes || [];
  const locations = locationsSwr.data?.locations || [];
  const vacantCodes = vacantCodesSwr.data?.vacantCodes || [];
  const [vacantProgramFilter, setVacantProgramFilter] = React.useState("");
  const requirementsList = requirementsSwr.data?.requirements || [];

  const [programDrafts, setProgramDrafts] = React.useState({});
  const [stageDrafts, setStageDrafts] = React.useState({});
  const [countryDrafts, setCountryDrafts] = React.useState({});
  const [locationDrafts, setLocationDrafts] = React.useState({});

  const [newProgram, setNewProgram] = React.useState({ programCode: "", programName: "", description: "", isActive: true });
  const [reqGenerator, setReqGenerator] = React.useState({ programId: "", codeIds: [], requirementName: "" });
  const [newStage, setNewStage] = React.useState({ stageCode: "", stageName: "", description: "", stageOrder: "", isActive: true });
  const [newCountry, setNewCountry] = React.useState({ countryName: "", countryCode: "", isActive: true, isDefault: false });
  const [newLocation, setNewLocation] = React.useState({ locationName: "", city: "", state: "", country: "India", isActive: true });

  React.useEffect(() => {
    const next = {};
    programs.forEach((p) => (next[p.id] = { ...p }));
    setProgramDrafts(next);
  }, [programsSwr.data]);

  React.useEffect(() => {
    const next = {};
    stages.forEach((s) => (next[s.id] = { ...s }));
    setStageDrafts(next);
  }, [stagesSwr.data]);

  React.useEffect(() => {
    const next = {};
    countryCodes.forEach((c) => (next[c.id] = { ...c }));
    setCountryDrafts(next);
  }, [countrySwr.data]);

  React.useEffect(() => {
    const next = {};
    locations.forEach((l) => (next[l.id] = { ...l }));
    setLocationDrafts(next);
  }, [locationsSwr.data]);

  const [candidateDrafts, setCandidateDrafts] = React.useState({});
  const [newCandidate, setNewCandidate] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    countryCodeId: "",
    phoneNumber: "",
    programId: "",
    mspCodeId: "",
    requirementId: "",
    locationId: "",
    appliedYear: "",
    resumeUrl: "",
    candidateStatus: "Active",
  });

  React.useEffect(() => {
    const next = {};
    (candidatesSwr.data?.candidates || []).forEach((c) => (next[c.id] = { ...c }));
    setCandidateDrafts(next);
  }, [candidatesSwr.data]);

  const [pipelineDrafts, setPipelineDrafts] = React.useState({});
  React.useEffect(() => {
    const next = {};
    (pipelineSwr.data?.rows || []).forEach((row) => {
      next[row.id] = {
        stage1Id: row.stage1?.stageId || "",
        stage1Date: toDateInput(row.stage1?.completedDate),
        stage2Id: row.stage2?.stageId || "",
        stage2Date: toDateInput(row.stage2?.completedDate),
        stage3Id: row.stage3?.stageId || "",
        stage3Date: toDateInput(row.stage3?.completedDate),
        stage4Id: row.stage4?.stageId || "",
        stage4Date: toDateInput(row.stage4?.completedDate),
        finalStatus: row.final?.finalStatus || "",
        finalDate: toDateInput(row.final?.finalDate),
        joiningDate: toDateInput(row.final?.joiningDate),
        finalNotes: row.final?.notes || "",
      };
    });
    setPipelineDrafts(next);
  }, [pipelineSwr.data]);

  const [newRequirement, setNewRequirement] = React.useState({ programId: "", locationId: "", requiredCount: "", filledCount: "" });
  const [requirementDrafts, setRequirementDrafts] = React.useState({});
  const [editingRequirementId, setEditingRequirementId] = React.useState(null);
  React.useEffect(() => {
    const next = {};
    (requirementsSwr.data?.requirements || []).forEach((req) => (next[req.id] = { ...req }));
    setRequirementDrafts(next);
  }, [requirementsSwr.data]);

  const [benchDrafts, setBenchDrafts] = React.useState({});
  const [selectedBench, setSelectedBench] = React.useState(new Set());
  const [benchEditingId, setBenchEditingId] = React.useState(null);
  const [newBench, setNewBench] = React.useState({
    fullName: "",
    phone: "",
    location: "",
    appliedFor: "",
    appliedDate: "",
    linkUrl: "",
    notes: "",
    source: "",
    email: "",
  });
  React.useEffect(() => {
    const next = {};
    (benchSwr.data?.bench || []).forEach((b) => (next[b.id] = { ...b }));
    setBenchDrafts(next);
    setSelectedBench(new Set());
    setBenchEditingId(null);
  }, [benchSwr.data]);

  const programCodeById = React.useMemo(() => {
    const map = new Map();
    activePrograms.forEach((p) => map.set(p.id, p.programCode));
    return map;
  }, [activePrograms]);

  const programNameByCode = React.useMemo(() => {
    const map = new Map();
    programs.forEach((p) => map.set(p.programCode, p.programName || p.programCode));
    return map;
  }, [programs]);

  const programLabel = (p) => `${p.programName || p.programCode} (${p.programCode})`;
  const requirementLabel = (r) => r?.requirementName ? r.requirementName : `Req #${r?.id || ""}`;

  const getVacantCodesForProgram = (programId) => {
    const programCode = programCodeById.get(Number(programId));
    if (!programCode) return [];
    return vacantCodes.filter(
      (code) => String(code.program).toUpperCase() === String(programCode).toUpperCase()
    );
  };

  const filteredVacantCodes = React.useMemo(() => {
    if (!vacantProgramFilter) return vacantCodes;
    const code = programCodeById.get(Number(vacantProgramFilter));
    if (!code) return [];
    return vacantCodes.filter((c) => String(c.program).toUpperCase() === String(code).toUpperCase());
  }, [vacantProgramFilter, vacantCodes, programCodeById]);

  const stageOptions = pipelineSwr.data?.stageOptions || [];
  const finalStatusOptions = pipelineSwr.data?.finalStatusOptions || [];
  const candidateStatusOptionsLocal = candidatesSwr.data?.candidateStatusOptions || ["Active", "Inactive", "Withdrawn"];
  const hasStages = stageOptions.length > 0;
  const stageByOrder = React.useMemo(() => {
    const map = new Map();
    stageOptions.forEach((s) => {
      if (s.stageOrder) map.set(Number(s.stageOrder), s);
    });
    return map;
  }, [stageOptions]);

  const handleSaveMeta = async (section, draft, mutate) => {
    await apiCall(section, "PUT", draft);
    await mutate();
  };

  const handleCreate = async (section, payload, reset, mutate) => {
    await apiCall(section, "POST", payload);
    reset();
    await mutate();
  };

  const handleSoftDelete = async (section, id, mutate) => {
    await apiCall(section, "DELETE", { id });
    await mutate();
  };

  const handleCandidateSave = async (draft) => {
    await apiCall("candidates", "PUT", draft);
    await candidatesSwr.mutate();
  };

  const handleCandidateCreate = async () => {
    await apiCall("candidates", "POST", newCandidate);
    setNewCandidate({
      firstName: "",
      lastName: "",
      email: "",
      countryCodeId: "",
      phoneNumber: "",
      programId: "",
      mspCodeId: "",
      requirementId: "",
      locationId: "",
      appliedYear: "",
      resumeUrl: "",
      candidateStatus: "Active",
    });
    await candidatesSwr.mutate();
  };

  const handlePipelineSave = async (candidateId) => {
    const draft = pipelineDrafts[candidateId];
    if (!draft) return;

    const stagesToSave = [
      { order: 1, id: stageByOrder.get(1)?.id, date: draft.stage1Date },
      { order: 2, id: stageByOrder.get(2)?.id, date: draft.stage2Date },
      { order: 3, id: stageByOrder.get(3)?.id, date: draft.stage3Date },
      { order: 4, id: stageByOrder.get(4)?.id, date: draft.stage4Date },
    ];

    for (const stage of stagesToSave) {
      await apiCall("pipeline", "POST", {
        candidateId,
        stageOrder: stage.order,
        stageId: stage.id || null,
        completedDate: stage.date || null,
      });
    }

    if (draft.finalStatus) {
      if (!draft.finalDate) {
        alert("Final status requires a final date.");
        return;
      }
      await apiCall("pipelineFinal", "POST", {
        candidateId,
        finalStatus: draft.finalStatus,
        finalDate: draft.finalDate || null,
        joiningDate: draft.joiningDate || null,
        notes: draft.finalNotes || null,
      });
    }

    await pipelineSwr.mutate();
  };

  const addStageComm = async (candidateId, stageOrder) => {
    const row = pipelineSwr.data?.rows?.find((r) => r.id === candidateId);
    const draft = pipelineDrafts[candidateId] || {};
    let stageId =
      (stageOrder === 1 && (draft.stage1Id || row?.stage1?.stageId)) ||
      (stageOrder === 2 && (draft.stage2Id || row?.stage2?.stageId)) ||
      (stageOrder === 3 && (draft.stage3Id || row?.stage3?.stageId)) ||
      (stageOrder === 4 && (draft.stage4Id || row?.stage4?.stageId)) ||
      null;

    // fallback: auto-pick by stage order from options if no stage chosen yet
    if (!stageId) {
      const guess = stageByOrder.get(stageOrder) || stageOptions[0];
      stageId = guess?.id || null;
    }

    // auto-create a stage if none configured
    if (!stageId) {
      try {
        const created = await apiCall("metaStages", "POST", {
          stageCode: `S${stageOrder}`,
          stageName: `Stage ${stageOrder}`,
          stageOrder,
          description: "Auto-created from pipeline logging",
          isActive: true,
        });
        stageId = created?.stage?.id;
        await Promise.all([stagesSwr.mutate(), pipelineSwr.mutate()]);
      } catch (e) {
        alert("Add at least one stage in Meta Controls first.");
        return;
      }
    }
    const stageDateDefault =
      (stageOrder === 1 && (draft.stage1Date || row?.stage1?.completedDate)) ||
      (stageOrder === 2 && (draft.stage2Date || row?.stage2?.completedDate)) ||
      (stageOrder === 3 && (draft.stage3Date || row?.stage3?.completedDate)) ||
      (stageOrder === 4 && (draft.stage4Date || row?.stage4?.completedDate)) ||
      "";

    setCommModal({
      open: true,
      candidateId,
      stageOrder,
      stageId,
      date: stageDateDefault || new Date().toISOString().slice(0, 10),
      method: COMM_METHOD_OPTIONS[0],
      subject: "",
      outcome: COMM_OUTCOME_OPTIONS[0],
      followUpDate: "",
      notes: "",
      finishStage: true,
    });
  };

  const handleRequirementSave = async (draft) => {
    await apiCall("programRequirements", "POST", {
      programId: draft.programId,
      requiredCount: Number(draft.requiredCount),
      filledCount: Number(draft.filledCount || 0),
      requirementName: draft.requirementName || "",
      notes: draft.notes || "",
    });
    await requirementsSwr.mutate();
  };

  const handleRequirementCreate = async () => {
    await apiCall("programRequirements", "POST", {
      programId: Number(newRequirement.programId),
      requiredCount: Number(newRequirement.requiredCount),
      filledCount: Number(newRequirement.filledCount || 0),
      requirementName: newRequirement.requirementName || "",
      notes: "",
    });
    setNewRequirement({ programId: "", locationId: "", requiredCount: "", filledCount: "" });
    await requirementsSwr.mutate();
  };

  const handleRequirementUpdate = async (reqId) => {
    const draft = requirementDrafts[reqId];
    if (!draft) return;
    await apiCall("programRequirements", "PUT", {
      id: reqId,
      requiredCount: Number(draft.requiredCount),
      filledCount: Number(draft.filledCount || 0),
      requirementName: draft.requirementName || "",
      notes: draft.notes || "",
      locationId: draft.locationId,
      programId: draft.programId,
    });
    await requirementsSwr.mutate();
    setEditingRequirementId(null);
  };

  const handleRequirementDelete = async (reqId) => {
    const draft = requirementDrafts[reqId] || {};
    const name = draft.requirementName || draft.programCode || "this requirement";
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    await apiCall("programRequirements", "DELETE", { id: reqId });
    await requirementsSwr.mutate();
  };

  const [benchPush, setBenchPush] = React.useState({
    programId: "",
    locationId: "",
    countryCodeId: "",
    mspCodeId: "",
    candidateStatus: "Active",
    appliedYear: "",
    email: "",
    requirementId: "",
  });
  const [benchRowPush, setBenchRowPush] = React.useState({});
  const [commModal, setCommModal] = React.useState({
    open: false,
    candidateId: null,
    stageOrder: null,
    date: "",
    method: COMM_METHOD_OPTIONS[0],
    subject: "",
    outcome: COMM_OUTCOME_OPTIONS[0],
    followUpDate: "",
    notes: "",
    finishStage: true,
  });

  const handleBenchCreate = async () => {
    try {
      await apiCall("bench", "POST", newBench);
      setNewBench({ fullName: "", phone: "", location: "", appliedFor: "", appliedDate: "", linkUrl: "", notes: "", source: "" });
      await benchSwr.mutate();
    } catch (e) {
      alert(e.message || "Failed to add to bench");
    }
  };

  const handleBenchSave = async (benchId) => {
    try {
      await apiCall("bench", "PUT", { id: benchId, ...benchDrafts[benchId] });
      await benchSwr.mutate();
      setBenchEditingId(null);
    } catch (e) {
      alert(e.message || "Failed to save lead");
    }
  };

  const handleBenchDelete = async (benchId) => {
    const draft = benchDrafts[benchId] || {};
    if (!window.confirm(`Delete ${draft.fullName || "this lead"}?`)) return;
    try {
      await apiCall("bench", "DELETE", { id: benchId });
      await benchSwr.mutate();
    } catch (e) {
      alert(e.message || "Failed to delete lead");
    }
  };

  const handleBenchPush = async () => {
    const benchIds = Array.from(selectedBench);
    if (!benchIds.length) {
      alert("Select at least one lead");
      return;
    }
    if (!benchPush.requirementId) {
      alert("Choose a requirement");
      return;
    }
    if (!benchPush.programId) {
      alert("Requirement missing program");
      return;
    }
    if (!benchPush.countryCodeId) {
      alert("Choose country code");
      return;
    }
    const payload = {
      benchIds,
      programId: Number(benchPush.programId),
      locationId: benchPush.locationId ? Number(benchPush.locationId) : null,
      countryCodeId: Number(benchPush.countryCodeId),
      mspCodeId: benchPush.mspCodeId ? Number(benchPush.mspCodeId) : null,
      candidateStatus: benchPush.candidateStatus,
      appliedYear: benchPush.appliedYear ? Number(benchPush.appliedYear) : null,
      email: benchPush.email,
      requirementId: Number(benchPush.requirementId),
    };
    await apiCall("benchPush", "POST", payload);
    await candidatesSwr.mutate();
    await pipelineSwr.mutate();
    await benchSwr.mutate();
    setSelectedBench(new Set());
  };

  const handleBenchRowPush = async (benchId) => {
    const sel = benchRowPush[benchId];
    const programId = sel?.programId || benchPush.programId;
    if (!programId) {
      alert("Pick a program first.");
      return;
    }
    const countryId = benchPush.countryCodeId || countryCodes[0]?.id || null;
    if (!countryId) {
      alert("Set a country code in the push bar first.");
      return;
    }
    const payload = {
      benchIds: [benchId],
      programId: Number(programId),
      locationId: sel?.locationId ? Number(sel.locationId) : null,
      countryCodeId: Number(countryId),
      mspCodeId: sel.mspCodeId ? Number(sel.mspCodeId) : null,
      candidateStatus: benchPush.candidateStatus,
      appliedYear: benchPush.appliedYear ? Number(benchPush.appliedYear) : null,
      email: benchPush.email,
    };
    await apiCall("benchPush", "POST", payload);
    await candidatesSwr.mutate();
    await pipelineSwr.mutate();
    await benchSwr.mutate();
  };

  const submitCommModal = async () => {
    const { candidateId, stageOrder, stageId: modalStageId, date, method, subject, outcome, followUpDate, notes, finishStage } = commModal;
    if (!candidateId || !stageOrder || !date || !method || !subject || !outcome) {
      alert("Date, method, subject, outcome are required");
      return;
    }
    let stageId = modalStageId;
    if (!stageId) {
      const guess = stageByOrder.get(stageOrder) || stageOptions[0];
      stageId = guess?.id || null;
    }
    if (!stageId) {
      try {
        const created = await apiCall("metaStages", "POST", {
          stageCode: `S${stageOrder}`,
          stageName: `Stage ${stageOrder}`,
          stageOrder,
          description: "Auto-created from comm modal",
          isActive: true,
        });
        stageId = created?.stage?.id;
        await stagesSwr.mutate();
      } catch {
        alert("Add a stage in Meta Controls first.");
        return;
      }
    }

    await apiCall("communicationLog", "POST", {
      candidateId,
      stageId,
      communicationDate: date,
      communicationMethod: method,
      subject,
      outcome,
      followUpDate: followUpDate || null,
      notes: notes || null,
    });

    if (finishStage) {
      await apiCall("pipeline", "POST", {
        candidateId,
        stageOrder,
        stageId,
        completedDate: date,
        notes,
      });
    }

    setCommModal((prev) => ({ ...prev, open: false }));
    await pipelineSwr.mutate();
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-emerald-50 via-amber-50 to-slate-100 p-4 md:p-6"
      style={{ fontFamily: "'Space Grotesk','Manrope',ui-sans-serif" }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-60" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.08), transparent 45%), radial-gradient(circle at 80% 10%, rgba(245,158,11,0.08), transparent 40%), radial-gradient(circle at 40% 90%, rgba(15,118,110,0.08), transparent 45%)" }} />
      <div className="relative space-y-6">
        <header className="rounded-2xl border border-slate-200/70 bg-white/70 px-6 py-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              {activeTab !== "home" && (
                <button
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setActiveTab("home")}
                >
                  ← Back to Overview
                </button>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Recruitment Suite</p>
                <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mt-1">Meed Recruitment</h1>
                <p className="text-sm text-slate-600 mt-1">All hiring signals in one flow — setup, track, and decide in minutes.</p>
              </div>
            </div>
            {activeTab !== "home" && activeTab !== "bench" && activeTab !== "appointments" && (
              <div className="flex flex-wrap gap-2">
                {TAB_LIST.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-full text-sm border transition ${activeTab === tab.key ? "bg-slate-900 text-white border-slate-900 shadow" : "bg-white/70 text-slate-700 border-slate-200 hover:bg-white"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {activeTab === "home" && (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-600">Talent Bench</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Quickly stash leads</h3>
              <p className="mt-1 text-sm text-slate-600">Drop raw leads here, then push matching profiles into the active pipeline when a requirement opens.</p>
              <button className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white shadow hover:bg-emerald-700" onClick={() => setActiveTab("bench")}>
                Go to Talent Bench
              </button>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Active Recruitment</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Run current hiring</h3>
              <p className="mt-1 text-sm text-slate-600">Meta controls, candidates, pipeline, dashboards, and program tracking—everything live.</p>
              <div className="mt-3 flex gap-2">
                <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white shadow hover:bg-slate-800" onClick={() => setActiveTab("meta")}>
                  Open Suite
                </button>
                <button className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-white" onClick={() => setActiveTab("pipeline")}>
                  Pipeline
                </button>
                <button className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-white" onClick={() => setActiveTab("candidates")}>
                  Shortlisted
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-600">Appointments</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Post-selection steps</h3>
              <p className="mt-1 text-sm text-slate-600">Offer letters, appointment letters, and joining checklist—coming soon.</p>
              <button className="mt-3 rounded-lg bg-amber-500 px-3 py-2 text-sm text-white shadow hover:bg-amber-600" onClick={() => setActiveTab("appointments")}>
                Open Appointments
              </button>
            </div>
          </div>
        )}

      {activeTab === "meta" && (
        <div className="space-y-6">
          <SectionCard title="Generate Requirement" subtitle="Pick program + available codes to spin up a hiring requirement in one go.">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm"
                placeholder="Requirement name (optional)"
                value={reqGenerator.requirementName}
                onChange={(e) => setReqGenerator({ ...reqGenerator, requirementName: e.target.value })}
              />
              <select
                className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm"
                value={reqGenerator.programId}
                onChange={(e) => setReqGenerator({ ...reqGenerator, programId: e.target.value, codeIds: [] })}
              >
                <option value="">Select program</option>
                {activePrograms.map((p) => (
                  <option key={p.id} value={p.id}>{programLabel(p)}</option>
                ))}
              </select>
              <select
                multiple
                className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm h-24"
                value={reqGenerator.codeIds}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setReqGenerator({ ...reqGenerator, codeIds: opts });
                }}
                disabled={!reqGenerator.programId}
              >
                {getVacantCodesForProgram(reqGenerator.programId).map((code) => (
                  <option key={code.id} value={code.id}>{code.code}{code.title ? ` — ${code.title}` : ""}</option>
                ))}
              </select>
              <button
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white shadow hover:bg-emerald-700"
                onClick={async () => {
                  if (!reqGenerator.programId || reqGenerator.codeIds.length === 0) {
                    alert("Pick a program and at least one code.");
                    return;
                  }
                  const selectedCodes = getVacantCodesForProgram(reqGenerator.programId)
                    .filter((c) => reqGenerator.codeIds.includes(String(c.id)))
                    .map((c) => c.code);
                  await apiCall("programRequirements", "POST", {
                    programId: Number(reqGenerator.programId),
                    requiredCount: reqGenerator.codeIds.length,
                    filledCount: 0,
                    requirementName: reqGenerator.requirementName,
                    notes: selectedCodes.length ? `Codes: ${selectedCodes.join(", ")}` : `Codes: ${reqGenerator.codeIds.join(",")}`,
                  });
                  setReqGenerator({ programId: "", codeIds: [], requirementName: "" });
                  await requirementsSwr.mutate();
                }}
              >
                Create requirement
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">Select multiple codes (Cmd/Ctrl + click) — one requirement can cover several codes simultaneously.</p>
          </SectionCard>

          <SectionCard title="Current Requirements" subtitle="What’s already opened. Open = Required - Filled. Edit inline or delete.">
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Program</th>
                    <th className="p-3 text-left">Code</th>
                    <th className="p-3 text-left">Required</th>
                    <th className="p-3 text-left">Filled</th>
                    <th className="p-3 text-left">Open</th>
                    <th className="p-3 text-left">MSP Codes</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(requirementsSwr.data?.requirements || []).map((req) => {
                    const open = Number(req.requiredCount || 0) - Number(req.filledCount || 0);
                    const mspCodes = (req.notes || "")
                      .replace(/^Codes:\s*/i, "")
                      .trim();
                    const draft = requirementDrafts[req.id] || req;
                    const isEditing = editingRequirementId === req.id;
                    return (
                      <tr key={req.id} className="border-t">
                        <td className="p-3">
                          {isEditing ? (
                            <input className="w-40 rounded-lg border border-slate-200 px-2 py-1 text-xs" value={draft.requirementName || ""} onChange={(e) => setRequirementDrafts((prev) => ({ ...prev, [req.id]: { ...prev[req.id], requirementName: e.target.value } }))} placeholder="Requirement name" />
                          ) : (
                            <span className="font-medium text-slate-900">{req.requirementName || "—"}</span>
                          )}
                        </td>
                        <td className="p-3">{programLabel({ programName: req.programName, programCode: req.programCode })}</td>
                        <td className="p-3 font-semibold text-slate-800">{req.programCode}</td>
                        <td className="p-3">
                          {isEditing ? (
                            <input className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs" value={draft.requiredCount || ""} onChange={(e) => setRequirementDrafts((prev) => ({ ...prev, [req.id]: { ...prev[req.id], requiredCount: e.target.value } }))} />
                          ) : (
                            <span>{req.requiredCount}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <input className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs" value={draft.filledCount || ""} onChange={(e) => setRequirementDrafts((prev) => ({ ...prev, [req.id]: { ...prev[req.id], filledCount: e.target.value } }))} />
                          ) : (
                            <span>{req.filledCount}</span>
                          )}
                        </td>
                        <td className="p-3">{open}</td>
                        <td className="p-3">
                          {isEditing ? (
                            <input className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-xs" value={draft.notes || ""} onChange={(e) => setRequirementDrafts((prev) => ({ ...prev, [req.id]: { ...prev[req.id], notes: e.target.value } }))} placeholder="Codes: MSP01, MSP02" />
                          ) : (
                            <span>{mspCodes || "—"}</span>
                          )}
                        </td>
                        <td className="p-3 flex gap-2">
                          {isEditing ? (
                            <>
                              <button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" title="Save changes" onClick={() => handleRequirementUpdate(req.id)}>💾</button>
                              <button className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700" title="Cancel" onClick={() => setEditingRequirementId(null)}>✖️</button>
                            </>
                          ) : (
                            <>
                              <button className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700" title="Edit" onClick={() => { setRequirementDrafts((prev) => ({ ...prev, [req.id]: { ...req } })); setEditingRequirementId(req.id); }}>✏️</button>
                              <button className="rounded-lg bg-rose-100 px-2 py-1 text-xs text-rose-700" title="Delete requirement" onClick={() => handleRequirementDelete(req.id)}>🗑️</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!(requirementsSwr.data?.requirements || []).length && (
                    <tr className="border-t">
                      <td className="p-3 text-slate-500" colSpan={5}>No requirements yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="MSP Codes (Vacant)" subtitle="Auto-pulled from Manage Meedian → MSP Codes. These codes have no active assignment.">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-xs text-slate-600">Pick a program to see its free codes, then assign on Candidates tab.</div>
              <select
                className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm md:w-64"
                value={vacantProgramFilter}
                onChange={(e) => setVacantProgramFilter(e.target.value)}
              >
                <option value="">All programs</option>
                        {activePrograms.map((p) => (
                          <option key={p.id} value={p.id}>{programLabel(p)}</option>
                        ))}
                      </select>
            </div>
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-3 text-left">Code</th>
                    <th className="p-3 text-left">Title</th>
                    <th className="p-3 text-left">Program</th>
                    <th className="p-3 text-left">Family</th>
                    <th className="p-3 text-left">Track</th>
                    <th className="p-3 text-left">Slice</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredVacantCodes || []).map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-3 font-semibold text-slate-800">{c.code}</td>
                      <td className="p-3">{c.title}</td>
                      <td className="p-3">{c.program}</td>
                      <td className="p-3">{c.familyKey}</td>
                      <td className="p-3">{c.track}</td>
                      <td className="p-3">{c.parentSlice || "—"}</td>
                    </tr>
                  ))}
                  {!filteredVacantCodes?.length && (
                    <tr className="border-t">
                      <td className="p-3 text-slate-500" colSpan={6}>No vacant MSP codes right now.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Program Registry" subtitle="Programs are synced from Program Design. Deactivate any stray entries you created earlier.">
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-3 text-left">Program</th>
                    <th className="p-3 text-left">Code</th>
                    <th className="p-3 text-left">Active</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-3">{p.programName || p.programCode}</td>
                      <td className="p-3 font-semibold text-slate-800">{p.programCode}</td>
                      <td className="p-3">{p.isActive ? "Yes" : "No"}</td>
                      <td className="p-3">
                        <button
                          className="rounded-lg bg-rose-100 px-2 py-1 text-xs text-rose-700"
                          onClick={() => handleSoftDelete("metaPrograms", p.id, programsSwr.mutate)}
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!programs.length && (
                    <tr className="border-t">
                      <td className="p-3 text-slate-500" colSpan={4}>No programs found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Stages" subtitle="Manage interview stages and ordering.">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Code" value={newStage.stageCode} onChange={(e) => setNewStage({ ...newStage, stageCode: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Name" value={newStage.stageName} onChange={(e) => setNewStage({ ...newStage, stageName: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Description" value={newStage.description} onChange={(e) => setNewStage({ ...newStage, description: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Order" value={newStage.stageOrder} onChange={(e) => setNewStage({ ...newStage, stageOrder: e.target.value })} />
              <button className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white shadow hover:bg-emerald-700" onClick={() => handleCreate("metaStages", { ...newStage, stageOrder: Number(newStage.stageOrder) }, () => setNewStage({ stageCode: "", stageName: "", description: "", stageOrder: "", isActive: true }), stagesSwr.mutate)}>Add</button>
            </div>
            <div className="mt-4 overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-left">Order</th>
                    <th className="p-2 text-left">Active</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="p-2"><input className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={stageDrafts[s.id]?.stageCode || ""} onChange={(e) => setStageDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], stageCode: e.target.value } }))} /></td>
                      <td className="p-2"><input className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={stageDrafts[s.id]?.stageName || ""} onChange={(e) => setStageDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], stageName: e.target.value } }))} /></td>
                      <td className="p-2"><input className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={stageDrafts[s.id]?.description || ""} onChange={(e) => setStageDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], description: e.target.value } }))} /></td>
                      <td className="p-2"><input className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={stageDrafts[s.id]?.stageOrder || ""} onChange={(e) => setStageDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], stageOrder: Number(e.target.value) } }))} /></td>
                      <td className="p-2"><input type="checkbox" checked={!!stageDrafts[s.id]?.isActive} onChange={(e) => setStageDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], isActive: e.target.checked } }))} /></td>
                      <td className="p-2 flex gap-2">
                        <button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => handleSaveMeta("metaStages", stageDrafts[s.id], stagesSwr.mutate)}>Save</button>
                        <button className="rounded-lg bg-rose-100 px-2 py-1 text-xs text-rose-700" onClick={() => handleSoftDelete("metaStages", s.id, stagesSwr.mutate)}>Deactivate</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Country Codes" subtitle="Phone prefixes available for candidates.">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Country" value={newCountry.countryName} onChange={(e) => setNewCountry({ ...newCountry, countryName: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="+91" value={newCountry.countryCode} onChange={(e) => setNewCountry({ ...newCountry, countryCode: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newCountry.isDefault} onChange={(e) => setNewCountry({ ...newCountry, isDefault: e.target.checked })} /> Default</label>
              <button className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white shadow hover:bg-emerald-700" onClick={() => handleCreate("metaCountryCodes", newCountry, () => setNewCountry({ countryName: "", countryCode: "", isActive: true, isDefault: false }), countrySwr.mutate)}>Add</button>
            </div>
            <div className="mt-4 overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-2 text-left">Country</th>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Active</th>
                    <th className="p-2 text-left">Default</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {countryCodes.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-2"><input className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={countryDrafts[c.id]?.countryName || ""} onChange={(e) => setCountryDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], countryName: e.target.value } }))} /></td>
                      <td className="p-2"><input className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={countryDrafts[c.id]?.countryCode || ""} onChange={(e) => setCountryDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], countryCode: e.target.value } }))} /></td>
                      <td className="p-2"><input type="checkbox" checked={!!countryDrafts[c.id]?.isActive} onChange={(e) => setCountryDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], isActive: e.target.checked } }))} /></td>
                      <td className="p-2"><input type="checkbox" checked={!!countryDrafts[c.id]?.isDefault} onChange={(e) => setCountryDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], isDefault: e.target.checked } }))} /></td>
                      <td className="p-2 flex gap-2">
                        <button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => handleSaveMeta("metaCountryCodes", countryDrafts[c.id], countrySwr.mutate)}>Save</button>
                        <button className="rounded-lg bg-rose-100 px-2 py-1 text-xs text-rose-700" onClick={() => handleSoftDelete("metaCountryCodes", c.id, countrySwr.mutate)}>Deactivate</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Locations" subtitle="Office hubs for recruitment.">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Location" value={newLocation.locationName} onChange={(e) => setNewLocation({ ...newLocation, locationName: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="City" value={newLocation.city} onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="State" value={newLocation.state} onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Country" value={newLocation.country} onChange={(e) => setNewLocation({ ...newLocation, country: e.target.value })} />
              <button className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white shadow hover:bg-emerald-700" onClick={() => handleCreate("metaLocations", newLocation, () => setNewLocation({ locationName: "", city: "", state: "", country: "India", isActive: true }), locationsSwr.mutate)}>Add</button>
            </div>
            <div className="mt-4 overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-2 text-left">Location</th>
                    <th className="p-2 text-left">City</th>
                    <th className="p-2 text-left">State</th>
                    <th className="p-2 text-left">Country</th>
                    <th className="p-2 text-left">Active</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2"><input className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={locationDrafts[l.id]?.locationName || ""} onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [l.id]: { ...prev[l.id], locationName: e.target.value } }))} /></td>
                      <td className="p-2"><input className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={locationDrafts[l.id]?.city || ""} onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [l.id]: { ...prev[l.id], city: e.target.value } }))} /></td>
                      <td className="p-2"><input className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={locationDrafts[l.id]?.state || ""} onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [l.id]: { ...prev[l.id], state: e.target.value } }))} /></td>
                      <td className="p-2"><input className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={locationDrafts[l.id]?.country || ""} onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [l.id]: { ...prev[l.id], country: e.target.value } }))} /></td>
                      <td className="p-2"><input type="checkbox" checked={!!locationDrafts[l.id]?.isActive} onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [l.id]: { ...prev[l.id], isActive: e.target.checked } }))} /></td>
                      <td className="p-2 flex gap-2">
                        <button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => handleSaveMeta("metaLocations", locationDrafts[l.id], locationsSwr.mutate)}>Save</button>
                        <button className="rounded-lg bg-rose-100 px-2 py-1 text-xs text-rose-700" onClick={() => handleSoftDelete("metaLocations", l.id, locationsSwr.mutate)}>Deactivate</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "candidates" && (
        <div className="space-y-6">
          <SectionCard title="Add Candidate" subtitle="Add a candidate once and let the pipeline auto-fill.">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="First name" value={newCandidate.firstName} onChange={(e) => setNewCandidate({ ...newCandidate, firstName: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Last name" value={newCandidate.lastName} onChange={(e) => setNewCandidate({ ...newCandidate, lastName: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Email" value={newCandidate.email} onChange={(e) => setNewCandidate({ ...newCandidate, email: e.target.value })} />
              <select className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" value={newCandidate.countryCodeId} onChange={(e) => setNewCandidate({ ...newCandidate, countryCodeId: e.target.value })}>
                <option value="">Country Code</option>
                {countryCodes.map((c) => (
                  <option key={c.id} value={c.id}>{c.countryCode}</option>
                ))}
              </select>
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Phone" value={newCandidate.phoneNumber} onChange={(e) => setNewCandidate({ ...newCandidate, phoneNumber: e.target.value })} />
              <select
                className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                value={newCandidate.programId}
                onChange={(e) => setNewCandidate({ ...newCandidate, programId: e.target.value, mspCodeId: "" })}
              >
                <option value="">Program</option>
                {activePrograms.map((p) => (
                  <option key={p.id} value={p.id}>{programLabel(p)}</option>
                ))}
              </select>
              <select
                className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                value={newCandidate.mspCodeId}
                onChange={(e) => setNewCandidate({ ...newCandidate, mspCodeId: e.target.value })}
                disabled={!newCandidate.programId}
              >
                <option value="">MSP Code</option>
                {getVacantCodesForProgram(newCandidate.programId).map((code) => (
                  <option key={code.id} value={code.id}>{code.code}{code.title ? ` — ${code.title}` : ""}</option>
                ))}
              </select>
              <select className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" value={newCandidate.locationId} onChange={(e) => setNewCandidate({ ...newCandidate, locationId: e.target.value })}>
                <option value="">Location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.locationName}</option>
                ))}
              </select>
              <select
                className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                value={newCandidate.requirementId}
                onChange={(e) => setNewCandidate({ ...newCandidate, requirementId: e.target.value })}
                disabled={!newCandidate.programId}
              >
                <option value="">Requirement</option>
                {requirementsList.filter((r) => !newCandidate.programId || Number(r.programId) === Number(newCandidate.programId)).map((r) => (
                  <option key={r.id} value={r.id}>{requirementLabel(r)}</option>
                ))}
              </select>
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Year" value={newCandidate.appliedYear} onChange={(e) => setNewCandidate({ ...newCandidate, appliedYear: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Resume URL" value={newCandidate.resumeUrl} onChange={(e) => setNewCandidate({ ...newCandidate, resumeUrl: e.target.value })} />
              <select className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" value={newCandidate.candidateStatus} onChange={(e) => setNewCandidate({ ...newCandidate, candidateStatus: e.target.value })}>
                {candidatesSwr.data?.candidateStatusOptions?.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white shadow hover:bg-slate-800" onClick={handleCandidateCreate}>Add</button>
            </div>
          </SectionCard>

          <SectionCard title="Shortlisted Candidates" subtitle="Live shortlist database. Edit inline and save.">
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-2 text-left">Sr</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Phone</th>
                    <th className="p-2 text-left">Program</th>
                    <th className="p-2 text-left">MSP Code</th>
                    <th className="p-2 text-left">Requirement</th>
                    <th className="p-2 text-left">Location</th>
                    <th className="p-2 text-left">Year</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(candidatesSwr.data?.candidates || []).map((c) => {
                    const rowProgramId = candidateDrafts[c.id]?.programId || c.programId;
                    const baseOptions = getVacantCodesForProgram(rowProgramId);
                    const currentCode = c.mspCodeId ? { id: c.mspCodeId, code: c.mspCode || "Code", title: c.mspCodeTitle || "" } : null;
                    const codeOptions =
                      currentCode && !baseOptions.some((opt) => opt.id === currentCode.id)
                        ? [currentCode, ...baseOptions]
                        : baseOptions;
                    return (
                    <tr key={c.id} className="border-t">
                      <td className="p-2">{c.srNo}</td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <input className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs w-24" value={candidateDrafts[c.id]?.firstName || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], firstName: e.target.value } }))} />
                          <input className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs w-24" value={candidateDrafts[c.id]?.lastName || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], lastName: e.target.value } }))} />
                        </div>
                      </td>
                      <td className="p-2"><input className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" value={candidateDrafts[c.id]?.email || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], email: e.target.value } }))} /></td>
                      <td className="p-2">
                        <select className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" value={candidateDrafts[c.id]?.countryCodeId || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], countryCodeId: Number(e.target.value) } }))}>
                          <option value="">Code</option>
                          {countryCodes.map((cc) => (
                            <option key={cc.id} value={cc.id}>{cc.countryCode}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2"><input className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" value={candidateDrafts[c.id]?.phoneNumber || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], phoneNumber: e.target.value } }))} /></td>
                      <td className="p-2">
                        <select
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                          value={candidateDrafts[c.id]?.programId || ""}
                          onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], programId: Number(e.target.value), mspCodeId: "" } }))}
                        >
                          {programs.map((p) => (
                            <option key={p.id} value={p.id}>{programLabel(p)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                          value={candidateDrafts[c.id]?.mspCodeId || ""}
                          onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], mspCodeId: Number(e.target.value) } }))}
                          disabled={!rowProgramId}
                        >
                          <option value="">--</option>
                          {codeOptions.map((code) => (
                            <option key={code.id} value={code.id}>{code.code}{code.title ? ` — ${code.title}` : ""}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                          value={candidateDrafts[c.id]?.requirementId || ""}
                          onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], requirementId: Number(e.target.value) } }))}
                        >
                          <option value="">--</option>
                          {requirementsList.map((r) => (
                            <option key={r.id} value={r.id}>{requirementLabel(r)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" value={candidateDrafts[c.id]?.locationId || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], locationId: Number(e.target.value) } }))}>
                          {locations.map((l) => (
                            <option key={l.id} value={l.id}>{l.locationName}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2"><input className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs w-20" value={candidateDrafts[c.id]?.appliedYear || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], appliedYear: e.target.value } }))} /></td>
                      <td className="p-2">
                        <select className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" value={candidateDrafts[c.id]?.candidateStatus || "Active"} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], candidateStatus: e.target.value } }))}>
                          {candidatesSwr.data?.candidateStatusOptions?.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <button className="px-2 py-1 text-xs rounded bg-slate-900 text-white" onClick={() => handleCandidateSave(candidateDrafts[c.id])}>Save</button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "pipeline" && (
        <div className="space-y-6">
          <SectionCard title="Pipeline Tracker" subtitle="Slim cards with collapsible stages and comms.">
            <div className="space-y-3">
              {(pipelineSwr.data?.rows || []).map((row) => {
                const draft = pipelineDrafts[row.id] || {};
                const comm1 = row.comm?.stage1;
                const comm2 = row.comm?.stage2;
                const comm3 = row.comm?.stage3;
                const comm4 = row.comm?.stage4;
                const logs1 = row.commLogs?.stage1 || [];
                const logs2 = row.commLogs?.stage2 || [];
                const logs3 = row.commLogs?.stage3 || [];
                const logs4 = row.commLogs?.stage4 || [];
                const isOpen = pipelineDrafts[`open-${row.id}`] ?? false;

                const renderStage = (stageOrder, comm, dateKey, logs) => {
                  const commKey = `commOpen-${row.id}-${stageOrder}`;
                  const commOpen = !!pipelineDrafts[commKey];
                  return (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-800">{stageByOrder.get(stageOrder)?.stageName || `Stage ${stageOrder}`}</div>
                      <button className="text-[11px] text-teal-600 hover:text-teal-800" onClick={() => addStageComm(row.id, stageOrder)}>Log comm</button>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] uppercase text-slate-500">Date</label>
                        <input
                          type="date"
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                          value={draft[dateKey] || ""}
                          onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], [dateKey]: e.target.value } }))}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] uppercase text-slate-500">Last comm</label>
                        <div className="text-[11px] text-slate-600">
                          {comm ? `${comm.communicationMethod} · ${comm.outcome}${comm.followUpDate ? ` · FU ${toDateInput(comm.followUpDate)}` : ""}` : "No comm yet"}
                        </div>
                        {logs.length > 0 && (
                          <button
                            className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                            onClick={() => setPipelineDrafts((prev) => ({ ...prev, [commKey]: !commOpen }))}
                          >
                            {commOpen ? "Hide convo" : "View full convo"}
                          </button>
                        )}
                      </div>
                    </div>
                    {commOpen && (
                      <div className="mt-3 space-y-2">
                        {logs.map((log) => (
                          <div key={log.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div className="text-[10px] text-slate-500">{toDateInput(log.communicationDate)} • {log.communicationMethod}</div>
                            <div className="text-xs font-semibold text-slate-900 mt-1">{log.subject}</div>
                            <div className="text-[11px] text-slate-600 mt-1">Outcome: {log.outcome}</div>
                            {log.followUpDate && <div className="text-[11px] text-slate-600">Follow-up: {toDateInput(log.followUpDate)}</div>}
                            {log.notes && <div className="text-[11px] text-slate-600 mt-1">{log.notes}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
                };

                return (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="text-xs font-semibold text-slate-400">#{row.srNo}</div>
                      <div className="flex-1 min-w-[200px]">
                        <div className="font-semibold text-slate-900 text-sm">{row.firstName} {row.lastName || ""}</div>
                        <div className="text-xs text-slate-500">{row.fullPhone || ""}</div>
                      </div>
                      <div className="text-xs text-slate-600">{row.mspCode ? `${row.mspCode}` : "No MSP code"}</div>
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          onClick={() => setPipelineDrafts((prev) => ({ ...prev, [`open-${row.id}`]: !isOpen }))}
                        >
                          {isOpen ? "Hide stages" : "Show stages"}
                        </button>
                        <button className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white" onClick={() => handlePipelineSave(row.id)}>Save</button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {renderStage(1, comm1, "stage1Date", logs1)}
                          {renderStage(2, comm2, "stage2Date", logs2)}
                          {renderStage(3, comm3, "stage3Date", logs3)}
                          {renderStage(4, comm4, "stage4Date", logs4)}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] uppercase text-slate-500">Final Status</label>
                            <select className="w-full rounded border border-slate-200 px-2 py-1 text-sm" value={draft.finalStatus || ""} onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], finalStatus: e.target.value } }))}>
                              <option value="">--</option>
                              {finalStatusOptions.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-slate-500">Final Date</label>
                            <input
                              type="date"
                              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                              value={draft.finalDate || ""}
                              onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], finalDate: e.target.value } }))}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-slate-500">Joining Date</label>
                            <input
                              type="date"
                              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                              value={draft.joiningDate || ""}
                              onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], joiningDate: e.target.value } }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "dashboard" && (
        <SectionCard title="Meed Recruitment Dashboard" subtitle="Live metrics and conversion snapshots.">
          {!dashboardSwr.data && <p className="text-sm text-slate-500">Loading metrics…</p>}
          {dashboardSwr.data && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Total Candidates</div>
                <div className="text-3xl font-semibold text-slate-900 mt-2">{dashboardSwr.data.totalCandidates}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div>Stage 1: <span className="text-slate-800 font-semibold">{dashboardSwr.data.stageCounts.stage1}</span></div>
                  <div>Stage 2: <span className="text-slate-800 font-semibold">{dashboardSwr.data.stageCounts.stage2}</span></div>
                  <div>Stage 3: <span className="text-slate-800 font-semibold">{dashboardSwr.data.stageCounts.stage3}</span></div>
                  <div>Stage 4: <span className="text-slate-800 font-semibold">{dashboardSwr.data.stageCounts.stage4}</span></div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Final Outcomes</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  {Object.entries(dashboardSwr.data.finalCounts).map(([key, value]) => (
                    <div key={key}>{key}: <span className="text-slate-900 font-semibold">{value}</span></div>
                  ))}
                </div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mt-4">Conversion Rates</div>
                <div className="mt-2 text-xs text-slate-600 space-y-1">
                  <div>S1 → S2: <span className="text-slate-900 font-semibold">{dashboardSwr.data.conversionRates.s1ToS2}%</span></div>
                  <div>S2 → S3: <span className="text-slate-900 font-semibold">{dashboardSwr.data.conversionRates.s2ToS3}%</span></div>
                  <div>S3 → S4: <span className="text-slate-900 font-semibold">{dashboardSwr.data.conversionRates.s3ToS4}%</span></div>
                  <div>Overall Success: <span className="text-slate-900 font-semibold">{dashboardSwr.data.conversionRates.overallSuccess}%</span></div>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === "programTracking" && (
        <div className="space-y-6">
          <SectionCard title="Program Requirements" subtitle="Set hiring targets per program and location.">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <select className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" value={newRequirement.programId} onChange={(e) => setNewRequirement({ ...newRequirement, programId: e.target.value })}>
                <option value="">Program</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{programLabel(p)}</option>
                ))}
              </select>
              <select className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" value={newRequirement.locationId} onChange={(e) => setNewRequirement({ ...newRequirement, locationId: e.target.value })}>
                <option value="">Location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.locationName}</option>
                ))}
              </select>
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Required" value={newRequirement.requiredCount} onChange={(e) => setNewRequirement({ ...newRequirement, requiredCount: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm" placeholder="Filled" value={newRequirement.filledCount} onChange={(e) => setNewRequirement({ ...newRequirement, filledCount: e.target.value })} />
              <button className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white shadow hover:bg-emerald-700" onClick={handleRequirementCreate}>Add</button>
            </div>
          </SectionCard>

          <SectionCard title="Program Tracking" subtitle="Pipeline distribution and status by program.">
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-2 text-left">Program</th>
                    <th className="p-2 text-left">Location</th>
                    <th className="p-2 text-left">Required</th>
                    <th className="p-2 text-left">Filled</th>
                    <th className="p-2 text-left">Open</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">In Pipeline</th>
                    <th className="p-2 text-left">Stage 1</th>
                    <th className="p-2 text-left">Stage 2</th>
                    <th className="p-2 text-left">Stage 3</th>
                    <th className="p-2 text-left">Stage 4</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(requirementsSwr.data?.requirements || []).map((req) => {
                    const draft = requirementDrafts[req.id] || req;
                    const pipelineRows = pipelineSwr.data?.rows || [];
                    const programCode = req.programCode || "";
                    const inPipeline = pipelineRows.filter((r) => r.programCode === programCode).length;
                    const stage1 = pipelineRows.filter((r) => r.programCode === programCode && r.stage1).length;
                    const stage2 = pipelineRows.filter((r) => r.programCode === programCode && r.stage2).length;
                    const stage3 = pipelineRows.filter((r) => r.programCode === programCode && r.stage3).length;
                    const stage4 = pipelineRows.filter((r) => r.programCode === programCode && r.stage4).length;
                    const openCount = Number(draft.requiredCount || 0) - Number(draft.filledCount || 0);

                    return (
                      <tr key={req.id} className="border-t">
                        <td className="p-2">{programNameByCode.get(req.programCode) ? `${programNameByCode.get(req.programCode)} (${req.programCode})` : req.programCode}</td>
                        <td className="p-2">{req.locationName}</td>
                        <td className="p-2"><input className="rounded-lg border border-slate-200 px-2 py-1 text-xs w-16" value={draft.requiredCount || ""} onChange={(e) => setRequirementDrafts((prev) => ({ ...prev, [req.id]: { ...prev[req.id], requiredCount: e.target.value } }))} /></td>
                        <td className="p-2"><input className="rounded-lg border border-slate-200 px-2 py-1 text-xs w-16" value={draft.filledCount || ""} onChange={(e) => setRequirementDrafts((prev) => ({ ...prev, [req.id]: { ...prev[req.id], filledCount: e.target.value } }))} /></td>
                        <td className="p-2">{openCount}</td>
                        <td className="p-2">{statusBadge(openCount)}</td>
                        <td className="p-2">{inPipeline}</td>
                        <td className="p-2">{stage1}</td>
                        <td className="p-2">{stage2}</td>
                        <td className="p-2">{stage3}</td>
                        <td className="p-2">{stage4}</td>
                        <td className="p-2"><button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => handleRequirementSave({ ...draft, id: req.id })}>Save</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "bench" && (
        <div className="space-y-6">
          <SectionCard title="Talent Bench" subtitle="Lightweight lead vault. Add once, search anytime, push to pipeline when needed.">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm" placeholder="Full name" value={newBench.fullName} onChange={(e) => setNewBench({ ...newBench, fullName: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm" placeholder="Phone" value={newBench.phone} onChange={(e) => setNewBench({ ...newBench, phone: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm" placeholder="Email (optional)" value={newBench.email} onChange={(e) => setNewBench({ ...newBench, email: e.target.value })} />
              <select
                className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm"
                value={newBench.gender || ""}
                onChange={(e) => setNewBench({ ...newBench, gender: e.target.value })}
              >
                <option value="">Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other / Prefer not to say</option>
              </select>
              <select className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm" value={newBench.location} onChange={(e) => setNewBench({ ...newBench, location: e.target.value })}>
                <option value="">Location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.locationName}>{l.locationName}</option>
                ))}
              </select>
              <select className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm" value={newBench.appliedFor} onChange={(e) => setNewBench({ ...newBench, appliedFor: e.target.value })}>
                <option value="">Applied for</option>
                {["English/SST/Science", "Maths", "Jr Eng", "Jr All", "Computer/Arts", "Admin/Principal/Vice Principal", "Office"].map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <input type="date" className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm" value={newBench.appliedDate} onChange={(e) => setNewBench({ ...newBench, appliedDate: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm" placeholder="Link (resume/portfolio)" value={newBench.linkUrl} onChange={(e) => setNewBench({ ...newBench, linkUrl: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm" placeholder="Source" value={newBench.source} onChange={(e) => setNewBench({ ...newBench, source: e.target.value })} />
              <input className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm md:col-span-2" placeholder="Notes" value={newBench.notes} onChange={(e) => setNewBench({ ...newBench, notes: e.target.value })} />
              <button className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white shadow hover:bg-emerald-700" onClick={handleBenchCreate}>Add to bench</button>
            </div>
          </SectionCard>

          <SectionCard
            title="Bench List"
            subtitle="Select rows to push. Click ✏️ to edit, 🗑️ to delete."
            className="space-y-3"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <input
                  className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-sm"
                  placeholder="Search name, phone, source..."
                  value={benchSearch}
                  onChange={(e) => setBenchSearch(e.target.value)}
                />
                <select
                  className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-sm"
                  value={benchFilterLocation}
                  onChange={(e) => setBenchFilterLocation(e.target.value)}
                >
                  <option value="">All locations</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.locationName}>{l.locationName}</option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-sm"
                  value={benchFilterApplied}
                  onChange={(e) => setBenchFilterApplied(e.target.value)}
                >
                  <option value="">All roles</option>
                  {["English/SST/Science", "Maths", "Jr Eng", "Jr All", "Computer/Arts", "Admin/Principal/Vice Principal", "Office"].map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-sm"
                  value={benchPush.requirementId}
                  onChange={(e) => {
                    const reqId = e.target.value;
                    const req = requirementsList.find((r) => String(r.id) === String(reqId));
                    setBenchPush({
                      ...benchPush,
                      requirementId: reqId,
                      programId: req ? req.programId : "",
                      locationId: req ? req.locationId : "",
                      mspCodeId: "",
                    });
                  }}
                >
                  <option value="">Current requirement</option>
                  {requirementsList.map((req) => (
                    <option key={req.id} value={req.id}>
                      {(req.requirementName || "Requirement") + (req.programCode ? ` — ${req.programCode}` : "")}
                    </option>
                  ))}
                </select>
                <select className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-sm" value={benchPush.countryCodeId} onChange={(e) => setBenchPush({ ...benchPush, countryCodeId: e.target.value })}>
                  <option value="">Country code</option>
                  {countryCodes.map((c) => (
                    <option key={c.id} value={c.id}>{c.countryCode}</option>
                  ))}
                </select>
                <select className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-sm" value={benchPush.mspCodeId} onChange={(e) => setBenchPush({ ...benchPush, mspCodeId: e.target.value })} disabled={!benchPush.programId}>
                  <option value="">MSP code (optional)</option>
                  {getVacantCodesForProgram(benchPush.programId).map((code) => (
                    <option key={code.id} value={code.id}>{code.code}{code.title ? ` — ${code.title}` : ""}</option>
                  ))}
                </select>
                <select className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-sm" value={benchPush.candidateStatus} onChange={(e) => setBenchPush({ ...benchPush, candidateStatus: e.target.value })}>
                  {candidateStatusOptionsLocal.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <input className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-sm w-32" placeholder="Email (optional)" value={benchPush.email} onChange={(e) => setBenchPush({ ...benchPush, email: e.target.value })} />
                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow hover:bg-slate-800 disabled:opacity-60" disabled={!selectedBench.size} onClick={handleBenchPush}>
                  Push {selectedBench.size || 0}
                </button>
              </div>
            </div>
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-3 text-left">Sr</th>
                    <th className="p-3">
                      <input
                        type="checkbox"
                        checked={(benchSwr.data?.bench?.length || 0) > 0 && selectedBench.size === (benchSwr.data?.bench?.length || 0)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedBench(new Set((benchSwr.data?.bench || []).map((b) => b.id)));
                          else setSelectedBench(new Set());
                        }}
                      />
                    </th>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Phone</th>
                    <th className="p-3 text-left">Location</th>
                    <th className="p-3 text-left">Applied For</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Link</th>
                    <th className="p-3 text-left">Source</th>
                    <th className="p-3 text-left">Notes</th>
                    <th className="p-3 text-left">Last Requirement</th>
                    <th className="p-3 text-left">Pushes</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(benchSwr.data?.bench || [])
                    .filter((b) => {
                      const q = benchSearch.trim().toLowerCase();
                      const matchesSearch =
                        !q ||
                        b.fullName?.toLowerCase().includes(q) ||
                        b.phone?.toLowerCase().includes(q) ||
                        b.source?.toLowerCase().includes(q);
                      const matchesLoc = !benchFilterLocation || b.location === benchFilterLocation;
                      const matchesApplied = !benchFilterApplied || b.appliedFor === benchFilterApplied;
                      return matchesSearch && matchesLoc && matchesApplied;
                    })
                    .map((b, idx) => {
                    const draft = benchDrafts[b.id] || b;
                    const checked = selectedBench.has(b.id);
                    const isEditing = benchEditingId === b.id;
                    return (
                      <tr key={b.id} className="border-t">
                        <td className="p-3 text-slate-600">{(benchSwr.data?.bench?.length || 0) - idx}</td>
                        <td className="p-3"><input type="checkbox" checked={checked} onChange={(e) => {
                          const next = new Set(selectedBench);
                          if (e.target.checked) next.add(b.id); else next.delete(b.id);
                          setSelectedBench(next);
                        }} /></td>
                        <td className="p-3">
                          {isEditing ? (
                            <input className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs" value={draft.fullName || ""} onChange={(e) => setBenchDrafts((prev) => ({ ...prev, [b.id]: { ...prev[b.id], fullName: e.target.value } }))} />
                          ) : (
                            <span className="font-medium text-slate-900">{b.fullName}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <input className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-xs" value={draft.phone || ""} onChange={(e) => setBenchDrafts((prev) => ({ ...prev, [b.id]: { ...prev[b.id], phone: e.target.value } }))} />
                          ) : (
                            <span>{b.phone}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <select className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs" value={draft.location || ""} onChange={(e) => setBenchDrafts((prev) => ({ ...prev, [b.id]: { ...prev[b.id], location: e.target.value } }))}>
                              <option value="">—</option>
                              {locations.map((l) => (
                                <option key={l.id} value={l.locationName}>{l.locationName}</option>
                              ))}
                            </select>
                          ) : (
                            <span>{b.location || "—"}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <select className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs" value={draft.appliedFor || ""} onChange={(e) => setBenchDrafts((prev) => ({ ...prev, [b.id]: { ...prev[b.id], appliedFor: e.target.value } }))}>
                              <option value="">—</option>
                              {["English/SST/Science", "Maths", "Jr Eng", "Jr All", "Computer/Arts", "Admin/Principal/Vice Principal", "Office"].map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <span>{b.appliedFor || "—"}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <input type="date" className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={draft.appliedDate || ""} onChange={(e) => setBenchDrafts((prev) => ({ ...prev, [b.id]: { ...prev[b.id], appliedDate: e.target.value } }))} />
                          ) : (
                            <span>{b.appliedDate || "—"}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <input className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs" value={draft.linkUrl || ""} onChange={(e) => setBenchDrafts((prev) => ({ ...prev, [b.id]: { ...prev[b.id], linkUrl: e.target.value } }))} />
                          ) : (
                            <span>{b.linkUrl || "—"}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <input className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs" value={draft.source || ""} onChange={(e) => setBenchDrafts((prev) => ({ ...prev, [b.id]: { ...prev[b.id], source: e.target.value } }))} />
                          ) : (
                            <span>{b.source || "—"}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <input className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs" value={draft.notes || ""} onChange={(e) => setBenchDrafts((prev) => ({ ...prev, [b.id]: { ...prev[b.id], notes: e.target.value } }))} />
                          ) : (
                            <span>{b.notes || "—"}</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-700">{b.lastRequirementName || "—"}</td>
                        <td className="p-3 text-slate-600">{Number(b.pushCount) || 0}{b.lastPushedAt ? ` • ${String(b.lastPushedAt).slice(0,10)}` : ""}</td>
                        <td className="p-3 flex gap-2">
                          {isEditing ? (
                            <>
                              <button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" title="Save lead" onClick={() => handleBenchSave(b.id)}>💾</button>
                              <button className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700" title="Cancel" onClick={() => { setBenchDrafts((prev) => ({ ...prev, [b.id]: { ...b } })); setBenchEditingId(null); }}>✖️</button>
                            </>
                          ) : (
                            <>
                              <button className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700" title="Edit lead" onClick={() => { setBenchDrafts((prev) => ({ ...prev, [b.id]: { ...b } })); setBenchEditingId(b.id); }}>✏️</button>
                              <button className="rounded-lg bg-rose-100 px-2 py-1 text-xs text-rose-700" title="Delete lead" onClick={() => handleBenchDelete(b.id)}>🗑️</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!(benchSwr.data?.bench || []).length && (
                    <tr className="border-t">
                      <td className="p-3 text-slate-500" colSpan={11}>No leads yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "appointments" && (
        <div className="space-y-4">
          <SectionCard title="Appointments" subtitle="Post-selection tasks will land here.">
            <p className="text-sm text-slate-700">Offer letters, appointment letters, and joining checklists coming soon.</p>
          </SectionCard>
        </div>
      )}

      {commModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Log communication</div>
                <div className="text-sm font-semibold text-slate-900">Stage {commModal.stageOrder}</div>
              </div>
              <button className="text-slate-500 hover:text-slate-700" onClick={() => setCommModal((p) => ({ ...p, open: false }))}>✕</button>
            </div>
            <div className="space-y-3 px-4 py-3">
              <div>
                <label className="text-[11px] uppercase text-slate-500">Date</label>
                <input type="date" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={commModal.date} onChange={(e) => setCommModal((p) => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase text-slate-500">Method</label>
                  <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={commModal.method} onChange={(e) => setCommModal((p) => ({ ...p, method: e.target.value }))}>
                    {COMM_METHOD_OPTIONS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase text-slate-500">Outcome</label>
                  <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={commModal.outcome} onChange={(e) => setCommModal((p) => ({ ...p, outcome: e.target.value }))}>
                    {COMM_OUTCOME_OPTIONS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase text-slate-500">Subject</label>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={commModal.subject} onChange={(e) => setCommModal((p) => ({ ...p, subject: e.target.value }))} placeholder="e.g., Screening call" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase text-slate-500">Follow-up date</label>
                  <input type="date" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={commModal.followUpDate} onChange={(e) => setCommModal((p) => ({ ...p, followUpDate: e.target.value }))} />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
                  <input type="checkbox" checked={commModal.finishStage} onChange={(e) => setCommModal((p) => ({ ...p, finishStage: e.target.checked }))} />
                  Finish this stage
                </label>
              </div>
              <div>
                <label className="text-[11px] uppercase text-slate-500">Notes</label>
                <textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={3} value={commModal.notes} onChange={(e) => setCommModal((p) => ({ ...p, notes: e.target.value }))} placeholder="Key points, concerns, next steps" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setCommModal((p) => ({ ...p, open: false }))}>
                Cancel
              </button>
              <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700" onClick={submitCommModal}>
                Save log
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
