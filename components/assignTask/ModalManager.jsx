import { AnimatePresence, motion } from "framer-motion";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const ModalManager = ({
  showModal,
  setShowModal,
  editingTask,
  newTask,
  selectedTask,
  members,
  formData,
  setFormData,
  handleEditTask,
  handleEditInputChange,
  setTempAssignees,
  addSprint,
  handleSprintChange,
  removeSprint,
  handleUpdateSprints,
  loading,
  voiceInput,
  setVoiceInput,
  isRecording,
  startVoiceInput,
  isTranslating,
  handleTranslate,
  handleTranslationConfirm,
  translationSuccess,
  setTranslationSuccess,
  selectedTaskIds,
  deleteTaskId,
  handleDeleteTask,
  setDeleteTaskId,
  setSelectedTaskIds,
  searchQuery,
  setSearchQuery,
  tempAssignees,
  handleAssigneeSelect,
  confirmAssignees,
  filteredMembers,
}) => {
  return (
    <AnimatePresence>
      {showModal && (
        <>
          {showModal === "manageTasks" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-2xl"
              >
                <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Manage All Assigned Tasks</h3>
                <div className="max-h-96 overflow-y-auto space-y-4">
                  {formData.previousTasks.length === 0 ? (
                    <p className="text-gray-500 text-base text-center">No tasks available.</p>
                  ) : (
                    formData.previousTasks.map((task) => (
                      <motion.div
                        key={`manage-task-${task.id}`}
                        className="bg-white rounded-xl shadow-md p-4"
                        whileHover={{ scale: 1.02, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.15)" }}
                      >
                        <h4 className="text-base sm:text-lg font-semibold text-gray-700">{task.title}</h4>
                        <p className="text-sm text-gray-500">Assignees: {task.assignees?.map((a) => a.name).join(", ") || "None"}</p>
                        <p className="text-sm text-gray-500">Sprints: {task.sprints?.length || 0}</p>
                        <p className="text-sm text-gray-500">Status: {task.status || "not_started"}</p>
                        <p className="text-sm text-gray-500">Deadline: {task.deadline ? new Date(task.deadline).toLocaleString() : "Not set"}</p>
                        <div className="flex gap-2 mt-2">
                          <motion.button
                            onClick={() => {
                              setEditingTask({ ...task, assignees: Array.from(new Set(task.assignees?.map((a) => a.id) || [])) });
                              setFormData((prev) => ({ ...prev, sprints: task.sprints || [] }));
                              setShowModal("editTask");
                            }}
                            className="px-3 py-1 sm:px-4 sm:py-2 bg-yellow-600 text-white rounded-lg text-xs sm:text-sm hover:bg-yellow-700"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Edit
                          </motion.button>
                          <motion.button
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, sprints: task.sprints || [] }));
                              setShowModal("sprints");
                            }}
                            className="px-3 py-1 sm:px-4 sm:py-2 bg-purple-600 text-white rounded-lg text-xs sm:text-sm hover:bg-purple-700"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Manage Sprints
                          </motion.button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
                <motion.button
                  onClick={() => setShowModal(null)}
                  className="mt-4 w-full px-4 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-sm sm:text-base font-semibold hover:bg-gray-300"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
          {showModal === "editTask" && editingTask && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-lg"
              >
                <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Update Assigned Task</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">Task Title</label>
                    <input
                      type="text"
                      name="title"
                      value={editingTask.title}
                      onChange={handleEditInputChange}
                      className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                      placeholder="Enter task title"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">Task Description</label>
                    <textarea
                      name="description"
                      value={editingTask.description || ""}
                      onChange={handleEditInputChange}
                      className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                      placeholder="Enter task description"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">Deadline</label>
                    <DatePicker
                      selected={editingTask.deadline}
                      onChange={(date) => handleEditInputChange({ target: { name: "deadline", value: date } })}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={15}
                      dateFormat="MMMM d, yyyy h:mm aa"
                      className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                      placeholderText="Select deadline"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">Resources (Links or Notes)</label>
                    <textarea
                      name="resources"
                      value={editingTask.resources || ""}
                      onChange={handleEditInputChange}
                      className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                      placeholder="Enter links or suggestive notes"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">Assignees</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editingTask.assignees.map((assigneeId, index) => {
                        const member = members.find((m) => m.id === assigneeId);
                        return (
                          member && (
                            <span
                              key={`assignee-${assigneeId}-${index}`}
                              className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs sm:text-sm font-medium flex items-center"
                            >
                              {member.name}
                              <button
                                onClick={() =>
                                  handleEditInputChange({
                                    target: {
                                      name: "assignees",
                                      value: editingTask.assignees.filter((id) => id !== assigneeId),
                                    },
                                  })
                                }
                                className="ml-2 text-red-600 hover:text-red-800"
                              >
                                ×
                              </button>
                            </span>
                          )
                        );
                      })}
                      <motion.button
                        onClick={() => {
                          setTempAssignees(editingTask.assignees);
                          setShowModal("assignee");
                        }}
                        className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs sm:text-sm font-medium hover:bg-teal-200"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Edit Assignees
                      </motion.button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <motion.button
                    onClick={() => handleEditTask(editingTask.id)}
                    disabled={loading || !editingTask.title || editingTask.assignees.length === 0}
                    className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${loading || !editingTask.title || editingTask.assignees.length === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                    whileHover={{ scale: loading || !editingTask.title || editingTask.assignees.length === 0 ? 1 : 1.03 }}
                    whileTap={{ scale: loading || !editingTask.title || editingTask.assignees.length === 0 ? 1 : 0.95 }}
                  >
                    Save
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      setEditingTask(null);
                      setShowModal(null);
                    }}
                    className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
          {showModal === "postAssign" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-lg"
              >
                <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Task Assigned Successfully</h3>
                <p className="text-gray-500 text-xs sm:text-base mb-4">Would you like to add sprints for this task now or view details?</p>
                <div className="flex gap-3">
                  <motion.button
                    onClick={() => {
                      setShowModal("sprints");
                      setEditingTask(newTask);
                      addSprint();
                    }}
                    className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-purple-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-purple-700"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Add Sprints
                  </motion.button>
                  <motion.button
                    onClick={() => setShowModal("taskDetails")}
                    className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-teal-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-teal-700"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    View Details
                  </motion.button>
                  <motion.button
                    onClick={() => setShowModal(null)}
                    className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Close
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
          {showModal === "sprints" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-lg"
              >
                <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">
                  Manage Sprints for Task: {(editingTask || newTask || selectedTask)?.title || "New Task"}
                </h3>
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {formData.sprints.map((sprint, index) => (
                    <motion.div
                      key={`sprint-${(editingTask || newTask || selectedTask)?.id}-${index}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 bg-white rounded-xl shadow-md"
                    >
                      <input
                        type="text"
                        placeholder="Sprint Title"
                        value={sprint.title}
                        onChange={(e) => handleSprintChange(index, "title", e.target.value)}
                        className="w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                      />
                      <textarea
                        placeholder="Sprint Description"
                        value={sprint.description}
                        onChange={(e) => handleSprintChange(index, "description", e.target.value)}
                        className="w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base mt-2"
                        rows={3}
                      />
                      {formData.sprints.length > 1 && (
                        <motion.button
                          onClick={() => removeSprint(index)}
                          className="mt-2 px-3 py-1 bg-red-600 text-white rounded-lg text-xs sm:text-sm hover:bg-red-700"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Remove
                        </motion.button>
                      )}
                    </motion.div>
                  ))}
                </div>
                {formData.sprints.length < 3 && (
                  <motion.button
                    onClick={addSprint}
                    className="w-full px-3 py-2 sm:px-6 sm:py-3 bg-purple-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-purple-700 mt-4"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Add Sprint
                  </motion.button>
                )}
                <div className="flex gap-3 mt-4">
                  <motion.button
                    onClick={() => handleUpdateSprints((editingTask || newTask || selectedTask)?.id)}
                    disabled={loading || formData.sprints.filter((s) => s.title).length === 0}
                    className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${loading || formData.sprints.filter((s) => s.title).length === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                    whileHover={{ scale: loading || formData.sprints.filter((s) => s.title).length === 0 ? 1 : 1.03 }}
                    whileTap={{ scale: loading || formData.sprints.filter((s) => s.title).length === 0 ? 1 : 0.95 }}
                  >
                    Save Sprints
                  </motion.button>
                  <motion.button
                    onClick={() => setFormData((prev) => ({ ...prev, sprints: [] }))}
                    className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
          {showModal === "voice" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-lg"
              >
                <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Record Task in Hindi</h3>
                <p className="text-gray-500 text-xs sm:text-base mb-4">
                  {voiceInput.recording === "title"
                    ? "Record the task title in Hindi."
                    : voiceInput.recording === "description"
                      ? "Record the task description in Hindi."
                      : "Review and translate the recorded inputs."}
                </p>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">Title</label>
                    <input
                      type="text"
                      value={voiceInput.title}
                      onChange={(e) => setVoiceInput((prev) => ({ ...prev, title: e.target.value }))}
                      className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                      placeholder="Recorded title will appear here"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      value={voiceInput.description}
                      onChange={(e) => setVoiceInput((prev) => ({ ...prev, description: e.target.value }))}
                      className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                      placeholder="Recorded description will appear here"
                      rows={4}
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  {voiceInput.recording && (
                    <motion.button
                      onClick={() => startVoiceInput(voiceInput.recording)}
                      disabled={isRecording}
                      className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${isRecording ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                      whileHover={{ scale: isRecording ? 1 : 1.03 }}
                      whileTap={{ scale: isRecording ? 1 : 0.95 }}
                    >
                      Record {voiceInput.recording === "title" ? "Title" : "Description"}
                    </motion.button>
                  )}
                  {!voiceInput.recording && (
                    <motion.button
                      onClick={handleTranslate}
                      disabled={isTranslating || !voiceInput.title || !voiceInput.description}
                      className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${isTranslating || !voiceInput.title || !voiceInput.description ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                      whileHover={{ scale: isTranslating || !voiceInput.title || !voiceInput.description ? 1 : 1.03 }}
                      whileTap={{ scale: isTranslating || !voiceInput.title || !voiceInput.description ? 1 : 0.95 }}
                    >
                      Translate to English
                    </motion.button>
                  )}
                  <motion.button
                    onClick={() => {
                      setShowModal(null);
                      setVoiceInput({ title: "", description: "", recording: "title" });
                      setTranslationSuccess(false);
                    }}
                    className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                  {!voiceInput.recording && (
                    <motion.button
                      onClick={handleTranslationConfirm}
                      disabled={isTranslating || !voiceInput.title}
                      className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${isTranslating || !voiceInput.title ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                      whileHover={{ scale: isTranslating || !voiceInput.title ? 1 : 1.03 }}
                      whileTap={{ scale: isTranslating || !voiceInput.title ? 1 : 0.95 }}
                    >
                      Confirm
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
          {showModal === "translation" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-lg"
              >
                <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Review Translated Text</h3>
                <p className="text-gray-500 text-xs sm:text-base mb-4">
                  {translationSuccess
                    ? "Translation successful! Review the translated task title and description."
                    : "Translation completed, but the text may not have changed. Review below."}
                </p>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">Translated Title</label>
                    <input
                      type="text"
                      value={voiceInput.title}
                      readOnly
                      className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg bg-gray-100 text-xs sm:text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">Translated Description</label>
                    <textarea
                      value={voiceInput.description}
                      readOnly
                      className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg bg-gray-100 text-xs sm:text-base"
                      rows={4}
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <motion.button
                    onClick={() => {
                      setShowModal(null);
                      setVoiceInput({ title: "", description: "", recording: "title" });
                      setTranslationSuccess(false);
                    }}
                    className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleTranslationConfirm}
                    className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-teal-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-teal-700"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Confirm
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
          {showModal === "deleteConfirm" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-lg"
              >
                <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Confirm Deletion</h3>
                <p className="text-gray-500 text-xs sm:text-base mb-4">
                  Are you sure you want to delete {selectedTaskIds.length > 0 ? `${selectedTaskIds.length} tasks` : "this task"}? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <motion.button
                    onClick={handleDeleteTask}
                    className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-red-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-red-700"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Delete
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      setShowModal(null);
                      setDeleteTaskId(null);
                      setSelectedTaskIds([]);
                    }}
                    className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
          {showModal === "assignee" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-lg"
              >
                <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Select Assignees</h3>
                <input
                  type="text"
                  placeholder="Search by name or email"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base mb-4"
                />
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {filteredMembers.length === 0 ? (
                    <p className="text-gray-500 text-sm sm:text-base text-center">No members found</p>
                  ) : (
                    filteredMembers.map((member) => (
                      <motion.div
                        key={`member-${member.id}`}
                        className="flex items-center p-2 hover:bg-teal-50 rounded-lg"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <input
                          type="checkbox"
                          id={`member-${member.id}`}
                          checked={tempAssignees.includes(member.id)}
                          onChange={() => handleAssigneeSelect(member.id)}
                          className="h-4 sm:h-5 w-4 sm:w-5 text-teal-600 border-teal-200 rounded focus:ring-teal-500"
                        />
                        <label htmlFor={`member-${member.id}`} className="ml-2 sm:ml-3 text-xs sm:text-base text-gray-700">
                          {member.name} ({member.email}, {member.role})
                        </label>
                      </motion.div>
                    ))
                  )}
                </div>
                <div className="flex gap-3 mt-4">
                  <motion.button
                    onClick={() => {
                      setShowModal(null);
                      setTempAssignees(editingTask ? editingTask.assignees : formData.assignees);
                      setSearchQuery("");
                    }}
                    className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={confirmAssignees}
                    disabled={tempAssignees.length === 0}
                    className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${tempAssignees.length === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                    whileHover={{ scale: tempAssignees.length === 0 ? 1 : 1.03 }}
                    whileTap={{ scale: tempAssignees.length === 0 ? 1 : 0.95 }}
                  >
                    Confirm
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
};

export default ModalManager;