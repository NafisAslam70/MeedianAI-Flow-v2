"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, Heart, Users } from "lucide-react";
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
  const openTogetherWorkspace = () => {
    router.push("/dashboard/member/workTogether");
  };
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
          padding: 0.5rem 0.75rem;
          font-size: 0.95rem;
          font-weight: 500;
          transition: all 0.2s ease;
          border-radius: 6px;
          margin-bottom: 0.3rem;
          white-space: nowrap;
        }
        .mobile-menu-item:hover {
          background: #374151;
        }
        .mobile-together-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.95rem;
          font-weight: 500;
          border-radius: 6px;
          margin-bottom: 0.3rem;
          transition: all 0.2s ease;
        }
        .mobile-together-button:hover {
          background: #374151;
        }
        .mylife-mobile {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #d1fae5;
          background: #15803d;
          padding: 0.5rem 0.75rem;
          font-size: 0.95rem;
          font-weight: 500;
          border-radius: 6px;
          margin-bottom: 0.3rem;
        }
        .mylife-mobile:hover {
          background: #16a34a;
        }
        .nav-item {
          position: relative;
          padding: 0.4rem 0.8rem;
          font-weight: 500;
          font-size: 0.85rem;
          transition: all 0.3s ease;
          border-radius: 6px;
          white-space: nowrap;
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
          padding: 0.4rem 1rem;
          font-weight: 500;
          font-size: 0.85rem;
          border-radius: 6px;
          transition: all 0.3s ease;
        }
        .nav-button:hover {
          transform: translateY(-2px);
        }
        .nav-icon-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.4rem;
          border-radius: 50%;
          transition: all 0.3s ease;
        }
        .nav-icon-button:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-2px);
        }
        .nav-icon-button.active::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 24px;
          height: 2px;
          background: #22d3ee;
        }
        .together-icon {
          animation: pulse-glow 1.5s infinite ease-in-out;
          filter: drop-shadow(0 0 4px rgba(34, 211, 238, 0.5));
        }
        .together-icon:hover {
          animation: pulse-glow-hover 0.8s infinite ease-in-out;
        }
        @keyframes pulse-glow {
          0% {
            transform: scale(1);
            opacity: 0.8;
            filter: drop-shadow(0 0 4px rgba(34, 211, 238, 0.3));
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
            filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.7));
          }
          100% {
            transform: scale(1);
            opacity: 0.8;
            filter: drop-shadow(0 0 4px rgba(34, 211, 238, 0.3));
          }
        }
        @keyframes pulse-glow-hover {
          0% {
            transform: scale(1.1);
            filter: drop-shadow(0 0 6px rgba(34, 211, 238, 0.5));
          }
          50% {
            transform: scale(1.25);
            filter: drop-shadow(0 0 12px rgba(34, 211, 238, 1));
          }
          100% {
            transform: scale(1.1);
            filter: drop-shadow(0 0 6px rgba(34, 211, 238, 0.5));
          }
        }
        .mobile-together-icon {
          animation: pulse-glow 1.5s infinite ease-in-out;
          filter: drop-shadow(0 0 4px rgba(34, 211, 238, 0.5));
        }
        .mobile-together-icon:hover {
          animation: pulse-glow-hover 0.8s infinite ease-in-out;
        }
        .mylife-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #d1fae5;
          background: #15803d;
          padding: 0.4rem 1rem;
          font-weight: 500;
          font-size: 0.85rem;
          border-radius: 6px;
          transition: all 0.3s ease;
        }
        .mylife-button:hover {
          background: #16a34a;
          transform: translateY(-2px);
        }
        .mylife-button.active::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 50%;
          height: 2px;
          background: #22d3ee;
        }
        .user-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #374151;
          padding: 0.4rem 0.8rem;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          transition: all 0.3s ease;
        }
        .user-info:hover {
          transform: translateY(-2px);
          background: #4b5563;
        }
        .user-info img {
          width: 28px;
          height: 28px;
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
          font-size: 0.8rem;
          text-transform: capitalize;
        }
        .user-info-text .role {
          font-size: 0.7rem;
          color: #9ca3af;
          text-transform: capitalize;
        }
        .mobile-user-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #374151;
          padding: 0.5rem;
          border-radius: 10px;
          margin-bottom: 0.75rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .mobile-user-info img {
          width: 36px;
          height: 36px;
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
          font-size: 0.9rem;
          text-transform: capitalize;
        }
        .mobile-user-info-text .role {
          font-size: 0.8rem;
          color: #9ca3af;
          text-transform: capitalize;
        }
        .managerial-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid #22d3ee;
          padding: 0.2rem;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
        }
        .mobile-managerial-group {
          border: 1px solid #22d3ee;
          padding: 0.5rem;
          border-radius: 6px;
          margin: 0.5rem 0;
          background: #2d3748;
        }
      `}</style>
      <nav className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-4 py-3 w-full sticky top-0 z-40 shadow-lg">
        <div className="flex items-center justify-between w-full px-2 sm:px-4 lg:px-6">
          {/* Left Section: Logo */}
          <div className="flex items-center gap-2">
            <img src="/flow1.png" alt="Logo" className="w-8 h-8 rounded-full border border-cyan-400 p-1" />
            <Link href="/" className={`text-xl font-bold tracking-tight hover:text-cyan-300 transition duration-200 ${isActive("/") ? "text-cyan-300" : ""}`}>
              MeedianAI-Flow
            </Link>
          </div>
          {/* Center Section: Nav Items */}
          <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 space-x-2">
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
                <div className="managerial-group">
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
                  <a
                    href="https://meed-recruitment.onrender.com/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`nav-item hover:text-cyan-300`}
                  >
                    Recruit
                  </a>
                  <button
                    onClick={openTogetherWorkspace}
                    title="Together"
                    className={`nav-icon-button relative hover:text-cyan-300 ${isActive("/dashboard/member/workTogether") ? "text-cyan-300 active" : ""}`}
                  >
                    <Users size={18} className="together-icon" />
                  </button>
                </div>
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
                  General
                </Link>
                <Link
                  href="/dashboard/team_manager"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/team_manager") ? "text-cyan-300 active" : ""}`}
                >
                  My Dashboard
                </Link>
                <Link
                  href="/dashboard/member/myMeedRituals"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/myMeedRituals") ? "text-cyan-300 active" : ""}`}
                >
                  MyMRIs
                </Link>
                <Link
                  href="/dashboard/member/closeMyDay"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/closeMyDay") ? "text-cyan-300 active" : ""}`}
                >
                  CloseMyDay
                </Link>
                <Link
                  href="/dashboard/member/myPerformance"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/myPerformance") ? "text-cyan-300 active" : ""}`}
                >
                  MyPerformance
                </Link>
                <div className="managerial-group">
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
                  <a
                    href="https://meed-recruitment.onrender.com/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`nav-item hover:text-cyan-300`}
                  >
                    Recruit
                  </a>
                  <button
                    onClick={openTogetherWorkspace}
                    title="Together"
                    className={`nav-icon-button relative hover:text-cyan-300 ${isActive("/dashboard/member/workTogether") ? "text-cyan-300 active" : ""}`}
                  >
                    <Users size={18} className="together-icon" />
                  </button>
                </div>
              </>
            )}
            {role === "member" && (
              <>
                <Link
                  href="/dashboard"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard") ? "text-cyan-300 active" : ""}`}
                >
                  General
                </Link>
                <Link
                  href="/dashboard/member"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member") ? "text-cyan-300 active" : ""}`}
                >
                  My Dashboard
                </Link>
                <Link
                  href="/dashboard/member/myMeedRituals"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/myMeedRituals") ? "text-cyan-300 active" : ""}`}
                >
                  MyMRIs
                </Link>
                <Link
                  href="/dashboard/member/closeMyDay"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/closeMyDay") ? "text-cyan-300 active" : ""}`}
                >
                  CloseMyDay
                </Link>
                <Link
                  href="/dashboard/member/myPerformance"
                  className={`nav-item hover:text-cyan-300 ${isActive("/dashboard/member/myPerformance") ? "text-cyan-300 active" : ""}`}
                >
                  MyPerformance
                </Link>
                <div className="managerial-group">
                  <button
                    onClick={openTogetherWorkspace}
                    title="Together"
                    className={`nav-icon-button relative hover:text-cyan-300 ${isActive("/dashboard/member/workTogether") ? "text-cyan-300 active" : ""}`}
                  >
                    <Users size={18} className="together-icon" />
                  </button>
                </div>
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
                  Manager Login
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
          {/* Right Section: User Info, MyLife, Logout, and Mobile Toggle */}
          <div className="flex items-center gap-2">
            {(role === "admin" || role === "team_manager" || role === "member") && (
              <>
                {(role === "team_manager" || role === "member") && (
                  <Link
                    href={`/dashboard/${role === "team_manager" ? "team_manager" : "member"}/myLife`}
                    className={`mylife-button ${isActive(`/dashboard/${role === "team_manager" ? "team_manager" : "member"}/myLife`) ? "active" : ""}`}
                  >
                    <Heart size={16} />
                    MyLife
                  </Link>
                )}
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
              <button onClick={toggleMobileMenu} className="text-white p-1 rounded-full hover:bg-gray-700 transition duration-200">
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
                <span className="text-base font-bold text-cyan-400">Menu</span>
                <button onClick={toggleMobileMenu} className="text-white p-1 rounded-full hover:bg-gray-700">
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
                    <div className="mobile-managerial-group">
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
                      <a
                        href="https://meed-recruitment.onrender.com/login"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item hover:text-cyan-400`}
                      >
                        Recruit
                      </a>
                      <button
                        onClick={() => {
                          openTogetherWorkspace();
                          toggleMobileMenu();
                        }}
                        className={`mobile-together-button hover:text-cyan-400 ${
                          isActive("/dashboard/member/workTogether") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                        }`}
                      >
                        <Users size={18} className="mobile-together-icon" />
                        Together
                      </button>
                    </div>
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
                      General
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
                      href="/dashboard/member/myMeedRituals"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/member/myMeedRituals") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      MyMRIs
                    </Link>
                    <Link
                      href="/dashboard/member/closeMyDay"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/member/closeMyDay") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      CloseMyDay
                    </Link>
                    <Link
                      href="/dashboard/member/myPerformance"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/member/myPerformance") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      MyPerformance
                    </Link>
                    <div className="mobile-managerial-group">
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
                      <a
                        href="https://meed-recruitment.onrender.com/login"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item hover:text-cyan-400`}
                      >
                        Recruit
                      </a>
                      <button
                        onClick={() => {
                          openTogetherWorkspace();
                          toggleMobileMenu();
                        }}
                        className={`mobile-together-button hover:text-cyan-400 ${
                          isActive("/dashboard/member/workTogether") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                        }`}
                      >
                        <Users size={18} className="mobile-together-icon" />
                        Together
                      </button>
                    </div>
                    <Link
                      href="/dashboard/team_manager/myLife"
                      onClick={toggleMobileMenu}
                      className={`mylife-mobile ${
                        isActive("/dashboard/team_manager/myLife") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      <Heart size={16} />
                      MyLife
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
                      General
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
                      href="/dashboard/member/myMeedRituals"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/member/myMeedRituals") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      MyMRIs
                    </Link>
                    <Link
                      href="/dashboard/member/closeMyDay"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/member/closeMyDay") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      CloseMyDay
                    </Link>
                    <Link
                      href="/dashboard/member/myPerformance"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${
                        isActive("/dashboard/member/myPerformance") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      MyPerformance
                    </Link>
                    <div className="mobile-managerial-group">
                      <button
                        onClick={() => {
                          openTogetherWorkspace();
                          toggleMobileMenu();
                        }}
                        className={`mobile-together-button hover:text-cyan-400 ${
                          isActive("/dashboard/member/workTogether") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                        }`}
                      >
                        <Users size={18} className="mobile-together-icon" />
                        Together
                      </button>
                    </div>
                    <Link
                      href="/dashboard/member/myLife"
                      onClick={toggleMobileMenu}
                      className={`mylife-mobile ${
                        isActive("/dashboard/member/myLife") ? "text-cyan-400 font-semibold bg-gray-700" : ""
                      }`}
                    >
                      <Heart size={16} />
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
                      Manager Login
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