"use client";
import { useState, useRef, useMemo } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function MeedCommunityPage() {
  const { data: session } = useSession();
  const { data, mutate } = useSWR("/api/community/posts", fetcher);
  const { data: usersData } = useSWR("/api/member/users", fetcher);
  const posts = data?.posts || [];
  const users = Array.isArray(usersData?.users) ? usersData.users : [];
  const usersById = useMemo(() => users.reduce((acc, u) => { acc[Number(u.id)] = u; return acc; }, {}), [users]);
  const [openComments, setOpenComments] = useState({}); // {postId: true}
  const [commentText, setCommentText] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState([]); // { title, file, preview, mimeType }
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);

  const onPickFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    const next = picked.map((f) => ({ title: f.name, file: f, preview: URL.createObjectURL(f), mimeType: f.type || "" }));
    setFiles((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const onDropFiles = (e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []);
    const next = dropped.map((f) => ({ title: f.name, file: f, preview: URL.createObjectURL(f), mimeType: f.type || "" }));
    setFiles((prev) => [...prev, ...next]);
  };
  const onDragOver = (e) => e.preventDefault();
  const removeFile = (i) => setFiles((a) => a.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!title.trim()) return alert("Title required");
    setSaving(true);
    try {
      const attachments = await Promise.all(
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
          const reader = new FileReader();
          const p = new Promise((resolve) => { reader.onload = () => resolve({ title: f.title, url: reader.result, mimeType: f.mimeType }); });
          reader.readAsDataURL(f.file);
          return p;
        })
      );
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: null, attachments }),
      });
      if (!res.ok) throw new Error("Failed to post");
      setTitle("");
      setFiles([]);
      setShowModal(false);
      mutate();
    } catch (e) {
      alert(e.message || "Failed to post");
    } finally { setSaving(false); }
  };

  const fmtRel = (dt) => {
    try { const d = new Date(dt); const s=(Date.now()-d.getTime())/1000; if(s<60) return "just now"; if(s<3600) return `${Math.floor(s/60)}m ago`; if(s<86400) return `${Math.floor(s/3600)}h ago`; return d.toLocaleString(); } catch { return String(dt); }
  };

  const REACTIONS = [
    { key: 'like', label: '👍' },
    { key: 'heart', label: '❤️' },
    { key: 'fire', label: '🔥' },
    { key: 'clap', label: '👏' },
    { key: 'party', label: '🎉' },
  ];

  const Card = ({ p }) => {
    const a = (p.attachments && p.attachments[0]) || null;
    const isImg = a && String(a.mimeType||"").startsWith("image/");
    const isPdf = a && String(a.mimeType||"").includes("pdf");
    return (
      <div className="rounded-2xl border bg-white overflow-hidden shadow hover:shadow-md transition">
        <div className="flex items-center gap-2 p-3">
          <img src={(usersById[p.userId]?.image) || "/default-avatar.png"} alt="avatar" className="w-7 h-7 rounded-full border object-cover" />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-gray-900 truncate">{usersById[p.userId]?.name || "Meedian"}</div>
            <div className="text-[11px] text-gray-500">{fmtRel(p.createdAt)}</div>
          </div>
        </div>
        {a ? (
          <div className="w-full aspect-[4/3] bg-gray-50 flex items-center justify-center">
            {isImg ? <img src={a.url} alt={a.title||""} className="w-full h-full object-cover" /> : (isPdf ? <div className="text-gray-600">PDF</div> : <div className="text-gray-600">File</div>)}
          </div>
        ) : (
          <div className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center text-gray-500">No media</div>
        )}
        <div className="p-3">
          <div className="text-sm font-semibold text-gray-900 truncate" title={p.title || "Untitled"}>{p.title || "Untitled"}</div>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 flex-wrap">
            {REACTIONS.map(({ key, label }) => {
              const count = p.reactions?.counts?.[key] || 0;
              const yours = (p.reactions?.yours || []).includes(key);
              return (
                <button key={key}
                  className={`px-2 py-1 rounded-lg border ${yours? 'bg-emerald-50 border-emerald-200 text-emerald-700':'hover:bg-gray-50'}`}
                  onClick={async ()=>{ await fetch('/api/community/reactions',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ postId: p.id, type: key, action: yours? 'unlike':'like' })}); mutate(); }}>
                  {label} {count}
                </button>
              );
            })}
            <button className="ml-2 px-2 py-1 rounded-lg border hover:bg-gray-50" onClick={async ()=>{ const key = String(p.id); if (!openComments[key]) { const r = await fetch(`/api/community/comments?postId=${p.id}`); if (r.ok) { const j = await r.json(); setOpenComments((prev)=>({...prev, [key]: j.comments || []})); } } else { setOpenComments((prev)=>{ const cp = {...prev}; delete cp[key]; return cp; }); } }}>
              💬 {p.commentsCount || 0}
            </button>
          </div>
          {openComments[String(p.id)] && (
            <div className="mt-3 space-y-2">
              <div className="space-y-2 max-h-56 overflow-auto">
                {openComments[String(p.id)].map((c)=> (
                  <div key={c.id} className="flex items-start gap-2">
                    <img src={c.image || '/default-avatar.png'} className="w-6 h-6 rounded-full border" />
                    <div className="bg-gray-50 border rounded-xl px-3 py-1.5">
                      <div className="text-[11px] font-semibold">{c.name || 'User'}</div>
                      <div className="text-xs text-gray-800 whitespace-pre-wrap">{c.content}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input className="flex-1 border rounded-lg px-3 py-1.5 text-sm" placeholder="Write a comment" value={commentText} onChange={(e)=>setCommentText(e.target.value)} />
                <button className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs" onClick={async ()=>{ if(!commentText.trim()) return; const res = await fetch('/api/community/comments',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ postId: p.id, content: commentText.trim() })}); if(res.ok){ setCommentText(''); const r = await fetch(`/api/community/comments?postId=${p.id}`); const j = await r.json(); setOpenComments((prev)=>({...prev, [String(p.id)]: j.comments || []})); mutate(); } }}>
                  Post
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Meed Community</h1>
          <p className="text-sm text-gray-600">A school-wide feed — post anything.</p>
        </div>
        <button className="px-3 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700" onClick={() => setShowModal(true)}>Create Post</button>
      </div>

      {posts.length ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {posts.map((p) => (<Card key={p.id} p={p} />))}
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">No posts yet.</div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-2xl bg-white rounded-2xl border shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold text-gray-900">New Community Post</div>
              <button className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200" onClick={() => setShowModal(false)}>Close</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Title</label>
                <input className="w-full border rounded-lg px-3 py-2" placeholder="What's happening?" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-600">Upload Files</div>
                <div onDrop={onDropFiles} onDragOver={onDragOver} className="border-2 border-dashed rounded-2xl p-4 text-center bg-gray-50 hover:bg-gray-100 transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
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
                <button disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700" onClick={submit}>{saving ? "Posting..." : "Post"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
