// "use client";
// import { useSession, signOut } from "next-auth/react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";
// import { useEffect, useState } from "react";
// import { Menu, X, Heart, Users } from "lucide-react";
// import { createPortal } from "react-dom";

// export default function Navbar() {
//   const { data: session, status } = useSession();
//   const pathname = usePathname();
//   const router = useRouter();
//   const [mounted, setMounted] = useState(false);
//   const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
//   const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

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
//   const handleAddMember = () => router.push("/dashboard/admin/addUser");
//   const handleManageMeedian = () => router.push("/dashboard/admin/manageMeedian");
//   const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
//   const openLogoutModal = () => setIsLogoutModalOpen(true);
//   const closeLogoutModal = () => setIsLogoutModalOpen(false);

//   const isActive = (href) => pathname.replace(/\/$/, "") === href.replace(/\/$/, "");

//   const openTogetherWorkspace = () => {
//     window.open("/dashboard/managersCommon/workTogether", "_blank", "width=1200,height=800");
//   };

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
//           padding: 0.5rem 0.75rem;
//           font-size: 0.95rem;
//           font-weight: 500;
//           transition: all 0.2s ease;
//           border-radius: 6px;
//           margin-bottom: 0.3rem;
//           white-space: nowrap;
//         }
//         .mobile-menu-item:hover {
//           background: #374151;
//         }
//         .mobile-together-button {
//           display: flex;
//           align-items: center;
//           gap: 0.5rem;
//           padding: 0.5rem 0.75rem;
//           font-size: 0.95rem;
//           font-weight: 500;
//           border-radius: 6px;
//           margin-bottom: 0.3rem;
//           transition: all 0.2s ease;
//         }
//         .mobile-together-button:hover {
//           background: #374151;
//         }
//         .mylife-mobile {
//           display: flex;
//           align-items: center;
//           gap: 0.5rem;
//           color: #d1fae5;
//           background: #15803d;
//           padding: 0.5rem 0.75rem;
//           font-size: 0.95rem;
//           font-weight: 500;
//           border-radius: 6px;
//           margin-bottom: 0.3rem;
//         }
//         .mylife-mobile:hover {
//           background: #16a34a;
//         }
//         .nav-item {
//           position: relative;
//           padding: 0.4rem 0.8rem;
//           font-weight: 500;
//           font-size: 0.85rem;
//           transition: all 0.3s ease;
//           border-radius: 6px;
//           white-space: nowrap;
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
//           padding: 0.4rem 1rem;
//           font-weight: 500;
//           font-size: 0.85rem;
//           border-radius: 6px;
//           transition: all 0.3s ease;
//         }
//         .nav-button:hover {
//           transform: translateY(-2px);
//         }
//         .nav-icon-button {
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           padding: 0.4rem;
//           border-radius: 50%;
//           transition: all 0.3s ease;
//         }
//         .nav-icon-button:hover {
//           background: rgba(255, 255, 255, 0.1);
//           transform: translateY(-2px);
//         }
//         .nav-icon-button.active::after {
//           content: '';
//           position: absolute;
//           bottom: -4px;
//           left: 50%;
//           transform: translateX(-50%);
//           width: 24px;
//           height: 2px;
//           background: #22d3ee;
//         }
//         .together-icon {
//           animation: pulse-glow 1.5s infinite ease-in-out;
//           filter: drop-shadow(0 0 4px rgba(34, 211, 238, 0.5));
//         }
//         .together-icon:hover {
//           animation: pulse-glow-hover 0.8s infinite ease-in-out;
//         }
//         @keyframes pulse-glow {
//           0% {
//             transform: scale(1);
//             opacity: 0.8;
//             filter: drop-shadow(0 0 4px rgba(34, 211, 238, 0.3));
//           }
//           50% {
//             transform: scale(1.15);
//             opacity: 1;
//             filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.7));
//           }
//           100% {
//             transform: scale(1);
//             opacity: 0.8;
//             filter: drop-shadow(0 0 4px rgba(34, 211, 238, 0.3));
//           }
//         }
//         @keyframes pulse-glow-hover {
//           0% {
//             transform: scale(1.1);
//             filter: drop-shadow(0 0 6px rgba(34, 211, 238, 0.5));
//           }
//           50% {
//             transform: scale(1.25);
//             filter: drop-shadow(0 0 12px rgba(34, 211, 238, 1));
//           }
//           100% {
//             transform: scale(1.1);
//             filter: drop-shadow(0 0 6px rgba(34, 211, 238, 0.5));
//           }
//         }
//         .mobile-together-icon {
//           animation: pulse-glow 1.5s infinite ease-in-out;
//           filter: drop-shadow(0 0 4px rgba(34, 211, 238, 0.5));
//         }
//         .mobile-together-icon:hover {
//           animation: pulse-glow-hover 0.8s infinite ease-in-out;
//         }
//         .mylife-button {
//           display: flex;
//           align-items: center;
//           gap: 0.5rem;
//           color: #d1fae5;
//           background: #15803d;
//           padding: 0.4rem 1rem;
//           font-weight: 500;
//           font-size: 0.85rem;
//           border-radius: 6px;
//           transition: all 0.3s ease;
//         }
//         .mylife-button:hover {
//           background: #16a34a;
//           transform: translateY(-2px);
//         }
//         .mylife-button.active::after {
//           content: '';
//           position: absolute;
//           bottom: -4px;
//           left: 50%;
//           transform: translateX(-50%);
//           width: 50%;
//           height: 2px;
//           background: #22d3ee;
//         }
//         .user-info {
//           display: flex;
//           align-items: center;
//           gap: 0.5rem;
//           background: #374151;
//           padding: 0.4rem 0.8rem;
//           border-radius: 10px;
//           box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
//           transition: all 0.3s ease;
//         }
//         .user-info:hover {
//           transform: translateY(-2px);
//           background: #4b5563;
//         }
//         .user-info img {
//           width: 28px;
//           height: 28px;
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
//           font-size: 0.8rem;
//           text-transform: capitalize;
//         }
//         .user-info-text .role {
//           font-size: 0.7rem;
//           color: #9ca3af;
//           text-transform: capitalize;
//         }
//         .mobile-user-info {
//           display: flex;
//           align-items: center;
//           gap: 0.5rem;
//           background: #374151;
//           padding: 0.5rem;
//           border-radius: 10px;
//           margin-bottom: 0.75rem;
//           box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
//         }
//         .mobile-user-info img {
//           width: 36px;
//           height: 36px;
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
//           font-size: 0.9rem;
//           text-transform: capitalize;
//         }
//         .mobile-user-info-text .role {
//           font-size: 0.8rem;
//           color: #9ca3af;
//           text-transform: capitalize;
//         }
//         .managerial-group {
//           display: flex;
//           align-items: center;
//           gap: 0.5rem;
//           border: 1px solid #22d3ee;
//           padding: 0.2rem;
//           border-radius: 6px;
//           background: rgba(255, 255, 255, 0.05);
//         }
//         .mobile-managerial-group {
//           border: 1px solid #22d3ee;
//           padding: 0.5rem;
//           border-radius: 6px;
//           margin: 0.5rem 0;
//           background: #2d3748;
//         }
//       `}</style>

