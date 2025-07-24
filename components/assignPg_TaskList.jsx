import { motion } from "framer-motion";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import TaskCard from "./assignPg_TaskCard";

const TaskList = ({
  filteredTasks,
  fetchingTasks,
  filterType,
  setFilterType,
  filterMember,
  setFilterMember,
  members,
  dateRange,
  setDateRange,
  showAllTasks,
  setShowAllTasks,
  setShowModal,
  selectedTaskIds,
  setSelectedTaskIds,
  handleBulkDelete,
  deleting,
  getStatusColor,
  setSelectedTask,
}) => {
  const [startDate, endDate] = dateRange;

  return (
    <div className="w-full sm:w-1/2 flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <svg className="w-6 sm:w-8 h-6 sm:h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="text-lg sm:text-2xl font-bold text-gray-800">Previous Tasks</h3>
      </div>
      {filteredTasks.length > 0 && (
        <div className="mb-3 flex justify-between items-center">
          <motion.button
            onClick={() => {
              const allSelected = selectedTaskIds.length === filteredTasks.length;
              setSelectedTaskIds(allSelected ? [] : filteredTasks.map((t) => t.id));
            }}
            className="px-3 py-1 bg-teal-500 text-white rounded-md text-sm hover:bg-teal-600"
            whileHover={{ scale: 1.02 }}
          >
            {selectedTaskIds.length === filteredTasks.length ? "Unselect All" : "Select All"}
          </motion.button>
          {selectedTaskIds.length > 0 && (
            <motion.button
              onClick={handleBulkDelete}
              className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
              whileHover={{ scale: 1.02 }}
            >
              {deleting ? "Deleting..." : `Delete (${selectedTaskIds.length})`}
            </motion.button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="flex-1 min-w-[100px] sm:min-w-[120px] p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm"
        >
          <option value="all">All Tasks</option>
          <option value="recentlyAssigned">Recent Assigned</option>
          <option value="recentlyUpdated">Recent Updated</option>
        </select>
        <select
          value={filterMember}
          onChange={(e) => setFilterMember(e.target.value)}
          className="flex-1 min-w-[100px] sm:min-w-[120px] p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm"
        >
          <option value="">By Member</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <DatePicker
          selectsRange={true}
          startDate={startDate}
          endDate={endDate}
          onChange={(update) => setDateRange(update)}
          isClearable={true}
          placeholderText="Date Range"
          className="flex-1 min-w-[100px] sm:min-w-[120px] p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm"
        />
        <motion.button
          onClick={() => setShowAllTasks(!showAllTasks)}
          className="px-2 py-1 sm:px-3 sm:py-2 bg-teal-100 text-teal-800 rounded-lg text-xs sm:text-sm font-medium hover:bg-teal-200"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
        >
          {showAllTasks ? "Selected Assignees" : "All Tasks"}
        </motion.button>
        <motion.button
          onClick={() => setShowModal("manageTasks")}
          className="px-2 py-1 sm:px-3 sm:py-2 bg-teal-100 text-teal-800 rounded-lg text-xs sm:text-sm font-medium hover:bg-teal-200"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
        >
          Manage All
        </motion.button>
      </div>
      <div className="flex-1 overflow-y-auto pr-2">
        {fetchingTasks ? (
          <div className="text-center py-6">
            <div className="flex flex-col items-center">
              <span className="animate-spin inline-block w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full"></span>
              <p className="mt-2 text-sm text-gray-500">Loading tasks...</p>
            </div>
          </div>
        ) : filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <TaskCard
              key={`task-${task.id}`}
              task={task}
              selectedTaskIds={selectedTaskIds}
              setSelectedTaskIds={setSelectedTaskIds}
              setSelectedTask={setSelectedTask}
              setShowModal={setShowModal}
              getStatusColor={getStatusColor}
            />
          ))
        ) : (
          <p className="text-gray-500 text-sm sm:text-base text-center">No tasks assigned.</p>
        )}
      </div>
    </div>
  );
};

export default TaskList;