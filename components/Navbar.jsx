// "use client";
// import { useSession, signOut } from "next-auth/react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";
// import { useEffect, useState } from "react";
// import { Menu, X } from "lucide-react";
// import { createPortal } from "react-dom";
// import { useSidebar } from "@/components/SidebarContext";

// export default function Navbar() {
//   const { data: session, status } = useSession();
//   const pathname = usePathname();
//   const router = useRouter();
//   const [mounted, setMounted] = useState(false);
//   const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
//   const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
//   const { isSidebarOpen, setIsSidebarOpen } = useSidebar();

//   useEffect(() => {
//     setMounted(true);
//   }, []);

//   const role = session?.user?.role;
//   const userName = session?.user?.name || "User";
//   const userImage = session?.user?.image || "/default-avatar.png";

//   const handleLogout = async () => {
//     setIsLogoutModalOpen(false);
//     await signOut({ redirect: false });
//     router.push("/");
//   };

//   const handleLogin = (role) => router.push(`/login?role=${role}`);
//   const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
//   const openLogoutModal = () => setIsLogoutModalOpen(true);
//   const closeLogoutModal = () => setIsLogoutModalOpen(false);
//   const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

//   const isActive = (href) => pathname.replace(/\/$/, "") === href.replace(/\/$/, "");

//   const isAdminRoute = role === "admin" && pathname.startsWith("/dashboard/admin");

//   const LogoutModal = () => (
//     <div className="modal-overlay">
//       <div className="modal-content">
//         <h2 className="text-lg font-semibold text-white mb-4">Confirm Logout</h2>
//         <p className="text-gray-300 mb-6">Are you sure you want to log out?</p>
//         <div className="flex justify-center space-x-4">
//           <button
//             onClick={handleLogout}
//             className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition duration-200"
//           >
//             Yes, Log Out
//           </button>
//           <button
//             onClick={closeLogoutModal}
//             className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-medium transition duration-200"
//           >
//             Cancel
//           </button>
//         </div>
//       </div>
//     </div>
//   );

//   return (
//     <>
//       <style global jsx>{`
//         .modal-overlay {
//           position: fixed;
//           inset: 0;
//           background: rgba(0, 0, 0, 0.75);
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           z-index: 10000;
//         }
//         .modal-content {
//           background: #1f2937;
//           padding: 24px;
//           border-radius: 12px;
//           max-width: 400px;
//           width: 90%;
//           text-align: center;
//           box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
//           border: 1px solid #4b5563;
//         }
//         .mobile-menu {
//           position: fixed;
//           top: 0;
//           right: 0;
//           height: 100%;
//           width: 75%;
//           max-width: 300px;
//           background: #1f2937;
//           transform: translateX(100%);
//           transition: transform 0.3s ease-in-out;
//           z-index: 9999;
//           box-shadow: -4px 0 12px rgba(0, 0, 0, 0.5);
//           padding: 1rem;
//         }
//         .mobile-menu.open {
//           transform: translateX(0);
//         }
//         .mobile-menu-overlay {
//           position: fixed;
//           inset: 0;
//           background: rgba(0, 0, 0, 0.5);
//           z-index: 9998;
//           opacity: 0;
//           transition: opacity 0.3s ease-in-out;
//           pointer-events: none;
//         }
//         .mobile-menu-overlay.open {
//           opacity: 1;
//           pointer-events: auto;
//         }
//         .mobile-menu-item {
//           display: block;
//           padding: 0.75rem 1rem;
//           font-size: 1.1rem;
//           font-weight: 500;
//           transition: all 0.2s ease;
//           border-radius: 8px;
//           margin-bottom: 0.5rem;
//         }
//         .mobile-menu-item:hover {
//           background: #374151;
//         }
//         .nav-item {
//           position: relative;
//           padding: 0.5rem 1rem;
//           font-weight: 500;
//           font-size: 1rem;
//           transition: all 0.3s ease;
//           border-radius: 8px;
//         }
//         .nav-item:hover {
//           background: rgba(255, 255, 255, 0.1);
//           transform: translateY(-2px);
//         }
//         .nav-item.active::after {
//           content: '';
//           position: absolute;
//           bottom: -4px;
//           left: 50%;
//           transform: translateX(-50%);
//           width: 50%;
//           height: 2px;
//           background: #22d3ee;
//         }
//         .nav-button {
//           padding: 0.5rem 1.5rem;
//           font-weight: 500;
//           border-radius: 8px;
//           transition: all 0.3s ease;
//         }
//         .nav-button:hover {
//           transform: translateY(-2px);
//         }
//         .user-info {
//           display: flex;
//           align-items: center;
//           gap: 0.75rem;
//           background: #374151;
//           padding: 0.5rem 1rem;
//           border-radius: 12px;
//           box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
//           transition: all 0.3s ease;
//         }
//         .user-info:hover {
//           transform: translateY(-2px);
//           background: #4b5563;
//         }
//         .user-info img {
//           width: 32px;
//           height: 32px;
//           border-radius: 50%;
//           border: 2px solid #22d3ee;
//           object-fit: cover;
//         }
//         .user-info-text {
//           display: flex;
//           flex-direction: column;
//           color: #d1d5db;
//         }
//         .user-info-text .name {
//           font-weight: 600;
//           font-size: 0.9rem;
//           text-transform: capitalize;
//         }
//         .user-info-text .role {
//           font-size: 0.75rem;
//           color: #9ca3af;
//           text-transform: capitalize;
//         }
//         .mobile-user-info {
//           display: flex;
//           align-items: center;
//           gap: 0.75rem;
//           background: #374151;
//           padding: 0.75rem;
//           border-radius: 12px;
//           margin-bottom: 1rem;
//           box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
//         }
//         .mobile-user-info img {
//           width: 40px;
//           height: 40px;
//           border-radius: 50%;
//           border: 2px solid #22d3ee;
//           object-fit: cover;
//         }
//         .mobile-user-info-text {
//           display: flex;
//           flex-direction: column;
//           color: #d1d5db;
//         }
//         .mobile-user-info-text .name {
//           font-weight: 600;
//           font-size: 1rem;
//           text-transform: capitalize;
//         }
//         .mobile-user-info-text .role {
//           font-size: 0.85rem;
//           color: #9ca3af;
//           text-transform: capitalize;
//         }
//       `}</style>

