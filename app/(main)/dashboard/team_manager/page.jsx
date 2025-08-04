"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SharedDashboard from "@/components/SharedDashboard";
import ManagersCommonDashboard from "../managersCommon/page";          // ⬅ adjust if path differs

export default function TeamManagerDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState("");
  const [view, setView] = useState("mine");          // "mine" | "theirs"

  /* ───────── role-gate ───────── */
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "team_manager") {
      router.push(
        session?.user?.role === "admin" ? "/dashboard/admin" : "/dashboard/member"
      );
    }
  }, [status, session, router]);

  /* ───────── optional 401 check (unchanged) ───────── */
  useEffect(() => {
    const checkAuth = async () => {
      if (status !== "authenticated") return;
      const today = new Date().toISOString().split("T")[0];
      const res   = await fetch(
        `/api/member/myMRIs?section=today&userId=${session?.user?.id}&date=${today}`
      );
      if (res.status === 401) {
        setError("Unauthorized access. Please log in again.");
        setTimeout(() => setError(""), 3000);
        router.push("/login");
      }
    };
    checkAuth();
  }, [status, session, router]);

  /* ───────── loading gate ───────── */
  if (status === "loading") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 flex items-center justify-center bg-gray-100"
      >
        <motion.div className="text-2xl font-semibold text-gray-700 flex items-center gap-2">
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-6 h-6 border-4 border-t-teal-600 border-teal-200 rounded-full"
          />
          Loading…
        </motion.div>
      </motion.div>
    );
  }

  /* ───────── UI ───────── */
  return (
    <>
      {/* floating error banner */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-4 right-4 text-red-600 text-sm font-medium bg-red-50 p-4 rounded-lg z-50"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* toggle tabs – always visible */}
      <div className="absolute top-4 left-0 right-0 flex justify-center z-50">
        <div className="bg-gray-100 rounded-lg p-1 flex gap-1">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setView("mine")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 ${
              view === "mine"
                ? "bg-purple-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            My Tasks
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setView("theirs")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 ${
              view === "theirs"
                ? "bg-purple-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            Team Tasks
          </motion.button>
        </div>
      </div>

      {/* swap panels without leaving the page */}
      <AnimatePresence mode="wait">
        {view === "mine" && (
          <motion.div
            key="mine"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3 }}
          >
            {/* your personal task view */}
            <SharedDashboard role="team_manager" />
          </motion.div>
        )}

        {view === "theirs" && (
          <motion.div
            key="theirs"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            {/* common team view – same component the admin uses */}
            <ManagersCommonDashboard disableUserSelect />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}



// "use client";

// import { useState, useEffect } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import { useRouter } from "next/navigation";
// import { useSession } from "next-auth/react";
// import PersonalView from "./PersonalView";

// export default function TeamManagerDashboard() {
//   const router = useRouter();
//   const { data: session, status } = useSession();
//   const [error, setError] = useState("");
//   const [view, setView] = useState("mine"); // Default to "mine"

//   useEffect(() => {
//     if (status === "authenticated" && session?.user?.role !== "team_manager") {
//       router.push(
//         session?.user?.role === "admin" ? "/dashboard/admin" : "/dashboard/member"
//       );
//     }
//   }, [status, session, router]);

//   // Handle 401 Unauthorized errors
//   useEffect(() => {
//     const handleUnauthorized = async () => {
//       try {
//         const response = await fetch(`/api/member/myMRIs?section=today&userId=${session?.user?.id}&date=${new Date().toISOString().split("T")[0]}`);
//         if (response.status === 401) {
//           setError("Unauthorized access. Please check your permissions or log in again.");
//           setTimeout(() => setError(""), 3000);
//           router.push("/login");
//         }
//       } catch (err) {
//         setError("Failed to verify access. Please try again.");
//         setTimeout(() => setError(""), 3000);
//       }
//     };

//     if (status === "authenticated") {
//       handleUnauthorized();
//     }
//   }, [status, session, router]);

//   // Handle "Team Tasks" view redirect
//   useEffect(() => {
//     if (view === "theirs") {
//       router.push("/dashboard/managersCommon");
//     }
//   }, [view, router]);

//   if (status === "loading") {
//     return (
//       <motion.div
//         initial={{ opacity: 0 }}
//         animate={{ opacity: 1 }}
//         className="fixed inset-0 flex items-center justify-center bg-gray-100"
//       >
//         <motion.div
//           className="text-2xl font-semibold text-gray-700 flex items-center gap-2"
//         >
//           <motion.span
//             animate={{ rotate: 360 }}
//             transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
//             className="inline-block w-6 h-6 border-4 border-t-teal-600 border-teal-200 rounded-full"
//           />
//           Loading...
//         </motion.div>
//       </motion.div>
//     );
//   }

//   return (
//     <>
//       {/* Error Message */}
//       <AnimatePresence>
//         {error && (
//           <motion.p
//             initial={{ opacity: 0, y: -20 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, y: -20 }}
//             className="absolute top-4 left-4 right-4 text-red-600 text-sm font-medium bg-red-50 p-4 rounded-lg z-50"
//           >
//             {error}
//           </motion.p>
//         )}
//       </AnimatePresence>

//       {/* View Switch Tabs */}
//       <div className="absolute top-4 left-0 right-0 flex justify-center z-50">
//         <div className="bg-gray-100 rounded-lg p-1 flex gap-1">
//           <motion.button
//             whileHover={{ scale: 1.05 }}
//             whileTap={{ scale: 0.95 }}
//             onClick={() => setView("mine")}
//             className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 ${
//               view === "mine"
//                 ? "bg-purple-600 text-white"
//                 : "bg-gray-200 text-gray-800 hover:bg-gray-300"
//             }`}
//           >
//             My Tasks
//           </motion.button>
//           <motion.button
//             whileHover={{ scale: 1.05 }}
//             whileTap={{ scale: 0.95 }}
//             onClick={() => setView("theirs")}
//             className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 ${
//               view === "theirs"
//                 ? "bg-purple-600 text-white"
//                 : "bg-gray-200 text-gray-800 hover:bg-gray-300"
//             }`}
//           >
//             Team Tasks
//           </motion.button>
//         </div>
//       </div>

//       {/* Conditional View Render */}
//       <AnimatePresence mode="wait">
//         {view === "mine" && (
//           <motion.div
//             key="mine"
//             initial={{ opacity: 0, x: -50 }}
//             animate={{ opacity: 1, x: 0 }}
//             exit={{ opacity: 0, x: 50 }}
//             transition={{ duration: 0.3 }}
//           >
//             <PersonalView />
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </>
//   );
// }