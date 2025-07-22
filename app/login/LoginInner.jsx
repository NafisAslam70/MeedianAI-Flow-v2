"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function LoginInner() {
  /* ─────────────────────────────────── State & helpers ─────────────────────────────────── */
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const roleHint     = searchParams.get("role")  ?? "";
  const errorParam   = searchParams.get("error") ?? "";

  const [email,            setEmail]            = useState("");
  const [password,         setPassword]         = useState("");
  const [selectedRole,     setSelectedRole]     = useState(roleHint);
  const [tempRole,         setTempRole]         = useState(roleHint);
  const [teamManagerType,  setTeamManagerType]  = useState("");
  const [error,            setError]            = useState(decodeURIComponent(errorParam));
  const [isLoggingIn,      setIsLoggingIn]      = useState(false);

  const roles = ["admin", "team_manager", "member"];
  const teamManagerTypes = [
    "head_incharge",
    "coordinator",
    "accountant",
    "chief_counsellor",
    "hostel_incharge",
    "principal",
  ];

  /* ─────────────────────────────────── Side‑effects ─────────────────────────────────── */

  // Auto‑redirect when session becomes available
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      router.replace(`/dashboard/${session.user.role}`);
    }
  }, [status, session, router]);

  /* ─────────────────────────────────── Handlers ─────────────────────────────────── */

  const handleRoleSelect = () => {
    if (!tempRole) {
      setError("Please select a role.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    setSelectedRole(tempRole);
    setTempRole("");
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!selectedRole) {
      setError("Please select a role.");
      return;
    }
    if (selectedRole === "team_manager" && !teamManagerType) {
      setError("Please select a team‑manager category.");
      return;
    }

    setIsLoggingIn(true);

    const result = await signIn("credentials", {
      email: email.toLowerCase(),
      password,
      role: selectedRole,
      team_manager_type:
        selectedRole === "team_manager" ? teamManagerType : undefined,
      redirect: false,
    });

    setIsLoggingIn(false);

    if (result?.error) {
      setError(
        decodeURIComponent(result.error) ||
          "Authentication failed. Please check your credentials."
      );
    } else {
      // Session will refresh; optimistic redirect for snappier UX
      router.replace(`/dashboard/${selectedRole}`);
    }
  }

  /* ─────────────────────────────────── UI states ─────────────────────────────────── */

  if (status === "loading") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 flex items-center justify-center
                   bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100"
      >
        <Skeleton height={400} width={320} className="rounded-2xl" />
      </motion.div>
    );
  }

  /* ─────────────────────────────────── Render ─────────────────────────────────── */

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 p-6 flex items-center justify-center
                 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100"
    >
      <div className="w-full h-full rounded-2xl shadow-2xl p-8
                      bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100
                      flex flex-col gap-8 overflow-y-auto">
        {/* ───────── Error banner ───────── */}
        <AnimatePresence>
          {error && (
            <motion.p
              key="error-banner"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 p-4 rounded-lg bg-red-50 text-red-600
                         text-lg font-medium shadow-md cursor-pointer"
              onClick={() => setError("")}
            >
              {error} (click to dismiss)
            </motion.p>
          )}
        </AnimatePresence>

        {/* ───────── Role‑selection panel ───────── */}
        {!selectedRole && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            <h1 className="flex items-center gap-3 text-2xl sm:text-3xl font-bold text-gray-800">
              <svg className="w-10 h-10 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v2h5m-2-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zM21 10a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Select your role
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {roles.map((role) => (
                <motion.div
                  key={role}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTempRole(role)}
                  className={`h-28 p-4 rounded-2xl shadow-lg cursor-pointer flex items-center justify-center
                              transition-colors ${
                                tempRole === role
                                  ? "bg-teal-50"
                                  : "bg-white hover:bg-teal-50"
                              }`}
                >
                  <span className="text-lg font-semibold text-gray-800">
                    {role === "admin"
                      ? "Admin"
                      : role === "team_manager"
                      ? "Team Manager"
                      : "Team Member"}
                  </span>
                </motion.div>
              ))}
            </div>

            <motion.button
              disabled={!tempRole}
              onClick={handleRoleSelect}
              whileHover={{ scale: tempRole ? 1.03 : 1 }}
              className={`mx-auto w-full max-w-xs py-3 rounded-2xl text-lg font-semibold
                          ${tempRole ? "bg-teal-600 text-white" : "bg-gray-400 cursor-not-allowed"}`}
            >
              Select role
            </motion.button>
          </motion.div>
        )}

        {/* ───────── Credential form ───────── */}
        {selectedRole && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md mx-auto flex flex-col gap-6"
          >
            <h1 className="flex items-center gap-3 text-2xl sm:text-3xl font-bold text-gray-800">
              <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
              </svg>
              {`Login as ${
                selectedRole === "admin"
                  ? "Admin"
                  : selectedRole === "team_manager"
                  ? "Team Manager"
                  : "Team Member"
              }`}
            </h1>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-lg space-y-6">
              {selectedRole === "team_manager" && (
                <div>
                  <label htmlFor="tm_type" className="block mb-1 text-sm font-medium text-gray-700">
                    Team‑manager category
                  </label>
                  <select
                    id="tm_type"
                    value={teamManagerType}
                    onChange={(e) => setTeamManagerType(e.target.value)}
                    required
                    className="w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="" disabled>Select a category</option>
                    {teamManagerTypes.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block mb-1 text-sm font-medium text-gray-700">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block mb-1 text-sm font-medium text-gray-700">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="••••••••"
                />
              </div>

              <motion.button
                type="submit"
                disabled={isLoggingIn}
                whileHover={{ scale: isLoggingIn ? 1 : 1.03 }}
                className={`w-full py-3 rounded-2xl text-lg font-semibold text-white
                            ${isLoggingIn ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700"}`}
              >
                {isLoggingIn ? "Logging in…" : "Login"}
              </motion.button>

              <motion.button
                type="button"
                onClick={() => setSelectedRole("")}
                whileHover={{ scale: 1.03 }}
                className="w-full py-3 rounded-2xl text-lg font-semibold bg-gray-200 hover:bg-gray-300"
              >
                Back to role selection
              </motion.button>
            </form>

            <motion.button
              onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
              whileHover={{ scale: 1.03 }}
              className="mt-4 text-lg text-gray-600 hover:text-teal-600 underline text-center"
            >
              ← Go back
            </motion.button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
