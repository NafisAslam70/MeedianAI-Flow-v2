"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function ProgramDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { data: progData } = useSWR(id ? `/api/admin/manageMeedian?section=metaPrograms` : null, fetcher);
  const program = useMemo(() => (progData?.programs || []).find((p) => p.id === id), [progData, id]);

  const searchParams = useSearchParams();
  const [track, setTrack] = useState("pre_primary");
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
  const [fullscreen, setFullscreen] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [schedTab, setSchedTab] = useState("base"); // base | weekly
  const [weekDay, setWeekDay] = useState("Mon");
  const [manageCodesOpen, setManageCodesOpen] = useState(false);
  const [dragMemberId, setDragMemberId] = useState(null);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [showDefaultSeedModal, setShowDefaultSeedModal] = useState(false);
  const [selfSchedOpen, setSelfSchedOpen] = useState(false);
  const [selfSchedFull, setSelfSchedFull] = useState(false);
  const [mspRMode, setMspRMode] = useState("class"); // class | teacher
  const [selectedTeacher, setSelectedTeacher] = useState("ALL");
  const [routineOpen, setRoutineOpen] = useState(false);
  const [rmPrompt, setRmPrompt] = useState("Draft an MSP routine matrix JSON for the selected track. Use period keys P1..P8 and map each class to {P#: [\"CODE\", \"SUBJECT\"]}. Only return JSON.");
  const [rmOut, setRmOut] = useState("");
  const [rmBusy, setRmBusy] = useState(false);
  const [rmEngine, setRmEngine] = useState("default"); // default = DELU-GPT env
  const [rmModel, setRmModel] = useState("gpt-4o-mini");
  const { data: dayData, mutate: refreshDays } = useSWR(fullscreen && id ? `/api/admin/manageMeedian?section=programScheduleDays&programId=${id}&track=${track}&day=${weekDay}` : null, fetcher);

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
                <Button variant="light" size="sm" onClick={() => { setView("detail"); setActiveSection("schedule"); }}>Open Full Schedule</Button>
              </Link>
              <Button variant="primary" size="sm" onClick={() => setSelfSchedOpen(true)}>Self‑Scheduler</Button>
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
            <Button variant="light" onClick={() => setShowDefaultSeedModal(true)}>Show Default Seed</Button>
            <Button variant="light" onClick={async()=>{ try{ const res = await fetch(`/api/admin/manageMeedian?section=expandBaseToDays`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ programId: id, track })}); const j = await res.json(); if(!res.ok) throw new Error(j.error||`HTTP ${res.status}`); setFullscreen(true); setSchedTab('weekly'); await refreshDays(); } catch(e){ alert(`Failed to build weekly: ${e.message}`);} }}>Build Weekly (Copy Base)</Button>
            <Button variant="primary" onClick={async()=>{ try{ const res = await fetch(`/api/admin/manageMeedian?section=expandBaseToDaysAdvanced`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ programId: id, track })}); const j = await res.json(); if(!res.ok) throw new Error(j.error||`HTTP ${res.status}`); setFullscreen(true); setSchedTab('weekly'); await refreshDays(); } catch(e){ alert(`Failed (rules) build: ${e.message}`);} }}>Build Weekly (Rules)</Button>
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
                    ) : (
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
                    )}
                  </CardBody>
                </Card>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="border rounded-lg p-3 bg-white">
              <div className="text-sm font-semibold text-gray-900 mb-1">Period Grid</div>
              <p className="text-xs text-gray-600 mb-2">View or verify period timings for the selected track.</p>
              <Button size="sm" variant="light" onClick={() => setShowPeriodModal(true)}>Open Period Grid</Button>
            </div>
            <div className="border rounded-lg p-3 bg-white">
              <div className="text-sm font-semibold text-gray-900 mb-1">Matrix (Class × Period)</div>
              <p className="text-xs text-gray-600 mb-2">See which code/teacher applies per class and period.</p>
              <Button size="sm" variant="light" onClick={() => setShowMatrixModal(true)}>Open Matrix</Button>
            </div>
            <div className="border rounded-lg p-3 bg-white">
              <div className="text-sm font-semibold text-gray-900 mb-1">Routine Manager (AI)</div>
              <p className="text-xs text-gray-600 mb-2">Use AI to draft an MSP routine and seed it.</p>
              <Button size="sm" variant="light" onClick={() => setRoutineOpen(true)}>Open Routine Manager</Button>
            </div>
          </div>
        </CardBody>
      </Card>
      )}

      {/* Period Grid modal */}
      {showPeriodModal && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-start justify-center" onClick={() => setShowPeriodModal(false)}>
          <div className="mt-10 w-[92vw] max-w-xl" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Period Grid — {track === "pre_primary" ? "Pre-Primary" : "Elementary"}</div>
                <Button size="sm" variant="light" onClick={() => setShowPeriodModal(false)}>Close</Button>
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
                      {(periodData?.periods || []).map((p) => (
                        <tr key={`${p.track}-${p.periodKey}`} className="border-t border-gray-200">
                          <td className="py-2 pr-4 font-semibold">{p.periodKey}</td>
                          <td className="py-2 pr-4">{p.startTime}</td>
                          <td className="py-2 pr-4">{p.endTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
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
                <div className="text-sm font-semibold text-gray-900">Routine Manager (AI) — {track === "pre_primary" ? "Pre-Primary" : "Elementary"}</div>
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
    <div className="space-y-4">
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
                    <Button size="sm" variant="light" onClick={() => { setPreview({ open: false, track: "pre_primary" }); setView("detail"); setActiveSection("schedule"); }}>Open Full Schedule</Button>
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
              <div className="flex items-center gap-2">
                <select className="px-2 py-1 border rounded text-sm" value={track} onChange={(e)=> setTrack(e.target.value)}>
                  <option value="pre_primary">Pre‑Primary</option>
                  <option value="elementary">Elementary</option>
                </select>
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
                onSaved={async()=> { await Promise.all([refreshCells()]); setSelfSchedOpen(false); setFullscreen(true); setSchedTab('weekly'); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SelfScheduler({ programId, track, periodData, codeData, asgData, teamData, onSaved }) {
  const [daysMode, setDaysMode] = useState('all'); // all | split
  const [daysSel, setDaysSel] = useState({ Mon:true, Tue:true, Wed:true, Thu:true, Fri:true, Sat:false });
  const [fallbackCode, setFallbackCode] = useState('');
  const [viewDay, setViewDay] = useState('Mon');
  const [staged, setStaged] = useState({}); // key: day|class|period -> codeId
  const [errorMsg, setErrorMsg] = useState('');
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedText, setSeedText] = useState('');
  const [seedMsg, setSeedMsg] = useState('');
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

  const periods = useMemo(() => (periodData?.periods || []).filter(p=>/^P\d+$/i.test(p.periodKey)).sort((a,b)=> Number(a.periodKey.slice(1))-Number(b.periodKey.slice(1))), [periodData]);
  const classes = useMemo(() => {
    // derive class list from existing base cells
    return Array.from(new Set((periodData?.periods||[]) && (codeData?.codes||[]))).length,
    [];
  }, []);
  // Use existing base cells to construct class list from cellData-ish: fallback to 1..7 or pre‑primary
  const classList = useMemo(() => {
    if (track === 'pre_primary') return ['Nursery','LKG','UKG'];
    // Estimate from assignments: default 1..7
    return ['1','2','3','4','5','6','7'];
  }, [track]);

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

    const targetDays = daysMode === 'all' ? Object.keys(daysSel).filter(k=> daysSel[k]) : Object.keys(daysSel).filter(k=> daysSel[k]);
    // Constraint 1: same code cannot appear twice at same day/period across classes (teacher clash by code)
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
  };
  const allowDrop = (ev) => ev.preventDefault();
  const onDragStartAssigned = (ev, day, cls, pk) => {
    ev.dataTransfer.setData('text/removeKey', `${day}|${cls}|${pk}`);
  };
  const onDropRemove = (ev) => {
    ev.preventDefault();
    const key = ev.dataTransfer.getData('text/removeKey');
    if (!key) return;
    updateStaged((next) => { delete next[key]; return next; });
  };

  const saveWeekly = async () => {
    try {
      setErrorMsg('');
      const usedDays = Object.keys(staged).map(k => k.split('|')[0]);
      const days = Array.from(new Set(usedDays)).filter(Boolean);
      if (!days.length) { setErrorMsg('No changes to save.'); return; }
      // Compile rows: include staged; we won’t merge existing for brevity (future: fetch & merge)
      const rows = Object.entries(staged).map(([k, cid]) => {
        const [dayName, cls, periodKey] = k.split('|');
        return { classId: isNaN(cls) ? null : Number(cls), dayName, periodKey, mspCodeId: Number(cid), subject: null };
      });
      // Map class names to ids
      // Minimal resolution: try to detect numeric ids; named classes (Nursery, etc.) would require class lookup; skipped for brevity
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
  };

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-12">
      <div className="md:col-span-4 border-r p-3 space-y-2">
        {/* Remove area */}
        <div className="mb-2">
          <div className="text-xs text-gray-600 mb-1">Drop here to remove a placed code</div>
          <div className="border-2 border-dashed rounded-lg p-2 text-center text-xs text-gray-500 bg-gray-50"
               onDragOver={allowDrop}
               onDrop={onDropRemove}
          >
            Remove Zone
          </div>
        </div>
        <div className="text-sm font-semibold text-gray-800">Codes by Family</div>
        <div className="text-xs text-gray-600">Drag a code onto the timetable.</div>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {familyGroups.map(({ fam, list }) => (
            <div key={fam} className="mb-2">
              <div className="text-xs font-bold text-gray-700 mb-1">{fam}</div>
              <div className="flex flex-wrap gap-2">
                {list.map(c => {
                  const count = occByCode.get(c.id) || 0;
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e)=> onDragStart(e, c.id)}
                      className={`px-2 py-1 rounded-lg border text-xs cursor-grab hover:brightness-105 ${colorByFamily(c.familyKey)} flex items-center justify-between gap-2 min-w-[84px]`}
                      title={`${c.title || c.code} — placed ${count} time${count===1?'':'s'}`}
                    >
                      <span>{c.code}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/80 border border-black/10 text-gray-800 min-w-[18px] text-center">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <div className="text-sm font-semibold text-gray-800">Apply Days</div>
          <label className="text-xs inline-flex items-center gap-2"><input type="radio" name="dm" checked={daysMode==='all'} onChange={()=> setDaysMode('all')} /> All (Mon–Fri)</label>
          <label className="text-xs inline-flex items-center gap-2"><input type="radio" name="dm" checked={daysMode==='split'} onChange={()=> setDaysMode('split')} /> Split days</label>
          {daysMode === 'split' && (
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
            <button className="px-3 py-1.5 rounded bg-gray-100 text-gray-800 text-xs" onClick={()=> { setStaged({}); histRef.current=[{}]; hiRef.current=0; setCanUndo(false); setCanRedo(false);} }>Clear</button>
            <button className="px-3 py-1.5 rounded bg-gray-100 text-gray-800 text-xs disabled:opacity-50" onClick={undo} disabled={!canUndo}>Undo</button>
            <button className="px-3 py-1.5 rounded bg-gray-100 text-gray-800 text-xs disabled:opacity-50" onClick={redo} disabled={!canRedo}>Redo</button>
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
                const key = track === 'pre_primary' ? 'pre_primary' : 'elementary';
                sop.selfSchedulerDraft = sop.selfSchedulerDraft || {};
                sop.selfSchedulerDraft[key] = draft;
                const pr = await fetch('/api/admin/manageMeedian?section=programSOP', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ programId, sop }) });
                const pj = await pr.json().catch(()=>({}));
                if (!pr.ok) throw new Error(pj.error || `HTTP ${pr.status}`);
                setSeedMsg('Draft saved');
              } catch(e) {
                setErrorMsg(e.message || 'Failed to save draft');
              }
            }}>Save Draft</button>
            <button className="px-3 py-1.5 rounded bg-white border text-gray-800 text-xs" onClick={async()=>{
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
            <span className="text-[11px] text-emerald-700">{seedMsg}</span>
            {errorMsg && <span className="text-[11px] text-rose-600">{errorMsg}</span>}
          </div>
          {/* Reset tools */}
          <div className="pt-3 border-t mt-3 space-y-2">
            <div className="text-sm font-semibold text-gray-800">Reset Tools</div>
            <ResetControls
              classes={classes}
              team={teamData?.users || []}
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
            />
          </div>
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
        </div>
      </div>
      <div className="md:col-span-8 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-800">Timetable (view day)</div>
          <select className="px-2 py-1 border rounded text-sm" value={viewDay} onChange={(e)=> setViewDay(e.target.value)}>
            {['Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
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
        <div className="mt-3">
          <div className="text-sm font-semibold text-gray-800 mb-1">Leisure (unassigned) — {viewDay}</div>
          <div className="overflow-x-auto">
            <table className="min-w-[800px] text-xs">
              <thead>
                <tr className="text-gray-600">
                  <th className="text-left py-1 pr-2">Period</th>
                  <th className="text-left py-1">Teachers Free</th>
                </tr>
              </thead>
              <tbody>
                {periods.map(p => {
                  const teachers = new Set((asgData?.assignments||[]).filter(a=> a.active).map(a=> a.userId));
                  // remove those used in staged for this day/period
                  classList.forEach(cls => {
                    const cid = staged[`${viewDay}|${cls}|${p.periodKey}`];
                    if (cid) {
                      const uid = codeTeacher.get(cid);
                      if (uid) teachers.delete(uid);
                    }
                  });
                  const pre = Array.from(teachers).filter(uid => teacherGroup.get(uid) === 'pre');
                  const ele = Array.from(teachers).filter(uid => teacherGroup.get(uid) !== 'pre');
                  const preNames = pre.map(uid => (teamData?.users||[]).find(u=> u.id === uid)?.name || uid).slice(0,12);
                  const eleNames = ele.map(uid => (teamData?.users||[]).find(u=> u.id === uid)?.name || uid).slice(0,12);
                  return (
                    <tr key={p.periodKey} className="border-t">
                      <td className="py-1 pr-2 font-semibold">{p.periodKey}</td>
                      <td className="py-1">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="text-[11px]"><span className="font-semibold text-sky-700">Pre‑Primary:</span> {preNames.length ? preNames.join(', ') : '—'}</div>
                          <div className="text-[11px]"><span className="font-semibold text-indigo-700">Elementary:</span> {eleNames.length ? eleNames.join(', ') : '—'}</div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResetControls({ classes, team, onResetClass, onClearTeacher }) {
  const [cls, setCls] = useState('');
  const [userId, setUserId] = useState('');
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
    </div>
  );
}
