"use client";
import { useMemo, useState, useEffect } from "react";
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
  const [manageCodesOpen, setManageCodesOpen] = useState(false);
  const [dragMemberId, setDragMemberId] = useState(null);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [showDefaultSeedModal, setShowDefaultSeedModal] = useState(false);
  const [mspRMode, setMspRMode] = useState("class"); // class | teacher
  const [selectedTeacher, setSelectedTeacher] = useState("ALL");
  const [routineOpen, setRoutineOpen] = useState(false);
  const [rmPrompt, setRmPrompt] = useState("Draft an MSP routine matrix JSON for the selected track. Use period keys P1..P8 and map each class to {P#: [\"CODE\", \"SUBJECT\"]}. Only return JSON.");
  const [rmOut, setRmOut] = useState("");
  const [rmBusy, setRmBusy] = useState(false);
  const [rmEngine, setRmEngine] = useState("default"); // default = DELU-GPT env
  const [rmModel, setRmModel] = useState("gpt-4o-mini");

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
    return Object.keys(m).length ? m : { "1": { P1: ["ESLC1","English"] } };
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
                        <div className="text-xs text-gray-600 mb-1">Paste matrix JSON (e.g. {"{"}"1":{"{"}P1:["ESLC1","English"]{"}"}{"}"})</div>
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
                      placeholder={`{\n  "1": { "P1": ["ESLC1", "English"] }\n}`}
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
              <select className="px-2 py-1 border rounded text-sm" value={track} onChange={(e) => setTrack(e.target.value)}>
                <option value="pre_primary">Pre-Primary</option>
                <option value="elementary">Elementary</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} /> Show teacher names
              </label>
              <Button variant="light" onClick={() => setFullscreen(false)}>Close</Button>
            </div>
          </div>
          <div className="flex-1 bg-white overflow-auto p-3">
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
                          <th key={p.periodKey} className="border px-3 py-2 text-center">{p.periodKey}<div className="text-[11px] text-gray-500">{p.startTime?.slice?.(0,5)}–{p.endTime?.slice?.(0,5)}</div></th>
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
                      "1": { P1: ["EHO1","Hin"],   P2: ["EMS1","Sci"],  P3: ["EUA1","Arb"],  P4: ["ESLC1","English"], P5: ["EHO2(2)","GK"],   P6: ["EUA1","U/QT"], P7: ["EMS1","Math"], P8: ["ESLC2(1)","S.St"] },
                      "2": { P1: ["ESLC2(2)","S.St"], P2: ["EHO1","Hin"],  P3: ["EMS1","Sci"],  P4: ["EUA2","Arb"],     P5: ["ESLC1","English"], P6: ["EHO2(1)","Computer"], P7: ["EUA1","U/QT"], P8: ["EMS2","Math"] },
                      "3": { P1: ["EMS2","Math"], P2: ["ESLC2(1)","S.St"], P3: ["EHO1","Hin"],  P4: ["EHO2(2)","GK"],   P5: ["EMS2","Sci"],     P6: ["ESLC1","English"], P7: ["EUA2","Arb"], P8: ["EUA1","U/QT"] },
                      "4": { P1: ["EUA1","U/QT"], P2: ["EMS2","Math"], P3: ["ESLC2(2)","S.St"], P4: ["EHO1","Hin"],  P5: ["EUA2","Arb"],     P6: ["EMS1","Sci"],     P7: ["ESLC1","English"], P8: ["EHO2(1)","Computer"] },
                      "5": { P1: ["EMS1","Sci"], P2: ["EUA1","U/QT"], P3: ["EMS2","Math"], P4: ["ESLC2(1)","S.St"], P5: ["EHO1","Hin"],  P6: ["EUA2","Arb"],     P7: ["EHO2(2)","GK"],   P8: ["ESLC1","English"] },
                      "6": { P1: ["ESLC1","English"], P2: ["EHO2(1)","Computer"], P3: ["EUA2","U/QT"], P4: ["EMS2","Math"], P5: ["ESLC2(2)","S.St"], P6: ["EHO1","Hin"], P7: ["EMS2","Sci"], P8: ["EUA2","Arb"] },
                      "7": { P1: ["EUA2","Arb"], P2: ["ESLC1","English"], P3: ["EHO2(2)","GK"], P4: ["EUA1","U/QT"], P5: ["EMS1","Math"], P6: ["ESLC2(1)","S.St"], P7: ["EHO1","Hin"], P8: ["EMS1","Sci"] },
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
    </div>
  );
}
