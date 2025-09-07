"use client";
import { useState, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function MeedRepoPage() {
  const { data: session } = useSession();
  const isManager = session?.user?.role === "admin" || session?.user?.role === "team_manager";
  const [statusFilter, setStatusFilter] = useState("submitted"); // submitted | approved | rejected | archived | all
  const [viewAll, setViewAll] = useState(false);
  const listUrl = (() => {
    const params = new URLSearchParams();
    if (!(isManager && viewAll)) params.set("mine", "1");
    if (statusFilter !== "all") params.set("status", statusFilter);
    return `/api/member/meed-repo?${params.toString()}`;
  })();
  const { data, mutate } = useSWR(listUrl, fetcher);
  const { data: usersData } = useSWR("/api/member/users", fetcher);
  const posts = data?.posts || [];
  const users = Array.isArray(usersData?.users) ? usersData.users : [];
  const usersById = useMemo(() => users.reduce((acc, u) => { acc[Number(u.id)] = u; return acc; }, {}), [users]);
  // Managers for reviewer selection
  const { data: teamData } = useSWR(`/api/admin/manageMeedian?section=team`, fetcher);
  const managers = useMemo(() => (teamData?.users || []).filter((u) => u.role === 'admin' || u.role === 'team_manager'), [teamData]);
  // My tasks today for optional linking
  const todayStr = new Date().toISOString().slice(0,10);
  const { data: myTasksData } = useSWR(session?.user?.id ? `/api/member/assignedTasks?action=tasks&date=${todayStr}` : null, fetcher);
  const myTasks = myTasksData?.tasks || [];

  const [title, setTitle] = useState("");
  // Minimal: no content/tags/URL attachments
  const [files, setFiles] = useState([]); // { title, file, preview, mimeType }
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [linkTask, setLinkTask] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedVerifier, setSelectedVerifier] = useState("");
  const [purpose, setPurpose] = useState("submitted");

  const removeFile = (i) => setFiles((a) => a.filter((_, idx) => idx !== i));

  const onPickFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    const next = picked.map((f) => ({ title: f.name, file: f, preview: URL.createObjectURL(f), mimeType: f.type || "" }));
    setFiles((prev) => [...prev, ...next]);
    // Reset input to allow re-picking same files
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const onDropFiles = (e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []);
    const next = dropped.map((f) => ({ title: f.name, file: f, preview: URL.createObjectURL(f), mimeType: f.type || "" }));
    setFiles((prev) => [...prev, ...next]);
  };
  const onDragOver = (e) => e.preventDefault();

  const submitWithStatus = async (desiredStatus = 'submitted') => {
    if (!title.trim()) return alert("Title required");
    setSaving(true);
    try {
      // Try to upload files to storage via our upload API; fallback to data URLs if upload fails
      const fileDataUrls = await Promise.all(
        files.map(async (f) => {
          try {
            const fd = new FormData();
            fd.set("file", f.file, f.title || "file");
            fd.set("title", f.title || "file");
            const r = await fetch("/api/uploads/meed-repo", { method: "POST", body: fd });
            if (r.ok) {
              const j = await r.json();
              return { title: j.title || f.title, url: j.url, mimeType: j.mimeType || f.mimeType };
            }
          } catch {}
          // fallback to data URL
          const reader = new FileReader();
          const p = new Promise((resolve) => {
            reader.onload = () => resolve({ title: f.title, url: reader.result, mimeType: f.mimeType });
          });
          reader.readAsDataURL(f.file);
          return p;
        })
      );

      const tags = [];
      if (selectedVerifier) tags.push({ reviewerId: Number(selectedVerifier) });
      const payload = {
        title: title.trim(),
        content: null,
        tags,
        attachments: fileDataUrls,
        status: desiredStatus,
        ...(linkTask && selectedTaskId ? { taskId: Number(selectedTaskId) } : {}),
      };
      const res = await fetch("/api/member/meed-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setTitle("");
      setFiles([]);
      mutate();
      alert("Submitted for verification");
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to submit");
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id) => {
    try {
      const res = await fetch("/api/member/meed-repo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "archive" }),
      });
      if (!res.ok) throw new Error("Failed to archive");
      mutate();
    } catch (e) {
      alert(e.message || "Archive failed");
    }
  };

  // filtered list comes from API with params
  const filteredPosts = posts;

  const fmtRel = (dt) => {
    try {
      const d = new Date(dt);
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return "just now";
      if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
      return d.toLocaleString();
    } catch { return String(dt); }
  };

  const chipCls = (status) => {
    const base = "text-xs px-2 py-1 rounded-full border capitalize";
    if (status === "submitted") return `${base} bg-amber-50 border-amber-200 text-amber-700`;
    if (status === "approved") return `${base} bg-emerald-50 border-emerald-200 text-emerald-700`;
    if (status === "rejected") return `${base} bg-rose-50 border-rose-200 text-rose-700`;
    if (status === "archived") return `${base} bg-gray-50 border-gray-200 text-gray-600`;
    return `${base} bg-gray-50 border-gray-200 text-gray-700`;
  };

  const PreviewTile = ({ a }) => {
    const isImg = String(a.mimeType||"").startsWith("image/");
    const isPdf = String(a.mimeType||"").includes("pdf");
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border bg-white overflow-hidden shadow-sm hover:shadow transition">
        <div className="w-full h-28 flex items-center justify-center bg-gray-50">
          {isImg ? (
            <img src={a.url} alt={a.title||"attachment"} className="w-full h-full object-cover" />
          ) : isPdf ? (
            <div className="flex flex-col items-center text-xs text-gray-600">
              <span className="font-semibold mb-1">PDF</span>
              <span className="truncate px-2">{a.title || 'Open'}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center text-xs text-gray-600">
              <span className="font-semibold mb-1">File</span>
              <span className="truncate px-2">{a.title || 'Open'}</span>
            </div>
          )}
        </div>
        <div className="p-2 border-t text-xs">
          <div className="truncate" title={a.title || a.url}>{a.title || a.url}</div>
        </div>
      </a>
    );
  };

  // Detail viewer state
  const [detailOpen, setDetailOpen] = useState(false);
  const [activePost, setActivePost] = useState(null);
  const openDetail = (post) => { setActivePost(post); setDetailOpen(true); };
  const closeDetail = () => { setDetailOpen(false); setActivePost(null); };

  const Tile = ({ p }) => {
    const a = (p.attachments && p.attachments[0]) || null;
    const isImg = a && String(a.mimeType||"").startsWith("image/");
    const isPdf = a && String(a.mimeType||"").includes("pdf");
    return (
      <button onClick={() => openDetail(p)} className="text-left rounded-2xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition focus:outline-none">
        <div className="relative">
          <div className="absolute top-2 left-2 text-[11px] px-2 py-0.5 rounded-full bg-white/90 border font-semibold">{p.status}</div>
          {p.taskId && (<div className="absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded-full bg-white/90 border">Task #{p.taskId}</div>)}
          <div className="w-full aspect-[4/3] bg-gray-50 flex items-center justify-center">
            {a ? (
              isImg ? <img src={a.url} alt={a.title||""} className="w-full h-full object-cover" /> : (isPdf ? <span className="text-gray-600 text-xs">PDF</span> : <span className="text-gray-600 text-xs">File</span>)
            ) : (
              <span className="text-gray-400 text-xs">No media</span>
            )}
          </div>
        </div>
        <div className="p-2">
          <div className="text-sm font-semibold text-gray-900 truncate" title={p.title}>{p.title}</div>
          <div className="mt-1 text-[11px] text-gray-600 truncate">By {usersById[p.userId]?.name || 'User'} • {fmtRel(p.createdAt)}</div>
        </div>
      </button>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Meed Repo</h1>
          <p className="text-sm text-gray-600">Your posts in a modern gallery.</p>
        </div>
      <div className="flex items-center gap-2">
        {isManager && (
          <label className="text-xs text-gray-700 inline-flex items-center gap-2">
            <input type="checkbox" checked={viewAll} onChange={(e) => { setViewAll(e.target.checked); }} />
            View All
          </label>
        )}
        {isManager && (
          <button className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 border border-amber-200" onClick={() => { setViewAll(true); setStatusFilter('submitted'); }}>
            To Verify
          </button>
        )}
        <div className="flex items-center gap-1 text-xs bg-white border px-2 py-1 rounded-xl">
            {["submitted","approved","rejected","archived","all"].map((k) => (
              <button key={k} className={`px-2 py-1 rounded-lg ${statusFilter===k?"bg-gray-900 text-white":"hover:bg-gray-100"}`} onClick={() => setStatusFilter(k)}>
                {k}
              </button>
            ))}
          </div>
          <button className="px-3 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700" onClick={() => setShowModal(true)}>
            Post in Repo
          </button>
        </div>
      </div>
      {filteredPosts.length ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredPosts.map((p) => (
            <Tile key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">No posts found.</div>
      )}

      {/* Submission modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-2xl bg-white rounded-2xl border shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold text-gray-900">New Post</div>
              <button className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200" onClick={() => setShowModal(false)}>Close</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Title</label>
                <input className="w-full border rounded-lg px-3 py-2" placeholder="Give your post a title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Purpose</label>
                <div className="flex gap-3 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="purpose" defaultChecked value="submitted" onChange={() => { /* status set in submit */ }} />
                    For Verification
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="purpose" value="approved" onChange={() => { /* handled in submit */ }} />
                    Just Share
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                    <input type="checkbox" onChange={(e)=> window.__linkTask = e.target.checked} /> Link to a task
                  </label>
                  {myTasks.length > 0 && (
                    <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" onChange={(e)=> window.__selectedTaskId = e.target.value} defaultValue="">
                      <option value="">Select a task…</option>
                      {myTasks.map((t)=> (<option key={t.id} value={t.id}>{t.title || `Task #${t.id}`}</option>))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Select Verifier</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" onChange={(e)=> window.__selectedVerifier = e.target.value} defaultValue="">
                    <option value="">(Any manager)</option>
                    {managers.map((m)=> (<option key={m.id} value={m.id}>{m.name} ({m.role === 'admin' ? 'Admin' : 'Manager'})</option>))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-600">Upload Files</div>
                <div
                  onDrop={onDropFiles}
                  onDragOver={onDragOver}
                  className="border-2 border-dashed rounded-2xl p-4 text-center bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-sm text-gray-700">Drag & drop files here, or click to browse</div>
                  <div className="text-xs text-gray-500">Images, PDFs, docs</div>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPickFiles} />
                </div>
                {files.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {files.map((f, i) => (
                      <div key={i} className="rounded-xl border bg-white overflow-hidden shadow-sm">
                        {String(f.mimeType).startsWith("image/") ? (
                          <img src={f.preview} alt={f.title} className="w-full h-24 object-cover" />
                        ) : (
                          <div className="w-full h-24 flex items-center justify-center bg-gray-100 text-xs text-gray-600">{f.mimeType || "file"}</div>
                        )}
                        <div className="p-2 border-t text-xs">
                          <div className="truncate" title={f.title}>{f.title}</div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-gray-500">{(f.file.size/1024).toFixed(1)} KB</span>
                            <button className="text-[10px] text-red-600" onClick={() => removeFile(i)}>Remove</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700" onClick={async () => {
                  // Set status from selected radio
                  const form = document.querySelector('input[name="purpose"]:checked');
                  const val = form?.value || 'submitted';
                  // Capture optional linking + reviewer
                  const link = !!window.__linkTask;
                  const selTask = window.__selectedTaskId || '';
                  const selVer = window.__selectedVerifier || '';
                  // Pass through helper state before submit
                  if (link) {
                    // mutate local state to include task
                  }
                  // Temporarily stash via closures
                  // Wrap submit: mutate function reads title/files only; we overload via globals
                  const old = { linkTask: window.___lt, selectedTaskId: window.___stid, selectedVerifier: window.___ver };
                  window.___lt = link; window.___stid = selTask; window.___ver = selVer;
                  await submitWithStatus(val);
                  window.___lt = old.linkTask; window.___stid = old.selectedTaskId; window.___ver = old.selectedVerifier;
                  setShowModal(false);
                }}>
                  {saving ? "Submitting..." : "Submit for Verification"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail viewer modal */}
      {detailOpen && activePost && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" onClick={closeDetail}>
          <div className="w-full max-w-4xl bg-white rounded-2xl border shadow-2xl overflow-hidden" onClick={(e)=> e.stopPropagation()}>
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-2 min-w-0">
                <img src={(usersById[activePost.userId]?.image)||'/default-avatar.png'} alt="avatar" className="w-8 h-8 rounded-full border object-cover" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{usersById[activePost.userId]?.name || 'User'}</div>
                  <div className="text-[11px] text-gray-500">{fmtRel(activePost.createdAt)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={chipCls(activePost.status)}>{activePost.status}</div>
                {activePost.taskId && (<div className="text-[11px] px-2 py-1 rounded-full border bg-gray-50 text-gray-700">Task #{activePost.taskId}</div>)}
                <button className="px-2 py-1 rounded bg-gray-100" onClick={closeDetail}>Close</button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-0">
              <div className="bg-gray-50 min-h-[50vh] flex items-center justify-center">
                {Array.isArray(activePost.attachments) && activePost.attachments.length ? (
                  <div className="w-full h-full p-2 grid grid-cols-2 gap-2">
                    {activePost.attachments.map((a, i)=> (
                      <a key={(a.id||a.url)+i} href={a.url} target="_blank" rel="noopener" className="rounded-xl overflow-hidden border bg-white flex items-center justify-center">
                        {String(a.mimeType||"").startsWith('image/') ? (
                          <img src={a.url} alt={a.title||''} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-xs text-gray-600 p-4">{a.title || 'Open file'}</div>
                        )}
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">No attachments</div>
                )}
              </div>
              <div className="p-3 space-y-3">
                <div className="text-base font-semibold text-gray-900">{activePost.title}</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{activePost.content || ''}</div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  {(Array.isArray(activePost.tags)?activePost.tags:[]).find(t=>t.reviewerId) && (
                    <span>Reviewer: {usersById[(Array.isArray(activePost.tags)?activePost.tags:[]).find(t=>t.reviewerId)?.reviewerId]?.name || (Array.isArray(activePost.tags)?activePost.tags:[]).find(t=>t.reviewerId)?.reviewerId}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                    {activePost.status === 'submitted' && (session?.user?.role === 'admin' || session?.user?.role === 'team_manager') && (
                      <>
                        <button className="text-xs px-2 py-1 rounded bg-emerald-600 text-white" onClick={async()=>{ const res = await fetch('/api/member/meed-repo', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: activePost.id, action: 'approve' })}); if(res.ok){ mutate(); closeDetail(); } }}>
                          Approve
                        </button>
                        <button className="text-xs px-2 py-1 rounded bg-rose-600 text-white" onClick={async()=>{ const note = prompt('Reason (optional)'); const res = await fetch('/api/member/meed-repo', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: activePost.id, action: 'reject', tags: note ? [{ reviewNote: note }] : undefined })}); if(res.ok){ mutate(); closeDetail(); } }}>
                          Reject
                        </button>
                      </>
                    )}
                    {activePost.status !== 'archived' && (
                      <button className="text-xs text-gray-700 underline" onClick={async()=>{ await archive(activePost.id); closeDetail(); }}>Archive</button>
                    )}
                  </div>
                </div>
                {/* Review comments */}
                <div className="mt-3">
                  <div className="text-sm font-semibold text-gray-800 mb-1">Review Comments</div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {(Array.isArray(activePost.tags)?activePost.tags:[]).filter(t=>t.reviewNote).map((t,i)=> (
                      <div key={i} className="p-2 bg-gray-50 rounded border text-xs text-gray-800">
                        <span className="font-semibold mr-1">{usersById[t.by]?.name || 'Reviewer'}:</span>
                        {t.reviewNote}
                        <span className="ml-2 text-[10px] text-gray-500">{t.at ? new Date(t.at).toLocaleString() : ''}</span>
                      </div>
                    ))}
                    {!(Array.isArray(activePost.tags)?activePost.tags:[]).some(t=>t.reviewNote) && (
                      <div className="text-xs text-gray-500">No comments yet.</div>
                    )}
                  </div>
                  {(session?.user?.role === 'admin' || session?.user?.role === 'team_manager') && (
                    <div className="mt-2 flex items-center gap-2">
                      <input id="__repo_comment" className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Add a comment" />
                      <button className="text-xs px-2 py-1 rounded bg-gray-900 text-white" onClick={async()=>{
                        const input = document.getElementById('__repo_comment');
                        const note = input?.value?.trim(); if(!note) return;
                        const tags = Array.isArray(activePost.tags)? [...activePost.tags] : [];
                        tags.push({ reviewNote: note, by: Number(session?.user?.id), at: new Date().toISOString() });
                        const res = await fetch('/api/member/meed-repo', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: activePost.id, tags })});
                        if(res.ok){ input.value=''; mutate(); }
                      }}>Post</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
