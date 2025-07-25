"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

export default function ManageDayClose({ setError, setSuccess }) {
  const userTypes = ["residential", "non_residential", "semi_residential"];
  const [appState, setAppState] = useState({
    residential: { dayOpenedAt: "", dayClosedAt: "", closingWindowStart: "", closingWindowEnd: "" },
    non_residential: { dayOpenedAt: "", dayClosedAt: "", closingWindowStart: "", closingWindowEnd: "" },
    semi_residential: { dayOpenedAt: "", dayClosedAt: "", closingWindowStart: "", closingWindowEnd: "" },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch open/close times with SWR
  const { data: timesData, error: timesError } = useSWR("/api/admin/day-close", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    revalidateOnReconnect: false,
  });

  useEffect(() => {
    console.log("DayClose fetch response:", { timesData, timesError }); // Debug API response
    if (timesData?.times) {
      const newAppState = {};
      timesData.times.forEach((t) => {
        try {
          // Ensure time is valid and convert to HH:MM format
          const formatTime = (time) => {
            if (!time || !/^\d{2}:\d{2}:\d{2}$/.test(time)) {
              console.warn(`Invalid time for ${t.userType}: ${time}`);
              return "";
            }
            // Remove seconds for UI display (e.g., 08:00:00 -> 08:00)
            return time.slice(0, 5);
          };

          newAppState[t.userType] = {
            dayOpenedAt: formatTime(t.dayOpenTime),
            dayClosedAt: formatTime(t.dayCloseTime),
            closingWindowStart: formatTime(t.closingWindowStart),
            closingWindowEnd: formatTime(t.closingWindowEnd),
          };
          console.log(`Processed times for ${t.userType}:`, newAppState[t.userType]); // Debug processed times
        } catch (err) {
          console.error(`Error parsing times for ${t.userType}:`, err);
          setError(`Failed to parse times for ${t.userType}: ${err.message}`);
        }
      });

      // Merge with default state to ensure all user types are present
      setAppState((prev) => {
        const updatedState = { ...prev, ...newAppState };
        console.log("Updated appState:", updatedState); // Debug final state
        return updatedState;
      });
      setLoading(false);
    }
    if (timesError) {
      console.error("Times fetch error:", timesError);
      setError(`Failed to fetch day-close times: ${timesError.message}`);
      setLoading(false);
    }
  }, [timesData, timesError, setError]);

  const handleAppStateChange = (userType, field, value) => {
    setAppState((prev) => ({
      ...prev,
      [userType]: { ...prev[userType], [field]: value },
    }));
  };

  const saveAppStateChanges = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const formattedTimes = userTypes.map((type) => {
        const times = appState[type];
        // Validate and append seconds to match time type (HH:MM -> HH:MM:00)
        const formatToTime = (time) => {
          if (!time || !/^\d{2}:\d{2}$/.test(time)) {
            throw new Error(`Invalid time format for ${type}: ${time}`);
          }
          return `${time}:00`;
        };

        const formatted = {
          userType: type,
          dayOpenTime: formatToTime(times.dayOpenedAt),
          dayCloseTime: formatToTime(times.dayClosedAt),
          closingWindowStart: formatToTime(times.closingWindowStart),
          closingWindowEnd: formatToTime(times.closingWindowEnd),
        };
        console.log(`Saving times for ${type}:`, formatted); // Debug payload
        return formatted;
      });

      const res = await fetch("/api/admin/day-close", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ times: formattedTimes }),
      });

      const responseData = await res.json();
      console.log("Save response:", responseData); // Debug save response
      if (!res.ok) {
        throw new Error(responseData.error || `Save failed: ${res.status}`);
      }

      setSuccess("Day-close times saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Save day-close times error:", err);
      setError(`Error saving day-close times: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-gray-600 text-center text-lg">Loading day-close times...</p>
      ) : (
        <div>
          {userTypes.map((type) => (
            <motion.div
              key={type}
              className="bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6 flex flex-col justify-between"
              whileHover={{ scale: 1.02, boxShadow: "0 8px 16px rgba(128, 0, 128, 0.2)" }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="font-semibold text-teal-900 capitalize mb-4 text-lg">{type.replace("_", " ")}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Day Open Time</label>
                  <input
                    type="time"
                    value={appState[type]?.dayOpenedAt || ""}
                    onChange={(e) => handleAppStateChange(type, "dayOpenedAt", e.target.value)}
                    className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Day Close Time</label>
                  <input
                    type="time"
                    value={appState[type]?.dayClosedAt || ""}
                    onChange={(e) => handleAppStateChange(type, "dayClosedAt", e.target.value)}
                    className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Closing Window Start</label>
                  <input
                    type="time"
                    value={appState[type]?.closingWindowStart || ""}
                    onChange={(e) => handleAppStateChange(type, "closingWindowStart", e.target.value)}
                    className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Closing Window End</label>
                  <input
                    type="time"
                    value={appState[type]?.closingWindowEnd || ""}
                    onChange={(e) => handleAppStateChange(type, "closingWindowEnd", e.target.value)}
                    className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base transition-all duration-200"
                  />
                </div>
              </div>
            </motion.div>
          ))}
          <motion.button
            onClick={saveAppStateChanges}
            disabled={saving}
            className={`mt-6 w-full sm:w-auto px-6 py-3 rounded-2xl text-white font-semibold text-lg transition-all duration-200 bg-teal-600 hover:bg-teal-700 shadow-md`}
            whileHover={{ scale: saving ? 1 : 1.03 }}
            whileTap={{ scale: saving ? 1 : 0.95 }}
          >
            {saving ? "Saving..." : "Save Day-Close Times"}
          </motion.button>
        </div>
      )}
    </div>
  );
}