//       <nav className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-4 py-3 w-full sticky top-0 z-40 shadow-lg">
//         <div className="flex items-center justify-between w-full px-2 sm:px-4 lg:px-6">
//           {/* Left Section: Logo */}
//           <div className="flex items-center gap-2">
//             <img src="/flow1.png" alt="Logo" className="w-8 h-8 rounded-full border border-cyan-400 p-1" />
//             <Link href="/" className={`text-xl font-bold tracking-tight hover:text-cyan-300 transition duration-200 ${isActive("/") ? "text-cyan-300" : ""}`}>
//               MeedianAI-Flow
//             </Link>
//           </div>

//           {/* Center Section: Nav Items */}
//           <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 space-x-2">
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
//                   Dashboard
//                 </Link>
//                 <div className="managerial-group">
//                   <Link
//                     href="/dashboard/managersCommon/routineTasks"
//                     className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-300 active" : ""}`}
//                   >
//                     Routine Tasks
//                   </Link>
//                   <Link
//                     href="/dashboard/managersCommon/assignTask"
//                     className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-300 active" : ""}`}
//                   >
//                     Assign Task
//                   </Link>
//                   <button
//                     onClick={openTogetherWorkspace}
//                     title="Together"
//                     className={`nav-icon-button relative hover:text-cyan-300 ${isActive("/dashboard/managersCommon/workTogether") ? "text-cyan-300 active" : ""}`}
//                   >
//                     <Users size={18} className="together-icon" />
//                   </button>
//                 </div>
//                 <button
//                   onClick={handleAddMember}
//                   className="nav-button bg-teal-600 hover:bg-teal-700 text-white"
//                 >
//                   Add Member
//                 </button>
//                 <button
//                   onClick={handleManageMeedian}
//                   className="nav-button bg-blue-600 hover:bg-blue-700 text-white"
//                 >
//                   Manage Meedian
//                 </button>
//               </>
//             )}