//       <nav className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-6 py-4 w-full sticky top-0 z-40 shadow-lg">
//         <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8">
//           {/* Left Section: Logo */}
//           <div className="flex items-center gap-3">
//             <img src="/flow1.png" alt="Logo" className="w-10 h-10 rounded-full border border-cyan-400 p-1" />
//             <Link href="/" className={`text-2xl font-bold tracking-tight hover:text-cyan-300 transition duration-200 ${isActive("/") ? "text-cyan-300" : ""}`}>
//               MeedianAI-Flow
//             </Link>
//           </div>

//           {/* Center Section: Nav Items */}
//           <div className="hidden md:flex flex-1 justify-center space-x-4">
//             {role === "admin" && (
//               <>
//                 <Link
//                   href="/dashboard"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard") ? "text-cyan-300 active" : ""}`}
//                 >
//                   General Dashboard
//                 </Link>
//                 <Link
//                   href="/dashboard/admin"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/admin") ? "text-cyan-300 active" : ""}`}
//                 >
//                   Admin Dashboard
//                 </Link>
//                 <Link
//                   href="/dashboard/managersCommon/routineTasks"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-300 active" : ""}`}
//                 >
//                   Routine Tasks
//                 </Link>
//                 <Link
//                   href="/dashboard/managersCommon/assignTask"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-300 active" : ""}`}
//                 >
//                   Assign Task
//                 </Link>
//               </>
//             )}

//             {role === "team_manager" && (
//               <>
//                 <Link
//                   href="/dashboard"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard") ? "text-cyan-300 active" : ""}`}
//                 >
//                   General Dashboard
//                 </Link>
//                 <Link
//                   href="/dashboard/team_manager"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/team_manager") ? "text-cyan-300 active" : ""}`}
//                 >
//                   My Dashboard
//                 </Link>
//                 <Link
//                   href="/dashboard/managersCommon/routineTasks"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-300 active" : ""}`}
//                 >
//                   Routine Tasks
//                 </Link>
//                 <Link
//                   href="/dashboard/managersCommon/assignTask"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-300 active" : ""}`}
//                 >
//                   Assign Task
//                 </Link>
//                 <Link
//                   href="/dashboard/team_manager/myHistory"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/team_manager/myHistory") ? "text-cyan-300 active" : ""}`}
//                 >
//                   My History
//                 </Link>
//               </>
//             )}

