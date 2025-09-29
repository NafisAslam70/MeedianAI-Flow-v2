"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  ListTodo,
  Loader2,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Users,
  X,
  Edit,
  Plus,
  Filter,
} from "lucide-react";
import { useSession } from "next-auth/react";
import AssignedTaskDetails from "@/components/assignedTaskCardDetailForAll";

const NOTE_CATEGORIES = ["MSP", "MHCP", "MHP", "MOP", "Other", "Building Home"];

const splitNoteIntoPoints = (content = "") =>
  content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length);

const toDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const humanizeDate = (value) => {
  if (!value) return "Unknown";
  try {
    return new Date(value).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
};

const deriveTitle = (content = "", fallback = "Untitled note") => {
  const lines = splitNoteIntoPoints(content);
  return (lines[0] || fallback).replace(/^\d+\.\s*/, "");
};

const derivePreview = (content = "") => {
  const lines = splitNoteIntoPoints(content);
  const cleaned = lines.map((line) => line.replace(/^\d+\.\s*/, ""));
  if (cleaned.length <= 1) return cleaned.join(" ").slice(0, 120);
  return cleaned.slice(1, 4).join(" · ").slice(0, 160);
};

const buildTaskDrafts = (note, defaultAssignees = []) => {
  const points = splitNoteIntoPoints(note?.content || "");
  const base = points.length ? points : [note?.content || ""];
  return base.map((text, idx) => {
    const cleaned = text.replace(/^\d+\.\s*/, "");
    const title = cleaned.trim() ? cleaned.slice(0, 80) : `Task ${idx + 1}`;
    return {
      id: `${note?.id ?? "new"}-${idx}`,
      include: true,
      sourceText: cleaned,
      title,
      description: "",
      deadline: "",
      assignees: [...defaultAssignees],
    };
  });
};

const MyNotes = ({
  userId,
  setError = () => {},
  setSuccess = () => {},
  embedded = false,
  fullScreen = false,
  twoPane = false,
  onClose = () => {},
  initialMode = "view",
  availableUsers = [],
  currentUser = null,
  readOnly = false,
  selectedNoteIdProp = undefined,
  onSelectedNoteChange = () => {},
  onComposerStateChange,
  sharedComposerDraft = null,
  onNotesActivity,
  externalNotes = null,
}) => {
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [newNote, setNewNote] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [composerOpen, setComposerOpen] = useState(initialMode === "add" && !readOnly);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localSuccess, setLocalSuccess] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [editingNoteCategory, setEditingNoteCategory] = useState("");
  const [shareModalNote, setShareModalNote] = useState(null);
  const [shareSelected, setShareSelected] = useState([]);
  const [shareCanEdit, setShareCanEdit] = useState({});
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [taskModalNote, setTaskModalNote] = useState(null);
  const [taskDrafts, setTaskDrafts] = useState([]);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskAiBusy, setTaskAiBusy] = useState(false);
  const [convertPrompt, setConvertPrompt] = useState(null);
  const [linkedTaskModalOpen, setLinkedTaskModalOpen] = useState(false);
  const [linkedTaskModalLoading, setLinkedTaskModalLoading] = useState(false);
  const [linkedTaskModalError, setLinkedTaskModalError] = useState("");
  const [linkedTaskDetails, setLinkedTaskDetails] = useState(null);
  const [linkedTaskLogs, setLinkedTaskLogs] = useState([]);
  const addingRef = useRef(false);
  const mountedRef = useRef(true);
  const errorRef = useRef(setError);
  const successRef = useRef(setSuccess);
  const composerRef = useRef(null);
  const notifyActivity = useCallback(
    (payload = {}) => {
      if (typeof onNotesActivity === "function") {
        onNotesActivity(payload);
      }
    },
    [onNotesActivity]
  );
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  const lastActivityCallbackRef = useRef(null);
  useEffect(() => {
    if (readOnly) {
      lastActivityCallbackRef.current = onNotesActivity || null;
      return;
    }
    if (typeof onNotesActivity === "function" && onNotesActivity !== lastActivityCallbackRef.current) {
      onNotesActivity({
        action: "notes-sync",
        noteId: selectedNoteId,
        notes: notesRef.current,
      });
    }
    lastActivityCallbackRef.current = onNotesActivity || null;
  }, [onNotesActivity, readOnly, selectedNoteId]);

  useEffect(() => {
    if (readOnly && composerOpen) setComposerOpen(false);
  }, [readOnly, composerOpen]);

  const allShareCandidates = useMemo(() => {
    const base = new Map();
    (availableUsers || []).forEach((user) => {
      if (!user || !user.id) return;
      base.set(user.id, {
        id: user.id,
        name: user.name || "Member",
        role: (user.role || "").replace(/_/g, " "),
      });
    });
    if (currentUser?.id && !base.has(currentUser.id)) {
      base.set(currentUser.id, {
        id: currentUser.id,
        name: currentUser.name || "You",
        role: (currentUser.role || "member").replace(/_/g, " "),
      });
    }
    return Array.from(base.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableUsers, currentUser]);

  const canAssignOthers = useMemo(() => ["admin", "team_manager"].includes(currentUser?.role), [currentUser]);

  const availableAssignees = useMemo(() => {
    const list = [...allShareCandidates];
    if (!canAssignOthers && currentUser?.id) {
      return list.filter((user) => user.id === currentUser.id);
    }
    return list;
  }, [allShareCandidates, canAssignOthers, currentUser]);

  useEffect(() => {
    if (selectedNoteIdProp === undefined || selectedNoteIdProp === null) return;
    setSelectedNoteId((prev) => (prev === selectedNoteIdProp ? prev : selectedNoteIdProp));
  }, [selectedNoteIdProp]);

  useEffect(() => {
    if (!selectedNoteId) return;
    onSelectedNoteChange(selectedNoteId);
  }, [selectedNoteId, onSelectedNoteChange]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    errorRef.current = setError;
  }, [setError]);

  useEffect(() => {
    successRef.current = setSuccess;
  }, [setSuccess]);

  const flash = useCallback((ok, msg) => {
    (ok ? successRef : errorRef).current?.(msg);
    (ok ? setLocalSuccess : setLocalError)(msg);
    setTimeout(() => {
      successRef.current?.("");
      errorRef.current?.("");
      setLocalSuccess("");
      setLocalError("");
    }, ok ? 2500 : 3000);
  }, []);

  const loadNotes = useCallback(async () => {
    if (!userId) {
      setNotes([]);
      return [];
    }
    setIsLoading(true);
    try {
      const response = await fetch(`/api/member/notes`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch notes");
      const list = Array.isArray(data.notes) ? data.notes : [];
      setNotes(list);
      return list;
    } catch (err) {
      flash(false, err.message || "Failed to fetch notes");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [userId, flash]);

  useEffect(() => {
    if (Array.isArray(externalNotes)) {
      setIsLoading(false);
      setNotes(externalNotes);
      return;
    }
    loadNotes();
  }, [externalNotes, loadNotes]);

  useEffect(() => {
    if (!notes.length) {
      setSelectedNoteId(null);
      return;
    }
    setSelectedNoteId((prev) => {
      if (prev && notes.some((note) => note.id === prev)) return prev;
      return notes[0].id;
    });
  }, [notes]);


  const filteredNotes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return notes.filter((note) => {
      const matchesCategory = (() => {
        switch (categoryFilter) {
          case "all":
            return true;
          case "shared_to_you":
            return !note.isOwner;
          case "shared_by_you":
            return note.isOwner && (note.sharedWith?.length || 0) > 0;
          default:
            return note.category === categoryFilter;
        }
      })();
      if (!matchesCategory) return false;
      if (!q) return true;
      const haystack = `${note.content} ${note.category} ${(note.owner?.name || "")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [notes, categoryFilter, searchTerm]);

  useEffect(() => {
    if (!filteredNotes.length) return;
    if (!filteredNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(filteredNotes[0].id);
    }
  }, [filteredNotes, selectedNoteId]);

  const selectedNote = useMemo(() => {
    if (!filteredNotes.length) return null;
    return filteredNotes.find((note) => note.id === selectedNoteId) || filteredNotes[0];
  }, [filteredNotes, selectedNoteId]);

  const allowManualSelection = !(readOnly && selectedNoteIdProp !== undefined);
  const stats = useMemo(() => {
    const total = notes.length;
    const shared = notes.filter((note) => !note.isOwner).length;
    const linkedTasks = notes.reduce((sum, note) => sum + (note.linkedTasks?.length || 0), 0);
    return { total, shared, linkedTasks };
  }, [notes]);

  const ensureNumbering = useCallback((value = "") => {
    const lines = value.split(/\n/);
    let counter = 0;
    return lines
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return "";
        counter += 1;
        const stripped = trimmed.replace(/^\d+\.\s*/, "");
        return `${counter}. ${stripped}`;
      })
      .join("\n");
  }, []);

  const resetComposer = () => {
    setNewNote("");
    setNewCategory("");
    setComposerOpen(false);
  };

  useEffect(() => {
    if (composerOpen && !newNote) {
      setNewNote("1. ");
      requestAnimationFrame(() => {
        if (composerRef.current) {
          composerRef.current.selectionStart = composerRef.current.selectionEnd = composerRef.current.value.length;
        }
      });
    }
  }, [composerOpen, newNote]);

  useEffect(() => {
    if (typeof onComposerStateChange !== "function") return;
    onComposerStateChange({
      open: composerOpen,
      content: newNote,
      category: newCategory,
    });
  }, [composerOpen, newNote, newCategory, onComposerStateChange]);

  const handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      setNewNote((prev) => {
        const sanitized = prev.replace(/\s+$/, "");
        const lines = sanitized ? sanitized.split(/\n/) : [];
        const nextNumber = lines.filter((line) => line.trim()).length + 1;
        const nextValue = `${sanitized}${sanitized ? "\n" : ""}${nextNumber}. `;
        requestAnimationFrame(() => {
          if (composerRef.current) {
            composerRef.current.selectionStart = composerRef.current.selectionEnd = nextValue.length;
          }
        });
        return nextValue;
      });
    }
  };

  const handleComposerChange = (event) => {
    setNewNote(event.target.value);
  };

  const closeLinkedTaskModal = useCallback(() => {
    setLinkedTaskModalOpen(false);
    setLinkedTaskModalLoading(false);
    setLinkedTaskModalError("");
    setLinkedTaskDetails(null);
    setLinkedTaskLogs([]);
  }, []);

  const openLinkedTaskDetails = useCallback(
    async (task) => {
      if (!task?.taskId) return;
      setLinkedTaskModalOpen(true);
      setLinkedTaskModalLoading(true);
      setLinkedTaskModalError("");
      setLinkedTaskDetails(null);
      setLinkedTaskLogs([]);

      try {
        const detailsRes = await fetch(`/api/member/assignedTasks?taskId=${task.taskId}&action=task`, {
          credentials: "include",
        });
        const detailsJson = await detailsRes.json();
        if (!detailsRes.ok) throw new Error(detailsJson?.error || "Failed to load task details");
        if (!mountedRef.current) return;
        const taskPayload = detailsJson?.task || detailsJson;
        setLinkedTaskDetails(taskPayload);

        try {
          const logsRes = await fetch(`/api/member/assignedTasks?taskId=${task.taskId}&action=logs`, {
            credentials: "include",
          });
          const logsJson = await logsRes.json();
          if (!logsRes.ok) throw new Error(logsJson?.error || "Failed to load task logs");
          if (!mountedRef.current) return;
          setLinkedTaskLogs(Array.isArray(logsJson?.logs) ? logsJson.logs : []);
        } catch (logError) {
          const message = logError?.message || "Failed to load task logs";
          setLinkedTaskModalError(message);
          flash(false, message);
        }
      } catch (error) {
        const message = error?.message || "Failed to load task details";
        if (!mountedRef.current) return;
        setLinkedTaskModalError(message);
        setLinkedTaskDetails(null);
        setLinkedTaskLogs([]);
        flash(false, message);
      } finally {
        if (!mountedRef.current) return;
        setLinkedTaskModalLoading(false);
      }
    },
    [flash]
  );

  const handleAddNote = useCallback(async () => {
    if (addingRef.current) return;
    if (!newNote.trim()) return flash(false, "Note content cannot be empty");
    if (!newCategory) return flash(false, "Please select a category");
    setIsLoading(true);
    addingRef.current = true;
    try {
      const numberedContent = ensureNumbering(newNote);
      const bulletCount = numberedContent
        .split(/\n/)
        .filter((line) => line.trim())
        .length;
      const response = await fetch("/api/member/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, content: numberedContent, category: newCategory }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to add note");
      flash(true, "Note added!");
      resetComposer();
      const updated = await loadNotes();
      const created = updated.find((note) => note.id === data.note?.id);
      if (created?.id) {
        setSelectedNoteId(created.id);
        if (bulletCount > 0) {
          setConvertPrompt(created);
        }
      }
      notifyActivity({ action: "note-added", noteId: created?.id || data?.note?.id || null });
    } catch (err) {
      flash(false, err.message || "Failed to add note");
    } finally {
      setIsLoading(false);
      addingRef.current = false;
    }
  }, [userId, newNote, newCategory, flash, ensureNumbering, loadNotes, notifyActivity]);

  const beginEdit = (note) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
    setEditingNoteCategory(note.category);
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setEditingNoteContent("");
    setEditingNoteCategory("");
  };

  const handleEditNote = useCallback(async () => {
    if (!editingNoteId) return;
    if (!editingNoteContent.trim()) return flash(false, "Note content cannot be empty");
    if (!editingNoteCategory) return flash(false, "Please select a category");
    setIsLoading(true);
    try {
      const response = await fetch(`/api/member/notes?noteId=${editingNoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: editingNoteId, content: editingNoteContent, category: editingNoteCategory }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update note");
      const updatedAt = new Date().toISOString();
      let updatedNotes = [];
      setNotes((prev) => {
        const next = prev.map((note) =>
          note.id === editingNoteId ? { ...note, content: editingNoteContent, category: editingNoteCategory, updatedAt } : note
        );
        updatedNotes = next;
        return next;
      });
      flash(true, "Note updated!");
      cancelEdit();
      notifyActivity({ action: "note-updated", noteId: editingNoteId, notes: updatedNotes });
    } catch (err) {
      flash(false, err.message || "Failed to update note");
    } finally {
      setIsLoading(false);
    }
  }, [editingNoteId, editingNoteContent, editingNoteCategory, flash, notifyActivity]);

  const handleDeleteNote = useCallback(async (noteId) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/member/notes?noteId=${noteId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete note");
      let remainingNotes = [];
      setNotes((prev) => {
        const remaining = prev.filter((note) => note.id !== noteId);
        if (!remaining.length) {
          setSelectedNoteId(null);
        } else if (!remaining.some((note) => note.id === selectedNoteId)) {
          setSelectedNoteId(remaining[0].id);
        }
        remainingNotes = remaining;
        return remaining;
      });
      flash(true, "Note deleted!");
      notifyActivity({ action: "note-deleted", noteId, notes: remainingNotes });
    } catch (err) {
      flash(false, err.message || "Failed to delete note");
    } finally {
      setIsLoading(false);
    }
  }, [flash, selectedNoteId, notifyActivity]);

  const closeShareModal = () => {
    setShareModalNote(null);
    setShareSelected([]);
    setShareCanEdit({});
    setShareSubmitting(false);
  };

  const openShareModal = (note) => {
    setShareModalNote(note);
    const selected = (note.sharedWith || []).map((share) => share.userId);
    const canEditMap = {};
    (note.sharedWith || []).forEach((share) => {
      canEditMap[share.userId] = Boolean(share.canEdit);
    });
    setShareSelected(selected);
    setShareCanEdit(canEditMap);
  };

  const toggleShareTarget = (userId) => {
    setShareSelected((prev) => {
      if (prev.includes(userId)) {
        const next = prev.filter((id) => id !== userId);
        setShareCanEdit((map) => {
          const copy = { ...map };
          delete copy[userId];
          return copy;
        });
        return next;
      }
      setShareCanEdit((map) => ({ ...map, [userId]: map[userId] ?? false }));
      return [...prev, userId];
    });
  };

  const toggleShareCanEdit = (userId) => {
    setShareCanEdit((map) => ({ ...map, [userId]: !map[userId] }));
  };

  const submitShare = async () => {
    if (!shareModalNote) return;
    setShareSubmitting(true);
    try {
      const payload = {
        shareWith: shareSelected.map((userId) => ({ userId, canEdit: Boolean(shareCanEdit[userId]) })),
      };
      const response = await fetch(`/api/member/notes/${shareModalNote.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update sharing");
      let updatedNotes = [];
      setNotes((prev) => {
        const next = prev.map((note) =>
          note.id === shareModalNote.id ? { ...note, sharedWith: Array.isArray(data.sharedWith) ? data.sharedWith : [] } : note
        );
        updatedNotes = next;
        return next;
      });
      flash(true, "Sharing updated!");
      closeShareModal();
      notifyActivity({ action: "note-shared", noteId: shareModalNote.id, notes: updatedNotes });
    } catch (err) {
      flash(false, err.message || "Failed to update sharing");
    } finally {
      setShareSubmitting(false);
    }
  };

  const openTaskModal = (note) => {
    const defaultAssignees = !canAssignOthers && currentUser?.id ? [parseInt(currentUser.id, 10)] : [];
    setTaskModalNote(note);
    setTaskDrafts(buildTaskDrafts(note, defaultAssignees));
  };

  const closeTaskModal = () => {
    setTaskModalNote(null);
    setTaskDrafts([]);
    setTaskSubmitting(false);
    setTaskAiBusy(false);
  };

  const updateTaskDraft = (draftId, updates) => {
    setTaskDrafts((prev) => prev.map((draft) => (draft.id === draftId ? { ...draft, ...updates } : draft)));
  };

  const toggleTaskInclude = (draftId) => {
    setTaskDrafts((prev) => prev.map((draft) => (draft.id === draftId ? { ...draft, include: !draft.include } : draft)));
  };

  const handleTaskAssignees = (draftId, values) => {
    if (!canAssignOthers && currentUser?.id) {
      updateTaskDraft(draftId, { assignees: [parseInt(currentUser.id, 10)] });
      return;
    }
    const ids = Array.from(new Set(values.map((value) => parseInt(value, 10)).filter(Boolean)));
    updateTaskDraft(draftId, { assignees: ids });
  };

  const handleTaskAiAssist = async () => {
    if (!taskModalNote) return;
    setTaskAiBusy(true);
    try {
      const enumerated = taskDrafts
        .map((draft, idx) => `${idx + 1}. ${draft.sourceText}`)
        .join("\n");
      const prompt = [
        "Convert the numbered notes into actionable internal tasks.",
        "Return ONLY JSON with an array of objects containing: index, title (<=80 chars), description (<=200 chars, optional), deadlineDays (0-30 or null).",
        "If unsure, omit fields or use null.",
        "Notes:",
        enumerated,
      ].join("\n");

      const response = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You help operational teams turn meeting notes into short actionable tasks." },
            { role: "user", content: prompt },
          ],
          model: "gpt-4o-mini",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch AI suggestions");
      let reply = String(data.reply || "");
      const block = reply.match(/```json\s*([\s\S]*?)```/i) || reply.match(/```\s*([\s\S]*?)```/i);
      if (block) reply = block[1];
      const suggestions = JSON.parse(reply);
      if (!Array.isArray(suggestions)) throw new Error("AI response was not an array");

      setTaskDrafts((prev) =>
        prev.map((draft, idx) => {
          const suggestion = suggestions.find((item) => {
            const index = Number.isFinite(item.index) ? item.index : item.noteIndex;
            return index ? index === idx + 1 : false;
          });
          if (!suggestion) return draft;
          let deadline = draft.deadline;
          const deadlineDays = Number.isFinite(suggestion.deadlineDays)
            ? suggestion.deadlineDays
            : Number.isFinite(suggestion.deadline_in_days)
              ? suggestion.deadline_in_days
              : null;
          if (Number.isFinite(deadlineDays) && deadlineDays >= 0) {
            const d = new Date();
            d.setDate(d.getDate() + Math.round(deadlineDays));
            deadline = toDateInput(d);
          }
          const result = {
            ...draft,
            title: suggestion.title ? String(suggestion.title).trim().slice(0, 80) : draft.title,
            description: suggestion.description ? String(suggestion.description).trim().slice(0, 200) : draft.description,
            deadline,
          };
          if (!canAssignOthers && currentUser?.id) {
            result.assignees = [parseInt(currentUser.id, 10)];
          }
          return result;
        })
      );
      flash(true, "AI suggestions applied");
    } catch (err) {
      flash(false, err.message || "Failed to parse AI response");
    } finally {
      setTaskAiBusy(false);
    }
  };

  const handleCreateTasks = async () => {
    if (!taskModalNote) return;
    const selectedDrafts = taskDrafts.filter((draft) => draft.include);
    if (!selectedDrafts.length) return flash(false, "Select at least one draft to create tasks");
    const invalid = selectedDrafts.find((draft) => !draft.title.trim() || !draft.assignees.length);
    if (invalid) return flash(false, `Task "${invalid.title || invalid.sourceText}" needs a title and assignee`);
    setTaskSubmitting(true);
    try {
      const payload = {
        tasks: selectedDrafts.map((draft) => ({
          title: draft.title.trim(),
          description: draft.description ? draft.description.trim() : null,
          deadline: draft.deadline ? new Date(draft.deadline).toISOString() : null,
          assigneeIds: canAssignOthers
            ? draft.assignees
            : currentUser?.id
              ? [parseInt(currentUser.id, 10)]
              : draft.assignees,
          taskType: "assigned",
          sourceText: draft.sourceText,
        })),
      };
      const response = await fetch(`/api/member/notes/${taskModalNote.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create tasks");
      const created = Array.isArray(data.createdTasks) ? data.createdTasks : [];
      let updatedNotes = [];
      if (created.length) {
        setNotes((prev) => {
          const next = prev.map((note) =>
            note.id === taskModalNote.id
              ? {
                  ...note,
                  linkedTasks: [
                    ...(note.linkedTasks || []),
                    ...created.map((task) => ({
                      taskId: task.taskId,
                      title: task.title,
                      description: task.description || null,
                      taskType: task.taskType,
                      deadline: task.deadline,
                      createdAt: task.createdAt,
                      linkCreatedAt: task.linkCreatedAt,
                      sourceText: task.sourceText,
                      assignees: task.assignees || [],
                    })),
                  ],
                }
              : note
          );
          updatedNotes = next;
          return next;
        });
      } else {
        updatedNotes = notes;
      }
      flash(true, `${created.length} task${created.length === 1 ? "" : "s"} created`);
      notifyActivity({ action: "tasks-created", noteId: taskModalNote.id, count: created.length, notes: updatedNotes });
      closeTaskModal();
    } catch (err) {
      flash(false, err.message || "Failed to create tasks");
    } finally {
      setTaskSubmitting(false);
    }
  };

  const filteredSelectedNote = selectedNote || null;

  if (embedded) return null;

  if (fullScreen) {
    const [toolbarHidden, setToolbarHidden] = useState(false);
    useEffect(() => {
      const onKey = (e) => {
        if (e.key === "Escape") setToolbarHidden(false);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);
    const saveAsPDF = () => {
      const esc = (s = "") =>
        s
          .replaceAll(/&/g, "&amp;")
          .replaceAll(/</g, "&lt;")
          .replaceAll(/>/g, "&gt;");
      const title = `My Notes — ${new Date().toLocaleString()}`;
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(`<!doctype html><html><head><meta charset=\"utf-8\" />
        <title>${title}</title>
        <style>
          @page { margin: 16mm; }
          body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#111; }
          h1 { font-size: 16px; margin: 0 0 12px; }
          .note { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
        </style>
      </head><body>
        <h1>${esc(title)}</h1>
        <div class=\"note\">${esc(newNote || "")}</div>
      </body></html>`);
      w.document.close();
      w.focus();
      w.print();
    };

    return (
      <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6">
        <div className="relative w-full h-full bg-white/95 dark:bg-slate-900/95 rounded-2xl shadow-2xl border border-white/40 overflow-hidden">
          <div className={`absolute top-3 left-3 right-3 flex items-center justify-between gap-2 transition ${toolbarHidden ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm">
                Close
              </button>
              <button onClick={() => setToolbarHidden(true)} className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm" title="Hide UI">
                Hide UI
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={saveAsPDF} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm">
                Save as PDF
              </button>
              <button
                onClick={() => {
                  if (!newCategory) setNewCategory("Other");
                  handleAddNote();
                }}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm disabled:opacity-60"
              >
                {isLoading ? "Saving…" : "Save Note"}
              </button>
            </div>
          </div>
          {toolbarHidden && (
            <button
              onClick={() => setToolbarHidden(false)}
              className="absolute top-2 right-2 px-2 py-1 rounded bg-gray-200/90 text-gray-700 text-xs shadow"
              title="Show UI"
            >
              Show UI
            </button>
          )}
          <div className="absolute inset-0 pt-14">
            <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm sm:text-base text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200"
                >
                  <option value="">Select Category</option>
                  {NOTE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="h-[calc(100%-120px)]">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Write your note in full-screen mode…"
                  className="w-full h-full resize-none outline-none border rounded-lg bg-gray-50 focus:ring-2 focus:ring-teal-500 text-base sm:text-lg text-gray-800 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100 p-3"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl">
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/30 p-5">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-emerald-900 dark:text-emerald-200">Notes & Actions</h2>
            <p className="text-sm text-emerald-800/70 dark:text-emerald-200/70 max-w-2xl">
              Capture meeting insights, share them with your team, and turn the important bullet points into actionable tasks.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-emerald-900/80 dark:text-emerald-200/80">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white shadow-sm border border-emerald-200/60 dark:bg-emerald-900/40 dark:border-emerald-800/50">
                <FileText className="w-3.5 h-3.5" /> Total {stats.total}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white shadow-sm border border-emerald-200/60 dark:bg-emerald-900/40 dark:border-emerald-800/50">
                <Users className="w-3.5 h-3.5" /> Shared {stats.shared}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white shadow-sm border border-emerald-200/60 dark:bg-emerald-900/40 dark:border-emerald-800/50">
                <ListTodo className="w-3.5 h-3.5" /> Linked tasks {stats.linkedTasks}
              </span>
            </div>
          </div>
          {!readOnly && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setComposerOpen(true);
                if (!newCategory) setNewCategory("Other");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" /> New note
            </motion.button>
          )}
        </div>

        <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
          <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm p-4 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search notes"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/80 text-sm focus:ring-2 focus:ring-emerald-400 focus:bg-white dark:focus:bg-slate-900"
              />
            </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-400 dark:text-slate-500">
              <Filter className="w-3.5 h-3.5" /> Categories & Views
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { value: "all", label: "All" },
                { value: "shared_to_you", label: "Shared to you" },
                { value: "shared_by_you", label: "Shared by you" },
                ...NOTE_CATEGORIES.map((category) => ({ value: category, label: category })),
              ].map(({ value, label }) => {
                const active = categoryFilter === value;
                return (
                  <button
                    key={value}
                    onClick={() => setCategoryFilter(value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      active
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              {isLoading && (
                <div className="flex items-center justify-center py-8 text-gray-400 dark:text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading notes…
                </div>
              )}
              {!isLoading && !filteredNotes.length && (
                <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 p-6 text-center text-sm text-gray-500 dark:text-slate-400">
                  No notes yet. Add one to get started.
                </div>
              )}
              {filteredNotes.map((note) => {
                const active = note.id === selectedNoteId;
                const title = deriveTitle(note.content);
                const preview = derivePreview(note.content);
                const sharedCount = note.sharedWith?.length || 0;
                const taskCount = note.linkedTasks?.length || 0;
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => {
                      if (!allowManualSelection) return;
                      setSelectedNoteId(note.id);
                    }}
                    className={`w-full text-left rounded-2xl border transition p-4 space-y-2 ${
                      active
                        ? "border-emerald-500 bg-emerald-50/80 shadow"
                        : "border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:border-emerald-700/60 dark:bg-slate-900/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">{title}</div>
                        <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold">
                          {note.category}
                        </div>
                      </div>
                      <span className="text-[11px] text-gray-400 dark:text-slate-500 whitespace-nowrap">
                        {new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{preview || "No additional context."}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400 dark:text-slate-500">
                      {!note.isOwner && note.owner ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 border border-gray-200 dark:bg-slate-800/60 dark:border-slate-700">
                          <Users className="w-3 h-3" /> shared by {note.owner.name || "Unknown"}
                        </span>
                      ) : null}
                      {sharedCount ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 border border-gray-200 dark:bg-slate-800/60 dark:border-slate-700">
                          <Share2 className="w-3 h-3" /> {sharedCount} teammate{sharedCount > 1 ? "s" : ""}
                        </span>
                      ) : null}
                      {taskCount ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 border border-gray-200 dark:bg-slate-800/60 dark:border-slate-700">
                          <ListTodo className="w-3 h-3" /> {taskCount} linked task{taskCount > 1 ? "s" : ""}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-sm min-h-[460px]">
            {!filteredSelectedNote ? (
              <div className="flex flex-col items-center justify-center gap-3 h-full text-sm text-gray-400 dark:text-slate-500">
                <FileText className="w-8 h-8" />
                Select a note to view its details.
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-gray-100 dark:border-slate-800 p-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {deriveTitle(filteredSelectedNote.content)}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                        {filteredSelectedNote.category}
                      </span>
                      <span>{humanizeDate(filteredSelectedNote.updatedAt || filteredSelectedNote.createdAt)}</span>
                      {filteredSelectedNote.owner && !filteredSelectedNote.isOwner ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3" /> {filteredSelectedNote.owner.name || "Owner"}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {filteredSelectedNote.canEdit && !readOnly ? (
                      editingNoteId === filteredSelectedNote.id ? (
                        <>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleEditNote}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium shadow hover:bg-emerald-700"
                          >
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            Save
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                          </motion.button>
                        </>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => beginEdit(filteredSelectedNote)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-gray-700 border border-gray-200 text-xs font-medium shadow-sm hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Edit
                        </motion.button>
                      )
                    ) : null}
                    {filteredSelectedNote.isOwner && !readOnly ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => openShareModal(filteredSelectedNote)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-gray-700 border border-gray-200 text-xs font-medium shadow-sm hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Share
                      </motion.button>
                    ) : null}
                    {filteredSelectedNote.canEdit && !readOnly ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => openTaskModal(filteredSelectedNote)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-gray-700 border border-gray-200 text-xs font-medium shadow-sm hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                      >
                        <ListTodo className="w-3.5 h-3.5" />
                        Convert to tasks
                      </motion.button>
                    ) : null}
                    {filteredSelectedNote.isOwner && !readOnly ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleDeleteNote(filteredSelectedNote.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 border border-red-200 text-xs font-medium shadow-sm hover:bg-red-500/20"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Delete
                      </motion.button>
                    ) : null}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {editingNoteId === filteredSelectedNote.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold uppercase text-gray-400 dark:text-slate-500">Category</label>
                        <select
                          value={editingNoteCategory}
                          onChange={(e) => setEditingNoteCategory(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm px-3 py-2 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">Select</option>
                          {NOTE_CATEGORIES.map((category) => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        value={editingNoteContent}
                        onChange={(e) => setEditingNoteContent(e.target.value)}
                        rows={10}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm px-3 py-2 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/80 p-4 text-sm text-gray-700 dark:text-slate-200 whitespace-pre-wrap">
                        {filteredSelectedNote.content || "This note has no written content yet."}
                      </div>
                      {filteredSelectedNote.sharedWith?.length ? (
                        <div className="space-y-2">
                          <h4 className="text-xs uppercase font-semibold text-gray-400 dark:text-slate-500">Shared with</h4>
                          <div className="flex flex-wrap gap-2">
                            {filteredSelectedNote.sharedWith.map((share) => (
                              <span
                                key={share.userId}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                              >
                                <Users className="w-3 h-3" />
                                {share.name}
                                {share.canEdit ? <span className="text-emerald-500 font-semibold">· edit</span> : null}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {filteredSelectedNote.linkedTasks?.length ? (
                        <div className="space-y-2">
                          <h4 className="text-xs uppercase font-semibold text-gray-400 dark:text-slate-500">Linked tasks</h4>
                          <div className="space-y-2">
                            {filteredSelectedNote.linkedTasks.map((task) => (
                              <button
                                key={task.taskId}
                                type="button"
                                onClick={() => openLinkedTaskDetails(task)}
                                className="w-full text-left rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 py-2 text-xs text-gray-600 dark:text-slate-300 transition hover:border-emerald-300/60 hover:bg-emerald-50/40 dark:hover:border-emerald-600/60 dark:hover:bg-emerald-900/40 hover:shadow"
                                title="View assigned task details"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-gray-800 dark:text-slate-100">{task.title || "Untitled task"}</span>
                                  {task.deadline ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                                      <Clock className="w-3 h-3" /> {new Date(task.deadline).toLocaleDateString()}
                                    </span>
                                  ) : null}
                                </div>
                                {task.assignees?.length ? (
                                  <div className="flex items-center gap-2 mt-1 text-gray-400 dark:text-slate-500">
                                    <Users className="w-3 h-3" />
                                    {task.assignees.map((assignee) => assignee.name).join(", ")}
                                  </div>
                                ) : null}
                                {task.sourceText ? (
                                  <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">“{task.sourceText}”</p>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      </div>

      <AnimatePresence>
        {readOnly && sharedComposerDraft?.open && (
          <motion.div
            className="fixed inset-0 z-[105] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-xl bg-emerald-900/40 border border-emerald-500/30 text-emerald-50 rounded-2xl shadow-xl p-4 sm:p-5 space-y-4"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-emerald-100">Live draft in progress…</h3>
                  <p className="text-xs text-emerald-200/80">
                    You’re viewing {(sharedComposerDraft?.hostName || "the host").replace(/\s+$/, "")}'s note while they type.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {sharedComposerDraft?.category ? (
                  <div>
                    <label className="text-xs font-semibold uppercase text-emerald-200/70">Category</label>
                    <div className="mt-1 px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-950/40 text-sm text-emerald-100">
                      {sharedComposerDraft.category}
                    </div>
                  </div>
                ) : null}
                <div>
                  <label className="text-xs font-semibold uppercase text-emerald-200/70">Draft content</label>
                  <textarea
                    value={sharedComposerDraft?.content || ""}
                    readOnly
                    rows={8}
                    className="mt-1 w-full rounded-lg border border-emerald-500/40 bg-emerald-950/60 text-sm text-emerald-100 px-3 py-2"
                  />
                </div>
              </div>
              <div className="text-xs text-emerald-200/70">
                Waiting for the host to save or share this note with the team.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {linkedTaskModalOpen && (
          <motion.div
            className="fixed inset-0 z-[125] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-4xl bg-slate-950/70 text-emerald-50 border border-emerald-500/30 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-emerald-500/30 bg-emerald-950/40">
                <h3 className="text-lg font-semibold">Assigned Task Details</h3>
                <button
                  onClick={closeLinkedTaskModal}
                  className="p-2 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/50 text-emerald-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {linkedTaskModalLoading ? (
                <div className="py-12 flex items-center justify-center text-sm text-emerald-100">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading task…
                </div>
              ) : linkedTaskDetails ? (
                <div className="relative">
                  {linkedTaskModalError && (
                    <div className="mx-6 mt-4 rounded-lg border border-amber-400/40 bg-amber-500/10 text-amber-100 text-xs px-3 py-2">
                      {linkedTaskModalError}
                    </div>
                  )}
                  <div className="px-2 pb-4">
                    <AssignedTaskDetails
                      task={linkedTaskDetails}
                      taskLogs={linkedTaskLogs}
                      users={availableUsers}
                      onClose={closeLinkedTaskModal}
                      currentUserId={currentUser?.id}
                      currentUserName={currentUser?.name}
                      isManager={["admin", "team_manager"].includes(currentUser?.role)}
                    />
                  </div>
                </div>
              ) : (
                <div className="py-12 px-6 text-sm text-rose-200">
                  {linkedTaskModalError || "We couldn’t load that task just now."}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {composerOpen && !readOnly && (
          <motion.div
            className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xl p-4 sm:p-5 space-y-4"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New note</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Quickly jot down meeting takeaways or action items.</p>
                  </div>
                  <button onClick={resetComposer} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-400 dark:text-slate-500">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm px-3 py-2 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select category</option>
                      {NOTE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-400 dark:text-slate-500">Note content</label>
                    <textarea
                      value={newNote}
                      ref={composerRef}
                      onKeyDown={handleComposerKeyDown}
                      onChange={handleComposerChange}
                      onBlur={() => setNewNote((prev) => ensureNumbering(prev))}
                      rows={8}
                      placeholder="Write what was discussed, key decisions, or follow-up actions…"
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm px-3 py-2 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setNewNote((prev) => {
                        const trimmed = prev.replace(/\s+$/, "");
                        const lines = trimmed ? trimmed.split(/\n/) : [];
                        const nextNumber = lines.filter((line) => line.trim()).length + 1;
                        const nextValue = `${trimmed}${trimmed ? "\n" : ""}${nextNumber}. `;
                        requestAnimationFrame(() => {
                          if (composerRef.current) {
                            composerRef.current.selectionStart = composerRef.current.selectionEnd = nextValue.length;
                          }
                        });
                        return nextValue;
                      });
                    }}
                    className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Start a bullet point
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={resetComposer}
                      className="px-4 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNote}
                      disabled={isLoading}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save note"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {convertPrompt && (
            <motion.div
              className="fixed inset-0 z-[125] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xl p-5 space-y-4"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Convert to tasks?</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    We spotted numbered bullet points. Would you like to turn them into tasks now?
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setConvertPrompt(null)}
                    className="px-4 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Not now
                  </button>
                  <button
                    onClick={() => {
                      const noteToUse = notes.find((note) => note.id === convertPrompt.id) || convertPrompt;
                      setConvertPrompt(null);
                      openTaskModal(noteToUse);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                  >
                    Convert now
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {shareModalNote && (
            <motion.div
              className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xl p-5 space-y-4"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Share note</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Choose teammates who should see this note.</p>
                  </div>
                  <button onClick={closeShareModal} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="max-h-[360px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                  {allShareCandidates.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      No other members available to share with right now.
                    </p>
                  ) : (
                    allShareCandidates.map((user) => {
                      const selected = shareSelected.includes(user.id);
                      return (
                        <label
                          key={user.id}
                          className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 cursor-pointer transition ${
                            selected
                              ? "border-emerald-400 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-900/30"
                              : "border-gray-200 dark:border-slate-700 hover:border-emerald-300"
                          }`}
                          onClick={(e) => {
                            if (e.target.tagName !== "INPUT") toggleShareTarget(user.id);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                              checked={selected}
                              onChange={() => toggleShareTarget(user.id)}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{user.name}</p>
                              <p className="text-xs text-gray-500 dark:text-slate-400">{user.role || "Member"}</p>
                            </div>
                          </div>
                          {selected ? (
                            <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-300">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 text-emerald-600 focus:ring-emerald-500"
                                checked={Boolean(shareCanEdit[user.id])}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleShareCanEdit(user.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              Can edit
                            </label>
                          ) : null}
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeShareModal}
                    className="px-4 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitShare}
                    disabled={shareSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {shareSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {taskModalNote && (
            <motion.div
              className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-2xl p-5 space-y-4"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create tasks from note</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Select the bullet points that should become tasks. Adjust assignees and deadlines before saving.
                    </p>
                  </div>
                  <button onClick={closeTaskModal} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={handleTaskAiAssist}
                    disabled={taskAiBusy}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-900/30 dark:text-emerald-200"
                  >
                    {taskAiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Suggest with AI
                  </button>
                  <span className="text-xs text-gray-500 dark:text-slate-400">{taskDrafts.filter((draft) => draft.include).length} selected</span>
                </div>

                <div className="max-h-[58vh] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                  {taskDrafts.map((draft, idx) => (
                    <div
                      key={draft.id}
                      className={`rounded-2xl border p-4 space-y-3 transition ${
                        draft.include
                          ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-900/40"
                          : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                          checked={draft.include}
                          onChange={() => toggleTaskInclude(draft.id)}
                        />
                        <div className="flex-1 space-y-3">
                          <div className="text-xs text-gray-400 dark:text-slate-500">{idx + 1}. {draft.sourceText}</div>
                          <input
                            value={draft.title}
                            onChange={(e) => updateTaskDraft(draft.id, { title: e.target.value })}
                            placeholder="Task title"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                          />
                          <textarea
                            value={draft.description}
                            onChange={(e) => updateTaskDraft(draft.id, { description: e.target.value })}
                            placeholder="Optional description"
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                          />
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-gray-400 dark:text-slate-500">Deadline</label>
                              <input
                                type="date"
                                value={draft.deadline}
                                onChange={(e) => updateTaskDraft(draft.id, { deadline: e.target.value })}
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                           <div>
                             <label className="text-xs font-semibold text-gray-400 dark:text-slate-500">Assignees</label>
                              <select
                                multiple={canAssignOthers}
                                disabled={!canAssignOthers}
                                value={
                                  canAssignOthers
                                    ? draft.assignees.map(String)
                                    : draft.assignees[0]
                                      ? String(draft.assignees[0])
                                      : ""
                                }
                                onChange={(e) =>
                                  handleTaskAssignees(
                                    draft.id,
                                    Array.from(e.target.selectedOptions, (option) => option.value)
                                  )
                                }
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 min-h-[70px] disabled:opacity-70"
                              >
                                {availableAssignees.length ? (
                                  availableAssignees.map((user) => (
                                    <option key={user.id} value={user.id}>
                                      {user.name}
                                      {user.role ? ` (${user.role})` : ""}
                                    </option>
                                  ))
                                ) : (
                                  <option disabled>No teammates available</option>
                                )}
                             </select>
                              {!canAssignOthers && (
                                <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
                                  You can assign tasks to yourself only.
                                </p>
                              )}
                           </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeTaskModal}
                    className="px-4 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTasks}
                    disabled={taskSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {taskSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create tasks"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {localError && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="fixed bottom-6 right-6 z-[140] flex items-center gap-2 rounded-xl bg-red-500 text-white px-4 py-2 text-sm shadow-lg"
            >
              <AlertTriangle className="w-4 h-4" /> {localError}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {localSuccess && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="fixed bottom-6 right-6 z-[140] flex items-center gap-2 rounded-xl bg-emerald-500 text-white px-4 py-2 text-sm shadow-lg"
            >
              <CheckCircle className="w-4 h-4" /> {localSuccess}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #b6e0fe66;
          border-radius: 3px;
        }
        .custom-scrollbar {
          scrollbar-color: #60a5fa44 transparent;
          scrollbar-width: thin;
        }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2563eb77;
        }
      `}</style>
    </div>
  );
};

export default MyNotes;


export function MyNotesPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;
  const [availableUsers, setAvailableUsers] = useState([]);
  const currentUser = useMemo(
    () => ({
      id: userId,
      name: session?.user?.name || "You",
      role: session?.user?.role || "member",
    }),
    [userId, session?.user?.name, session?.user?.role]
  );

  useEffect(() => {
    if (!userId) {
      setAvailableUsers([]);
      return;
    }
    let cancelled = false;
    const loadUsers = async () => {
      try {
        const response = await fetch("/api/member/users", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        const data = await response.json();
        if (!cancelled && response.ok) {
          setAvailableUsers(Array.isArray(data.users) ? data.users : []);
        }
      } catch {
        if (!cancelled) setAvailableUsers([]);
      }
    };
    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-sm text-gray-500 dark:text-slate-400">
        Unable to load notes. Please sign in and try again.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <MyNotes
        userId={userId}
        availableUsers={availableUsers}
        currentUser={currentUser}
        twoPane
        setError={() => {}}
        setSuccess={() => {}}
      />
    </div>
  );
}
