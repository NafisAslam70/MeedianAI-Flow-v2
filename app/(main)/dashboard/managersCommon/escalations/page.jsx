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
  const { data: all } = useSWR(tab === "all" ? "/api/managersCommon/escalations?section=all" : null, fetcher);
  const { data: usersData } = useSWR("/api/managersCommon/users", fetcher);
  const users = usersData?.users || [];
  const assignableUsers = users.filter((u) => u.role === 'admin' || u.role === 'team_manager');
  const [openDetailId, setOpenDetailId] = useState(null);
  const { data: detail } = useSWR(openDetailId ? `/api/managersCommon/escalations?section=detail&id=${openDetailId}` : null, fetcher);
  const [progressNote, setProgressNote] = useState("");

  const BasicList = ({ rows, actions = false }) => (
    <div className="space-y-3">
      {(rows || []).map((m) => (
        <div key={m.id} className="p-3 bg-white border border-gray-200 rounded-lg cursor-pointer" onClick={()=>{ setOpenDetailId(m.id); setErr(""); setMsg(""); }}>
          <div className="flex items-center justify-between">
            <div className="font-semibold text-gray-800">{m.title}</div>
            <div className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-700">{m.status} L{m.level}</div>
          </div>
          <div className="text-xs text-gray-500">#{m.id} • {new Date(m.createdAt).toLocaleString()}</div>
          {actions && (
            <div className="mt-2 flex gap-2">
              {m.level === 1 && (
                <button
                  className="px-3 py-1 rounded border"
                  onClick={async () => {
                    const l2AssigneeId = prompt("Level-2 assignee userId?") || "";
                    if (!l2AssigneeId) return;
                    setErr(""); setMsg("");
                    try {
                      const res = await fetch('/api/managersCommon/escalations?section=escalate', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, l2AssigneeId: parseInt(l2AssigneeId) }) });
                      const d = await res.json();
                      if (!res.ok) throw new Error(d.error || `Failed (${res.status})`);
                      setMsg(`Escalated #${m.id} to L2`);
                    } catch (e) { setErr(e.message); }
                  }}
                >Escalate to L2</button>
              )}
              <button
                className="px-3 py-1 rounded bg-teal-600 text-white"
                onClick={async () => {
                  const note = prompt("Close note (required)") || "";
                  if (!note) return;
                  setErr(""); setMsg("");
                  try {
                    const res = await fetch('/api/managersCommon/escalations?section=close', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, note }) });
                    const d = await res.json();
                    if (!res.ok) throw new Error(d.error || `Failed (${res.status})`);
                    setMsg(`Closed #${m.id}`);
                  } catch (e) { setErr(e.message); }
                }}
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
      const involvedUserIds = members.map((id) => parseInt(id)).filter(Boolean);
      const res = await fetch("/api/managersCommon/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, l1AssigneeId: parseInt(l1), suggestedLevel2Id: l2 ? parseInt(l2) : null, involvedUserIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setMsg(`Created matter #${data.id}`);
      setTitle(""); setDescription(""); setL1(""); setL2(""); setMembers([]);
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
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Escalations</h1>
      {msg && <div className="text-sm text-emerald-600">{msg}</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
      <div className="flex gap-2">
        <button className={`px-3 py-1 rounded ${tab==='new'?'bg-teal-600 text-white':'bg-white border'}`} onClick={()=>setTab('new')}>New</button>
        <button className={`px-3 py-1 rounded ${tab==='forYou'?'bg-teal-600 text-white':'bg-white border'}`} onClick={()=>setTab('forYou')}>For You</button>
        <button className={`px-3 py-1 rounded ${tab==='mine'?'bg-teal-600 text-white':'bg-white border'}`} onClick={()=>setTab('mine')}>Raised by Me</button>
        <button className={`px-3 py-1 rounded ${tab==='all'?'bg-teal-600 text-white':'bg-white border'}`} onClick={()=>setTab('all')}>All (Admin)</button>
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
          <div>
            <label className="text-sm">Members Involved</label>
            <select multiple value={members.map(String)} onChange={(e)=> setMembers(Array.from(e.target.selectedOptions, o=>o.value))} className="mt-1 w-full p-2 border rounded bg-white h-40">
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
          </div>
          <div className="md:col-span-2">
            <button onClick={create} className="px-4 py-2 rounded bg-teal-600 text-white">Create</button>
          </div>
        </div>
      )}

      {tab === 'forYou' && <BasicList rows={forYou?.matters} actions />}
      {tab === 'mine' && <BasicList rows={mine?.matters} />}
      {tab === 'all' && <BasicList rows={all?.matters} />}
      {openDetailId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={()=>setOpenDetailId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-auto" onClick={(e)=>e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-gray-800">{detail?.matter?.title || 'Matter'}</div>
                <div className="text-xs text-gray-500">Status: {detail?.matter?.status} • Level {detail?.matter?.level} • #{detail?.matter?.id}</div>
              </div>
              <button className="px-3 py-1 rounded border" onClick={()=>setOpenDetailId(null)}>Close</button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="font-semibold mb-2">Timeline</div>
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
              </div>
              <div className="md:col-span-1">
                <div className="font-semibold mb-2">Members Involved</div>
                <div className="space-y-1">
                  {(detail?.members||[]).map((m,idx)=> (
                    <div key={idx} className="text-sm text-gray-700">{m.userName || `User #${m.userId}`}</div>
                  ))}
                  {(!detail?.members || detail.members.length===0) && <div className="text-sm text-gray-500">None</div>}
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
    </div>
  );
}