//             {role === "member" && (
//               <>
//                 <Link
//                   href="/dashboard"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard") ? "text-cyan-300 active" : ""}`}
//                 >
//                   General Dashboard
//                 </Link>
//                 <Link
//                   href="/dashboard/member"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member") ? "text-cyan-300 active" : ""}`}
//                 >
//                   My Dashboard
//                 </Link>
//                 <Link
//                   href="/dashboard/member/myHistory"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/myHistory") ? "text-cyan-300 active" : ""}`}
//                 >
//                   My History
//                 </Link>
//               </>
//             )}

//             {status === "unauthenticated" && (
//               <>
//                 <button
//                   onClick={() => handleLogin("admin")}
//                   className="nav-button bg-indigo-600 hover:bg-indigo-700 text-white"
//                 >
//                   Admin Login
//                 </button>
//                 <button
//                   onClick={() => handleLogin("team_manager")}
//                   className="nav-button bg-purple-600 hover:bg-purple-700 text-white"
//                 >
//                   Team Manager Login
//                 </button>
//                 <button
//                   onClick={() => handleLogin("member")}
//                   className="nav-button bg-teal-600 hover:bg-teal-700 text-white"
//                 >
//                   Member Login
//                 </button>
//               </>
//             )}
//           </div>

//           {/* Right Section: User Info, Logout, Sidebar Toggle, and Mobile Toggle */}
//           <div className="flex items-center gap-4">
//             {(role === "admin" || role === "team_manager" || role === "member") && (
//               <>
//                 <div className="user-info hidden md:flex">
//                   <img src={userImage} alt="User Avatar" />
//                   <div className="user-info-text">
//                     <span className="name">{userName}</span>
//                     <span className="role">{role.replace("_", " ")}</span>
//                   </div>
//                 </div>
//                 <button
//                   onClick={openLogoutModal}
//                   className="hidden md:block nav-button bg-red-600 hover:bg-red-700 text-white"
//                 >
//                   Logout
//                 </button>
//               </>
//             )}
//             {isAdminRoute && (
//               <button onClick={toggleSidebar} className="text-white p-2 rounded-full hover:bg-gray-700 transition duration-200 hidden md:block">
//                 <Menu size={24} />
//               </button>
//             )}
//             <div className="md:hidden">
//               <button onClick={toggleMobileMenu} className="text-white p-2 rounded-full hover:bg-gray-700 transition duration-200">
//                 {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Mobile Menu */}
//         {isMobileMenuOpen && (
//           <>
//             <div className="mobile-menu-overlay open" onClick={toggleMobileMenu}></div>
//             <div className={`mobile-menu ${isMobileMenuOpen ? "open" : ""}`}>
//               <div className="flex justify-between items-center mb-6">
//                 <span className="text-lg font-bold text-cyan-400">Menu</span>
//                 <button onClick={toggleMobileMenu} className="text-white p-2 rounded-full hover:bg-gray-700">
//                   <X size={24} />
//                 </button>
//               </div>
//               {(role === "admin" || role === "team_manager" || role === "member") && (
//                 <div className="mobile-user-info">
//                   <img src={userImage} alt="User Avatar" />
//                   <div className="mobile-user-info-text">
//                     <span className="name">{userName}</span>
//                     <span className="role">{role.replace("_", " ")}</span>
//                   </div>
//                 </div>
//               )}
//               <div className="space-y-2">
//                 {role === "admin" && (
//                   <>
//                     <Link
//                       href="/dashboard"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       General Dashboard
//                     </Link>
//                     <Link
//                       href="/dashboard/admin"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/admin") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       Admin Dashboard
//                     </Link>
//                     <Link
//                       href="/dashboard/managersCommon/routineTasks"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       Routine Tasks
//                     </Link>
//                     <Link
//                       href="/dashboard/managersCommon/assignTask"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       Assign Task
//                     </Link>
//                   </>
//                 )}
//                 {role === "team_manager" && (
//                   <>
//                     <Link
//                       href="/dashboard"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       General Dashboard
//                     </Link>
//                     <Link
//                       href="/dashboard/team_manager"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/team_manager") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       My Dashboard
//                     </Link>
//                     <Link
//                       href="/dashboard/managersCommon/routineTasks"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       Routine Tasks
//                     </Link>
//                     <Link
//                       href="/dashboard/managersCommon/assignTask"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       Assign Task
//                     </Link>
//                     <Link
//                       href="/dashboard/team_manager/myHistory"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/team_manager/myHistory") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       My History
//                     </Link>
//                   </>
//                 )}
//                 {role === "member" && (
//                   <>
//                     <Link
//                       href="/dashboard"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       General Dashboard
//                     </Link>
//                     <Link
//                       href="/dashboard/member"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/member") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       My Dashboard
//                     </Link>
//                     <Link
//                       href="/dashboard/member/myHistory"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/member/myHistory") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       My History
//                     </Link>
//                   </>
//                 )}
//                 {status === "unauthenticated" && (
//                   <>
//                     <button
//                       onClick={() => {
//                         handleLogin("admin");
//                         toggleMobileMenu();
//                       }}
//                       className="mobile-menu-item text-left hover:text-cyan-400 w-full"
//                     >
//                       Admin Login
//                     </button>
//                     <button
//                       onClick={() => {
//                         handleLogin("team_manager");
//                         toggleMobileMenu();
//                       }}
//                       className="mobile-menu-item text-left hover:text-cyan-400 w-full"
//                     >
//                       Team Manager Login
//                     </button>
//                     <button
//                       onClick={() => {
//                         handleLogin("member");
//                         toggleMobileMenu();
//                       }}
//                       className="mobile-menu-item text-left hover:text-cyan-400 w-full"
//                     >
//                       Member Login
//                     </button>
//                   </>
//                 )}
//                 {(role === "admin" || role === "team_manager" || role === "member") && (
//                   <button
//                     onClick={() => {
//                       openLogoutModal();
//                       toggleMobileMenu();
//                     }}
//                     className="mobile-menu-item text-left text-red-400 hover:text-red-500 w-full"
//                   >
//                     Logout
//                   </button>
//                 )}
//               </div>
//             </div>
//           </>
//         )}
//       </nav>

