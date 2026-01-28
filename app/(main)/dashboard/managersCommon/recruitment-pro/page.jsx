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
  { key: "candidates", label: "Master Database" },
  { key: "pipeline", label: "Pipeline Tracker" },
  { key: "dashboard", label: "Dashboard" },
  { key: "programTracking", label: "Program Tracking" },
  { key: "howto", label: "How To" },
];

export default function RecruitmentProPage() {
  const [activeTab, setActiveTab] = React.useState("meta");

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
  const requirementsSwr = useSWR(activeTab === "programTracking" ? "/api/managersCommon/recruitment-pro?section=programRequirements" : null, fetcher);

  const programs = programsSwr.data?.programs || [];
  const stages = stagesSwr.data?.stages || [];
  const countryCodes = countrySwr.data?.codes || [];
  const locations = locationsSwr.data?.locations || [];
  const vacantCodes = vacantCodesSwr.data?.vacantCodes || [];

  const [programDrafts, setProgramDrafts] = React.useState({});
  const [stageDrafts, setStageDrafts] = React.useState({});
  const [countryDrafts, setCountryDrafts] = React.useState({});
  const [locationDrafts, setLocationDrafts] = React.useState({});

  const [newProgram, setNewProgram] = React.useState({ programCode: "", programName: "", description: "", isActive: true });
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
  React.useEffect(() => {
    const next = {};
    (requirementsSwr.data?.requirements || []).forEach((req) => (next[req.id] = { ...req }));
    setRequirementDrafts(next);
  }, [requirementsSwr.data]);

  const programCodeById = React.useMemo(() => {
    const map = new Map();
    programs.forEach((p) => map.set(p.id, p.programCode));
    return map;
  }, [programs]);

  const getVacantCodesForProgram = (programId) => {
    const programCode = programCodeById.get(Number(programId));
    if (!programCode) return [];
    return vacantCodes.filter(
      (code) => String(code.program).toUpperCase() === String(programCode).toUpperCase()
    );
  };

  const stageOptions = pipelineSwr.data?.stageOptions || [];
  const finalStatusOptions = pipelineSwr.data?.finalStatusOptions || [];

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
      { order: 1, id: draft.stage1Id, date: draft.stage1Date },
      { order: 2, id: draft.stage2Id, date: draft.stage2Date },
      { order: 3, id: draft.stage3Id, date: draft.stage3Date },
      { order: 4, id: draft.stage4Id, date: draft.stage4Date },
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

  const addStageComm = async (candidateId, stageId) => {
    if (!stageId) {
      alert("Select a stage before logging communication.");
      return;
    }
    const communicationDate = prompt("Communication date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10)) || "";
    if (!communicationDate) return;
    const communicationMethod = prompt(`Method (${COMM_METHOD_OPTIONS.join(", ")})`, COMM_METHOD_OPTIONS[0]) || "";
    if (!communicationMethod) return;
    const subject = prompt("Subject", "") || "";
    if (!subject) return;
    const outcome = prompt(`Outcome (${COMM_OUTCOME_OPTIONS.join(", ")})`, COMM_OUTCOME_OPTIONS[0]) || "";
    if (!outcome) return;
    const followUpDate = prompt("Follow-up date (YYYY-MM-DD) - optional", "") || "";
    const notes = prompt("Notes (optional)", "") || "";

    await apiCall("communicationLog", "POST", {
      candidateId,
      stageId,
      communicationDate,
      communicationMethod,
      subject,
      outcome,
      followUpDate: followUpDate || null,
      notes: notes || null,
    });
    await pipelineSwr.mutate();
  };

  const handleRequirementSave = async (draft) => {
    await apiCall("programRequirements", "POST", {
      programId: draft.programId,
      locationId: draft.locationId,
      requiredCount: Number(draft.requiredCount),
      filledCount: Number(draft.filledCount || 0),
      notes: draft.notes || "",
    });
    await requirementsSwr.mutate();
  };

  const handleRequirementCreate = async () => {
    await apiCall("programRequirements", "POST", {
      programId: Number(newRequirement.programId),
      locationId: Number(newRequirement.locationId),
      requiredCount: Number(newRequirement.requiredCount),
      filledCount: Number(newRequirement.filledCount || 0),
      notes: "",
    });
    setNewRequirement({ programId: "", locationId: "", requiredCount: "", filledCount: "" });
    await requirementsSwr.mutate();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Meed Recruitment</h1>
        <p className="text-sm text-slate-600">Teacher recruitment tracker with meta controls, pipeline, and dashboards.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TAB_LIST.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-full text-sm border ${activeTab === tab.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "meta" && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Programs</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="Code" value={newProgram.programCode} onChange={(e) => setNewProgram({ ...newProgram, programCode: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Name" value={newProgram.programName} onChange={(e) => setNewProgram({ ...newProgram, programName: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Description" value={newProgram.description} onChange={(e) => setNewProgram({ ...newProgram, description: e.target.value })} />
              <button className="px-3 py-1.5 rounded bg-teal-600 text-white text-sm" onClick={() => handleCreate("metaPrograms", newProgram, () => setNewProgram({ programCode: "", programName: "", description: "", isActive: true }), programsSwr.mutate)}>Add</button>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm border">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-left">Active</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2"><input className="border rounded px-2 py-1 text-xs" value={programDrafts[p.id]?.programCode || ""} onChange={(e) => setProgramDrafts((prev) => ({ ...prev, [p.id]: { ...prev[p.id], programCode: e.target.value } }))} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 text-xs" value={programDrafts[p.id]?.programName || ""} onChange={(e) => setProgramDrafts((prev) => ({ ...prev, [p.id]: { ...prev[p.id], programName: e.target.value } }))} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 text-xs" value={programDrafts[p.id]?.description || ""} onChange={(e) => setProgramDrafts((prev) => ({ ...prev, [p.id]: { ...prev[p.id], description: e.target.value } }))} /></td>
                      <td className="p-2"><input type="checkbox" checked={!!programDrafts[p.id]?.isActive} onChange={(e) => setProgramDrafts((prev) => ({ ...prev, [p.id]: { ...prev[p.id], isActive: e.target.checked } }))} /></td>
                      <td className="p-2 flex gap-2">
                        <button className="px-2 py-1 rounded bg-slate-900 text-white text-xs" onClick={() => handleSaveMeta("metaPrograms", programDrafts[p.id], programsSwr.mutate)}>Save</button>
                        <button className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-xs" onClick={() => handleSoftDelete("metaPrograms", p.id, programsSwr.mutate)}>Deactivate</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">MSP Codes (Vacant)</h2>
            <p className="text-xs text-slate-500">Auto-pulled from Manage Meedian → MSP Codes. These codes have no active assignment.</p>
            <div className="overflow-auto">
              <table className="min-w-full text-xs border">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Title</th>
                    <th className="p-2 text-left">Program</th>
                    <th className="p-2 text-left">Family</th>
                    <th className="p-2 text-left">Track</th>
                    <th className="p-2 text-left">Slice</th>
                  </tr>
                </thead>
                <tbody>
                  {(vacantCodesSwr.data?.vacantCodes || []).map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-2">{c.code}</td>
                      <td className="p-2">{c.title}</td>
                      <td className="p-2">{c.program}</td>
                      <td className="p-2">{c.familyKey}</td>
                      <td className="p-2">{c.track}</td>
                      <td className="p-2">{c.parentSlice || "—"}</td>
                    </tr>
                  ))}
                  {!vacantCodesSwr.data?.vacantCodes?.length && (
                    <tr className="border-t">
                      <td className="p-2 text-slate-500" colSpan={6}>No vacant MSP codes right now.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Stages</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="Code" value={newStage.stageCode} onChange={(e) => setNewStage({ ...newStage, stageCode: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Name" value={newStage.stageName} onChange={(e) => setNewStage({ ...newStage, stageName: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Description" value={newStage.description} onChange={(e) => setNewStage({ ...newStage, description: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Order" value={newStage.stageOrder} onChange={(e) => setNewStage({ ...newStage, stageOrder: e.target.value })} />
              <button className="px-3 py-1.5 rounded bg-teal-600 text-white text-sm" onClick={() => handleCreate("metaStages", { ...newStage, stageOrder: Number(newStage.stageOrder) }, () => setNewStage({ stageCode: "", stageName: "", description: "", stageOrder: "", isActive: true }), stagesSwr.mutate)}>Add</button>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm border">
                <thead className="bg-slate-50">
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
                      <td className="p-2"><input className="border rounded px-2 py-1 text-xs" value={stageDrafts[s.id]?.stageCode || ""} onChange={(e) => setStageDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], stageCode: e.target.value } }))} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 text-xs" value={stageDrafts[s.id]?.stageName || ""} onChange={(e) => setStageDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], stageName: e.target.value } }))} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 text-xs" value={stageDrafts[s.id]?.description || ""} onChange={(e) => setStageDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], description: e.target.value } }))} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 text-xs" value={stageDrafts[s.id]?.stageOrder || ""} onChange={(e) => setStageDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], stageOrder: Number(e.target.value) } }))} /></td>
                      <td className="p-2"><input type="checkbox" checked={!!stageDrafts[s.id]?.isActive} onChange={(e) => setStageDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], isActive: e.target.checked } }))} /></td>
                      <td className="p-2 flex gap-2">
                        <button className="px-2 py-1 rounded bg-slate-900 text-white text-xs" onClick={() => handleSaveMeta("metaStages", stageDrafts[s.id], stagesSwr.mutate)}>Save</button>
                        <button className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-xs" onClick={() => handleSoftDelete("metaStages", s.id, stagesSwr.mutate)}>Deactivate</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Country Codes</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="Country" value={newCountry.countryName} onChange={(e) => setNewCountry({ ...newCountry, countryName: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="+91" value={newCountry.countryCode} onChange={(e) => setNewCountry({ ...newCountry, countryCode: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newCountry.isDefault} onChange={(e) => setNewCountry({ ...newCountry, isDefault: e.target.checked })} /> Default</label>
              <button className="px-3 py-1.5 rounded bg-teal-600 text-white text-sm" onClick={() => handleCreate("metaCountryCodes", newCountry, () => setNewCountry({ countryName: "", countryCode: "", isActive: true, isDefault: false }), countrySwr.mutate)}>Add</button>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm border">
                <thead className="bg-slate-50">
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
                      <td className="p-2"><input className="border rounded px-2 py-1 text-xs" value={countryDrafts[c.id]?.countryName || ""} onChange={(e) => setCountryDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], countryName: e.target.value } }))} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 text-xs" value={countryDrafts[c.id]?.countryCode || ""} onChange={(e) => setCountryDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], countryCode: e.target.value } }))} /></td>
                      <td className="p-2"><input type="checkbox" checked={!!countryDrafts[c.id]?.isActive} onChange={(e) => setCountryDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], isActive: e.target.checked } }))} /></td>
                      <td className="p-2"><input type="checkbox" checked={!!countryDrafts[c.id]?.isDefault} onChange={(e) => setCountryDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], isDefault: e.target.checked } }))} /></td>
                      <td className="p-2 flex gap-2">
                        <button className="px-2 py-1 rounded bg-slate-900 text-white text-xs" onClick={() => handleSaveMeta("metaCountryCodes", countryDrafts[c.id], countrySwr.mutate)}>Save</button>
                        <button className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-xs" onClick={() => handleSoftDelete("metaCountryCodes", c.id, countrySwr.mutate)}>Deactivate</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Locations</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="Location" value={newLocation.locationName} onChange={(e) => setNewLocation({ ...newLocation, locationName: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="City" value={newLocation.city} onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="State" value={newLocation.state} onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Country" value={newLocation.country} onChange={(e) => setNewLocation({ ...newLocation, country: e.target.value })} />
              <button className="px-3 py-1.5 rounded bg-teal-600 text-white text-sm" onClick={() => handleCreate("metaLocations", newLocation, () => setNewLocation({ locationName: "", city: "", state: "", country: "India", isActive: true }), locationsSwr.mutate)}>Add</button>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm border">
                <thead className="bg-slate-50">
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
                      <td className="p-2"><input className="border rounded px-2 py-1 text-xs" value={locationDrafts[l.id]?.locationName || ""} onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [l.id]: { ...prev[l.id], locationName: e.target.value } }))} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 text-xs" value={locationDrafts[l.id]?.city || ""} onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [l.id]: { ...prev[l.id], city: e.target.value } }))} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 text-xs" value={locationDrafts[l.id]?.state || ""} onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [l.id]: { ...prev[l.id], state: e.target.value } }))} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 text-xs" value={locationDrafts[l.id]?.country || ""} onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [l.id]: { ...prev[l.id], country: e.target.value } }))} /></td>
                      <td className="p-2"><input type="checkbox" checked={!!locationDrafts[l.id]?.isActive} onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [l.id]: { ...prev[l.id], isActive: e.target.checked } }))} /></td>
                      <td className="p-2 flex gap-2">
                        <button className="px-2 py-1 rounded bg-slate-900 text-white text-xs" onClick={() => handleSaveMeta("metaLocations", locationDrafts[l.id], locationsSwr.mutate)}>Save</button>
                        <button className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-xs" onClick={() => handleSoftDelete("metaLocations", l.id, locationsSwr.mutate)}>Deactivate</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "candidates" && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Add Candidate</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="First name" value={newCandidate.firstName} onChange={(e) => setNewCandidate({ ...newCandidate, firstName: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Last name" value={newCandidate.lastName} onChange={(e) => setNewCandidate({ ...newCandidate, lastName: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Email" value={newCandidate.email} onChange={(e) => setNewCandidate({ ...newCandidate, email: e.target.value })} />
              <select className="border rounded px-2 py-1 text-sm" value={newCandidate.countryCodeId} onChange={(e) => setNewCandidate({ ...newCandidate, countryCodeId: e.target.value })}>
                <option value="">Country Code</option>
                {countryCodes.map((c) => (
                  <option key={c.id} value={c.id}>{c.countryCode}</option>
                ))}
              </select>
              <input className="border rounded px-2 py-1 text-sm" placeholder="Phone" value={newCandidate.phoneNumber} onChange={(e) => setNewCandidate({ ...newCandidate, phoneNumber: e.target.value })} />
              <select
                className="border rounded px-2 py-1 text-sm"
                value={newCandidate.programId}
                onChange={(e) => setNewCandidate({ ...newCandidate, programId: e.target.value, mspCodeId: "" })}
              >
                <option value="">Program</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.programCode}</option>
                ))}
              </select>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={newCandidate.mspCodeId}
                onChange={(e) => setNewCandidate({ ...newCandidate, mspCodeId: e.target.value })}
                disabled={!newCandidate.programId}
              >
                <option value="">MSP Code</option>
                {getVacantCodesForProgram(newCandidate.programId).map((code) => (
                  <option key={code.id} value={code.id}>{code.code}{code.title ? ` — ${code.title}` : ""}</option>
                ))}
              </select>
              <select className="border rounded px-2 py-1 text-sm" value={newCandidate.locationId} onChange={(e) => setNewCandidate({ ...newCandidate, locationId: e.target.value })}>
                <option value="">Location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.locationName}</option>
                ))}
              </select>
              <input className="border rounded px-2 py-1 text-sm" placeholder="Year" value={newCandidate.appliedYear} onChange={(e) => setNewCandidate({ ...newCandidate, appliedYear: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Resume URL" value={newCandidate.resumeUrl} onChange={(e) => setNewCandidate({ ...newCandidate, resumeUrl: e.target.value })} />
              <select className="border rounded px-2 py-1 text-sm" value={newCandidate.candidateStatus} onChange={(e) => setNewCandidate({ ...newCandidate, candidateStatus: e.target.value })}>
                {candidatesSwr.data?.candidateStatusOptions?.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button className="px-3 py-1.5 rounded bg-teal-600 text-white text-sm" onClick={handleCandidateCreate}>Add</button>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Candidate Pool</h2>
            <div className="overflow-auto">
              <table className="min-w-full text-xs border">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left">Sr</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Phone</th>
                    <th className="p-2 text-left">Program</th>
                    <th className="p-2 text-left">MSP Code</th>
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
                          <input className="border rounded px-1 py-0.5 w-20" value={candidateDrafts[c.id]?.firstName || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], firstName: e.target.value } }))} />
                          <input className="border rounded px-1 py-0.5 w-20" value={candidateDrafts[c.id]?.lastName || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], lastName: e.target.value } }))} />
                        </div>
                      </td>
                      <td className="p-2"><input className="border rounded px-1 py-0.5" value={candidateDrafts[c.id]?.email || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], email: e.target.value } }))} /></td>
                      <td className="p-2">
                        <select className="border rounded px-1 py-0.5" value={candidateDrafts[c.id]?.countryCodeId || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], countryCodeId: Number(e.target.value) } }))}>
                          <option value="">Code</option>
                          {countryCodes.map((cc) => (
                            <option key={cc.id} value={cc.id}>{cc.countryCode}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2"><input className="border rounded px-1 py-0.5" value={candidateDrafts[c.id]?.phoneNumber || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], phoneNumber: e.target.value } }))} /></td>
                      <td className="p-2">
                        <select
                          className="border rounded px-1 py-0.5"
                          value={candidateDrafts[c.id]?.programId || ""}
                          onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], programId: Number(e.target.value), mspCodeId: "" } }))}
                        >
                          {programs.map((p) => (
                            <option key={p.id} value={p.id}>{p.programCode}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          className="border rounded px-1 py-0.5"
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
                        <select className="border rounded px-1 py-0.5" value={candidateDrafts[c.id]?.locationId || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], locationId: Number(e.target.value) } }))}>
                          {locations.map((l) => (
                            <option key={l.id} value={l.id}>{l.locationName}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2"><input className="border rounded px-1 py-0.5 w-20" value={candidateDrafts[c.id]?.appliedYear || ""} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], appliedYear: e.target.value } }))} /></td>
                      <td className="p-2">
                        <select className="border rounded px-1 py-0.5" value={candidateDrafts[c.id]?.candidateStatus || "Active"} onChange={(e) => setCandidateDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], candidateStatus: e.target.value } }))}>
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
          </div>
        </div>
      )}

      {activeTab === "pipeline" && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Pipeline Tracker</h2>
            <div className="overflow-auto">
              <table className="min-w-full text-xs border">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left">Sr</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Phone</th>
                    <th className="p-2 text-left">Program</th>
                    <th className="p-2 text-left">Stage 1</th>
                    <th className="p-2 text-left">Date 1</th>
                    <th className="p-2 text-left">Stage 2</th>
                    <th className="p-2 text-left">Date 2</th>
                    <th className="p-2 text-left">Stage 3</th>
                    <th className="p-2 text-left">Date 3</th>
                    <th className="p-2 text-left">Stage 4</th>
                    <th className="p-2 text-left">Date 4</th>
                    <th className="p-2 text-left">Final</th>
                    <th className="p-2 text-left">Final Date</th>
                    <th className="p-2 text-left">Join Date</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(pipelineSwr.data?.rows || []).map((row) => {
                    const draft = pipelineDrafts[row.id] || {};
                    return (
                      <tr key={row.id} className="border-t">
                        <td className="p-2">{row.srNo}</td>
                        <td className="p-2">{row.firstName} {row.lastName || ""}</td>
                        <td className="p-2">{row.fullPhone || ""}</td>
                        <td className="p-2">{row.programCode}</td>
                        <td className="p-2">
                          <select className="border rounded px-1 py-0.5" value={draft.stage1Id || ""} onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], stage1Id: Number(e.target.value) } }))}>
                            <option value="">--</option>
                            {stageOptions.map((s) => (
                              <option key={s.id} value={s.id}>{s.stageName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2"><input type="date" className="border rounded px-1 py-0.5" value={draft.stage1Date || ""} onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], stage1Date: e.target.value } }))} /></td>
                        <td className="p-2">
                          <select className="border rounded px-1 py-0.5" value={draft.stage2Id || ""} onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], stage2Id: Number(e.target.value) } }))}>
                            <option value="">--</option>
                            {stageOptions.map((s) => (
                              <option key={s.id} value={s.id}>{s.stageName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2"><input type="date" className="border rounded px-1 py-0.5" value={draft.stage2Date || ""} onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], stage2Date: e.target.value } }))} /></td>
                        <td className="p-2">
                          <select className="border rounded px-1 py-0.5" value={draft.stage3Id || ""} onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], stage3Id: Number(e.target.value) } }))}>
                            <option value="">--</option>
                            {stageOptions.map((s) => (
                              <option key={s.id} value={s.id}>{s.stageName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2"><input type="date" className="border rounded px-1 py-0.5" value={draft.stage3Date || ""} onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], stage3Date: e.target.value } }))} /></td>
                        <td className="p-2">
                          <select className="border rounded px-1 py-0.5" value={draft.stage4Id || ""} onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], stage4Id: Number(e.target.value) } }))}>
                            <option value="">--</option>
                            {stageOptions.map((s) => (
                              <option key={s.id} value={s.id}>{s.stageName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2"><input type="date" className="border rounded px-1 py-0.5" value={draft.stage4Date || ""} onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], stage4Date: e.target.value } }))} /></td>
                        <td className="p-2">
                          <select className="border rounded px-1 py-0.5" value={draft.finalStatus || ""} onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], finalStatus: e.target.value } }))}>
                            <option value="">--</option>
                            {finalStatusOptions.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2"><input type="date" className="border rounded px-1 py-0.5" value={draft.finalDate || ""} onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], finalDate: e.target.value } }))} /></td>
                        <td className="p-2"><input type="date" className="border rounded px-1 py-0.5" value={draft.joiningDate || ""} onChange={(e) => setPipelineDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], joiningDate: e.target.value } }))} /></td>
                        <td className="p-2"><button className="px-2 py-1 text-xs rounded bg-slate-900 text-white" onClick={() => handlePipelineSave(row.id)}>Save</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "dashboard" && (
        <div className="rounded-xl border bg-white p-4 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Meed Recruitment Dashboard</h2>
          {!dashboardSwr.data && <p className="text-sm text-slate-500">Loading metrics…</p>}
          {dashboardSwr.data && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs text-slate-500">Total Candidates</div>
                <div className="text-2xl font-semibold text-slate-900">{dashboardSwr.data.totalCandidates}</div>
                <div className="text-xs text-slate-500">Stage 1: {dashboardSwr.data.stageCounts.stage1}</div>
                <div className="text-xs text-slate-500">Stage 2: {dashboardSwr.data.stageCounts.stage2}</div>
                <div className="text-xs text-slate-500">Stage 3: {dashboardSwr.data.stageCounts.stage3}</div>
                <div className="text-xs text-slate-500">Stage 4: {dashboardSwr.data.stageCounts.stage4}</div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-slate-500">Final Outcomes</div>
                {Object.entries(dashboardSwr.data.finalCounts).map(([key, value]) => (
                  <div key={key} className="text-xs text-slate-600">{key}: {value}</div>
                ))}
                <div className="text-xs text-slate-500 mt-2">Conversion Rates</div>
                <div className="text-xs text-slate-600">S1 → S2: {dashboardSwr.data.conversionRates.s1ToS2}%</div>
                <div className="text-xs text-slate-600">S2 → S3: {dashboardSwr.data.conversionRates.s2ToS3}%</div>
                <div className="text-xs text-slate-600">S3 → S4: {dashboardSwr.data.conversionRates.s3ToS4}%</div>
                <div className="text-xs text-slate-600">Overall Success: {dashboardSwr.data.conversionRates.overallSuccess}%</div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "programTracking" && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Program Requirements</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <select className="border rounded px-2 py-1 text-sm" value={newRequirement.programId} onChange={(e) => setNewRequirement({ ...newRequirement, programId: e.target.value })}>
                <option value="">Program</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.programCode}</option>
                ))}
              </select>
              <select className="border rounded px-2 py-1 text-sm" value={newRequirement.locationId} onChange={(e) => setNewRequirement({ ...newRequirement, locationId: e.target.value })}>
                <option value="">Location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.locationName}</option>
                ))}
              </select>
              <input className="border rounded px-2 py-1 text-sm" placeholder="Required" value={newRequirement.requiredCount} onChange={(e) => setNewRequirement({ ...newRequirement, requiredCount: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Filled" value={newRequirement.filledCount} onChange={(e) => setNewRequirement({ ...newRequirement, filledCount: e.target.value })} />
              <button className="px-3 py-1.5 rounded bg-teal-600 text-white text-sm" onClick={handleRequirementCreate}>Add</button>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-3">
            <div className="overflow-auto">
              <table className="min-w-full text-xs border">
                <thead className="bg-slate-50">
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
                        <td className="p-2">{req.programCode}</td>
                        <td className="p-2">{req.locationName}</td>
                        <td className="p-2"><input className="border rounded px-1 py-0.5 w-16" value={draft.requiredCount || ""} onChange={(e) => setRequirementDrafts((prev) => ({ ...prev, [req.id]: { ...prev[req.id], requiredCount: e.target.value } }))} /></td>
                        <td className="p-2"><input className="border rounded px-1 py-0.5 w-16" value={draft.filledCount || ""} onChange={(e) => setRequirementDrafts((prev) => ({ ...prev, [req.id]: { ...prev[req.id], filledCount: e.target.value } }))} /></td>
                        <td className="p-2">{openCount}</td>
                        <td className="p-2">{statusBadge(openCount)}</td>
                        <td className="p-2">{inPipeline}</td>
                        <td className="p-2">{stage1}</td>
                        <td className="p-2">{stage2}</td>
                        <td className="p-2">{stage3}</td>
                        <td className="p-2">{stage4}</td>
                        <td className="p-2"><button className="px-2 py-1 text-xs rounded bg-slate-900 text-white" onClick={() => handleRequirementSave({ ...draft, id: req.id })}>Save</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "howto" && (
        <div className="rounded-xl border bg-white p-4 space-y-3 text-sm text-slate-700">
          <h2 className="text-sm font-semibold text-slate-900">How To Use</h2>
          <ol className="list-decimal ml-5 space-y-2">
            <li>Start with Meta Controls: add programs, stages, country codes, and locations.</li>
            <li>Add candidates in Master Database. Sr No and full phone auto-generate.</li>
            <li>Update Pipeline Tracker stages and dates as interviews progress.</li>
            <li>Use Dashboard for real-time metrics and conversion rates.</li>
            <li>Maintain Program Tracking requirements to see open positions.</li>
            <li>Log every call/email in Comm Log for follow-ups.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
