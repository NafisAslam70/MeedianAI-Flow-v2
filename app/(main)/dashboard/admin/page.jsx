"use client";
import { useEffect, useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

const closingWindows = {
  residential: { start: "19:30", end: "20:00" },
  non_residential: { start: "12:00", end: "12:30" },
  semi_residential: { start: "17:30", end: "18:00" },
};

function getClosingWindow(type) {
  const today = new Date().toISOString().split("T")[0];
  const { start, end } = closingWindows[type] || closingWindows.residential;
  return {
    startTime: new Date(`${today}T${start}:00`),
    endTime: new Date(`${today}T${end}:00`),
  };
}

export default function MemberDashboard() {
  const [routineTasks, setRoutineTasks] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [memberType, setMemberType] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isDayClosed, setIsDayClosed] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      // Fetch routine tasks and status
      const routineRes = await fetch("/api/member/routine-status");
      const routineData = await routineRes.json();
      if (routineData.error) {
        console.error("Error fetching routine tasks:", routineData.error);
        setRoutineTasks([]);
      } else {
        setRoutineTasks(routineData.tasks || []);
        setLocked(routineData.locked || false);
        setMemberType(routineData.type || "residential");
        setIsDayClosed(routineData.isDayClosed || false);
      }

      // Fetch assigned tasks
      const assignedRes = await fetch("/api/member/assigned-tasks");
      const assignedData = await assignedRes.json();
      if (assignedData.error) {
        console.error("Error fetching assigned tasks:", assignedData.error);
        setAssignedTasks([]);
      } else {
        setAssignedTasks(assignedData.tasks || []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setRoutineTasks([]);
      setAssignedTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRoutineStatusChange = async (id, newStatus) => {
    try {
      const res = await fetch("/api/member/routine-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (res.ok) {
        setRoutineTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
        );
      } else {
        console.error("Error updating routine task status");
      }
    } catch (error) {
      console.error("Error updating routine task status:", error);
    }
  };

  const handleAssignedStatusChange = async (id, newStatus) => {
    try {
      const res = await fetch("/api/member/assigned-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (res.ok) {
        setAssignedTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
      );
      } else {
        console.error("Error updating assigned task status");
      }
    } catch (error) {
      console.error("Error updating assigned task status:", error);
    }
  };

  const handleDayClose = async () => {
    try {
      const res = await fetch("/api/member/day-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        setIsDayClosed(true);
        setLocked(true);
        alert("Day closed successfully!");
      } else {
        console.error("Error closing day");
      }
    } catch (error) {
      console.error("Error closing day:", error);
    }
  };

  useEffect(() => {
    fetchTasks();

    const interval = setInterval(() => {
      const now = new Date();
      if (memberType) {
        const { startTime, endTime } = getClosingWindow(memberType);
        const timeToClose = Math.max(0, endTime - now);
        setTimeLeft(timeToClose > 0 ? Math.floor(timeToClose / 1000) : 0);

        if (now >= startTime && now <= endTime && !locked) {
          fetchTasks();
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [memberType, locked]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-xl font-bold mb-4">
        My Dashboard – {new Date().toLocaleDateString()}
      </h2>

      {memberType && (
        <div className="mb-4 text-sm text-gray-600">
          Closing Window ({memberType}):{" "}
          <strong>
            {closingWindows[memberType]?.start} to {closingWindows[memberType]?.end}
          </strong>
          {timeLeft !== null && timeLeft > 0 && (
            <span className="ml-2 text-green-600">
              ⏳ Time left: {Math.floor(timeLeft / 60)}m {timeLeft % 60}s
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Routine Tasks */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Routine Tasks</h3>
          {loading ? (
            <p>Loading...</p>
          ) : routineTasks.length === 0 ? (
            <p className="text-gray-500">No routine tasks assigned for today.</p>
          ) : (
            <ul className="space-y-4">
              {routineTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    {task.status === "done" ? (
                      <CheckCircleIcon className="h-6 w-6 text-green-500 mr-2" />
                    ) : (
                      <div className="h-6 w-6 border-2 border-gray-300 rounded-full mr-2" />
                    )}
                    <div>
                      <p className="font-semibold">{task.title}</p>
                      <p className="text-sm text-gray-500">{task.description}</p>
                    </div>
                  </div>
                  <select
                    disabled={locked || isDayClosed || task.isLocked}
                    className="p-2 border rounded"
                    value={task.status}
                    onChange={(e) => handleRoutineStatusChange(task.id, e.target.value)}
                  >
                    <option value="not_started">⛔ Not Started</option>
                    <option value="in_progress">🔄 In Progress</option>
                    <option value="done">✅ Done</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Assigned Tasks */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Assigned Tasks</h3>
          {loading ? (
            <p>Loading...</p>
          ) : assignedTasks.length === 0 ? (
            <p className="text-gray-500">No assigned tasks for today.</p>
          ) : (
            <ul className="space-y-4">
              {assignedTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{task.title}</p>
                    <p className="text-sm text-gray-500">{task.description}</p>
                  </div>
                  <select
                    disabled={locked || isDayClosed}
                    className="p-2 border rounded"
                    value={task.status}
                    onChange={(e) => handleAssignedStatusChange(task.id, e.target.value)}
                  >
                    <option value="not_started">⛔ Not Started</option>
                    <option value="in_progress">🔄 In Progress</option>
                    <option value="done">✅ Done</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {locked && (
        <p className="mt-4 text-sm text-red-500">
          Task updates are locked for today.
        </p>
      )}

      <div className="mt-6">
        <button
          onClick={handleDayClose}
          disabled={isDayClosed || locked}
          className={`px-4 py-2 rounded ${
            isDayClosed || locked
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          Close Day
        </button>
      </div>
    </div>
  );
}