//       {/* Logout Modal Portal */}
//       {mounted && typeof window !== "undefined" && isLogoutModalOpen && document?.body &&
//         createPortal(<LogoutModal />, document.body)}
//     </>
//   );
// }

"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { createPortal } from "react-dom";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const role = session?.user?.role;
  const userName = session?.user?.name || "User";
  const userImage = session?.user?.image || "/default-avatar.png";

  const handleLogout = async () => {
    setIsLogoutModalOpen(false);
    await signOut({ redirect: false });
    router.push("/");
  };

  const handleLogin = (role) => router.push(`/login?role=${role}`);
  const handleAddMember = () => router.push("/dashboard/admin/addUser");
  const handleManageMeedian = () => router.push("/dashboard/admin/manageMeedian");
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const openLogoutModal = () => setIsLogoutModalOpen(true);
  const closeLogoutModal = () => setIsLogoutModalOpen(false);

  const isActive = (href) => pathname.replace(/\/$/, "") === href.replace(/\/$/, "");

  const LogoutModal = () => (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="text-lg font-semibold text-white mb-4">Confirm Logout</h2>
        <p className="text-gray-300 mb-6">Are you sure you want to log out?</p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition duration-200"
          >
            Yes, Log Out
          </button>
          <button
            onClick={closeLogoutModal}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-medium transition duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style global jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }
        .modal-content {
          background: #1f2937;
          padding: 24px;
          border-radius: 12px;
          max-width: 400px;
          width: 90%;
          text-align: center;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
          border: 1px solid #4b5563;
        }
        .mobile-menu {
          position: fixed;
          top: 0;
          right: 0;
          height: 100%;
          width: 75%;
          max-width: 300px;
          background: #1f2937;
          transform: translateX(100%);
          transition: transform 0.3s ease-in-out;
          z-index: 9999;
          box-shadow: -4px 0 12px rgba(0, 0, 0, 0.5);
          padding: 1rem;
        }
        .mobile-menu.open {
          transform: translateX(0);
        }
        .mobile-menu-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 9998;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
          pointer-events: none;
        }
        .mobile-menu-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }
        .mobile-menu-item {
          display: block;
          padding: 0.75rem 1rem;
          font-size: 1.1rem;
          font-weight: 500;
          transition: all 0.2s ease;
          border-radius: 8px;
          margin-bottom: 0.5rem;
        }
        .mobile-menu-item:hover {
          background: #374151;
        }
        .nav-item {
          position: relative;
          padding: 0.5rem 1rem;
          font-weight: 500;
          font-size: 1rem;
          transition: all 0.3s ease;
          border-radius: 8px;
        }
        .nav-item:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-2px);
        }
        .nav-item.active::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 50%;
          height: 2px;
          background: #22d3ee;
        }
        .nav-button {
          padding: 0.5rem 1.5rem;
          font-weight: 500;
          border-radius: 8px;
          transition: all 0.3s ease;
        }
        .nav-button:hover {
          transform: translateY(-2px);
        }
        .user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: #374151;
          padding: 0.5rem 1rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          transition: all 0.3s ease;
        }
        .user-info:hover {
          transform: translateY(-2px);
          background: #4b5563;
        }
        .user-info img {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid #22d3ee;
          object-fit: cover;
        }
        .user-info-text {
          display: flex;
          flex-direction: column;
          color: #d1d5db;
        }
        .user-info-text .name {
          font-weight: 600;
          font-size: 0.9rem;
          text-transform: capitalize;
        }
        .user-info-text .role {
          font-size: 0.75rem;
          color: #9ca3af;
          text-transform: capitalize;
        }
        .mobile-user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: #374151;
          padding: 0.75rem;
          border-radius: 12px;
          margin-bottom: 1rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .mobile-user-info img {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid #22d3ee;
          object-fit: cover;
        }
        .mobile-user-info-text {
          display: flex;
          flex-direction: column;
          color: #d1d5db;
        }
        .mobile-user-info-text .name {
          font-weight: 600;
          font-size: 1rem;
          text-transform: capitalize;
        }
        .mobile-user-info-text .role {
          font-size: 0.85rem;
          color: #9ca3af;
          text-transform: capitalize;
        }
      `}</style>

      <nav className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-6 py-4 w-full sticky top-0 z-40 shadow-lg">
        <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8">
          {/* Left Section: Logo */}
          <div className="flex items-center gap-3">
            <img src="/flow1.png" alt="Logo" className="w-10 h-10 rounded-full border border-cyan-400 p-1" />
            <Link href="/" className={`text-2xl font-bold tracking-tight hover:text-cyan-300 transition duration-200 ${isActive("/") ? "text-cyan-300" : ""}`}>
              MeedianAI-Flow
            </Link>
          </div>

          {/* Center Section: Nav Items */}
         <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 space-x-4">
            {role === "admin" && (
              <>
                <Link
                  href="/dashboard"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard") ? "text-cyan-300 active" : ""}`}
                >
                  General Dashboard
                </Link>
                <Link
                  href="/dashboard/admin"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/admin") ? "text-cyan-300 active" : ""}`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/managersCommon/routineTasks"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-300 active" : ""}`}
                >
                  Routine Tasks
                </Link>
                <Link
                  href="/dashboard/managersCommon/assignTask"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-300 active" : ""}`}
                >
                  Assign Task
                </Link>
                <button
                  onClick={handleAddMember}
                  className="nav-button bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Add Member
                </button>
                <button
                  onClick={handleManageMeedian}
                  className="nav-button bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Manage Meedian
                </button>
              </>
            )}

            {role === "team_manager" && (
              <>
                <Link
                  href="/dashboard"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard") ? "text-cyan-300 active" : ""}`}
                >
                  General Dashboard
                </Link>
                <Link
                  href="/dashboard/team_manager"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/team_manager") ? "text-cyan-300 active" : ""}`}
                >
                  My Dashboard
                </Link>
                <Link
                  href="/dashboard/managersCommon/routineTasks"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-300 active" : ""}`}
                >
                  Routine Tasks
                </Link>
                <Link
                  href="/dashboard/managersCommon/assignTask"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-300 active" : ""}`}
                >
                  Assign Task
                </Link>
                <Link
                  href="/dashboard/team_manager/myHistory"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/team_manager/myHistory") ? "text-cyan-300 active" : ""}`}
                >
                  My History
                </Link>
              </>
            )}

            {role === "member" && (
              <>
                <Link
                  href="/dashboard"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard") ? "text-cyan-300 active" : ""}`}
                >
                  General Dashboard
                </Link>
                <Link
                  href="/dashboard/member"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member") ? "text-cyan-300 active" : ""}`}
                >
                  My Dashboard
                </Link>
                <Link
                  href="/dashboard/member/myHistory"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/myHistory") ? "text-cyan-300 active" : ""}`}
                >
                  My History
                </Link>
              </>
            )}

            {status === "unauthenticated" && (
              <>
                <button
                  onClick={() => handleLogin("admin")}
                  className="nav-button bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Admin Login
                </button>
                <button
                  onClick={() => handleLogin("team_manager")}
                  className="nav-button bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Team Manager Login
                </button>
                <button
                  onClick={() => handleLogin("member")}
                  className="nav-button bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Member Login
                </button>
              </>
            )}
          </div>

          {/* Right Section: User Info, Logout, and Mobile Toggle */}
          <div className="flex items-center gap-4">
            {(role === "admin" || role === "team_manager" || role === "member") && (
              <>
                <div className="user-info hidden md:flex">
                  <img src={userImage} alt="User Avatar" />
                  <div className="user-info-text">
                    <span className="name">{userName}</span>
                    <span className="role">{role.replace("_", " ")}</span>
                  </div>
                </div>
                <button
                  onClick={openLogoutModal}
                  className="hidden md:block nav-button bg-red-600 hover:bg-red-700 text-white"
                >
                  Logout
                </button>
              </>
            )}
            <div className="md:hidden">
              <button onClick={toggleMobileMenu} className="text-white p-2 rounded-full hover:bg-gray-700 transition duration-200">
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <>
            <div className="mobile-menu-overlay open" onClick={toggleMobileMenu}></div>
            <div className={`mobile-menu ${isMobileMenuOpen ? "open" : ""}`}>
              <div className="flex justify-between items-center mb-6">
                <span className="text-lg font-bold text-cyan-400">Menu</span>
                <button onClick={toggleMobileMenu} className="text-white p-2 rounded-full hover:bg-gray-700">
                  <X size={24} />
                </button>
              </div>
              {(role === "admin" || role === "team_manager" || role === "member") && (
                <div className="mobile-user-info">
                  <img src={userImage} alt="User Avatar" />
                  <div className="mobile-user-info-text">
                    <span className="name">{userName}</span>
                    <span className="role">{role.replace("_", " ")}</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {role === "admin" && (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      General Dashboard
                    </Link>
                    <Link
                      href="/dashboard/admin"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/admin") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/managersCommon/routineTasks"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      Routine Tasks
                    </Link>
                    <Link
                      href="/dashboard/managersCommon/assignTask"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      Assign Task
                    </Link>
                    <button
                      onClick={() => {
                        handleAddMember();
                        toggleMobileMenu();
                      }}
                      className="mobile-menu-item text-left hover:text-cyan-400 w-full"
                    >
                      Add Member
                    </button>
                    <button
                      onClick={() => {
                        handleManageMeedian();
                        toggleMobileMenu();
                      }}
                      className="mobile-menu-item text-left hover:text-cyan-400 w-full"
                    >
                      Manage Meedian
                    </button>
                  </>
                )}
                {role === "team_manager" && (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      General Dashboard
                    </Link>
                    <Link
                      href="/dashboard/team_manager"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/team_manager") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      My Dashboard
                    </Link>
                    <Link
                      href="/dashboard/managersCommon/routineTasks"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      Routine Tasks
                    </Link>
                    <Link
                      href="/dashboard/managersCommon/assignTask"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      Assign Task
                    </Link>
                    <Link
                      href="/dashboard/team_manager/myHistory"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/team_manager/myHistory") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      My History
                    </Link>
                  </>
                )}
                {role === "member" && (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      General Dashboard
                    </Link>
                    <Link
                      href="/dashboard/member"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/member") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      My Dashboard
                    </Link>
                    <Link
                      href="/dashboard/member/myHistory"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/member/myHistory") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      My History
                    </Link>
                  </>
                )}
                {status === "unauthenticated" && (
                  <>
                    <button
                      onClick={() => {
                        handleLogin("admin");
                        toggleMobileMenu();
                      }}
                      className="mobile-menu-item text-left hover:text-cyan-400 w-full"
                    >
                      Admin Login
                    </button>
                    <button
                      onClick={() => {
                        handleLogin("team_manager");
                        toggleMobileMenu();
                      }}
                      className="mobile-menu-item text-left hover:text-cyan-400 w-full"
                    >
                      Team Manager Login
                    </button>
                    <button
                      onClick={() => {
                        handleLogin("member");
                        toggleMobileMenu();
                      }}
                      className="mobile-menu-item text-left hover:text-cyan-400 w-full"
                    >
                      Member Login
                    </button>
                  </>
                )}
                {(role === "admin" || role === "team_manager" || role === "member") && (
                  <button
                    onClick={() => {
                      openLogoutModal();
                      toggleMobileMenu();
                    }}
                    className="mobile-menu-item text-left text-red-400 hover:text-red-500 w-full"
                  >
                    Logout
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Logout Modal Portal */}
      {mounted && typeof window !== "undefined" && isLogoutModalOpen && document?.body &&
        createPortal(<LogoutModal />, document.body)}
    </>
  );
}