import { motion } from "framer-motion";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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
}) => {
  const { data: session } = useSession();
  const router = useRouter();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="w-full sm:w-1/2 flex flex-col gap-4 h-full overflow-y-auto">
      <div className="bg-white/70 backdrop-blur rounded-2xl border border-teal-50 p-4">
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

        <div className="mt-3 flex flex-wrap gap-2 items-center">
          {formData.assignees.length > 0 ? (
            <>
              {formData.assignees.map((assigneeId, index) => {
                const member = members ? members.find((m) => m.id === assigneeId) : null;
                return (
                  member && (
                    <span
                      key={`assignee-${assigneeId}-${index}`}
                      className="px-2 py-1 bg-teal-50 text-teal-800 border border-teal-100 rounded-full text-xs sm:text-sm font-medium flex items-center"
                    >
                      {member.name}
                      <button
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            assignees: prev.assignees.filter((id) => id !== assigneeId),
                          }))
                        }
                        className="ml-2 text-red-600 hover:text-red-800"
                        aria-label="Remove assignee"
                      >
                        ×
                      </button>
                    </span>
                  )
                );
              })}
              <motion.button
                onClick={() => {
                  setTempAssignees(formData.assignees);
                  setShowModal("assignee");
                }}
                className="px-3 py-1 bg-white border border-gray-200 text-gray-700 rounded-full text-xs sm:text-sm hover:bg-gray-50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Edit Assignees
              </motion.button>
            </>
          ) : (
            <motion.button
              onClick={() => setShowModal("assignee")}
              className="px-3 py-1 bg-white border border-gray-200 text-gray-700 rounded-full text-xs sm:text-sm hover:bg-gray-50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Select Assignees
            </motion.button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4">
          <div className="flex gap-2">
            <motion.button
              onClick={() => setInputMode("text")}
              className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold ${inputMode === "text" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700"}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Text Input
            </motion.button>
            <motion.button
              onClick={() => {
                setInputMode("voice");
                setShowModal("voice");
                setVoiceInput({ title: "", description: "", recording: "title" });
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold ${inputMode === "voice" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700"}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Voice Input
            </motion.button>
          </div>

          {inputMode === "text" && (
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="title" className="block text-xs sm:text-sm font-medium text-gray-700">
                    Task Title
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
                  Task Description
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
                  Resources (Links or Notes)
                </label>
                <textarea
                  id="resources"
                  name="resources"
                  value={formData.resources}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-3 py-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm"
                  placeholder="Paste URLs or quick notes for the assignees"
                  rows={3}
                />
              </div>
            </div>
          )}

          <motion.button
            onClick={handleSubmit}
            disabled={loading || !members || members.length === 0 || isRecording || isTranslating}
            className={`mt-2 w-full px-4 py-3 rounded-xl text-white text-sm sm:text-base font-semibold shadow-sm ${
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
