"use client";
import { useState, useRef } from "react";
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
  const posts = data?.posts || [];

  const [title, setTitle] = useState("");
  // Minimal: no content/tags/URL attachments
  const [files, setFiles] = useState([]); // { title, file, preview, mimeType }
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  // Minimal: no task linking in submit form
  const [showModal, setShowModal] = useState(false);

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

      const payload = {
        title: title.trim(),
        content: null,
        tags: [],
        attachments: fileDataUrls,
        status: desiredStatus,
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

  const PostCard = ({ p }) => (
    <div className="p-4 space-y-3 border-b last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <img src={session?.user?.image || "/default-avatar.png"} alt="avatar" className="w-9 h-9 rounded-full border" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{session?.user?.name || "You"}</div>
            <div className="text-[11px] text-gray-500">{fmtRel(p.createdAt)}</div>
          </div>
        </div>
        <div className={chipCls(p.status)}>{p.status}</div>
      </div>
      <div className="text-sm font-semibold text-gray-900">{p.title}</div>
      {Array.isArray(p.attachments) && p.attachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {p.attachments.slice(0,4).map((a, idx) => (
            <div key={(a.id||a.url)+idx} className="relative">
              <PreviewTile a={a} />
              {idx===3 && p.attachments.length>4 && (
                <div className="absolute inset-0 bg-black/50 text-white text-sm font-semibold rounded-xl flex items-center justify-center">
                  +{p.attachments.length-4} more
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
      {p.status !== "archived" && (
        <div>
          <button className="text-xs text-gray-700 underline" onClick={() => archive(p.id)}>Move to Archive</button>
        </div>
      )}
    </div>
  );

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
            <PostCard key={p.id} p={p} />
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
                  // Monkey patch payload by temporarily storing desired
                  await submitWithStatus(val);
                  setShowModal(false);
                }}>
                  {saving ? "Submitting..." : "Submit for Verification"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
