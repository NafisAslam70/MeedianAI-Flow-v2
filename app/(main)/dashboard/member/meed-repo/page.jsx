"use client";
import { useState, useRef, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function MeedRepoPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const isManager = isAdmin || session?.user?.role === "team_manager";
  const [statusFilter, setStatusFilter] = useState("all"); // submitted | approved | rejected | archived | all
  const [viewAll, setViewAll] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [galleryClusterFilter, setGalleryClusterFilter] = useState("all");
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

  const [viewMode, setViewMode] = useState("gallery");
  const canManageClusters = isAdmin;
  const { data: clusterData, mutate: mutateClusters } = useSWR("/api/member/meed-repo/clusters", fetcher);
  const visibilityOptions = clusterData?.visibilityOptions || [];
  const [clusterBoard, setClusterBoard] = useState(null);
  const [clusterSyncing, setClusterSyncing] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);

  const [clusterModalOpen, setClusterModalOpen] = useState(false);
  const [clusterModalMode, setClusterModalMode] = useState("create");
  const [clusterModalCluster, setClusterModalCluster] = useState(null);
  const [clusterModalName, setClusterModalName] = useState("");
  const [clusterModalDescription, setClusterModalDescription] = useState("");
  const [clusterModalVisibility, setClusterModalVisibility] = useState("admins_and_managers");
  const [clusterModalSaving, setClusterModalSaving] = useState(false);
  const [quickTargets, setQuickTargets] = useState({});

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
      await mutate();
      if (typeof mutateClusters === "function") await mutateClusters();
    } catch (e) {
      alert(e.message || "Archive failed");
    }
  };

  const postsById = useMemo(() => {
    const map = {};
    for (const p of posts) map[p.id] = p;
    return map;
  }, [posts]);

  const postIndexById = useMemo(() => {
    const map = new Map();
    posts.forEach((p, idx) => map.set(p.id, idx));
    return map;
  }, [posts]);

  const clustersForSelect = clusterBoard?.clusters || clusterData?.clusters || [];

  // filtered list comes from API with params
  const filteredPosts = useMemo(() => {
    let next = posts;
    if (galleryClusterFilter !== "all" && clustersForSelect.length) {
      const cluster = clustersForSelect.find((c) => String(c.id) === String(galleryClusterFilter));
      const ids = cluster?.postIds || [];
      const idSet = new Set(ids);
      next = next.filter((p) => idSet.has(p.id));
    }
    const term = searchTerm.trim().toLowerCase();
    if (!term) return next;
    return next.filter((p) => {
      const title = String(p.title || "").toLowerCase();
      const content = String(p.content || "").toLowerCase();
      const author = String(usersById[p.userId]?.name || "").toLowerCase();
      return title.includes(term) || content.includes(term) || author.includes(term);
    });
  }, [posts, searchTerm, usersById, galleryClusterFilter, clustersForSelect]);

  const searchMatchIds = useMemo(() => new Set(filteredPosts.map((p) => p.id)), [filteredPosts]);

  useEffect(() => {
    if (!clusterData || !Array.isArray(clusterData?.clusters)) return;
    if (clusterSyncing) return;

    const sanitizedClusters = clusterData.clusters.map((cluster) => {
      const ids = Array.isArray(cluster.postIds)
        ? cluster.postIds.map((pid) => Number(pid)).filter((pid) => pid > 0)
        : [];
      return {
        id: cluster.id,
        name: cluster.name,
        description: cluster.description,
        visibility: cluster.visibility,
        createdAt: cluster.createdAt,
        updatedAt: cluster.updatedAt,
        postIds: ids,
      };
    });

    const assigned = new Set();
    for (const cluster of sanitizedClusters) {
      for (const pid of cluster.postIds) assigned.add(pid);
    }

    const unassigned = posts
      .map((p) => p.id)
      .filter((id) => !assigned.has(id));

    setClusterBoard((prev) => {
      if (prev) {
        const prevClusters = prev.clusters || [];
        if (prevClusters.length === sanitizedClusters.length) {
          let identical = true;
          for (const cluster of sanitizedClusters) {
            const matching = prevClusters.find((c) => c.id === cluster.id);
            if (!matching) { identical = false; break; }
            if (
              matching.name !== cluster.name ||
              matching.description !== cluster.description ||
              matching.visibility !== cluster.visibility ||
              matching.postIds.length !== cluster.postIds.length
            ) {
              identical = false;
              break;
            }
            for (let i = 0; i < matching.postIds.length; i += 1) {
              if (matching.postIds[i] !== cluster.postIds[i]) {
                identical = false;
                break;
              }
            }
            if (!identical) break;
          }
          if (identical) {
            const prevUnassigned = prev.unassigned || [];
            if (prevUnassigned.length === unassigned.length) {
              let unassignedSame = true;
              for (let i = 0; i < prevUnassigned.length; i += 1) {
                if (prevUnassigned[i] !== unassigned[i]) {
                  unassignedSame = false;
                  break;
                }
              }
              if (unassignedSame) return prev;
            }
          }
        }
      }
      return { clusters: sanitizedClusters, unassigned };
    });
  }, [clusterData, posts, clusterSyncing]);

  const defaultVisibilityOption = useMemo(() => {
    if (visibilityOptions.includes("admins_and_managers")) return "admins_and_managers";
    if (visibilityOptions.includes("managers_only")) return "managers_only";
    if (visibilityOptions.includes("admins_only")) return "admins_only";
    if (visibilityOptions.includes("everyone")) return "everyone";
    return "admins_and_managers";
  }, [visibilityOptions]);

  useEffect(() => {
    if (!clusterModalOpen) {
      setClusterModalVisibility(defaultVisibilityOption);
    }
  }, [defaultVisibilityOption, clusterModalOpen]);

  const formatVisibility = (value) => {
    if (!value) return "";
    return String(value)
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const disableDetailInCluster = viewMode === "clusters" && canManageClusters;

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

  const PdfPreview = ({ url, title, className = "", showBadge = false }) => {
    if (!url) return null;
    return (
      <div className={`relative w-full h-full bg-gray-100 ${className}`}>
        <object data={url} type="application/pdf" className="w-full h-full pointer-events-none" aria-label={title || "PDF preview"}>
          <embed src={url} type="application/pdf" className="w-full h-full pointer-events-none" />
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-600 bg-white">
            PDF preview unavailable
          </div>
        </object>
        {showBadge && (
          <div className="pointer-events-none absolute bottom-1 right-1 text-[10px] font-medium bg-white/80 border border-gray-200 px-1.5 py-0.5 rounded">
            PDF
          </div>
        )}
      </div>
    );
  };

  const PreviewTile = ({ a }) => {
    const isImg = String(a.mimeType||"").startsWith("image/");
    const isPdf = String(a.mimeType||"").includes("pdf");
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border bg-white overflow-hidden shadow-sm hover:shadow transition">
        <div className="w-full h-28 bg-gray-50 overflow-hidden relative">
          {isImg ? (
            <img src={a.url} alt={a.title||"attachment"} className="w-full h-full object-cover" />
          ) : isPdf ? (
            <PdfPreview url={a.url} title={a.title} showBadge />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-gray-600">
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
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [detailSaving, setDetailSaving] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const openDetail = (post) => {
    setActivePost(post);
    setEditMode(false);
    setEditTitle(post?.title || "");
    setEditContent(post?.content || "");
    setDetailSaving(false);
    setDeletingPost(false);
    setDetailOpen(true);
  };
  const closeDetail = () => {
    setDetailOpen(false);
    setActivePost(null);
    setEditMode(false);
    setDetailSaving(false);
    setDeletingPost(false);
  };

  const Tile = ({
    p,
    draggable = false,
    onDragStart,
    onDragEnd,
    dimmed = false,
    disableOpen = false,
    className = "",
    onDoubleClick,
  }) => {
    const a = (p.attachments && p.attachments[0]) || null;
    const isImg = a && String(a.mimeType || "").startsWith("image/");
    const isPdf = a && String(a.mimeType || "").includes("pdf");
    const classes = [
      "text-left rounded-2xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition focus:outline-none",
      draggable ? "cursor-grab active:cursor-grabbing" : "",
      dimmed ? "opacity-60" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const handleClick = () => {
      if (disableOpen) return;
      openDetail(p);
    };

    const handleDragStartInternal = (e) => {
      if (!draggable) return;
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", String(p.id));
      } catch {}
      if (onDragStart) onDragStart(e);
    };

    const handleDragEndInternal = (e) => {
      if (!draggable) return;
      if (onDragEnd) onDragEnd(e);
    };

    return (
      <button
        type="button"
        onClick={handleClick}
        onDoubleClick={onDoubleClick}
        className={classes}
        draggable={draggable}
        onDragStartCapture={handleDragStartInternal}
        onDragEnd={handleDragEndInternal}
        data-post-id={p.id}
      >
        <div className="relative">
          <div className="absolute top-2 left-2 text-[11px] px-2 py-0.5 rounded-full bg-white/90 border font-semibold">{p.status}</div>
          {p.taskId && (
            <div className="absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded-full bg-white/90 border">Task #{p.taskId}</div>
          )}
          <div className="w-full aspect-[4/3] bg-gray-50 overflow-hidden relative">
            {!a && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                No media
              </div>
            )}
            {a && isImg && <img src={a.url} alt={a.title || ""} className="w-full h-full object-cover" />}
            {a && !isImg && isPdf && <PdfPreview url={a.url} title={a.title} showBadge />}
            {a && !isImg && !isPdf && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">
                File
              </div>
            )}
          </div>
        </div>
        <div className="p-2">
          <div className="text-sm font-semibold text-gray-900 truncate" title={p.title}>
            {p.title}
          </div>
          <div className="mt-1 text-[11px] text-gray-600 truncate">
            By {usersById[p.userId]?.name || "User"} • {fmtRel(p.createdAt)}
          </div>
        </div>
      </button>
    );
  };

  const cloneBoard = (board) => {
    if (!board) return null;
    return {
      clusters: (board.clusters || []).map((cluster) => ({
        ...cluster,
        postIds: Array.isArray(cluster.postIds) ? [...cluster.postIds] : [],
      })),
      unassigned: Array.isArray(board.unassigned) ? [...board.unassigned] : [],
    };
  };

  const openCreateClusterModal = () => {
    if (!canManageClusters) return;
    setClusterModalMode("create");
    setClusterModalCluster(null);
    setClusterModalName("");
    setClusterModalDescription("");
    setClusterModalVisibility(defaultVisibilityOption);
    setClusterModalOpen(true);
  };

  const openEditClusterModal = (cluster) => {
    if (!canManageClusters || !cluster) return;
    setClusterModalMode("edit");
    setClusterModalCluster(cluster);
    setClusterModalName(cluster.name || "");
    setClusterModalDescription(cluster.description || "");
    setClusterModalVisibility(cluster.visibility || defaultVisibilityOption);
    setClusterModalOpen(true);
  };

  const closeClusterModal = () => {
    setClusterModalOpen(false);
    setClusterModalCluster(null);
    setClusterModalSaving(false);
    setClusterModalName("");
    setClusterModalDescription("");
    setClusterModalVisibility(defaultVisibilityOption);
  };

  const handleClusterModalSubmit = async () => {
    if (!canManageClusters) return;
    const trimmedName = clusterModalName.trim();
    if (!trimmedName) {
      alert("Cluster name is required");
      return;
    }
    const trimmedDescription = clusterModalDescription.trim();
    const payload = {
      name: trimmedName,
      description: trimmedDescription.length ? trimmedDescription : null,
      visibility: clusterModalVisibility,
    };

    setClusterModalSaving(true);
    try {
      if (clusterModalMode === "create") {
        const res = await fetch("/api/member/meed-repo/clusters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create cluster");
      } else if (clusterModalMode === "edit" && clusterModalCluster) {
        const res = await fetch("/api/member/meed-repo/clusters", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            clusterId: clusterModalCluster.id,
            ...payload,
          }),
        });
        if (!res.ok) throw new Error("Failed to update cluster");
      }
      if (typeof mutateClusters === "function") await mutateClusters();
      closeClusterModal();
    } catch (error) {
      console.error(error);
      alert(error.message || "Cluster save failed");
    } finally {
      setClusterModalSaving(false);
    }
  };

  const syncBoardWithServer = async (nextBoard, previousBoard) => {
    if (!canManageClusters) return;
    setClusterSyncing(true);
    try {
      const payload = {
        action: "sync",
        clusters: (nextBoard?.clusters || []).map((cluster) => ({
          id: cluster.id,
          postIds: cluster.postIds,
        })),
      };
      const res = await fetch("/api/member/meed-repo/clusters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update clusters");
      if (typeof mutateClusters === "function") await mutateClusters();
    } catch (error) {
      console.error(error);
      if (previousBoard) setClusterBoard(previousBoard);
      alert(error.message || "Failed to update clusters");
    } finally {
      setClusterSyncing(false);
    }
  };

  const applyBoardMove = (postId, targetKey) => {
    if (!clusterBoard || clusterSyncing) return;
    const prevBoard = cloneBoard(clusterBoard);
    const nextBoard = cloneBoard(clusterBoard);
    if (!nextBoard) return;

    nextBoard.clusters = nextBoard.clusters.map((cluster) => {
      let nextIds = cluster.postIds.filter((id) => id !== postId);
      if (targetKey === `cluster-${cluster.id}` && !nextIds.includes(postId)) {
        nextIds = [...nextIds, postId];
      }
      return { ...cluster, postIds: nextIds };
    });

    const withoutPost = nextBoard.unassigned.filter((id) => id !== postId);
    if (targetKey === "unassigned") {
      const merged = Array.from(new Set([...withoutPost, postId]));
      merged.sort((a, b) => {
        const ai = postIndexById.get(a) ?? 0;
        const bi = postIndexById.get(b) ?? 0;
        return ai - bi;
      });
      nextBoard.unassigned = merged;
    } else {
      nextBoard.unassigned = withoutPost;
    }

    setClusterBoard(nextBoard);
    syncBoardWithServer(nextBoard, prevBoard);
  };

  const handleDragStart = (postId, sourceKey) => {
    if (!canManageClusters || clusterSyncing) return;
    setDragState({ postId, sourceKey });
    setDragOverTarget(sourceKey);
  };

  const handleDragEnd = () => {
    setDragState(null);
    setDragOverTarget(null);
  };

  const handleDropOn = (targetKey) => {
    if (!dragState || !clusterBoard) return;
    const { sourceKey, postId } = dragState;
    setDragState(null);
    setDragOverTarget(null);
    if (sourceKey === targetKey) return;
    applyBoardMove(postId, targetKey);
  };

  const columnDragHandlers = (targetKey) => ({
    onDragOver: (e) => {
      if (!dragState || !canManageClusters) return;
      e.preventDefault();
    },
    onDragEnter: (e) => {
      if (!dragState || !canManageClusters) return;
      e.preventDefault();
      setDragOverTarget(targetKey);
    },
    onDragLeave: (e) => {
      if (!dragState || !canManageClusters) return;
      e.preventDefault();
      setDragOverTarget((current) => (current === targetKey ? null : current));
    },
    onDrop: (e) => {
      if (!dragState || !canManageClusters) return;
      e.preventDefault();
      handleDropOn(targetKey);
    },
  });

  const handleQuickAssign = (postId, currentClusterId) => {
    if (clusterSyncing) return;
    const target = quickTargets[postId];
    if (!target) return;
    let targetKey = "unassigned";
    if (target !== "__unassigned") {
      targetKey = `cluster-${target}`;
    }
    const currentKey = currentClusterId ? `cluster-${currentClusterId}` : "unassigned";
    if (targetKey === currentKey) {
      setQuickTargets((prev) => ({ ...prev, [postId]: "" }));
      return;
    }
    applyBoardMove(postId, targetKey);
    setQuickTargets((prev) => ({ ...prev, [postId]: "" }));
  };

  const cancelEdit = () => {
    if (!activePost) return;
    setEditTitle(activePost.title || "");
    setEditContent(activePost.content || "");
    setEditMode(false);
    setDetailSaving(false);
  };

  const saveDetailEdits = async () => {
    if (!activePost || !isAdmin) return;
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      alert("Title is required");
      return;
    }
    setDetailSaving(true);
    try {
      const payload = {
        id: activePost.id,
        title: trimmedTitle,
        content: editContent && editContent.trim().length ? editContent : null,
      };
      const res = await fetch("/api/member/meed-repo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update");
      setActivePost((prev) => (prev ? { ...prev, title: trimmedTitle, content: payload.content } : prev));
      setEditMode(false);
      await mutate();
      if (typeof mutateClusters === "function") await mutateClusters();
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to save changes");
    } finally {
      setDetailSaving(false);
    }
  };

  const deletePost = async () => {
    if (!activePost || !isAdmin) return;
    if (!window.confirm("Delete this repo post permanently?")) return;
    setDeletingPost(true);
    try {
      const res = await fetch("/api/member/meed-repo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activePost.id, action: "delete" }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      await mutate();
      if (typeof mutateClusters === "function") await mutateClusters();
      closeDetail();
    } catch (error) {
      console.error(error);
      alert(error.message || "Delete failed");
    } finally {
      setDeletingPost(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Meed Repo</h1>
          <p className="text-sm text-gray-600">Your posts in a modern gallery.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === "gallery" && clustersForSelect.length > 0 && (
            <div className="flex items-center gap-1 text-xs bg-white border px-2 py-1 rounded-xl">
              <select
                value={galleryClusterFilter}
                onChange={(e) => setGalleryClusterFilter(e.target.value)}
                className="border-none bg-transparent text-xs focus:outline-none"
              >
                <option value="all">All clusters</option>
                {clustersForSelect.map((clusterOption) => (
                  <option key={clusterOption.id} value={clusterOption.id}>
                    {clusterOption.name}
                  </option>
                ))}
              </select>
              {galleryClusterFilter !== "all" && (
                <button
                  type="button"
                  className="text-[10px] text-gray-500 underline"
                  onClick={() => setGalleryClusterFilter("all")}
                >
                  Reset
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 text-xs bg-white border px-1 py-0.5 rounded-xl">
            <button
              type="button"
              className={`px-3 py-1 rounded-lg ${viewMode === "gallery" ? "bg-gray-900 text-white" : "hover:bg-gray-100"}`}
              onClick={() => {
                setViewMode("gallery");
                setDragState(null);
              }}
            >
              Gallery
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-lg ${viewMode === "clusters" ? "bg-gray-900 text-white" : "hover:bg-gray-100"}`}
              onClick={() => {
                setViewMode("clusters");
                setDragState(null);
                if (typeof mutateClusters === "function") mutateClusters();
              }}
            >
            Cluster View
          </button>
        </div>
        {isManager && (
          <label className="text-xs text-gray-700 inline-flex items-center gap-2">
              <input type="checkbox" checked={viewAll} onChange={(e) => { setViewAll(e.target.checked); }} />
              View All
            </label>
          )}
          {isManager && (
            <button
              className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 border border-amber-200"
              onClick={() => {
                setViewAll(true);
                setStatusFilter("submitted");
              }}
            >
              To Verify
            </button>
          )}
          <div className="relative">
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search posts"
              className="w-40 md:w-56 lg:w-64 rounded-xl border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              aria-label="Search Meed Repo posts"
            />
            {searchTerm && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setSearchTerm("")}
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs bg-white border px-2 py-1 rounded-xl">
            {["submitted", "approved", "rejected", "archived", "all"].map((k) => (
              <button
                key={k}
                className={`px-2 py-1 rounded-lg ${statusFilter === k ? "bg-gray-900 text-white" : "hover:bg-gray-100"}`}
                onClick={() => setStatusFilter(k)}
              >
                {k}
              </button>
            ))}
          </div>
          {viewMode === "clusters" && canManageClusters && (
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={openCreateClusterModal}
            >
              New Cluster
            </button>
          )}
          <button className="px-3 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700" onClick={() => setShowModal(true)}>
            Post in Repo
          </button>
        </div>
      </div>
      {viewMode === "gallery" ? (
        filteredPosts.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {filteredPosts.map((p) => (
              <Tile key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">No posts found.</div>
        )
      ) : null}
      {viewMode === "clusters" ? (
        clusterBoard ? (
          <div className="space-y-3">
            {clusterSyncing && (
              <div className="text-xs text-gray-500">Syncing cluster changes…</div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-2 md:gap-3">
              {canManageClusters && (
                <div
                  className={`flex flex-col gap-1.5 rounded-xl border bg-white p-2 min-h-[180px] text-[13px] ${
                    dragOverTarget === "unassigned" ? "ring-2 ring-teal-400" : ""
                  }`}
                  {...columnDragHandlers("unassigned")}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-900">Available Posts</div>
                    <div className="text-[11px] text-gray-500">{clusterBoard.unassigned.length}</div>
                  </div>
                  <div className="flex-1 space-y-1.5 overflow-auto pr-1">
                    {clusterBoard.unassigned.length ? (
                      clusterBoard.unassigned.map((id) => {
                        const post = postsById[id];
                        if (!post) return null;
                        const dimmed = searchTerm ? !searchMatchIds.has(id) : false;
                        return (
                          <div key={`unassigned-${id}`} className="space-y-1.5">
                            <Tile
                              p={post}
                              draggable
                              onDragStart={() => handleDragStart(id, "unassigned")}
                              onDragEnd={handleDragEnd}
                              dimmed={dimmed}
                              disableOpen={disableDetailInCluster || !!dragState}
                              onDoubleClick={() => {
                                if (dragState) return;
                                openDetail(post);
                              }}
                              className="!shadow-none border-dashed"
                            />
                            {disableDetailInCluster && clustersForSelect.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={quickTargets[id] || ""}
                                  onChange={(e) => setQuickTargets((prev) => ({ ...prev, [id]: e.target.value }))}
                                  className="flex-1 border rounded-lg px-1.5 py-1 text-[11px]"
                                >
                                  <option value="">Select cluster…</option>
                                  {clustersForSelect.map((clusterOption) => (
                                    <option key={clusterOption.id} value={clusterOption.id}>
                                      {clusterOption.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="px-2 py-1 text-[11px] rounded bg-indigo-600 text-white disabled:opacity-50"
                                  onClick={() => handleQuickAssign(id, null)}
                                  disabled={!quickTargets[id] || clusterSyncing}
                                >
                                  Push
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-gray-500">All posts are assigned.</div>
                    )}
                  </div>
                </div>
              )}
              {clusterBoard.clusters.map((cluster) => {
                const handlers = columnDragHandlers(`cluster-${cluster.id}`);
                return (
                  <div
                    key={cluster.id}
                    className={`flex flex-col gap-1.5 rounded-xl border bg-white p-2 min-h-[180px] text-[13px] ${
                      dragOverTarget === `cluster-${cluster.id}` ? "ring-2 ring-teal-400" : ""
                    }`}
                    {...handlers}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate" title={cluster.name}>
                          {cluster.name}
                        </div>
                        <div className="text-[11px] text-gray-500">{formatVisibility(cluster.visibility)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-[11px] text-gray-500">{cluster.postIds.length}</div>
                        {canManageClusters && (
                          <button
                            type="button"
                            className="text-[11px] text-teal-700 underline"
                            onClick={() => openEditClusterModal(cluster)}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {cluster.description && (
                      <div className="text-[11px] text-gray-600 line-clamp-2">{cluster.description}</div>
                    )}
                    <div className="flex-1 space-y-1.5 overflow-auto pr-1">
                      {cluster.postIds.length ? (
                        cluster.postIds.map((id) => {
                          const post = postsById[id];
                          if (!post) return null;
                          const dimmed = searchTerm ? !searchMatchIds.has(id) : false;
                          return (
                            <div key={`cluster-${cluster.id}-${id}`} className="space-y-1.5">
                              <Tile
                                p={post}
                                draggable={canManageClusters}
                                onDragStart={() => handleDragStart(id, `cluster-${cluster.id}`)}
                                onDragEnd={handleDragEnd}
                                dimmed={dimmed}
                                disableOpen={disableDetailInCluster || !!dragState}
                                onDoubleClick={() => {
                                  if (dragState) return;
                                  openDetail(post);
                                }}
                                className="!shadow-none"
                              />
                              {disableDetailInCluster && (clustersForSelect.length > 1 || clusterBoard.unassigned.length > 0) && (
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={quickTargets[id] || ""}
                                    onChange={(e) => setQuickTargets((prev) => ({ ...prev, [id]: e.target.value }))}
                                    className="flex-1 border rounded-lg px-1.5 py-1 text-[11px]"
                                  >
                                    <option value="">Move to…</option>
                                    <option value="__unassigned">Available posts</option>
                                    {clustersForSelect.map((clusterOption) => (
                                      <option key={clusterOption.id} value={clusterOption.id}>
                                        {clusterOption.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="px-2 py-1 text-[11px] rounded bg-indigo-600 text-white disabled:opacity-50"
                                    onClick={() => handleQuickAssign(id, cluster.id)}
                                    disabled={!quickTargets[id] || clusterSyncing}
                                  >
                                    Move
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-gray-500">No posts yet.</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {!clusterBoard.clusters.length && !canManageClusters && (
              <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600">
                No clusters available yet.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">Loading clusters…</div>
        )
      ) : null}
      {clusterModalOpen && (
        <div
          className="fixed inset-0 z-[62] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeClusterModal}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold text-gray-900">
                {clusterModalMode === "create" ? "Create Cluster" : "Edit Cluster"}
              </div>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                onClick={closeClusterModal}
              >
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Name</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={clusterModalName}
                  onChange={(e) => setClusterModalName(e.target.value)}
                  placeholder="Cluster name"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Description (optional)</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  value={clusterModalDescription}
                  onChange={(e) => setClusterModalDescription(e.target.value)}
                  placeholder="Short summary for admins/managers"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Visible To</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={clusterModalVisibility}
                  onChange={(e) => setClusterModalVisibility(e.target.value)}
                >
                  {(visibilityOptions.length ? visibilityOptions : [clusterModalVisibility || defaultVisibilityOption]).map((option) => (
                    <option key={option} value={option}>
                      {formatVisibility(option)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                  onClick={closeClusterModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
                  onClick={handleClusterModalSubmit}
                  disabled={clusterModalSaving}
                >
                  {clusterModalSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <div className={chipCls(activePost.status)}>{activePost.status}</div>
                {activePost.taskId && (
                  <div className="text-[11px] px-2 py-1 rounded-full border bg-gray-50 text-gray-700">Task #{activePost.taskId}</div>
                )}
                {isAdmin && (
                  editMode ? (
                    <>
                      <button
                        type="button"
                        className="px-2 py-1 rounded bg-emerald-600 text-white text-xs"
                        onClick={saveDetailEdits}
                        disabled={detailSaving}
                      >
                        {detailSaving ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 rounded bg-gray-200 text-xs"
                        onClick={cancelEdit}
                        disabled={detailSaving}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-indigo-600 text-white text-xs"
                      onClick={() => setEditMode(true)}
                    >
                      Edit
                    </button>
                  )
                )}
                {isAdmin && (
                  <button
                    type="button"
                    className="px-2 py-1 rounded bg-rose-600 text-white text-xs"
                    onClick={deletePost}
                    disabled={deletingPost}
                  >
                    {deletingPost ? "Deleting..." : "Delete"}
                  </button>
                )}
                <button className="px-2 py-1 rounded bg-gray-100" onClick={closeDetail}>Close</button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-0">
              <div className="bg-gray-50 min-h-[50vh] flex items-center justify-center">
                {Array.isArray(activePost.attachments) && activePost.attachments.length ? (
                  <div className="w-full h-full p-2 grid grid-cols-2 gap-2">
                    {activePost.attachments.map((a, i) => {
                      const attIsImg = String(a.mimeType||"").startsWith("image/");
                      const attIsPdf = String(a.mimeType||"").includes("pdf");
                      return (
                        <a key={(a.id||a.url)+i} href={a.url} target="_blank" rel="noopener" className="relative block rounded-xl overflow-hidden border bg-white min-h-[160px]">
                          {attIsImg ? (
                            <img src={a.url} alt={a.title||''} className="w-full h-full object-cover" />
                          ) : attIsPdf ? (
                            <PdfPreview url={a.url} title={a.title} showBadge />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center p-4 text-xs text-gray-600 text-center break-words">
                              {a.title || 'Open file'}
                            </div>
                          )}
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">No attachments</div>
                )}
              </div>
              <div className="p-3 space-y-3">
                {editMode ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Title</label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Post title"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Notes</label>
                      <textarea
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        rows={6}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Context / summary"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-base font-semibold text-gray-900">{activePost.title}</div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{activePost.content || ''}</div>
                  </>
                )}
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