//             {role === "team_manager" && (
//               <>
//                 <Link
//                   href="/dashboard"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard") ? "text-cyan-300 active" : ""}`}
//                 >
//                   General
//                 </Link>
//                 <Link
//                   href="/dashboard/team_manager"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/team_manager") ? "text-cyan-300 active" : ""}`}
//                 >
//                   My Dashboard
//                 </Link>
//                 <Link
//                   href="/dashboard/member/myMeedRituals"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/myMeedRituals") ? "text-cyan-300 active" : ""}`}
//                 >
//                   MyMRIs
//                 </Link>
//                 <Link
//                   href="/dashboard/member/closeMyDay"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/closeMyDay") ? "text-cyan-300 active" : ""}`}
//                 >
//                   CloseMyDay
//                 </Link>
//                 <Link
//                   href="/dashboard/member/myPerformance"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/myPerformance") ? "text-cyan-300 active" : ""}`}
//                 >
//                   MyPerformance
//                 </Link>
//                 <div className="managerial-group">
//                   <Link
//                     href="/dashboard/managersCommon/routineTasks"
//                     className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-300 active" : ""}`}
//                   >
//                     Routine Tasks
//                   </Link>
//                   <Link
//                     href="/dashboard/managersCommon/assignTask"
//                     className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-300 active" : ""}`}
//                   >
//                     Assign Task
//                   </Link>
//                   <button
//                     onClick={openTogetherWorkspace}
//                     title="Together"
//                     className={`nav-icon-button relative hover:text-cyan-300 ${isActive("/dashboard/managersCommon/workTogether") ? "text-cyan-300 active" : ""}`}
//                   >
//                     <Users size={18} className="together-icon" />
//                   </button>
//                 </div>
//               </>
//             )}

//             {role === "member" && (
//               <>
//                 <Link
//                   href="/dashboard"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard") ? "text-cyan-300 active" : ""}`}
//                 >
//                   General
//                 </Link>
//                 <Link
//                   href="/dashboard/member"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member") ? "text-cyan-300 active" : ""}`}
//                 >
//                   My Dashboard
//                 </Link>
//                 <Link
//                   href="/dashboard/member/myMeedRituals"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/myMeedRituals") ? "text-cyan-300 active" : ""}`}
//                 >
//                   MyMRIs
//                 </Link>
//                 <Link
//                   href="/dashboard/member/closeMyDay"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/closeMyDay") ? "text-cyan-300 active" : ""}`}
//                 >
//                   CloseMyDay
//                 </Link>
//                 <Link
//                   href="/dashboard/member/myPerformance"
//                   className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/myPerformance") ? "text-cyan-300 active" : ""}`}
//                 >
//                   MyPerformance
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
//                   Manager Login
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

