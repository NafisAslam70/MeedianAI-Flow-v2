"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => res.json());

const createPreviewEntry = (file) => {
  const preview = URL.createObjectURL(file);
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return {
    id,
    file,
    title: file.name,
    preview,
    mimeType: file.type || "",
  };
};

const formatDate = (value) => {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(value);
  }
};

export default function CommunityPushPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAllowed = role === "admin" || role === "team_manager";

  const { data: postsData, mutate: mutatePosts } = useSWR(
    isAllowed ? "/api/community/posts" : null,
    fetcher,
    { dedupingInterval: 20000 }
  );
  const { data: usersData } = useSWR(isAllowed ? "/api/member/users" : null, fetcher, {
    dedupingInterval: 60000,
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef(null);

  const usersById = useMemo(() => {
    const map = {};
    if (Array.isArray(usersData?.users)) {
      for (const user of usersData.users) {
        map[Number(user.id)] = user;
      }
    }
    return map;
  }, [usersData]);

  const posts = postsData?.posts || [];

  useEffect(() => {
    return () => {
      files.forEach((entry) => {
        if (entry.preview) URL.revokeObjectURL(entry.preview);
      });
    };
  }, [files]);

  const attachFiles = (fileList) => {
    if (!fileList?.length) return;
    const additions = Array.from(fileList).map(createPreviewEntry);
    setFiles((prev) => [...prev, ...additions]);
    setError("");
  };

  const handleFilePick = (event) => {
    attachFiles(event.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    attachFiles(event.dataTransfer?.files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const removeFile = (id) => {
    setFiles((prev) => {
      const next = prev.filter((entry) => {
        if (entry.id === id && entry.preview) {
          URL.revokeObjectURL(entry.preview);
        }
        return entry.id !== id;
      });
      return next;
    });
  };

  const uploadAttachment = async (entry) => {
    try {
      const formData = new FormData();
      formData.append("file", entry.file, entry.title || entry.file.name);
      formData.append("title", entry.title || entry.file.name);
      const response = await fetch("/api/uploads/meed-repo", {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        const json = await response.json();
        return {
          title: json.title || entry.title || entry.file.name,
          url: json.url,
          mimeType: json.mimeType || entry.mimeType || entry.file.type || null,
        };
      }
    } catch (uploadError) {
      console.warn("Attachment upload failed, falling back to inline payload", uploadError);
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          title: entry.title || entry.file.name,
          url: reader.result,
          mimeType: entry.mimeType || entry.file.type || "application/octet-stream",
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(entry.file);
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim() && !content.trim() && files.length === 0) {
      setError("Add a title, message, or attachment before publishing.");
      return;
    }

    setSubmitting(true);
    try {
      const attachments = [];
      for (const entry of files) {
        // eslint-disable-next-line no-await-in-loop
        const uploaded = await uploadAttachment(entry);
        if (uploaded && uploaded.url) attachments.push(uploaded);
      }

      const payload = {
        title: title.trim() || null,
        content: content.trim() ? content.trim() : null,
        attachments,
      };

      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Failed to publish (HTTP ${response.status})`);
      }

      setTitle("");
      setContent("");
      files.forEach((entry) => { if (entry.preview) URL.revokeObjectURL(entry.preview); });
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess("Post shared to Meed Community.");
      mutatePosts();
    } catch (submitError) {
      setError(submitError.message || "Failed to publish post.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAllowed) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-rose-100 bg-white/80 p-6 text-sm text-rose-600">
          You need manager or admin access to push updates to the Meed Community.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-lg font-bold text-gray-900">Meed Community Broadcast</h1>
        <p className="text-sm text-gray-600">
          Share announcements with the full Meed community. Posts appear instantly on every member&apos;s Community feed.
        </p>
      </header>

      <section className="rounded-3xl border border-teal-100 bg-white/90 p-6 shadow-sm">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-600" htmlFor="community-title">Title</label>
            <Input
              id="community-title"
              placeholder="What do you want everyone to know?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-600" htmlFor="community-content">Message</label>
            <textarea
              id="community-content"
              className="w-full min-h-[120px] resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              placeholder="Add context, instructions, or a quick note for everyone."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-600">Attachments</label>
            <div
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/40 px-4 py-6 text-center text-sm text-teal-700 transition hover:border-teal-300 hover:bg-teal-50"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              role="presentation"
            >
              <p className="mb-3">Drag &amp; drop files here, or browse from your computer.</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="light"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select Files
                </Button>
                <span className="text-xs text-teal-600/80">Images, PDFs, docs — we&apos;ll attach them for everyone.</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleFilePick}
              />
            </div>

            {files.length > 0 && (
              <ul className="space-y-2 rounded-2xl border border-teal-100 bg-white/60 p-3">
                {files.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-4 text-sm text-gray-700">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{entry.title}</div>
                      <div className="text-xs text-gray-500">{entry.mimeType || "Unknown format"}</div>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                      onClick={() => removeFile(entry.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(error || success) && (
            <div className={`rounded-xl border px-3 py-2 text-xs ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}>
              {error || success}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Publishing…" : "Publish to Community"}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Recent Community Posts</h2>
          <span className="text-xs text-gray-500">Showing latest {Math.min(posts.length, 10)} posts</span>
        </div>

        {posts.length > 0 ? (
          <div className="space-y-3">
            {posts.slice(0, 10).map((post) => (
              <article key={post.id} className="rounded-3xl border border-gray-200 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{usersById[post.userId]?.name || "Member"}</span>
                  <span>{formatDate(post.createdAt)}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-900">
                  {post.title || "Untitled announcement"}
                </div>
                {post.content && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{post.content}</p>
                )}
                {Array.isArray(post.attachments) && post.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {post.attachments.map((att) => (
                      <a
                        key={`${post.id}-${att.id || att.url}`}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-teal-200 px-2 py-1 text-xs font-medium text-teal-700 transition hover:bg-teal-50"
                      >
                        📎 {att.title || "Attachment"}
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-xs text-gray-500">
                  👍 {post.likeCount ?? 0} · 💬 {post.commentsCount ?? 0}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white/70 p-6 text-sm text-gray-600">
            No community posts yet. Your updates will show here once published.
          </div>
        )}
      </section>
    </div>
  );
}
