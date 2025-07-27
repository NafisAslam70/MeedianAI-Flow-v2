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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <svg className="w-6 sm:w-8 h-6 sm:h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <h2 className="text-lg sm:text-2xl font-bold text-gray-800">Create New Task</h2>
        </div>
        {["admin", "team_manager"].includes(session?.user?.role) && (
          <motion.button
            onClick={() => router.push("/dashboard/managersCommon/announcements")}
            className="px-4 py-2 sm:px-6 sm:py-3 bg-teal-600 text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-teal-700"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
          >
            Post an Announcement
          </motion.button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {formData.assignees.length > 0 ? (
          <>
            {formData.assignees.map((assigneeId, index) => {
              const member = members ? members.find((m) => m.id === assigneeId) : null;
              return (
                member && (
                  <span
                    key={`assignee-${assigneeId}-${index}`}
                    className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs sm:text-sm font-medium flex items-center"
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
              className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs sm:text-sm font-medium hover:bg-teal-200"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
            >
              Edit Assignees
            </motion.button>
          </>
        ) : (
          <motion.button
            onClick={() => setShowModal("assignee")}
            className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs sm:text-sm font-medium hover:bg-teal-200"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
          >
            Select Assignees
          </motion.button>
        )}
      </div>
      <div className="flex gap-2">
        <motion.button
          onClick={() => setInputMode("text")}
          className={`flex-1 px-3 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-base font-semibold ${inputMode === "text" ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
        >
          Text Input
        </motion.button>
        <motion.button
          onClick={() => {
            setInputMode("voice");
            setShowModal("voice");
            setVoiceInput({ title: "", description: "", recording: "title" });
          }}
          className={`flex-1 px-3 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-base font-semibold ${inputMode === "voice" ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
        >
          Voice Input
        </motion.button>
      </div>
      {inputMode === "text" && (
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-2 gap-4">
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
                className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                placeholder="Enter task title"
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
                className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
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
              className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
              placeholder="Enter task description"
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
              className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
              placeholder="Enter links or suggestive notes"
              rows={3}
            />
          </div>
        </div>
      )}
      <motion.button
        onClick={handleSubmit}
        disabled={loading || !members || members.length === 0 || isRecording || isTranslating}
        className={`sticky bottom-0 w-full px-4 py-2 sm:px-6 sm:py-3 rounded-lg text-white text-xs sm:text-base font-semibold ${loading || !members || members.length === 0 || isRecording || isTranslating ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700"}`}
        whileHover={{ scale: loading || !members || members.length === 0 || isRecording || isTranslating ? 1 : 1.03 }}
        whileTap={{ scale: loading || !members || members.length === 0 || isRecording || isTranslating ? 1 : 0.95 }}
      >
        Assign Task
      </motion.button>
    </div>
  );
};

export default TaskForm;