//           {/* Right Section: User Info, MyLife, Logout, and Mobile Toggle */}
//           <div className="flex items-center gap-2">
//             {(role === "admin" || role === "team_manager" || role === "member") && (
//               <>
//                 {(role === "team_manager" || role === "member") && (
//                   <Link
//                     href={`/dashboard/${role === "team_manager" ? "team_manager" : "member"}/myLife`}
//                     className={`mylife-button ${isActive(`/dashboard/${role === "team_manager" ? "team_manager" : "member"}/myLife`) ? "active" : ""}`}
//                   >
//                     <Heart size={16} />
//                     MyLife
//                   </Link>
//                 )}
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
//             <div className="md:hidden">
//               <button onClick={toggleMobileMenu} className="text-white p-1 rounded-full hover:bg-gray-700 transition duration-200">
//                 {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Mobile Menu */}
//         {isMobileMenuOpen && (
//           <>
//             <div className="mobile-menu-overlay open" onClick={toggleMobileMenu}></div>
//             <div className={`mobile-menu ${isMobileMenuOpen ? "open" : ""}`}>
//               <div className="flex justify-between items-center mb-4">
//                 <span className="text-base font-bold text-cyan-400">Menu</span>
//                 <button onClick={toggleMobileMenu} className="text-white p-1 rounded-full hover:bg-gray-700">
//                   <X size={20} />
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
//               <div className="space-y-1">
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
//                       Dashboard
//                     </Link>
//                     <div className="mobile-managerial-group">
//                       <Link
//                         href="/dashboard/managersCommon/routineTasks"
//                         onClick={toggleMobileMenu}
//                         className={`mobile-menu-item hover:text-cyan-400 ${
//                           isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                         }`}
//                       >
//                         Routine Tasks
//                       </Link>
//                       <Link
//                         href="/dashboard/managersCommon/assignTask"
//                         onClick={toggleMobileMenu}
//                         className={`mobile-menu-item hover:text-cyan-400 ${
//                           isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                         }`}
//                       >
//                         Assign Task
//                       </Link>
//                       <button
//                         onClick={() => {
//                           openTogetherWorkspace();
//                           toggleMobileMenu();
//                         }}
//                         className={`mobile-together-button hover:text-cyan-400 ${
//                           isActive("/dashboard/managersCommon/workTogether") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                         }`}
//                       >
//                         <Users size={18} className="mobile-together-icon" />
//                         Together
//                       </button>
//                     </div>
//                     <button
//                       onClick={() => {
//                         handleAddMember();
//                         toggleMobileMenu();
//                       }}
//                       className="mobile-menu-item text-left hover:text-cyan-400 w-full"
//                     >
//                       Add Member
//                     </button>
//                     <button
//                       onClick={() => {
//                         handleManageMeedian();
//                         toggleMobileMenu();
//                       }}
//                       className="mobile-menu-item text-left hover:text-cyan-400 w-full"
//                     >
//                       Manage Meedian
//                     </button>
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
//                       General
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
//                       href="/dashboard/member/myMeedRituals"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/member/myMeedRituals") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       MyMRIs
//                     </Link>
//                     <Link
//                       href="/dashboard/member/closeMyDay"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/member/closeMyDay") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       CloseMyDay
//                     </Link>
//                     <Link
//                       href="/dashboard/member/myPerformance"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/member/myPerformance") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       MyPerformance
//                     </Link>
//                     <div className="mobile-managerial-group">
//                       <Link
//                         href="/dashboard/managersCommon/routineTasks"
//                         onClick={toggleMobileMenu}
//                         className={`mobile-menu-item hover:text-cyan-400 ${
//                           isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                         }`}
//                       >
//                         Routine Tasks
//                       </Link>
//                       <Link
//                         href="/dashboard/managersCommon/assignTask"
//                         onClick={toggleMobileMenu}
//                         className={`mobile-menu-item hover:text-cyan-400 ${
//                           isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                         }`}
//                       >
//                         Assign Task
//                       </Link>
//                       <button
//                         onClick={() => {
//                           openTogetherWorkspace();
//                           toggleMobileMenu();
//                         }}
//                         className={`mobile-together-button hover:text-cyan-400 ${
//                           isActive("/dashboard/managersCommon/workTogether") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                         }`}
//                       >
//                         <Users size={18} className="mobile-together-icon" />
//                         Together
//                       </button>
//                     </div>
//                     <Link
//                       href="/dashboard/team_manager/myLife"
//                       onClick={toggleMobileMenu}
//                       className={`mylife-mobile ${
//                         isActive("/dashboard/team_manager/myLife") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       <Heart size={16} />
//                       MyLife
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
//                       General
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
//                       href="/dashboard/member/myMeedRituals"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/member/myMeedRituals") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       MyMRIs
//                     </Link>
//                     <Link
//                       href="/dashboard/member/closeMyDay"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/member/closeMyDay") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       CloseMyDay
//                     </Link>
//                     <Link
//                       href="/dashboard/member/myPerformance"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${
//                         isActive("/dashboard/member/myPerformance") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       MyPerformance
//                     </Link>
//                     <Link
//                       href="/dashboard/member/myLife"
//                       onClick={toggleMobileMenu}
//                       className={`mylife-mobile ${
//                         isActive("/dashboard/member/myLife") ? "text-cyan-400 font-semibold bg-gray-700" : ""
//                       }`}
//                     >
//                       <Heart size={16} />
//                       MyLife
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
//                       Manager Login
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
import { Menu, X, Heart, Users, Sun, Moon } from "lucide-react";
import { createPortal } from "react-dom";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [theme, setTheme] = useState("dark"); // Theme state for light/dark mode
  const [isUserHover, setIsUserHover] = useState(false); // For user icon hover

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.classList.toggle("light", savedTheme === "light");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("light", newTheme === "light");
  };

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
  const handleRecruit = () => window.open("https://meed-recruitment.onrender.com/login", "_blank");
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const openLogoutModal = () => setIsLogoutModalOpen(true);
  const closeLogoutModal = () => setIsLogoutModalOpen(false);

  const isActive = (href) => pathname.replace(/\/$/, "") === href.replace(/\/$/, "");

  const openTogetherWorkspace = () => {
    window.open("/dashboard/managersCommon/workTogether", "_blank", "width=1200,height=800");
  };

  const LogoutModal = () => (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="text-lg font-semibold mb-4">Confirm Logout</h2>
        <p className="mb-6">Are you sure you want to log out?</p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition duration-200 transform hover:scale-105"
          >
            Yes, Log Out
          </button>
          <button
            onClick={closeLogoutModal}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-medium transition duration-200 transform hover:scale-105"
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
        :root {
          --bg-primary: #0f172a; /* Dark background */
          --bg-secondary: #1e293b;
          --text-primary: #f1f5f9;
          --accent-cyan: #06b6d4;
          --accent-green: #10b981;
          --accent-red: #ef4444;
          --shadow-color: rgba(0, 0, 0, 0.3);
        }
        .light {
          --bg-primary: #f8fafc;
          --bg-secondary: #e2e8f0;
          --text-primary: #0f172a;
          --accent-cyan: #0e7490;
          --accent-green: #059669;
          --accent-red: #b91c1c;
          --shadow-color: rgba(0, 0, 0, 0.1);
        }
        body {
          background: var(--bg-primary);
          color: var(--text-primary);
        }
        .modal-overlay {
          animation: fadeIn 0.3s ease-out;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          inset: 0;
          justify-content: center;
          position: fixed;
          z-index: 10000;
        }
        .modal-content {
          animation: scaleIn 0.3s ease-out;
          background: var(--bg-secondary);
          border: 1px solid var(--accent-cyan);
          border-radius: 12px;
          box-shadow: 0 8px 16px var(--shadow-color);
          max-width: 400px;
          padding: 24px;
          text-align: center;
          width: 90%;
        }
        .mobile-menu {
          animation: slideInRight 0.3s ease-in-out forwards;
          background: var(--bg-secondary);
          box-shadow: -4px 0 12px var(--shadow-color);
          height: 100%;
          max-width: 300px;
          padding: 1.5rem;
          position: fixed;
          right: 0;
          top: 0;
          transform: translateX(100%);
          transition: transform 0.3s ease-in-out;
          width: 80%;
          z-index: 9999;
        }
        .mobile-menu.open {
          transform: translateX(0);
        }
        .mobile-menu-overlay {
          animation: fadeIn 0.3s ease-in-out;
          background: rgba(0, 0, 0, 0.5);
          inset: 0;
          opacity: 0;
          pointer-events: none;
          position: fixed;
          transition: opacity 0.3s ease-in-out;
          z-index: 9998;
        }
        .mobile-menu-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }
        .mobile-menu-item {
          border-radius: 8px;
          display: block;
          font-size: 0.9rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
          padding: 0.75rem 1rem;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .mobile-menu-item:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: scale(1.03);
        }
        .mobile-together-button {
          align-items: center;
          border-radius: 8px;
          display: flex;
          font-size: 0.9rem;
          font-weight: 500;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
          padding: 0.75rem 1rem;
          transition: all 0.2s ease;
        }
        .mobile-together-button:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: scale(1.03);
        }
        .mylife-mobile {
          align-items: center;
          background: linear-gradient(135deg, var(--accent-green), #059669);
          border-radius: 8px;
          color: var(--text-primary);
          display: flex;
          font-size: 0.9rem;
          font-weight: 500;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
          padding: 0.75rem 1rem;
        }
        .mylife-mobile:hover {
          transform: scale(1.03);
        }
        .nav-item {
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 500;
          letter-spacing: 0.025rem;
          padding: 0.3rem 0.6rem;
          position: relative;
          transition: all 0.3s ease;
          white-space: nowrap;
        }
        .nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          transform: translateY(-1px) scale(1.02);
        }
        .nav-item.active::after {
          background: linear-gradient(to right, var(--accent-cyan), #22d3ee);
          bottom: -3px;
          content: '';
          height: 2px;
          left: 50%;
          position: absolute;
          transform: translateX(-50%);
          width: 50%;
        }
        .nav-button {
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 500;
          letter-spacing: 0.025rem;
          padding: 0.3rem 0.8rem;
          transition: all 0.3s ease;
          box-shadow: 0 1px 2px var(--shadow-color);
        }
        .nav-button:hover {
          transform: translateY(-2px) scale(1.03);
        }
        .nav-icon-button {
          align-items: center;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          padding: 0.3rem;
          position: relative;
          transition: all 0.3s ease;
        }
        .nav-icon-button:hover {
          background: rgba(255, 255, 255, 0.05);
          transform: translateY(-2px) scale(1.05);
        }
        .nav-icon-button.active::after {
          background: var(--accent-cyan);
          bottom: -3px;
          content: '';
          height: 2px;
          left: 50%;
          position: absolute;
          transform: translateX(-50%);
          width: 20px;
        }
        .together-icon {
          animation: pulse-glow 1.8s infinite ease-in-out;
          color: var(--accent-red);
          filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.6));
        }
        .together-icon:hover {
          animation: pulse-glow-hover 1s infinite ease-in-out;
        }
        @keyframes pulse-glow {
          0%, 100% {
            filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.4));
            opacity: 0.85;
            transform: scale(1);
          }
          50% {
            filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.8));
            opacity: 1;
            transform: scale(1.2);
          }
        }
        @keyframes pulse-glow-hover {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.6));
            transform: scale(1.15);
          }
          50% {
            filter: drop-shadow(0 0 14px rgba(239, 68, 68, 1));
            transform: scale(1.3);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.85); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .mobile-together-icon {
          animation: pulse-glow 1.8s infinite ease-in-out;
          color: var(--accent-red);
          filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.6));
        }
        .mobile-together-icon:hover {
          animation: pulse-glow-hover 1s infinite ease-in-out;
        }
        .mylife-button {
          align-items: center;
          background: linear-gradient(135deg, var(--accent-green), #059669);
          border-radius: 6px;
          color: var(--text-primary);
          display: flex;
          font-size: 0.8rem;
          font-weight: 500;
          gap: 0.5rem;
          letter-spacing: 0.025rem;
          padding: 0.3rem 0.8rem;
          position: relative;
          transition: all 0.3s ease;
          box-shadow: 0 1px 2px var(--shadow-color);
        }
        .mylife-button:hover {
          transform: translateY(-2px) scale(1.03);
        }
        .mylife-button.active::after {
          background: var(--accent-cyan);
          bottom: -3px;
          content: '';
          height: 2px;
          left: 50%;
          position: absolute;
          transform: translateX(-50%);
          width: 50%;
        }
        .user-info {
          align-items: center;
          position: relative;
          display: flex;
          gap: 0.25rem;
        }
        .user-info img {
          border: 1px solid var(--accent-cyan);
          border-radius: 50%;
          height: 24px;
          object-fit: cover;
          width: 24px;
          cursor: pointer;
        }
        .user-details {
          position: absolute;
          top: 100%;
          right: 0;
          background: var(--bg-secondary);
          border-radius: 8px;
          box-shadow: 0 4px 8px var(--shadow-color);
          padding: 0.5rem;
          z-index: 50;
          white-space: nowrap;
          color: var(--text-primary);
        }
        .user-details .name {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
        }
        .user-details .role {
          font-size: 0.7rem;
          color: #94a3b8;
          text-transform: capitalize;
        }
        .mobile-user-info {
          align-items: center;
          background: var(--bg-secondary);
          border-radius: 8px;
          box-shadow: 0 2px 4px var(--shadow-color);
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          padding: 0.5rem;
        }
        .mobile-user-info img {
          border: 1px solid var(--accent-cyan);
          border-radius: 50%;
          height: 32px;
          object-fit: cover;
          width: 32px;
        }
        .mobile-user-info-text {
          color: var(--text-primary);
          display: flex;
          flex-direction: column;
        }
        .mobile-user-info-text .name {
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: capitalize;
        }
        .mobile-user-info-text .role {
          color: #94a3b8;
          font-size: 0.75rem;
          text-transform: capitalize;
        }
        .managerial-group {
          align-items: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--accent-cyan);
          border-radius: 6px;
          display: flex;
          gap: 0.5rem;
          padding: 0.2rem;
        }
        .mobile-managerial-group {
          background: var(--bg-secondary);
          border: 1px solid var(--accent-cyan);
          border-radius: 6px;
          margin: 0.75rem 0;
          padding: 0.5rem;
        }
        .theme-toggle {
          border-radius: 50%;
          padding: 0.3rem;
          transition: all 0.3s ease;
        }
        .theme-toggle:hover {
          background: rgba(255, 255, 255, 0.05);
          transform: scale(1.05);
        }
      `}</style>

      <nav className="bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)] text-[var(--text-primary)] px-4 py-2 w-full sticky top-0 z-40 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between w-full px-2 sm:px-4 lg:px-8">
          {/* Box 1: Logo and Name */}
          <div className="flex items-center gap-2">
            <img src="/flow1.png" alt="Logo" className="w-8 h-8 rounded-full border-2 border-[var(--accent-cyan)] p-1 shadow-md" />
            <Link href="/" className={`text-lg font-bold tracking-tight hover:text-[var(--accent-cyan)] transition duration-300 ${isActive("/") ? "text-[var(--accent-cyan)]" : ""}`}>
              MeedianAI-Flow
            </Link>
          </div>

          {/* Box 2: General/My Dashboard + extras if not admin */}
          <div className="hidden lg:flex items-center gap-6 ml-8">
            {role && (
              <>
                <Link
                  href="/dashboard"
                  className={`nav-item hover:text-[var(--accent-cyan)] ${isActive("/dashboard") ? "text-[var(--accent-cyan)] active" : ""}`}
                >
                  General
                </Link>
                <Link
                  href={`/dashboard/${role === "admin" ? "admin" : role === "team_manager" ? "team_manager" : "member"}`}
                  className={`nav-item hover:text-[var(--accent-cyan)] ${isActive(`/dashboard/${role === "admin" ? "admin" : role === "team_manager" ? "team_manager" : "member"}`) ? "text-[var(--accent-cyan)] active" : ""}`}
                >
                  My Dashboard
                </Link>
                {role !== "admin" && (
                  <>
                    <Link
                      href="/dashboard/member/myMeedRituals"
                      className={`nav-item hover:text-[var(--accent-cyan)] ${isActive("/dashboard/member/myMeedRituals") ? "text-[var(--accent-cyan)] active" : ""}`}
                    >
                      MyMRIs
                    </Link>
                    <Link
                      href="/dashboard/member/closeMyDay"
                      className={`nav-item hover:text-[var(--accent-cyan)] ${isActive("/dashboard/member/closeMyDay") ? "text-[var(--accent-cyan)] active" : ""}`}
                    >
                      CloseMyDay
                    </Link>
                    <Link
                      href="/dashboard/member/myPerformance"
                      className={`nav-item hover:text-[var(--accent-cyan)] ${isActive("/dashboard/member/myPerformance") ? "text-[var(--accent-cyan)] active" : ""}`}
                    >
                      MyPerformance
                    </Link>
                  </>
                )}
              </>
            )}
          </div>

          {/* Box 3: Managerial Group */}
          <div className="hidden lg:flex items-center gap-4">
            {(role === "admin" || role === "team_manager") && (
              <div className="managerial-group">
                <Link
                  href="/dashboard/managersCommon/routineTasks"
                  className={`nav-item hover:text-[var(--accent-cyan)] ${isActive("/dashboard/managersCommon/routineTasks") ? "text-[var(--accent-cyan)] active" : ""}`}
                >
                  Routine Tasks
                </Link>
                <Link
                  href="/dashboard/managersCommon/assignTask"
                  className={`nav-item hover:text-[var(--accent-cyan)] ${isActive("/dashboard/managersCommon/assignTask") ? "text-[var(--accent-cyan)] active" : ""}`}
                >
                  Assign Task
                </Link>
                <button
                  onClick={openTogetherWorkspace}
                  title="Together Workspace"
                  aria-label="Open Together Workspace"
                  className={`nav-icon-button relative hover:text-[var(--accent-cyan)] ${isActive("/dashboard/managersCommon/workTogether") ? "text-[var(--accent-cyan)] active" : ""}`}
                >
                  <Users size={16} className="together-icon" />
                </button>
                <button
                  onClick={handleRecruit}
                  className="nav-item hover:text-[var(--accent-cyan)]"
                >
                  Recruit
                </button>
              </div>
            )}
          </div>

          {/* Box 4: Add Member and Manage Meedian (for admin) */}
          <div className="hidden lg:flex items-center gap-4">
            {role === "admin" && (
              <>
                <button
                  onClick={handleAddMember}
                  className="nav-button bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white"
                >
                  Add Member
                </button>
                <button
                  onClick={handleManageMeedian}
                  className="nav-button bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                >
                  Manage Meedian
                </button>
              </>
            )}
          </div>

          {/* Box 5: Theme Toggle + User Icon (hover details) + Logout + Name */}
          <div className="flex items-center gap-3">
            {(role === "admin" || role === "team_manager" || role === "member") && (
              <>
                {(role === "team_manager" || role === "member") && (
                  <Link
                    href={`/dashboard/${role === "team_manager" ? "team_manager" : "member"}/myLife`}
                    className={`mylife-button hidden lg:flex ${isActive(`/dashboard/${role === "team_manager" ? "team_manager" : "member"}/myLife`) ? "active" : ""}`}
                  >
                    <Heart size={14} />
                    MyLife
                  </Link>
                )}
                <button
                  onClick={toggleTheme}
                  title="Toggle Theme"
                  aria-label="Toggle light/dark mode"
                  className="theme-toggle text-[var(--text-primary)]"
                >
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                <div 
                  className="user-info hidden md:flex"
                  onMouseEnter={() => setIsUserHover(true)}
                  onMouseLeave={() => setIsUserHover(false)}
                >
                  <img src={userImage} alt="User Avatar" />
                  {isUserHover && (
                    <div className="user-details">
                      <span className="name">{userName}</span>
                      <span className="role">{role.replace("_", " ")}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={openLogoutModal}
                  className="hidden md:block nav-button bg-gradient-to-r from-[var(--accent-red)] to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                >
                  Logout
                </button>
                <span className="text-sm font-medium hidden lg:block">{userName}</span>
              </>
            )}
            {status === "unauthenticated" && (
              <div className="hidden lg:flex gap-4">
                <button
                  onClick={() => handleLogin("admin")}
                  className="nav-button bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white"
                >
                  Admin Login
                </button>
                <button
                  onClick={() => handleLogin("team_manager")}
                  className="nav-button bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
                >
                  Manager Login
                </button>
                <button
                  onClick={() => handleLogin("member")}
                  className="nav-button bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white"
                >
                  Member Login
                </button>
              </div>
            )}
            <div className="lg:hidden">
              <button onClick={toggleMobileMenu} className="text-[var(--text-primary)] p-1 rounded-full hover:bg-[rgba(255,255,255,0.05)] transition duration-200 transform hover:scale-110">
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <>
            <div className="mobile-menu-overlay open" onClick={toggleMobileMenu}></div>
            <div className={`mobile-menu ${isMobileMenuOpen ? "open" : ""}`}>
              <div className="flex justify-between items-center mb-4">
                <span className="text-base font-bold text-[var(--accent-cyan)]">Menu</span>
                <button onClick={toggleMobileMenu} className="text-[var(--text-primary)] p-1 rounded-full hover:bg-[rgba(255,255,255,0.05)] transform hover:scale-110">
                  <X size={20} />
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
              <div className="space-y-1">
                {role === "admin" && (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                        isActive("/dashboard") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      General Dashboard
                    </Link>
                    <Link
                      href="/dashboard/admin"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                        isActive("/dashboard/admin") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      Dashboard
                    </Link>
                    <div className="mobile-managerial-group">
                      <Link
                        href="/dashboard/managersCommon/routineTasks"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                          isActive("/dashboard/managersCommon/routineTasks") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                        }`}
                      >
                        Routine Tasks
                      </Link>
                      <Link
                        href="/dashboard/managersCommon/assignTask"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                          isActive("/dashboard/managersCommon/assignTask") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                        }`}
                      >
                        Assign Task
                      </Link>
                      <button
                        onClick={() => {
                          openTogetherWorkspace();
                          toggleMobileMenu();
                        }}
                        aria-label="Open Together Workspace"
                        className={`mobile-together-button hover:text-[var(--accent-cyan)] ${
                          isActive("/dashboard/managersCommon/workTogether") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                        }`}
                      >
                        <Users size={16} className="mobile-together-icon" />
                        Together
                      </button>
                      <button
                        onClick={() => {
                          handleRecruit();
                          toggleMobileMenu();
                        }}
                        className="mobile-menu-item text-left hover:text-[var(--accent-cyan)] w-full"
                      >
                        Recruit
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        handleAddMember();
                        toggleMobileMenu();
                      }}
                      className="mobile-menu-item text-left hover:text-[var(--accent-cyan)] w-full"
                    >
                      Add Member
                    </button>
                    <button
                      onClick={() => {
                        handleManageMeedian();
                        toggleMobileMenu();
                      }}
                      className="mobile-menu-item text-left hover:text-[var(--accent-cyan)] w-full"
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
                      className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                        isActive("/dashboard") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      General
                    </Link>
                    <Link
                      href="/dashboard/team_manager"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                        isActive("/dashboard/team_manager") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      My Dashboard
                    </Link>
                    <Link
                      href="/dashboard/member/myMeedRituals"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                        isActive("/dashboard/member/myMeedRituals") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      MyMRIs
                    </Link>
                    <Link
                      href="/dashboard/member/closeMyDay"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                        isActive("/dashboard/member/closeMyDay") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      CloseMyDay
                    </Link>
                    <Link
                      href="/dashboard/member/myPerformance"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                        isActive("/dashboard/member/myPerformance") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      MyPerformance
                    </Link>
                    <div className="mobile-managerial-group">
                      <Link
                        href="/dashboard/managersCommon/routineTasks"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                          isActive("/dashboard/managersCommon/routineTasks") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                        }`}
                      >
                        Routine Tasks
                      </Link>
                      <Link
                        href="/dashboard/managersCommon/assignTask"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                          isActive("/dashboard/managersCommon/assignTask") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                        }`}
                      >
                        Assign Task
                      </Link>
                      <button
                        onClick={() => {
                          openTogetherWorkspace();
                          toggleMobileMenu();
                        }}
                        aria-label="Open Together Workspace"
                        className={`mobile-together-button hover:text-[var(--accent-cyan)] ${
                          isActive("/dashboard/managersCommon/workTogether") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                        }`}
                      >
                        <Users size={16} className="mobile-together-icon" />
                        Together
                      </button>
                      <button
                        onClick={() => {
                          handleRecruit();
                          toggleMobileMenu();
                        }}
                        className="mobile-menu-item text-left hover:text-[var(--accent-cyan)] w-full"
                      >
                        Recruit
                      </button>
                    </div>
                    <Link
                      href="/dashboard/team_manager/myLife"
                      onClick={toggleMobileMenu}
                      className={`mylife-mobile ${
                        isActive("/dashboard/team_manager/myLife") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      <Heart size={14} />
                      MyLife
                    </Link>
                  </>
                )}
                {role === "member" && (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                        isActive("/dashboard") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      General
                    </Link>
                    <Link
                      href="/dashboard/member"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                        isActive("/dashboard/member") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      My Dashboard
                    </Link>
                    <Link
                      href="/dashboard/member/myMeedRituals"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                        isActive("/dashboard/member/myMeedRituals") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      MyMRIs
                    </Link>
                    <Link
                      href="/dashboard/member/closeMyDay"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                        isActive("/dashboard/member/closeMyDay") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      CloseMyDay
                    </Link>
                    <Link
                      href="/dashboard/member/myPerformance"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-[var(--accent-cyan)] ${
                        isActive("/dashboard/member/myPerformance") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      MyPerformance
                    </Link>
                    <Link
                      href="/dashboard/member/myLife"
                      onClick={toggleMobileMenu}
                      className={`mylife-mobile ${
                        isActive("/dashboard/member/myLife") ? "text-[var(--accent-cyan)] font-bold bg-[rgba(255,255,255,0.05)]" : ""
                      }`}
                    >
                      <Heart size={14} />
                      MyLife
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
                      className="mobile-menu-item text-left hover:text-[var(--accent-cyan)] w-full"
                    >
                      Admin Login
                    </button>
                    <button
                      onClick={() => {
                        handleLogin("team_manager");
                        toggleMobileMenu();
                      }}
                      className="mobile-menu-item text-left hover:text-[var(--accent-cyan)] w-full"
                    >
                      Manager Login
                    </button>
                    <button
                      onClick={() => {
                        handleLogin("member");
                        toggleMobileMenu();
                      }}
                      className="mobile-menu-item text-left hover:text-[var(--accent-cyan)] w-full"
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
                    className="mobile-menu-item text-left text-[var(--accent-red)] hover:text-red-400 w-full"
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