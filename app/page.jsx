"use client";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function Home() {
  const [selectedRole, setSelectedRole] = useState("");
  const [tempRole, setTempRole] = useState("");
  const [error, setError] = useState("");

  const roles = ["admin", "team_manager", "member"];

  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
  };

  const textVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, delay: 0.2 } },
  };

  const buttonVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, delay: 0.4 } },
    hover: { scale: 1.03, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.2)", transition: { duration: 0.3 } },
    tap: { scale: 0.95 },
  };

  const handleRoleSelect = () => {
    if (tempRole) {
      setSelectedRole(tempRole);
      setTempRole("");
    } else {
      setError("Please select a role.");
      setTimeout(() => setError(""), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 p-6 flex items-center justify-center"
    >
      <div className="w-full h-full bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-lg font-medium p-4 rounded-lg shadow-md bg-red-50 text-red-600"
              onClick={() => setError("")}
            >
              {error} (Click to dismiss)
            </motion.p>
          )}
        </AnimatePresence>

        {/* Role Selection */}
        {!selectedRole && (
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="w-full flex flex-col gap-6"
          >
            <div className="flex items-center gap-4">
              <svg className="w-12 h-12 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v2h5m-2-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Select Your Role</h1>
            </div>
            <motion.p
              className="text-lg text-gray-600 italic"
              variants={textVariants}
            >
              Welcome to Meedian, where we nurture blooming buds to mavens
            </motion.p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {roles.map((role, index) => (
                <motion.div
                  key={`role-${role}-${index}`}
                  className={`relative p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-300 ${
                    tempRole === role ? "bg-teal-50" : "bg-white hover:bg-teal-50 hover:shadow-xl"
                  } flex flex-col items-center justify-center h-32`}
                  whileHover={{ scale: 1.03, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTempRole(role)}
                >
                  <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-teal-500"></div>
                  <h2 className="text-lg font-semibold text-gray-800 text-center">
                    {role === "admin" ? "Admin" : role === "team_manager" ? "Team Manager" : "Team Member"}
                  </h2>
                </motion.div>
              ))}
            </div>
            <motion.button
              onClick={handleRoleSelect}
              disabled={!tempRole}
              className={`w-full max-w-md mx-auto px-6 py-3 rounded-2xl text-lg font-semibold ${
                !tempRole ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"
              }`}
              variants={buttonVariants}
              initial="hidden"
              animate="visible"
              whileHover="hover"
              whileTap="tap"
            >
              Select Role
            </motion.button>
          </motion.div>
        )}

        {/* Login Options */}
        {selectedRole && (
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-md mx-auto flex flex-col gap-6"
          >
            <div className="flex items-center gap-4">
              <svg className="w-12 h-12 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14" />
              </svg>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Login as {selectedRole === "admin" ? "Admin" : selectedRole === "team_manager" ? "Team Manager" : "Team Member"}</h1>
            </div>
            <motion.p
              className="text-lg text-gray-600 italic text-center"
              variants={textVariants}
            >
              Welcome to Meedian, where we nurture blooming buds to mavens
            </motion.p>
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
              <Link href={`/login?role=${selectedRole}`}>
                <motion.button
                  className="w-full px-6 py-3 bg-teal-600 text-white rounded-2xl text-lg font-semibold hover:bg-teal-700 shadow-md flex items-center justify-center"
                  variants={buttonVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  whileTap="tap"
                >
                  <span className="mr-2">👤</span> Login
                </motion.button>
              </Link>
              <motion.button
                onClick={() => setSelectedRole("")}
                className="w-full px-6 py-3 bg-gray-200 text-gray-800 rounded-2xl text-lg font-semibold hover:bg-gray-300"
                variants={buttonVariants}
                initial="hidden"
                animate="visible"
                whileHover="hover"
                whileTap="tap"
              >
                Back to Role Selection
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}