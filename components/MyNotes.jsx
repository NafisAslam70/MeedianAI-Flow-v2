"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Clock,
  Edit,
  Trash2,
  CheckCircle,
  AlertTriangle,
  FileText,
  X,
} from "lucide-react";

const MyNotes = ({
  userId,
  setError = () => {},
  setSuccess = () => {},
  embedded = false,
}) => {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [editingNoteCategory, setEditingNoteCategory] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showViewNotesModal, setShowViewNotesModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localSuccess, setLocalSuccess] = useState("");

  /* Load notes */
  useEffect(() => {
    const fetchNotes = async () => {
      setIsLoading(true);
      try {
        const r = await fetch(`/api/member/notes?userId=${userId}`);
        const d = await r.json();
        if (r.ok) setNotes(d.notes || []);
        else throw new Error(d.error || "Failed to fetch notes");
      } catch (err) {
        setError(err.message);
        setLocalError(err.message);
        setTimeout(() => {
          setError("");
          setLocalError("");
        }, 3000);
      } finally {
        setIsLoading(false);
      }
    };
    if (userId) fetchNotes();
  }, [userId, setError]);

  /* Helpers */
  const closeAllInner = useCallback(() => {
    setShowViewNotesModal(false);
    setShowAddNoteModal(false);
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeAllInner();
    if (showViewNotesModal || showAddNoteModal) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [showViewNotesModal, showAddNoteModal, closeAllInner]);

  const flash = (ok, msg) => {
    (ok ? setSuccess : setError)(msg);
    (ok ? setLocalSuccess : setLocalError)(msg);
    setTimeout(() => {
      setSuccess("");
      setError("");
      setLocalSuccess("");
      setLocalError("");
    }, ok ? 2500 : 3000);
  };

  /* Actions */
  const handleAddNote = async () => {
    if (!newNote.trim()) return flash(false, "Note content cannot be empty");
    if (!newCategory) return flash(false, "Please select a category");
    setIsLoading(true);
    try {
      const r = await fetch("/api/member/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, content: newNote, category: newCategory }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to add note");
      setNotes((p) => [...p, d.note]);
      setNewNote("");
      setNewCategory("");
      flash(true, "Note added!");
      setShowAddNoteModal(false);
    } catch (err) {
      flash(false, err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditNote = async (noteId) => {
    if (!editingNoteContent.trim())
      return flash(false, "Note content cannot be empty");
    if (!editingNoteCategory) return flash(false, "Please select a category");
    setIsLoading(true);
    try {
      const r = await fetch(`/api/member/notes?noteId=${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId,
          content: editingNoteContent,
          category: editingNoteCategory,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to update note");
      setNotes((p) =>
        p.map((n) =>
          n.id === noteId
            ? { ...n, content: editingNoteContent, category: editingNoteCategory }
            : n
        )
      );
      setEditingNoteId(null);
      setEditingNoteContent("");
      setEditingNoteCategory("");
      flash(true, "Note updated!");
    } catch (err) {
      flash(false, err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    setIsLoading(true);
    try {
      const r = await fetch(`/api/member/notes?noteId=${noteId}`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to delete note");
      setNotes((p) => p.filter((n) => n.id !== noteId));
      flash(true, "Note deleted!");
    } catch (err) {
      flash(false, err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /* UI */
  const twoPane = showViewNotesModal && showAddNoteModal;
  const colsClass = twoPane ? "grid-cols-2" : "grid-cols-1";

  return (
    <div className={embedded ? "w-full" : "w-full"}>
      {/* Root inline card (doesn't change page size) */}
      <div className="w-full rounded-2xl border border-teal-200/50 bg-white/80 dark:bg-slate-900/70 shadow-xl px-6 py-5 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-teal-600" />
          My Notes
        </h2>
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              setShowViewNotesModal(true);
              setShowAddNoteModal(false);
            }}
            className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-800"
          >
            View Notes
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              setShowAddNoteModal(true);
              setShowViewNotesModal(false);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            Add New Note
          </motion.button>
        </div>
      </div>

      {/* Overlay matches UpdateStatusForAll sizing */}
      <AnimatePresence>
        {(showViewNotesModal || showAddNoteModal) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-start justify-center bg-gradient-to-br from-teal-50 to-blue-50/80 p-2 md:p-8 overflow-y-auto"
            style={{ minHeight: "100vh" }}
          >
            <div
              className={`
                relative w-full max-w-[96vw] min-h-[70vh] max-h-[92vh]
                bg-white/80 dark:bg-slate-900/70
                border border-teal-200/70 shadow-2xl
                rounded-3xl
                px-2 md:px-10 py-7 flex flex-col overflow-visible
                glassmorphism
                backdrop-blur-2xl
                transition-all
              `}
              style={{
                boxShadow:
                  "0 12px 40px 0 rgba(16, 42, 67, 0.12), 0 2px 12px 0 rgba(16,42,67,0.09)",
              }}
            >
              {/* Single top-right close (same pattern as UpdateStatusForAll) */}
              <motion.button
                whileHover={{ scale: 1.13, rotate: 90 }}
                whileTap={{ scale: 0.92 }}
                onClick={closeAllInner}
                className="absolute top-6 right-6 z-50 p-2 bg-gray-100/80 hover:bg-gray-300/80 rounded-full shadow-lg border border-gray-200 transition-all"
                aria-label="Close"
              >
                <X className="w-6 h-6 text-gray-700 dark:text-gray-200" />
              </motion.button>

              <div className={`grid ${colsClass} h-full gap-8`}>
                {/* VIEW NOTES PANE */}
                {showViewNotesModal && (
                  <div className="min-w-0 h-full flex flex-col rounded-2xl bg-gradient-to-br from-blue-50/60 to-slate-100/80 dark:from-slate-800/80 dark:to-slate-900/70 border border-teal-100/70 shadow-xl">
                    <div className="flex items-center justify-between p-5 border-b border-white/40 dark:border-slate-700/60">
                      <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-6 h-6 text-teal-600" />
                        Your Notes
                      </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 custom-scrollbar">
                      {isLoading && (
                        <motion.p
                          className="text-sm text-gray-500 text-center mt-10"
                          initial={{ opacity: 0.6 }}
                          animate={{ opacity: 1 }}
                        >
                          Loading notes...
                        </motion.p>
                      )}
                      {!isLoading && notes.length === 0 && (
                        <motion.p
                          className="text-sm text-gray-500 text-center mt-10"
                          initial={{ opacity: 0.6 }}
                          animate={{ opacity: 1 }}
                        >
                          No notes yet.
                        </motion.p>
                      )}
                      {notes.map((note) => (
                        <motion.div
                          key={note.id}
                          className="flex gap-2 p-3 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700 shadow"
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          {editingNoteId === note.id ? (
                            <div className="flex-1 flex flex-col gap-2">
                              <select
                                value={editingNoteCategory}
                                onChange={(e) =>
                                  setEditingNoteCategory(e.target.value)
                                }
                                className="w-full px-4 py-2 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200"
                              >
                                <option value="">Select Category</option>
                                {[
                                  "MSP",
                                  "MHCP",
                                  "MHP",
                                  "MOP",
                                  "Other",
                                  "Building Home",
                                ].map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                              <textarea
                                value={editingNoteContent}
                                onChange={(e) =>
                                  setEditingNoteContent(e.target.value)
                                }
                                className="w-full px-4 py-2 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200"
                                rows={4}
                              />
                              <div className="flex gap-2">
                                <motion.button
                                  whileHover={{ scale: 1.04 }}
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => handleEditNote(note.id)}
                                  className="px-3 py-1 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-800"
                                >
                                  Save
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.04 }}
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setEditingNoteContent("");
                                    setEditingNoteCategory("");
                                  }}
                                  className="px-3 py-1 bg-gray-500 text-white rounded-xl text-sm font-medium hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700"
                                >
                                  Cancel
                                </motion.button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-teal-700 dark:text-teal-300 font-bold">
                                  [{note.category}]
                                </span>
                                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                  {new Date(note.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-800 dark:text-gray-100">
                                {note.content}
                              </p>
                              <div className="flex gap-2 mt-2">
                                <motion.button
                                  whileHover={{ scale: 1.04 }}
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => {
                                    setEditingNoteId(note.id);
                                    setEditingNoteContent(note.content);
                                    setEditingNoteCategory(note.category);
                                  }}
                                  className="px-3 py-1 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                                >
                                  Edit
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.04 }}
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="px-3 py-1 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
                                >
                                  Delete
                                </motion.button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>

                    <AnimatePresence>
                      {localError && (
                        <motion.p
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="p-4 pt-0 text-red-600 text-sm font-medium flex items-center gap-1"
                        >
                          <AlertTriangle className="w-4 h-4" /> {localError}
                        </motion.p>
                      )}
                      {localSuccess && (
                        <motion.p
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="p-4 pt-0 text-emerald-600 text-sm font-medium flex items-center gap-1"
                        >
                          <CheckCircle className="w-4 h-4" /> {localSuccess}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ADD NOTE PANE */}
                {showAddNoteModal && (
                  <div className="min-w-0 h-full flex flex-col rounded-2xl bg-gradient-to-br from-blue-50/60 to-slate-100/80 dark:from-slate-800/80 dark:to-slate-900/70 border border-teal-100/70 shadow-xl">
                    <div className="flex items-center justify-between p-5 border-b border-white/40 dark:border-slate-700/60">
                      <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AlertCircle className="w-6 h-6 text-teal-600" />
                        Add New Note
                      </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar">
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          Category
                        </label>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className="w-full px-4 py-2 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200"
                        >
                          <option value="">Select Category</option>
                          {["MSP", "MHCP", "MHP", "MOP", "Other", "Building Home"].map(
                            (c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          Note Content
                        </label>
                        <textarea
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Write a new note..."
                          className="w-full px-4 py-2 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200"
                          rows={4}
                        />
                      </div>
                    </div>

                    <div className="p-4 md:p-5 border-t border-white/40 dark:border-slate-700/60 flex justify-end gap-3">
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setShowAddNoteModal(false)}
                        className="px-5 py-2 bg-gray-500 text-white rounded-xl text-sm font-medium hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={handleAddNote}
                        disabled={isLoading}
                        className={`px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium ${
                          isLoading
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-800"
                        }`}
                      >
                        {isLoading ? (
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="inline-block w-4 h-4 border-4 border-t-teal-200 border-teal-600 rounded-full"
                          />
                        ) : (
                          "Add Note"
                        )}
                      </motion.button>
                    </div>

                    <AnimatePresence>
                      {localError && (
                        <motion.p
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="px-5 pb-5 text-red-600 text-sm font-medium flex items-center gap-1"
                        >
                          <AlertTriangle className="w-4 h-4" /> {localError}
                        </motion.p>
                      )}
                      {localSuccess && (
                        <motion.p
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="px-5 pb-5 text-emerald-600 text-sm font-medium flex items-center gap-1"
                        >
                          <CheckCircle className="w-4 h-4" /> {localSuccess}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom scrollbar */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 7px;
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #b6e0fe66;
          border-radius: 6px;
        }
        .custom-scrollbar {
          scrollbar-color: #60a5fa44 #0000;
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
