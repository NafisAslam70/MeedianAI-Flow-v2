import { motion } from "framer-motion";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const TaskForm = ({
  formData,
  setFormData,
  members,
  loading,
  isRecording,
  isTranslating,
  handleSubmit,
  inputMode,
  setInputMode,
  setShowModal,
  setVoiceInput,
  setTempAssignees,
  autoObserverIds = [],
}) => {
  const { data: session } = useSession();
  const router = useRouter();
  const canEditAssignees = ["admin", "team_manager"].includes(session?.user?.role);
  const managerOptions = useMemo(() => {
    if (!Array.isArray(members)) return [];
    return members.filter((member) => member && member.role === "team_manager");
  }, [members]);
  const memberOptions = useMemo(() => {
    if (!Array.isArray(members)) return [];
    return members.filter((member) => member && member.role === "member");
  }, [members]);
  const [showManagerAssigneeQuick, setShowManagerAssigneeQuick] = useState(false);
  const [showMemberAssigneeQuick, setShowMemberAssigneeQuick] = useState(false);
  const [showDoerPicker, setShowDoerPicker] = useState(false);
  const [showObserverPicker, setShowObserverPicker] = useState(false);
  const selfId = session?.user?.id ? Number(session.user.id) : null;
  const defaultObserverIds = useMemo(
    () => (Array.isArray(autoObserverIds) ? autoObserverIds.map((id) => Number(id)) : []),
    [autoObserverIds]
  );
  const defaultObserverMembers = useMemo(() => {
    if (!Array.isArray(members)) return [];
    return defaultObserverIds
      .map((id) => members.find((member) => Number(member.id) === Number(id)) || null)
      .filter(Boolean);
  }, [defaultObserverIds, members]);
  const defaultObserverLabel = useMemo(() => {
    if (defaultObserverMembers.length) {
      return defaultObserverMembers
        .map((observer) => observer?.name || (observer?.id != null ? `Observer ${observer.id}` : null))
        .filter(Boolean)
        .join(", ");
    }
    return defaultObserverIds.length ? defaultObserverIds.map((id) => `#${id}`).join(", ") : "";
  }, [defaultObserverMembers, defaultObserverIds]);
  const areDefaultsApplied = useMemo(() => {
    if (!defaultObserverIds.length) return true;
    const selected = new Set((formData.observers || []).map((id) => Number(id)));
    return defaultObserverIds.every((id) => selected.has(Number(id)));
  }, [defaultObserverIds, formData.observers]);

  const hasAutoAppliedDefaults = useRef(false);

  const defaultObserverSignature = useMemo(
    () => defaultObserverIds.slice().sort((a, b) => a - b).join(","),
    [defaultObserverIds]
  );

  useEffect(() => {
    hasAutoAppliedDefaults.current = false;
  }, [defaultObserverSignature]);

  useEffect(() => {
    if (hasAutoAppliedDefaults.current) return;

    if (!defaultObserverIds.length || areDefaultsApplied) {
      hasAutoAppliedDefaults.current = true;
      return;
    }

    setFormData((prev) => {
      const observerSet = new Set((prev.observers || []).map((id) => Number(id)));
      let updated = false;
      defaultObserverIds.forEach((observerId) => {
        if (!observerSet.has(Number(observerId))) {
          observerSet.add(Number(observerId));
          updated = true;
        }
      });

      if (!updated) {
        return prev;
      }

      hasAutoAppliedDefaults.current = true;
      return { ...prev, observers: Array.from(observerSet) };
    });
  }, [areDefaultsApplied, defaultObserverIds, setFormData]);

  const isSelfAlreadyAssigned = useMemo(() => {
    if (selfId == null) return false;
    return formData.assignees.some((id) => Number(id) === Number(selfId));
  }, [formData.assignees, selfId]);

  const handleApplyDefaultObservers = () => {
    if (!defaultObserverIds.length) return;
    setFormData((prev) => {
      const observerSet = new Set((prev.observers || []).map((id) => Number(id)));
      defaultObserverIds.forEach((id) => observerSet.add(Number(id)));
      return { ...prev, observers: Array.from(observerSet) };
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="w-full flex flex-col gap-4 h-full overflow-y-auto">
      <div className="bg-white/85 backdrop-blur-lg rounded-3xl border border-slate-100 shadow-xl p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg className="w-6 sm:w-7 h-6 sm:h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <h2 className="text-base sm:text-xl font-bold text-gray-800">Create Task</h2>
          </div>
          {["admin", "team_manager"].includes(session?.user?.role) && (
            <motion.button
              onClick={() => router.push("/dashboard/managersCommon/announcements")}
              className="px-3 py-2 bg-teal-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-teal-700"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Announcement
            </motion.button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start">
                  <div className="flex min-w-[220px] flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-teal-600 font-semibold">Doers</p>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-teal-700 shadow-sm">
                        {formData.assignees.length} selected
                      </span>
                      {canEditAssignees && (
                        <motion.button
                          onClick={() => setShowDoerPicker((prev) => !prev)}
                          className="px-2 py-1 rounded-full border border-transparent bg-teal-600/10 text-[11px] font-semibold text-teal-700 hover:bg-teal-600/20"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {showDoerPicker ? "Hide quick add" : "Quick add"}
                        </motion.button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.assignees.length > 0 ? (
                        formData.assignees.map((assigneeId, index) => {
                          const member = members ? members.find((m) => Number(m.id) === Number(assigneeId)) : null;
                          return (
                            member && (
                              <span
                                key={`assignee-${assigneeId}-${index}`}
                                className="px-2 py-1 bg-white/70 text-teal-700 border border-teal-200/70 rounded-full text-xs sm:text-sm font-medium flex items-center shadow-sm"
                              >
                                {member.name}
                                {canEditAssignees && (
                                  <button
                                    onClick={() =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        assignees: prev.assignees.filter((id) => Number(id) !== Number(assigneeId)),
                                      }))
                                    }
                                    className="ml-2 text-red-500 hover:text-red-700"
                                    aria-label="Remove assignee"
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            )
                          );
                        })
                      ) : (
                        <span className="text-xs text-teal-700/80">
                          {canEditAssignees ? "No doers yet. Tap quick add to draft a crew." : "You'll be the doer for this task."}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canEditAssignees && (
                        <motion.button
                          onClick={() => {
                            setTempAssignees(formData.assignees);
                            setShowModal("assignee");
                          }}
                          className="px-3 py-1.5 rounded-full bg-white/90 border border-teal-200 text-teal-700 text-xs sm:text-sm font-semibold hover:bg-white"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Open picker
                        </motion.button>
                      )}
                      {selfId != null && (
                        <motion.button
                          onClick={() => {
                            setFormData((prev) => {
                              const assigneeSet = new Set(prev.assignees.map((id) => Number(id)));
                              assigneeSet.add(Number(selfId));
                              return {
                                ...prev,
                                assignees: Array.from(assigneeSet),
                              };
                            });
                          }}
                          disabled={isSelfAlreadyAssigned}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
                            isSelfAlreadyAssigned
                              ? "bg-gray-200 text-gray-500 cursor-default"
                              : "bg-teal-600 text-white hover:bg-teal-700"
                          }`}
                          whileHover={{ scale: isSelfAlreadyAssigned ? 1 : 1.03 }}
                          whileTap={{ scale: isSelfAlreadyAssigned ? 1 : 0.97 }}
                        >
                          {isSelfAlreadyAssigned ? "You're in" : "Add me"}
                        </motion.button>
                      )}
                    </div>
                  </div>

                  <div className="flex min-w-[220px] flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700 font-semibold">Observers</p>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-sky-700 shadow-sm">
                        {formData.observers?.length || 0} watching
                      </span>
                      <motion.button
                        onClick={() => setShowObserverPicker((prev) => !prev)}
                        className="px-2 py-1 rounded-full border border-transparent bg-sky-600/10 text-[11px] font-semibold text-sky-700 hover:bg-sky-600/20"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {showObserverPicker ? "Hide manager list" : "Manage"}
                      </motion.button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(formData.observers) && formData.observers.length > 0 ? (
                        formData.observers.map((observerId, index) => {
                          const member = members ? members.find((m) => Number(m.id) === Number(observerId)) : null;
                          const label = member?.name || `Observer ${observerId}`;
                          return (
                            <span
                              key={`observer-${observerId}-${index}`}
                              className="px-2 py-1 bg-white/70 text-sky-700 border border-sky-200/70 rounded-full text-xs sm:text-sm font-medium flex items-center shadow-sm"
                            >
                              {label}
                              <button
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    observers: prev.observers.filter((id) => Number(id) !== Number(observerId)),
                                  }))
                                }
                                className="ml-2 text-red-500 hover:text-red-700"
                                aria-label="Remove observer"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-sky-700/80">Defaults are watching this task for you.</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {areDefaultsApplied ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-medium text-sky-700">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 00-1.414 0L9 11.586 6.707 9.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l7-7a1 1 0 000-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Defaults pinned
                        </span>
                      ) : (
                        <motion.button
                          onClick={handleApplyDefaultObservers}
                          className="px-3 py-1.5 rounded-full bg-sky-600 text-white text-xs font-semibold shadow-sm hover:bg-sky-700"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          Apply defaults
                        </motion.button>
                      )}
                      {defaultObserverIds.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium text-sky-600 shadow-sm">
                          {defaultObserverLabel || defaultObserverIds.map((id) => `#${id}`).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex min-w-[220px] flex-col gap-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-600 font-semibold">Assignment mode</p>
                  <div className="flex flex-wrap gap-2">
                    <motion.button
                      onClick={() => setFormData((prev) => ({ ...prev, distribution: "shared" }))}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold ${
                        formData.distribution === "shared" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700"
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={!canEditAssignees}
                    >
                      Share with team
                    </motion.button>
                    <motion.button
                      onClick={() => canEditAssignees && setFormData((prev) => ({ ...prev, distribution: "individual" }))}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold ${
                        formData.distribution === "individual" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700"
                      }`}
                      whileHover={{ scale: canEditAssignees ? 1.02 : 1 }}
                      whileTap={{ scale: canEditAssignees ? 0.98 : 1 }}
                      disabled={!canEditAssignees}
                    >
                      Individual copies
                    </motion.button>
                  </div>
                  {!canEditAssignees && (
                    <p className="text-[11px] text-gray-500">
                      Members create tasks for themselves; managers can redistribute later.
                    </p>
                  )}
                </div>
              </div>

              {showDoerPicker && canEditAssignees && (
                <div className="rounded-2xl border border-teal-100 bg-white/90 p-3 flex flex-col gap-3 shadow-inner">
                  {managerOptions.length > 0 && (
                    <div>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between text-[11px] uppercase tracking-[0.18em] text-teal-600 font-semibold"
                        onClick={() => setShowManagerAssigneeQuick((prev) => !prev)}
                      >
                        <span>Managers</span>
                        <span>{showManagerAssigneeQuick ? "−" : "+"}</span>
                      </button>
                      {showManagerAssigneeQuick && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {managerOptions.map((manager) => {
                            const isSelected = formData.assignees.some(
                              (assigneeId) => Number(assigneeId) === Number(manager.id)
                            );
                            return (
                              <motion.button
                                key={`assignee-manager-chip-${manager.id}`}
                                onClick={() => {
                                  setFormData((prev) => {
                                    if (prev.assignees.some((id) => Number(id) === Number(manager.id))) return prev;
                                    return {
                                      ...prev,
                                      assignees: [...prev.assignees, Number(manager.id)],
                                    };
                                  });
                                }}
                                disabled={isSelected}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                  isSelected
                                    ? "border-teal-200 bg-teal-100 text-teal-700 cursor-default"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50"
                                }`}
                                whileHover={{ scale: isSelected ? 1 : 1.03 }}
                                whileTap={{ scale: isSelected ? 1 : 0.97 }}
                              >
                                {manager.name || `Manager ${manager.id}`}
                              </motion.button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {memberOptions.length > 0 && (
                    <div>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-600 font-semibold"
                        onClick={() => setShowMemberAssigneeQuick((prev) => !prev)}
                      >
                        <span>Members</span>
                        <span>{showMemberAssigneeQuick ? "−" : "+"}</span>
                      </button>
                      {showMemberAssigneeQuick && (
                        <div className="mt-2 max-h-40 overflow-y-auto custom-scrollbar pr-1 flex flex-wrap gap-2">
                          {memberOptions.map((member) => {
                            const isSelected = formData.assignees.some(
                              (assigneeId) => Number(assigneeId) === Number(member.id)
                            );
                            return (
                              <motion.button
                                key={`assignee-member-chip-${member.id}`}
                                onClick={() => {
                                  setFormData((prev) => {
                                    if (prev.assignees.some((id) => Number(id) === Number(member.id))) return prev;
                                    return {
                                      ...prev,
                                      assignees: [...prev.assignees, Number(member.id)],
                                    };
                                  });
                                }}
                                disabled={isSelected}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                  isSelected
                                    ? "border-sky-200 bg-sky-100 text-sky-700 cursor-default"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50"
                                }`}
                                whileHover={{ scale: isSelected ? 1 : 1.03 }}
                                whileTap={{ scale: isSelected ? 1 : 0.97 }}
                              >
                                {member.name || `Member ${member.id}`}
                              </motion.button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {showObserverPicker && (
                <div className="rounded-2xl border border-sky-100 bg-white/90 p-3 shadow-inner">
                  <p className="text-[11px] text-gray-500 mb-2">Tap to add managers as observers.</p>
                  {managerOptions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {managerOptions.map((manager) => {
                        const isSelected = (formData.observers || []).some(
                          (observerId) => Number(observerId) === Number(manager.id)
                        );
                        return (
                          <motion.button
                            key={`observer-chip-${manager.id}`}
                            onClick={() => {
                              setFormData((prev) => {
                                const observerSet = new Set((prev.observers || []).map((id) => Number(id)));
                                observerSet.add(Number(manager.id));
                                return { ...prev, observers: Array.from(observerSet) };
                              });
                            }}
                            disabled={isSelected}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                              isSelected
                                ? "border-sky-200 bg-sky-100 text-sky-700 cursor-default"
                                : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50"
                            }`}
                            whileHover={{ scale: isSelected ? 1 : 1.03 }}
                            whileTap={{ scale: isSelected ? 1 : 0.97 }}
                          >
                            {manager.name || `Manager ${manager.id}`}
                          </motion.button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No managers available to assign as observers.</p>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-gray-700">Task details</h3>
              <div className="flex flex-wrap items-center gap-2">
                <motion.button
                  onClick={() => setInputMode("text")}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold ${
                    inputMode === "text" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Text input
                </motion.button>
                <motion.button
                  onClick={() => {
                    setInputMode("voice");
                    setShowModal("voice");
                    setVoiceInput({ title: "", description: "", recording: "title" });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold ${
                    inputMode === "voice" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Voice input
                </motion.button>
              </div>
            </div>

            <div className="mt-3">
              {inputMode === "text" ? (
                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="title" className="block text-xs sm:text-sm font-medium text-gray-700">
                        Task title
                      </label>
                      <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        className="mt-1 w-full px-3 py-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm"
                        placeholder="Describe what needs to be done"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="deadline" className="block text-xs sm:text-sm font-medium text-gray-700">
                        Deadline
                      </label>
                      <DatePicker
                        selected={formData.deadline}
                        onChange={(date) => setFormData((prev) => ({ ...prev, deadline: date }))}
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="MMMM d, yyyy h:mm aa"
                        className="mt-1 w-full px-3 py-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm"
                        placeholderText="Select deadline"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-xs sm:text-sm font-medium text-gray-700">
                      Task description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="mt-1 w-full px-3 py-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm"
                      placeholder="Add context, acceptance criteria, links, etc."
                      rows={4}
                    />
                  </div>
                  <div>
                    <label htmlFor="resources" className="block text-xs sm:text-sm font-medium text-gray-700">
                      Resources (links or notes)
                    </label>
                    <textarea
                      id="resources"
                      name="resources"
                      value={formData.resources}
                      onChange={handleInputChange}
                      className="mt-1 w-full px-3 py-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm"
                      placeholder="Paste URLs or quick notes for the doers"
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Trigger the voice capture panel to record the task title and description, then review before saving.
                </p>
              )}
            </div>
          </section>

          <motion.button
            onClick={handleSubmit}
            disabled={loading || !members || members.length === 0 || isRecording || isTranslating}
            className={`mt-3 w-full px-4 py-3 rounded-xl text-white text-sm sm:text-base font-semibold shadow-sm ${
              loading || !members || members.length === 0 || isRecording || isTranslating
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700"
            }`}
            whileHover={{ scale: loading || !members || members.length === 0 || isRecording || isTranslating ? 1 : 1.01 }}
            whileTap={{ scale: loading || !members || members.length === 0 || isRecording || isTranslating ? 1 : 0.99 }}
          >
            Assign Task
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default TaskForm;
