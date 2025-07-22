"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Loader2, Calendar } from "lucide-react";
import DatePicker from "react-date-picker";
import "react-date-picker/dist/DatePicker.css";
import "react-calendar/dist/Calendar.css";

export default function MyHistory() {
  const { data: session, status } = useSession();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState("completedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [filterType, setFilterType] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "member") {
      fetchHistory();
    }
  }, [status, session]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/member/history");
      if (!response.ok) {
        setError("Come back later, no history for now");
        return;
      }
      const data = await response.json();
      setHistory(data);
      if (data.length === 0) {
        setError("Come back later, no history for now");
      }
    } catch (err) {
      setError("Come back later, no history for now");
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleDateFilter = (type) => {
    const now = new Date();
    if (type === "week") {
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      startOfWeek.setHours(0, 0, 0, 0);
      setStartDate(startOfWeek);
      setEndDate(new Date());
    } else if (type === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(startOfMonth);
      setEndDate(new Date());
    } else if (type === "custom") {
      setStartDate(null);
      setEndDate(null);
    }
    setDateFilter(type);
    setShowDatePicker(false);
  };

  const handleCustomDateChange = () => {
    if (startDate && endDate) {
      setDateFilter("custom");
      setShowDatePicker(false);
    }
  };

  const sortedHistory = [...history]
    .filter((item) => filterType === "all" || item.taskType === filterType)
    .filter((item) => {
      if (dateFilter === "all" || !startDate || !endDate) return true;
      const completedAt = new Date(item.completedAt);
      return completedAt >= startDate && completedAt <= endDate;
    })
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (sortField === "completedAt" || sortField === "createdAt") {
        return sortOrder === "asc"
          ? new Date(aValue).getTime() - new Date(bValue).getTime()
          : new Date(bValue).getTime() - new Date(aValue).getTime();
      }
      return sortOrder === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white/80 backdrop-blur-sm flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated" || session?.user?.role !== "member") {
    return (
      <div className="min-h-screen bg-white/80 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center text-gray-800">
          <h1 className="text-2xl font-bold">Unauthorized</h1>
          <p className="mt-2">Please log in as a member to view your history.</p>
          <Link
            href="/login?role=member"
            className="mt-4 inline-block px-6 py-2 bg-indigo-500 rounded-lg hover:bg-indigo-600 text-sm font-medium text-white transition-all duration-200"
          >
            Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 bg-white/80 backdrop-blur-sm relative z-10">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-6 text-indigo-600">My Task History</h1>

        {/* Filter Controls */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:space-x-4 bg-white/90 p-4 rounded-xl shadow-sm">
          <div className="flex items-center space-x-2 mb-4 sm:mb-0">
            <label htmlFor="filterType" className="text-sm font-medium text-gray-700">
              Filter by Type:
            </label>
            <select
              id="filterType"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-white text-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-300"
            >
              <option value="all">All Tasks</option>
              <option value="assigned">Assigned Tasks</option>
              <option value="routine">Routine Tasks</option>
            </select>
          </div>
          <div className="flex items-center space-x-2 relative">
            <label htmlFor="dateFilter" className="text-sm font-medium text-gray-700">
              Filter by Date:
            </label>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center px-3 py-2 bg-white rounded-lg border border-gray-300 text-gray-800 text-sm hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500"
            >
              <Calendar className="w-4 h-4 mr-2" />
              {dateFilter === "all" ? "All Time" : dateFilter === "week" ? "This Week" : dateFilter === "month" ? "This Month" : "Custom Range"}
            </button>
            {showDatePicker && (
              <div className="absolute top-12 right-0 bg-white p-4 rounded-xl shadow-lg z-20 border border-gray-200">
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleDateFilter("week")}
                    className="px-3 py-1 text-sm text-gray-800 hover:bg-indigo-50 rounded"
                  >
                    This Week
                  </button>
                  <button
                    onClick={() => handleDateFilter("month")}
                    className="px-3 py-1 text-sm text-gray-800 hover:bg-indigo-50 rounded"
                  >
                    This Month
                  </button>
                  <button
                    onClick={() => handleDateFilter("custom")}
                    className="px-3 py-1 text-sm text-gray-800 hover:bg-indigo-50 rounded"
                  >
                    Custom Range
                  </button>
                </div>
                {dateFilter === "custom" && (
                  <div className="mt-4 space-y-2">
                    <div>
                      <label className="text-sm text-gray-700">Start Date:</label>
                      <DatePicker
                        value={startDate}
                        onChange={setStartDate}
                        maxDate={new Date()}
                        className="bg-white border border-gray-300 rounded-lg text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-700">End Date:</label>
                      <DatePicker
                        value={endDate}
                        onChange={setEndDate}
                        maxDate={new Date()}
                        minDate={startDate}
                        className="bg-white border border-gray-300 rounded-lg text-gray-800"
                      />
                    </div>
                    <button
                      onClick={handleCustomDateChange}
                      disabled={!startDate || !endDate}
                      className="w-full px-3 py-1 mt-2 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:bg-gray-300"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
          </div>
        )}

        {/* Task History Table */}
        {!loading && history.length === 0 && !error && (
          <div className="text-center text-gray-600">
            Come back later, no history for now
          </div>
        )}

        {!loading && history.length > 0 && (
          <div className="overflow-x-auto bg-white/90 rounded-xl shadow-sm">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100 text-left text-sm font-medium text-gray-700">
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-indigo-500 transition-colors"
                    onClick={() => handleSort("title")}
                  >
                    Title <ArrowUpDown className="inline w-4 h-4" />
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-indigo-500 transition-colors"
                    onClick={() => handleSort("taskType")}
                  >
                    Type <ArrowUpDown className="inline w-4 h-4" />
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-indigo-500 transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    Status <ArrowUpDown className="inline w-4 h-4" />
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-indigo-500 transition-colors"
                    onClick={() => handleSort("completedAt")}
                  >
                    Completed At <ArrowUpDown className="inline w-4 h-4" />
                  </th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Comment</th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((task) => (
                  <tr key={task.id} className="border-t border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-800">{task.title}</td>
                    <td className="px-4 py-3 capitalize text-gray-800">{task.taskType}</td>
                    <td className="px-4 py-3 capitalize text-gray-800">
                      {task.status.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {new Date(task.completedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {task.description || "No description"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {task.comment || "No comment"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}