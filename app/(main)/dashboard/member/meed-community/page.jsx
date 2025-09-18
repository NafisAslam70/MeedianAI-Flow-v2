"use client";
import { useState, useRef, useMemo } from "react";
import { Plus } from "lucide-react";
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

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState([]); // { title, file, preview, mimeType }
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  // Full post viewer state
  const [viewerPost, setViewerPost] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerComments, setViewerComments] = useState([]);
  const [viewerCommentText, setViewerCommentText] = useState("");

  const openViewer = async (p) => {
    setViewerPost(p);
    setViewerIndex(0);
    try {
      const r = await fetch(`/api/community/comments?postId=${p.id}`);
      const j = await r.json();
      setViewerComments(Array.isArray(j?.comments) ? j.comments : []);
    } catch {
      setViewerComments([]);
    }
  };
  const closeViewer = () => { setViewerPost(null); setViewerComments([]); setViewerIndex(0); setViewerCommentText(""); };

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
    const commentRef = useRef(null);
    const attachments = Array.isArray(p.attachments) ? p.attachments : [];
    const hero = attachments[0] || null;
    const commentKey = String(p.id);
    const comments = openComments[commentKey] || null;

    const toggleComments = async () => {
      if (!openComments[commentKey]) {
        const r = await fetch(`/api/community/comments?postId=${p.id}`);
        if (r.ok) {
          const j = await r.json();
          setOpenComments((prev) => ({ ...prev, [commentKey]: j.comments || [] }));
        }
      } else {
        setOpenComments((prev) => {
          const next = { ...prev };
          delete next[commentKey];
          return next;
        });
      }
    };

    const submitInlineComment = async () => {
      const input = commentRef.current;
      const txt = input?.value?.trim();
      if (!txt) return;
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: p.id, content: txt }),
      });
      if (res.ok) {
        if (input) input.value = '';
        const refreshed = await fetch(`/api/community/comments?postId=${p.id}`);
        const j = await refreshed.json();
        setOpenComments((prev) => ({ ...prev, [commentKey]: j.comments || [] }));
        mutate();
      }
    };

    const handleReaction = async (key, yours) => {
      await fetch('/api/community/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: p.id, type: key, action: yours ? 'unlike' : 'like' }),
      });
      mutate();
    };

    return (
      <article className="group flex flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm transition hover:shadow-md focus-within:ring-2 focus-within:ring-teal-200">
        <header className="flex items-center gap-3 px-4 py-3">
          <img
            src={(usersById[p.userId]?.image) || "/default-avatar.png"}
            alt="avatar"
            className="h-9 w-9 rounded-full border object-cover"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-900">{usersById[p.userId]?.name || "Meedian"}</div>
            <div className="text-xs text-gray-500">{fmtRel(p.createdAt)}</div>
          </div>
        </header>

        {hero && (
          <button
            type="button"
            onClick={() => openViewer(p)}
            className="relative w-full overflow-hidden"
          >
            {String(hero.mimeType || "").startsWith('image/') ? (
              <img src={hero.url} alt={hero.title || ''} className="h-56 w-full object-cover transition duration-300 group-hover:scale-[1.01]" />
            ) : (
              <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
                {String(hero.mimeType || '').includes('pdf') ? 'PDF Attachment' : 'Attachment'}
              </div>
            )}
            {attachments.length > 1 && (
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                +{attachments.length - 1} more
              </span>
            )}
          </button>
        )}

        <div className="flex flex-col gap-4 px-4 pb-4">
          {p.title && <h3 className="text-base font-semibold text-gray-900">{p.title}</h3>}
          {p.content && <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{p.content}</p>}

          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            {REACTIONS.map(({ key, label }) => {
              const count = p.reactions?.counts?.[key] || 0;
              const yours = (p.reactions?.yours || []).includes(key);
              return (
                <button
                  key={key}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    yours ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => handleReaction(key, yours)}
                >
                  {label}
                  <span className="text-[11px] text-gray-500">{count}</span>
                </button>
              );
            })}
            <button
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              onClick={toggleComments}
            >
              💬
              <span>{p.commentsCount || 0}</span>
            </button>
          </div>

          <div className="text-xs font-semibold text-teal-600/80">
            <button type="button" className="hover:underline" onClick={() => openViewer(p)}>
              View details
            </button>
          </div>

          {comments && (
            <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/70 px-3 py-3">
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <div className="text-xs text-gray-500">Be the first to comment.</div>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2">
                      <img src={c.image || '/default-avatar.png'} className="h-6 w-6 rounded-full border object-cover" alt="avatar" />
                      <div className="rounded-2xl bg-white px-3 py-1.5 text-xs shadow-sm">
                        <div className="font-semibold text-gray-900">{c.name || 'User'}</div>
                        <div className="text-gray-700 whitespace-pre-wrap">{c.content}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={commentRef}
                  className="flex-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  placeholder="Write a comment"
                />
                <button
                  className="rounded-full bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-white"
                  onClick={submitInlineComment}
                >
                  Post
                </button>
              </div>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="relative mx-auto w-full max-w-5xl px-3 pb-24 sm:pb-8 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-gray-900">Meed Community</h1>
          <p className="text-sm text-gray-600">Share quick updates, wins, and announcements with everyone.</p>
        </div>
        <div className="w-full sm:w-auto">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
            onClick={() => setShowModal(true)}
          >
            <Plus className="h-4 w-4" />
            New Post
          </button>
        </div>
      </div>

      {posts.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((p) => (<Card key={p.id} p={p} />))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white/80 p-6 text-center text-sm text-gray-600">
          Be the first to post in the community.
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-t-3xl bg-white shadow-2xl transition sm:max-w-2xl sm:rounded-3xl sm:border sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900">New Community Post</h2>
                <p className="text-xs text-gray-500">Share a quick update or attach supporting files.</p>
              </div>
              <button className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-0 sm:py-4 space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Title</label>
                <input
                  className="w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  placeholder="What's happening?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Attachments</div>
                <div
                  onDrop={onDropFiles}
                  onDragOver={onDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-teal-200 bg-teal-50/40 px-4 py-8 text-center text-sm text-teal-700 transition hover:border-teal-300 hover:bg-teal-50"
                >
                  <span className="font-medium">Drag & drop files</span>
                  <span className="text-xs text-teal-600/80">or tap to browse images, PDFs, or docs</span>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPickFiles} />
                </div>
                {files.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
                        {String(f.mimeType).startsWith("image/") ? (
                          <img src={f.preview} alt={f.title} className="h-16 w-16 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-500">
                            {f.mimeType || "file"}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-gray-800" title={f.title}>{f.title}</div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                            <span>{(f.file.size / 1024).toFixed(1)} KB</span>
                            <button className="font-semibold text-rose-600" onClick={() => removeFile(i)}>Remove</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400"
                  onClick={submit}
                >
                  {saving ? "Posting…" : "Publish Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Post Viewer */}
      {viewerPost && (
        <div
          className="fixed inset-0 z-[70] flex h-full w-full items-stretch bg-black/60 backdrop-blur-sm"
          onClick={closeViewer}
        >
          <div
            className="relative flex h-full w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:mx-auto sm:h-auto sm:max-w-4xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="View post"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <img src={(usersById[viewerPost.userId]?.image) || "/default-avatar.png"} alt="avatar" className="w-8 h-8 rounded-full object-cover border" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{usersById[viewerPost.userId]?.name || "Meedian"}</div>
                  <div className="text-[11px] text-gray-500">{fmtRel(viewerPost.createdAt)}</div>
                </div>
              </div>
              <button className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200" onClick={closeViewer} aria-label="Close">Close</button>
            </div>
            <div className="grid h-full flex-1 overflow-y-auto md:grid-cols-2">
              <div className="flex min-h-[40vh] items-center justify-center bg-gray-50">
                {Array.isArray(viewerPost.attachments) && viewerPost.attachments.length > 0 ? (
                  (() => {
                    const att = viewerPost.attachments[Math.max(0, Math.min(viewerIndex, viewerPost.attachments.length - 1))];
                    const isImg = String(att.mimeType||"").startsWith("image/");
                    const isPdf = String(att.mimeType||"").includes("pdf");
                    return (
                      <div className="relative w-full">
                        {isImg ? (
                          <img src={att.url} alt={att.title||""} className="w-full max-h-[70vh] object-contain bg-black" />
                        ) : (
                          <div className="flex h-[60vh] w-full items-center justify-center bg-gray-100 text-gray-600">{isPdf ? 'PDF' : 'File'}</div>
                        )}
                        {viewerPost.attachments.length > 1 && (
                          <>
                            <button onClick={() => setViewerIndex((i)=> Math.max(0, i-1))} className="absolute left-3 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white">‹</button>
                            <button onClick={() => setViewerIndex((i)=> Math.min(viewerPost.attachments.length-1, i+1))} className="absolute right-3 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white">›</button>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                              {viewerPost.attachments.map((_, idx) => (
                                <span key={idx} className={`w-2 h-2 rounded-full ${idx===viewerIndex? 'bg-white' : 'bg-white/50'}`} />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="w-full h-[60vh] flex items-center justify-center text-gray-500">No media</div>
                )}
              </div>
              <div className="space-y-4 border-t border-gray-100 p-4 md:border-t-0 md:border-l">
                <div className="text-base font-semibold text-gray-900">{viewerPost.title || 'Untitled'}</div>
                {viewerPost.content && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewerPost.content}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                  {REACTIONS.map(({ key, label }) => {
                    const count = viewerPost.reactions?.counts?.[key] || 0;
                    const yours = (viewerPost.reactions?.yours || []).includes(key);
                    return (
                      <button key={key} className={`px-2 py-1 rounded-lg border ${yours ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50'}`}
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/community/reactions', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ postId: viewerPost.id, type: key })});
                            if (res.ok) { mutate(); /* refetch posts */ }
                          } catch {}
                        }}
                      >{label} <span className="ml-1 text-xs text-gray-500">{count}</span></button>
                    );
                  })}
                </div>
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-gray-800">Comments</div>
                  <div className="max-h-60 space-y-2 overflow-y-auto">
                    {viewerComments.length === 0 ? (
                      <div className="text-xs text-gray-500">No comments yet.</div>
                    ) : (
                      viewerComments.map((c) => (
                        <div key={c.id} className="flex items-start gap-2">
                          <img src={(usersById[c.userId]?.image) || '/default-avatar.png'} alt="avatar" className="w-6 h-6 rounded-full object-cover border" />
                          <div className="bg-gray-50 rounded-lg px-2 py-1 border">
                            <div className="text-xs font-semibold text-gray-900">{usersById[c.userId]?.name || 'User'}</div>
                            <div className="text-xs text-gray-800 whitespace-pre-wrap">{c.content}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200" placeholder="Write a comment" value={viewerCommentText} onChange={(e)=>setViewerCommentText(e.target.value)} />
                    <button className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white" onClick={async ()=>{ if(!viewerCommentText.trim()) return; const res = await fetch('/api/community/comments',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ postId: viewerPost.id, content: viewerCommentText.trim() })}); if(res.ok){ setViewerCommentText(''); const r = await fetch(`/api/community/comments?postId=${viewerPost.id}`); const j = await r.json(); setViewerComments(Array.isArray(j?.comments)? j.comments: []); mutate(); } }}>
                      Post
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        className="fixed bottom-20 right-4 z-[55] flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg transition hover:bg-teal-700 sm:hidden"
        onClick={() => setShowModal(true)}
        aria-label="Create post"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
