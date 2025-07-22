"use client";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function LoginInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const roleHint = searchParams.get("role") || "";
  const errorParam = decodeURIComponent(searchParams.get("error") || "");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState(roleHint);
  const [tempRole, setTempRole] = useState(roleHint);
  const [teamManagerType, setTeamManagerType] = useState("");
  const [error, setError] = useState(errorParam || "");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const roles = ["admin", "team_manager", "member"];
  const teamManagerTypes = [
    "head_incharge",
    "coordinator",
    "accountant",
    "chief_counsellor",
    "hostel_incharge",
    "principal",
  ];

  useEffect(() => {
    console.log("Login session:", { status, session });
  }, [status, session]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      const userRole = session.user.role;
      router.push(`/dashboard/${userRole}`);
    }
  }, [status, session, router]);

  const handleRoleSelect = () => {
    if (tempRole) {
      setSelectedRole(tempRole);
      setTempRole("");
    } else {
      setError("Please select a role.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoggingIn(true);

    if (!selectedRole) {
      setError("Please select a role to log in.");
      setIsLoggingIn(false);
      return;
    }

    if (selectedRole === "team_manager" && !teamManagerType) {
      setError("Please select a team manager category.");
      setIsLoggingIn(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        email: email.toLowerCase(),
        password,
        role: selectedRole,
        team_manager_type: selectedRole === "team_manager" ? teamManagerType : undefined,
        redirect: false,
        callbackUrl: `/dashboard/${selectedRole}`,
      });

      if (result?.error) {
        setError(decodeURIComponent(result.error) || "Authentication failed. Please check your credentials.");
        setIsLoggingIn(false);
        return;
      }

      // Poll for session update
      let attempts = 0;
      const maxAttempts = 10;
      const checkSession = async () => {
        const { data: session } = await import("next-auth/react").then((mod) => mod.useSession());
        if (session?.user?.role) {
          router.push(`/dashboard/${session.user.role}`);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkSession, 100);
        } else {
          setError("Session not established. Please try again.");
          setIsLoggingIn(false);
        }
      };
      checkSession();
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setIsLoggingIn(false);
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  if (status === "loading") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 flex items-center justify-center"
      >
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md">
          <Skeleton height={400} className="rounded-2xl" />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 p-6 flex items-center justify-center"
    >
      <div className="w-full h-full bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
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

        {!selectedRole && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full flex flex-col gap-6"
          >
            <div className="flex items-center gap-4">
              <svg className="w-12 h-12 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v2h5m-2-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Select Your Role</h1>
            </div>
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
              whileHover={{ scale: !tempRole ? 1 : 1.03, boxShadow: !tempRole ? null : "0 8px 16px rgba(0, 128, 128, 0.2)" }}
              whileTap={{ scale: !tempRole ? 1 : 0.95 }}
            >
              Select Role
            </motion.button>
          </motion.div>
        )}

        {selectedRole && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full max-w-md mx-auto flex flex-col gap-6"
          >
            <div className="flex items-center gap-4">
              <svg className="w-12 h-12 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14" />
              </svg>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                Login as {selectedRole === "admin" ? "Admin" : selectedRole === "team_manager" ? "Team Manager" : "Team Member"}
              </h1>
            </div>
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
              {selectedRole === "team_manager" && (
                <div>
                  <label htmlFor="team_manager_type" className="block text-sm font-medium text-gray-700">
                    Team Manager Category
                  </label>
                  <select
                    id="team_manager_type"
                    value={teamManagerType}
                    onChange={(e) => setTeamManagerType(e.target.value)}
                    className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
                    required
                  >
                    <option value="" disabled>
                      Select a category
                    </option>
                    {teamManagerTypes.map((type, index) => (
                      <option key={`type-${type}-${index}`} value={type}>
                        {type
                          .split("_")
                          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(" ")}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
                  required
                  placeholder="e.g., user@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
                  required
                  placeholder="Enter your password"
                />
              </div>
              <motion.button
                type="submit"
                disabled={isLoggingIn}
                className={`w-full px-6 py-3 rounded-2xl text-lg font-semibold text-white ${
                  isLoggingIn ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700"
                }`}
                whileHover={{ scale: isLoggingIn ? 1 : 1.03, boxShadow: isLoggingIn ? null : "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                whileTap={{ scale: isLoggingIn ? 1 : 0.95 }}
                aria-label="Login"
              >
                {isLoggingIn ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Logging in...
                  </span>
                ) : (
                  "Login"
                )}
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setSelectedRole("")}
                className="w-full px-6 py-3 bg-gray-200 text-gray-800 rounded-2xl text-lg font-semibold hover:bg-gray-300"
                whileHover={{ scale: 1.03, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                whileTap={{ scale: 0.95 }}
                aria-label="Back to role selection"
              >
                Back to Role Selection
              </motion.button>
            </form>
            <motion.button
              onClick={handleGoBack}
              className="w-full mt-4 text-lg text-gray-600 hover:text-teal-600 underline text-center"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Go back to previous page"
            >
              ← Go Back
            </motion.button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}