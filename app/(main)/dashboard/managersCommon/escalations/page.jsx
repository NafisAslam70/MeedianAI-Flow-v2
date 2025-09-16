"use client";
import { useState } from "react";
import { Mic } from "lucide-react";
import useSWR from "swr";

const fetcher = (u) => fetch(u).then((r) => r.json());

export default function EscalationsPage() {
  const [tab, setTab] = useState("new");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [l1, setL1] = useState("");
  const [l2, setL2] = useState("");
  const [members, setMembers] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const { data: forYou } = useSWR(tab === "forYou" ? "/api/managersCommon/escalations?section=forYou" : null, fetcher);
  const { data: mine } = useSWR(tab === "mine" ? "/api/managersCommon/escalations?section=raisedByMe" : null, fetcher);
  const { data: openAll } = useSWR(tab === "openAll" ? "/api/managersCommon/escalations?section=allOpen" : null, fetcher);
  const { data: closedAll } = useSWR(tab === "closedAll" ? "/api/managersCommon/escalations?section=allClosed" : null, fetcher);
  const { data: usersData } = useSWR("/api/managersCommon/users", fetcher);
  const { data: studentsData } = useSWR("/api/managersCommon/students", fetcher);
  const { data: counts } = useSWR("/api/managersCommon/escalations?section=counts", fetcher);
  const users = usersData?.users || [];
  const students = studentsData?.students || [];
  const assignableUsers = users.filter((u) => u.role === 'admin' || u.role === 'team_manager');
  const [openDetailId, setOpenDetailId] = useState(null);
  const { data: detail } = useSWR(openDetailId ? `/api/managersCommon/escalations?section=detail&id=${openDetailId}` : null, fetcher);
  const [progressNote, setProgressNote] = useState("");
  const [showTimeline, setShowTimeline] = useState(true);
  const [useMembers, setUseMembers] = useState(true);
  const [useStudents, setUseStudents] = useState(false);
  const [studentIds, setStudentIds] = useState([]);

  const [actionModal, setActionModal] = useState(null); // { type: 'escalate'|'close', id }
  const [modalL2, setModalL2] = useState("");
  const [modalNote, setModalNote] = useState("");
  const [query, setQuery] = useState("");

  const BasicList = ({ rows, actions = false, variant = 'default' }) => (
    <div className="space-y-3">
      {((rows || []).filter(m => {
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return String(m.id).includes(q) || (m.title||'').toLowerCase().includes(q);
      })).map((m) => (
        <div
          key={m.id}
          className={`p-3 border rounded-lg cursor-pointer ${variant==='closed' || m.status==='CLOSED' ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}
          onClick={()=>{ setOpenDetailId(m.id); setErr(""); setMsg(""); }}
        >
          <div className="flex items-center justify-between">
            <div className={`font-semibold ${variant==='closed' || m.status==='CLOSED' ? 'text-black' : 'text-gray-800'}`}>{m.title}</div>
            <div className={`text-xs px-2 py-0.5 rounded border border-gray-300 ${variant==='closed' || m.status==='CLOSED' ? 'text-black' : 'text-gray-700'}`}>{m.status} L{m.level}</div>
          </div>
          <div className={`text-xs ${variant==='closed' || m.status==='CLOSED' ? 'text-black' : 'text-gray-500'}`}>#{m.id} • {new Date(m.createdAt).toLocaleString()}</div>
          {(variant==='closed' || m.status==='CLOSED') && (
            <div className="mt-2 text-sm">
              <div className="text-red-700 font-medium">Closing lines</div>
              <div className="text-red-800">{m.closeNote?.trim() ? m.closeNote : '—'}</div>
            </div>
          )}
          {actions && (
            <div className="mt-2 flex gap-2">
              {m.level === 1 && (
                <button
                  className="px-3 py-1 rounded border"
                  onClick={() => { setActionModal({ type: 'escalate', id: m.id }); setModalL2(""); setModalNote(""); }}
                >Escalate to L2</button>
              )}
              <button
                className="px-3 py-1 rounded bg-teal-600 text-white"
                onClick={() => { setActionModal({ type: 'close', id: m.id }); setModalNote(""); }}
              >Close</button>
            </div>
          )}
        </div>
      ))}
      {(!rows || rows.length === 0) && <div className="text-sm text-gray-500">No items</div>}
    </div>
  );

  const create = async () => {
    setMsg(""); setErr("");
    try {
      const involvedUserIds = useMembers ? members.map((id) => parseInt(id)).filter(Boolean) : [];
      const involvedStudentIds = useStudents ? studentIds.map((id) => parseInt(id)).filter(Boolean) : [];
      const res = await fetch("/api/managersCommon/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, l1AssigneeId: parseInt(l1), suggestedLevel2Id: l2 ? parseInt(l2) : null, involvedUserIds, involvedStudentIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setMsg(`Created matter #${data.id}`);
      setTitle(""); setDescription(""); setL1(""); setL2(""); setMembers([]); setStudentIds([]); setUseStudents(false); setUseMembers(true);
      setTab("forYou");
    } catch (e) { setErr(e.message); }
  };

  const startVoiceForDescription = () => {
    setErr("");
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setErr("Speech recognition not supported in this browser");
      setTimeout(()=>setErr(""), 3000);
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US"; // English only
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsRecording(true);
    recognition.start();
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setDescription((prev) => (prev ? prev + " " + transcript : transcript));
      setIsRecording(false);
    };
    recognition.onerror = (event) => {
      setErr(`Voice error: ${event.error}`);
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Escalations</h1>
        <div className="hidden md:flex gap-2">
          <div className="rounded-xl border bg-white px-3 py-2 shadow-sm">
            <div className="text-xs text-gray-500">For You (Open)</div>
            <div className="text-xl font-bold text-teal-700">{counts?.forYouCount ?? '—'}</div>
          </div>
          {counts?.openTotalCount != null && (
            <div className="rounded-xl border bg-white px-3 py-2 shadow-sm">
              <div className="text-xs text-gray-500">All Open</div>
              <div className="text-xl font-bold text-gray-900">{counts?.openTotalCount}</div>
            </div>
          )}
        </div>
      </div>
      {msg && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-md">{msg}</div>}
      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-md">{err}</div>}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="inline-flex gap-2">
          <button className={`px-3 py-1.5 text-sm rounded-md border ${tab==='new'?'bg-teal-600 text-white border-teal-600 shadow-sm':'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'}`} onClick={()=>setTab('new')}>New</button>
          <button className={`px-3 py-1.5 text-sm rounded-md border ${tab==='forYou'?'bg-teal-600 text-white border-teal-600 shadow-sm':'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'}`} onClick={()=>setTab('forYou')}>For You</button>
          <button className={`px-3 py-1.5 text-sm rounded-md border ${tab==='mine'?'bg-teal-600 text-white border-teal-600 shadow-sm':'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'}`} onClick={()=>setTab('mine')}>Raised by Me</button>
          <button className={`px-3 py-1.5 text-sm rounded-md border ${tab==='openAll'?'bg-teal-600 text-white border-teal-600 shadow-sm':'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'}`} onClick={()=>setTab('openAll')}>Open (All)</button>
          <button className={`px-3 py-1.5 text-sm rounded-md border ${tab==='closedAll'?'bg-teal-600 text-white border-teal-600 shadow-sm':'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'}`} onClick={()=>setTab('closedAll')}>Closed (All)</button>
        </div>
        <div className="md:ml-auto flex items-center gap-2">
          <input
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
            placeholder="Search title or #id"
            className="border rounded-lg px-3 py-1.5 text-sm w-[220px]"
          />
        </div>
      </div>

      {tab === 'new' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Title</label>
            <input value={title} onChange={(e)=>setTitle(e.target.value)} className="mt-1 w-full p-2 border rounded" placeholder="Matter title" />
          </div>
          <div>
            <label className="text-sm">Level-1 Assignee</label>
            <select value={l1} onChange={(e)=>setL1(e.target.value)} className="mt-1 w-full p-2 border rounded bg-white">
              <option value="">Select user…</option>
              {assignableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm flex items-center gap-2">Description
              <button type="button" onClick={startVoiceForDescription} className={`ml-2 px-2 py-1 rounded border ${isRecording? 'bg-red-50 border-red-300 text-red-700':'bg-white border-gray-300 text-gray-700'}`} title="Speak to fill">
                <Mic className="w-4 h-4 inline" /> {isRecording ? 'Listening…' : 'Voice'}
              </button>
            </label>
            <textarea value={description} onChange={(e)=>setDescription(e.target.value)} className="mt-1 w-full p-2 border rounded" rows={4} placeholder="Say or type the details" />
          </div>
          <div>
            <label className="text-sm">Suggested L2 Assignee</label>
            <select value={l2} onChange={(e)=>setL2(e.target.value)} className="mt-1 w-full p-2 border rounded bg-white">
              <option value="">(optional)</option>
              {assignableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm">Involved:</span>
              <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={useMembers} onChange={(e)=>setUseMembers(e.target.checked)} /> Team Members</label>
              <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={useStudents} onChange={(e)=>setUseStudents(e.target.checked)} /> Students</label>
            </div>
            {useMembers && (
              <div className="mb-3">
                <label className="text-sm">Team Members</label>
                <div className="mt-1 border rounded p-2">
                  <input className="border rounded px-2 py-1 text-xs w-full mb-2" placeholder="Search members"
                    onChange={(e)=>{
                      const s = e.target.value.toLowerCase();
                      const ids = users.filter(u => u.name.toLowerCase().includes(s) || (u.role||'').toLowerCase().includes(s)).map(u=>String(u.id));
                      // no-op: search filters list below by CSS hidden; keep simple selection list
                      const list = document.getElementById('members-list');
                      if (list) {
                        Array.from(list.querySelectorAll('[data-name]')).forEach(el => {
                          const ok = el.getAttribute('data-name').includes(s);
                          el.style.display = ok ? '' : 'none';
                        });
                      }
                    }} />
                  <div id="members-list" className="max-h-48 overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {users.map(u => (
                      <label key={u.id} data-name={`${u.name.toLowerCase()} ${String(u.role||'').toLowerCase()}`} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-gray-50">
                        <input type="checkbox" checked={members.includes(String(u.id))||members.includes(u.id)} onChange={()=> setMembers(prev => prev.includes(String(u.id))||prev.includes(u.id) ? prev.filter(x => String(x)!==String(u.id)) : [...prev, String(u.id)])} />
                        <span className="truncate"><span className="font-medium">{u.name}</span> <span className="text-xs text-gray-500">— {u.role}</span></span>
                      </label>
                    ))}
                    {users.length===0 && <div className="text-xs text-gray-500 px-2">No members</div>}
                  </div>
                </div>
              </div>
            )}
            {useStudents && (
              <div>
                <label className="text-sm">Students</label>
                <div className="mt-1 border rounded p-2">
                  <input className="border rounded px-2 py-1 text-xs w-full mb-2" placeholder="Search students"
                    onChange={(e)=>{
                      const s = e.target.value.toLowerCase();
                      const list = document.getElementById('students-list');
                      if (list) {
                        Array.from(list.querySelectorAll('[data-name]')).forEach(el => {
                          const ok = el.getAttribute('data-name').includes(s);
                          el.style.display = ok ? '' : 'none';
                        });
                      }
                    }} />
                  <div id="students-list" className="max-h-48 overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {students.map(s => (
                      <label key={s.id} data-name={`${(s.name||'').toLowerCase()} ${(s.className||'').toLowerCase()}`} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-gray-50">
                        <input type="checkbox" checked={studentIds.includes(String(s.id))||studentIds.includes(s.id)} onChange={()=> setStudentIds(prev => prev.includes(String(s.id))||prev.includes(s.id) ? prev.filter(x => String(x)!==String(s.id)) : [...prev, String(s.id)])} />
                        <span className="truncate"><span className="font-medium">{s.name}</span> {s.className ? <span className="text-xs text-gray-500">— {s.className}</span> : null}</span>
                      </label>
                    ))}
                    {students.length===0 && <div className="text-xs text-gray-500 px-2">No students found or unauthorized</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <button onClick={create} className="px-4 py-2 rounded bg-teal-600 text-white">Create</button>
          </div>
        </div>
      )}

      {tab === 'forYou' && <BasicList rows={forYou?.matters} actions />}
      {tab === 'mine' && <BasicList rows={mine?.matters} />}
      {tab === 'openAll' && <BasicList rows={openAll?.matters} actions={false} variant="open" />}
      {tab === 'closedAll' && <BasicList rows={closedAll?.matters} actions={false} variant="closed" />}
      {openDetailId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={()=>setOpenDetailId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl md:max-w-[55vw] max-h-[80vh] overflow-auto" onClick={(e)=>e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-gray-800">{detail?.matter?.title || 'Matter'}</div>
                <div className="text-xs text-gray-500">Status: {detail?.matter?.status} • Level {detail?.matter?.level} • #{detail?.matter?.id}</div>
              </div>
              <button className="px-3 py-1 rounded border" onClick={()=>setOpenDetailId(null)}>Close</button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                {/* Description */}
                <div className="mb-4 p-3 border rounded bg-white">
                  <div className="font-semibold mb-1">Description</div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {detail?.matter?.description?.trim() ? detail.matter.description : <span className="text-gray-500">No description provided</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">Timeline</div>
                  <button
                    className="text-xs px-2 py-0.5 rounded border bg-white hover:bg-gray-50"
                    onClick={() => setShowTimeline((v) => !v)}
                  >
                    {showTimeline ? 'Hide' : `Show (${detail?.steps?.length || 0})`}
                  </button>
                </div>
                {showTimeline ? (
                  <div className="space-y-2">
                    {(detail?.steps||[]).map((s,idx)=> (
                      <div key={idx} className="p-2 border rounded bg-gray-50">
                        <div className="text-xs text-gray-600">{new Date(s.createdAt).toLocaleString()}</div>
                        <div className="text-sm">
                          <span className="font-semibold">{s.action}</span>
                          {s.fromUserName ? <span> by {s.fromUserName}</span> : null}
                          {s.toUserName && s.action !== 'CLOSE' ? <span> → {s.toUserName}</span> : null}
                          {s.note ? <span> — {s.note}</span> : null}
                        </div>
                      </div>
                    ))}
                    {(!detail?.steps || detail.steps.length===0) && <div className="text-sm text-gray-500">No steps yet</div>}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">Timeline hidden</div>
                )}
              </div>
              <div className="md:col-span-1">
                <div className="font-semibold mb-2">Members Involved</div>
                <div className="space-y-1">
                  {(detail?.members||[]).map((m,idx)=> (
                    <div key={idx} className="text-sm text-gray-700">{m.userName || `User #${m.userId}`}</div>
                  ))}
                  {(!detail?.members || detail.members.length===0) && <div className="text-sm text-gray-500">None</div>}
                </div>
                <div className="font-semibold mt-4 mb-2">Students Involved</div>
                <div className="space-y-1">
                  {(detail?.studentMembers||[]).map((s,idx)=> (
                    <div key={idx} className="text-sm text-gray-700">{s.name || `Student #${s.studentId}`}{s.className ? ` — ${s.className}` : ''}</div>
                  ))}
                  {(!detail?.studentMembers || detail.studentMembers.length===0) && <div className="text-sm text-gray-500">None</div>}
                </div>
                <div className="mt-4">
                  <div className="font-semibold mb-1">Add Progress</div>
                  <textarea value={progressNote} onChange={(e)=>setProgressNote(e.target.value)} className="w-full p-2 border rounded" rows={4} placeholder="Add an update for this matter" />
                  <div className="mt-2 flex gap-2">
                    <button className="px-3 py-1 rounded bg-teal-600 text-white" onClick={async ()=>{
                      if (!progressNote.trim()) return;
                      setErr(''); setMsg('');
                      try {
                        const res = await fetch('/api/managersCommon/escalations?section=progress', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: openDetailId, note: progressNote.trim() }) });
                        const d = await res.json();
                        if (!res.ok) throw new Error(d.error || `Failed (${res.status})`);
                        setProgressNote('');
                        // simple reload of detail
                        location.reload();
                      } catch(e){ setErr(e.message); }
                    }}>Add Update</button>
                    <button className="px-3 py-1 rounded border" onClick={()=>setProgressNote('')}>Clear</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {actionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={()=>setActionModal(null)}>
          <div className="bg-white rounded-2xl border shadow-xl w-full max-w-md p-4" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-base font-semibold text-gray-900">{actionModal.type==='escalate' ? 'Escalate to L2' : 'Close Escalation'}</div>
              <button className="text-sm text-gray-500" onClick={()=>setActionModal(null)}>✕</button>
            </div>
            {actionModal.type==='escalate' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-sm">L2 Assignee (user id)</label>
                  <input value={modalL2} onChange={(e)=>setModalL2(e.target.value)} className="mt-1 w-full p-2 border rounded" placeholder="Enter user id" />
                </div>
                <div className="flex justify-end gap-2">
                  <button className="px-3 py-1.5 rounded border" onClick={()=>setActionModal(null)}>Cancel</button>
                  <button className="px-3 py-1.5 rounded bg-teal-600 text-white" onClick={async ()=>{
                    setErr(''); setMsg('');
                    try {
                      const res = await fetch('/api/managersCommon/escalations?section=escalate', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: actionModal.id, l2AssigneeId: parseInt(modalL2) }) });
                      const d = await res.json();
                      if (!res.ok) throw new Error(d.error || `Failed (${res.status})`);
                      setMsg(`Escalated #${actionModal.id} to L2`);
                      setActionModal(null);
                    } catch(e) { setErr(e.message); }
                  }}>Escalate</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm">Closing note</label>
                  <textarea value={modalNote} onChange={(e)=>setModalNote(e.target.value)} className="mt-1 w-full p-2 border rounded" rows={4} placeholder="Why is this closed?" />
                </div>
                <div className="flex justify-end gap-2">
                  <button className="px-3 py-1.5 rounded border" onClick={()=>setActionModal(null)}>Cancel</button>
                  <button className="px-3 py-1.5 rounded bg-red-600 text-white" onClick={async ()=>{
                    if (!modalNote.trim()) { setErr('Close note required'); return; }
                    setErr(''); setMsg('');
                    try {
                      const res = await fetch('/api/managersCommon/escalations?section=close', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: actionModal.id, note: modalNote.trim() }) });
                      const d = await res.json();
                      if (!res.ok) throw new Error(d.error || `Failed (${res.status})`);
                      setMsg(`Closed #${actionModal.id}`);
                      setActionModal(null);
                    } catch(e) { setErr(e.message); }
                  }}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
