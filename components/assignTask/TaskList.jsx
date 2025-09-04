import { motion } from "framer-motion";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import TaskCard from "./TaskCard";

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
  refreshTasks,
}) => {
  const [startDate, endDate] = dateRange;

  return (
    <div className="w-full sm:w-1/2 flex flex-col gap-4 h-full">
      <div className="sticky top-0 z-10 bg-white/70 backdrop-blur rounded-2xl border border-teal-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-6 sm:w-7 h-6 sm:h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-base sm:text-xl font-bold text-gray-800 truncate">Assigned Tasks</h3>
          </div>
          <div className="flex items-center gap-2">
            {filteredTasks.length > 0 && (
              <>
                <motion.button
                  onClick={() => {
                    const allSelected = selectedTaskIds.length === filteredTasks.length;
                    setSelectedTaskIds(allSelected ? [] : filteredTasks.map((t) => t.id));
                  }}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
                  whileHover={{ scale: 1.02 }}
                >
                  {selectedTaskIds.length === filteredTasks.length ? "Unselect" : "Select All"}
                </motion.button>
                <motion.button
                  onClick={refreshTasks}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
                  whileHover={{ scale: 1.02 }}
                >
                  Refresh
                </motion.button>
              </>
            )}
            {!!selectedTaskIds.length && (
              <motion.button
                onClick={handleBulkDelete}
                className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs sm:text-sm hover:bg-red-700"
                whileHover={{ scale: 1.02 }}
              >
                {deleting ? "Deleting..." : `Delete (${selectedTaskIds.length})`}
              </motion.button>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm bg-white"
          >
            <option value="all">All Tasks</option>
            <option value="recentlyAssigned">Recent Assigned</option>
            <option value="recentlyUpdated">Recent Updated</option>
          </select>
          <select
            value={filterMember}
            onChange={(e) => setFilterMember(e.target.value)}
            className="px-3 py-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm bg-white"
          >
            <option value="">By Member</option>
            {members ? members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            )) : []}
          </select>
          <DatePicker
            selectsRange
            startDate={startDate}
            endDate={endDate}
            onChange={(update) => setDateRange(update)}
            isClearable
            placeholderText="Date Range"
            className="px-3 py-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm bg-white col-span-2"
          />
          <div className="flex items-center justify-between col-span-2">
            <motion.button
              onClick={() => setShowAllTasks(!showAllTasks)}
              className="px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs sm:text-sm font-medium hover:bg-teal-100"
              whileHover={{ scale: 1.02 }}
            >
              {showAllTasks ? "Show Selected Assignees" : "Show All Tasks"}
            </motion.button>
            <motion.button
              onClick={() => setShowModal("manageTasks")}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
              whileHover={{ scale: 1.02 }}
            >
              Manage All
            </motion.button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {fetchingTasks ? (
          <div className="text-center py-8">
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
              members={members}
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
