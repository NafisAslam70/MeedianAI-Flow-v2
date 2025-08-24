"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [userName, setUserName] = useState(session?.user?.name || "User");
  const [userImage, setUserImage] = useState(session?.user?.image || "/default-avatar.png");

  useEffect(() => {
    setMounted(true);

    // Update local state when session changes
    if (session?.user) {
      setUserName(session.user.name || "User");
      const image = session.user.image || "/default-avatar.png";
      setUserImage(image);
      console.log("Session updated:", { name: session.user.name, image, role: session.user.role });
    }

    // Fetch profile data on profile page or after update
    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/member/profile");
        const data = await response.json();
        if (response.ok) {
          setUserName(data.user.name || "User");
          const image = data.user.image || "/default-avatar.png";
          setUserImage(image);
          await fetch("/api/auth/session", { credentials: "include" });
          console.log("Profile fetched:", { name: data.user.name, image });
        } else {
          console.error("Profile fetch failed:", data);
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      }
    };

    // Listen for profile updates from Profile.jsx
    const handleProfileUpdate = (event) => {
      if (event.data.type === "PROFILE_UPDATED") {
        fetchProfile();
      }
    };

    if (pathname.includes("/profile")) {
      fetchProfile(); // Initial fetch on profile page
      window.addEventListener("message", handleProfileUpdate);
      const interval = setInterval(fetchProfile, 5000); // Refetch every 5 seconds
      return () => {
        window.removeEventListener("message", handleProfileUpdate);
        clearInterval(interval);
      };
    }
  }, [pathname, session]);

  // Prevent rendering until session is loaded and component is mounted
  if (status === "loading" || !mounted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gray-900/80 dark:bg-slate-900/80 backdrop-blur-lg text-white p-4"
      >
        Loading...
      </motion.div>
    );
  }

  if (pathname.includes('/workTogether')) {
    return null;
  }

  const role = session?.user?.role || "user";
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
  const isActive = (href) => {
    const isActive = pathname.replace(/\/$/, "") === href.replace(/\/$/, "");
    console.log(`isActive check: href=${href}, pathname=${pathname}, isActive=${isActive}`);
    return isActive;
  };

  const openTogetherWorkspace = () => {
    window.open("/dashboard/member/workTogether", '_blank');
  };

  const profilePath = role ? `/dashboard/${role === "team_manager" ? "team_manager" : role}/profile` : "/";

  const LogoutModal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[10000] p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="bg-gray-900/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 max-w-[400px] w-full border border-gray-100/30 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-white mb-4">Confirm Logout</h2>
        <p className="text-gray-300 mb-6">Are you sure you want to log out?</p>
        <div className="flex justify-center space-x-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition duration-200"
          >
            Yes, Log Out
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={closeLogoutModal}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition duration-200"
          >
            Cancel
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
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
          background: #1f2937/90;
          backdrop-blur-lg;
          transform: translateX(100%);
          transition: transform 0.3s ease-in-out;
          z-index: 9999;
          box-shadow: -4px 0 12px rgba(0, 0, 0, 0.5);
          padding: 1.5rem;
          border-left: 1px solid #4b5563;
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
          font-size: 0.95rem;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          transition: all 0.2s ease;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          white-space: nowrap;
          color: #e5e7eb;
        }
        .mobile-menu-item:hover {
          background: #374151/80;
          color: #22d3ee;
        }
        .mobile-menu-item.active {
          color: #22d3ee;
          font-weight: 600;
          background: #374151/80;
          background: linear-gradient(to right, #22d3ee20, #37415180);
        }
        .mobile-together-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          transition: all 0.2s ease;
          color: #e5e7eb;
        }
        .mobile-together-button:hover {
          background: #374151/80;
          color: #22d3ee;
        }
        .mobile-together-button.active {
          color: #22d3ee;
          background: #374151/80;
          background: linear-gradient(to right, #22d3ee20, #37415180);
        }
        .nav-item {
          position: relative;
          padding: 0.5rem 0.75rem;
          font-weight: 500;
          font-size: 0.85rem;
          font-family: 'Inter', sans-serif;
          transition: all 0.3s ease;
          border-radius: 8px;
          white-space: nowrap;
          color: #e5e7eb;
        }
        .nav-item:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #22d3ee;
          transform: translateY(-2px);
        }
        .nav-item.active {
          color: #22d3ee;
          background: linear-gradient(to right, #22d3ee20, #37415120);
        }
        .nav-item.active::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 50%;
          height: 2px;
          background: linear-gradient(to right, #22d3ee, #3b82f6);
        }
        .nav-button {
          padding: 0.5rem 0.75rem;
          font-weight: 500;
          font-size: 0.85rem;
          font-family: 'Inter', sans-serif;
          border-radius: 8px;
          transition: all 0.3s ease;
          white-space: nowrap;
        }
        .nav-button:hover {
          transform: translateY(-2px);
        }
        .nav-icon-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          border-radius: 50%;
          transition: all 0.3s ease;
        }
        .nav-icon-button:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #22d3ee;
          transform: translateY(-2px);
        }
        .nav-icon-button.active {
          color: #22d3ee;
          background: linear-gradient(to right, #22d3ee20, #37415120);
        }
        .nav-icon-button.active::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 24px;
          height: 2px;
          background: linear-gradient(to right, #22d3ee, #3b82f6);
        }
        .managerial-group {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          border: 1px solid #22d3ee30;
          padding: 0.2rem;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-blur-sm;
        }
        .mobile-managerial-group {
          border: 1px solid #22d3ee30;
          padding: 0.75rem;
          border-radius: 8px;
          margin: 0.75rem 0;
          background: #2d3748/90;
          backdrop-blur-sm;
        }
        .user-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          transition: all 0.3s ease;
          position: relative;
          background: rgba(255, 255, 255, 0.05);
        }
        .user-info:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-2px);
        }
        .user-info img {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid #22d3ee;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .user-info:hover img {
          transform: scale(1.05);
        }
        .user-info-text {
          display: flex;
          flex-direction: column;
          font-family: 'Inter', sans-serif;
        }
        .user-info-text .name {
          font-size: 0.9rem;
          font-weight: 600;
          color: #e5e7eb;
        }
        .user-info-text .account-label {
          font-size: 0.75rem;
          color: #9ca3af;
        }
        .mobile-user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          margin-bottom: 0.75rem;
          background: #374151/80;
          transition: all 0.2s ease;
        }
        .mobile-user-info:hover {
          background: #374151;
          color: #22d3ee;
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
          font-family: 'Inter', sans-serif;
        }
        .mobile-user-info-text .name {
          font-size: 0.95rem;
          font-weight: 600;
          color: #e5e7eb;
        }
        .mobile-user-info-text .account-label {
          font-size: 0.8rem;
          color: #9ca3af;
        }
        .nav-container {
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          gap: 0.5rem;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .nav-container::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-gray-900/80 dark:bg-slate-900/80 backdrop-blur-lg text-white py-3 w-full sticky top-0 z-40 shadow-xl border-b border-gray-100/30"
      >
        <div className="flex items-center justify-between w-full px-4 sm:px-6">
          {/* Left Section: Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-3"
          >
            <img src="/flow1.png" alt="Logo" className="w-10 h-10 rounded-full border-2 border-cyan-400 p-1.5" />
            <Link
              href="/"
              className={`text-xl sm:text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 transition duration-200 ${isActive("/") ? "active" : ""}`}
            >
              MeedianAI-Flow
            </Link>
          </motion.div>
          {/* Center Section: Nav Items */}
          <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2">
            <div className="nav-container">
              {role === "admin" && (
                <>
                  <Link
                    href="/dashboard"
                    className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}
                  >
                    General Dashboard
                  </Link>
                  <Link
                    href="/dashboard/admin"
                    className={`nav-item ${isActive("/dashboard/admin") ? "active" : ""}`}
                  >
                    Dashboard
                  </Link>
                  <div className="managerial-group">
                    <Link
                      href="/dashboard/managersCommon/routineTasks"
                      className={`nav-item ${isActive("/dashboard/managersCommon/routineTasks") ? "active" : ""}`}
                    >
                      Routine Tasks
                    </Link>
                    <Link
                      href="/dashboard/managersCommon/assignTask"
                      className={`nav-item ${isActive("/dashboard/managersCommon/assignTask") ? "active" : ""}`}
                    >
                      Assign Task
                    </Link>
                    <a
                      href="https://meed-recruitment.onrender.com/login"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`nav-item`}
                    >
                      Recruit
                    </a>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={openTogetherWorkspace}
                      title="Together"
                      className={`nav-icon-button ${isActive("/dashboard/member/workTogether") ? "active" : ""}`}
                    >
                      <Users size={18} className="together-icon" />
                    </motion.button>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddMember}
                    className="nav-button bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-800 text-white"
                  >
                    Add Member
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleManageMeedian}
                    className="nav-button bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
                  >
                    Manage Meedian
                  </motion.button>
                </>
              )}
              {role === "team_manager" && (
                <>
                  <Link
                    href="/dashboard"
                    className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}
                  >
                    General
                  </Link>
                  <Link
                    href="/dashboard/team_manager"
                    className={`nav-item ${isActive("/dashboard/team_manager") ? "active" : ""}`}
                  >
                    My Dashboard
                  </Link>
                  <Link
                    href="/dashboard/member/myMeedRituals"
                    className={`nav-item ${isActive("/dashboard/member/myMeedRituals") ? "active" : ""}`}
                  >
                    MyMRIs
                  </Link>
                  <Link
                    href="/dashboard/member/closeMyDay"
                    className={`nav-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}
                  >
                    CloseMyDay
                  </Link>
                  <div className="managerial-group">
                    <Link
                      href="/dashboard/managersCommon/routineTasks"
                      className={`nav-item ${isActive("/dashboard/managersCommon/routineTasks") ? "active" : ""}`}
                    >
                      Routine Tasks
                    </Link>
                    <Link
                      href="/dashboard/managersCommon/assignTask"
                      className={`nav-item ${isActive("/dashboard/managersCommon/assignTask") ? "active" : ""}`}
                    >
                      Assign Task
                    </Link>
                    <a
                      href="https://meed-recruitment.onrender.com/login"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`nav-item`}
                    >
                      Recruit
                    </a>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={openTogetherWorkspace}
                      title="Together"
                      className={`nav-icon-button ${isActive("/dashboard/member/workTogether") ? "active" : ""}`}
                    >
                      <Users size={18} className="together-icon" />
                    </motion.button>
                  </div>
                </>
              )}
              {role === "member" && (
                <>
                  <Link
                    href="/dashboard"
                    className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}
                  >
                    General
                  </Link>
                  <Link
                    href="/dashboard/member"
                    className={`nav-item ${isActive("/dashboard/member") ? "active" : ""}`}
                  >
                    My Dashboard
                  </Link>
                  <Link
                    href="/dashboard/member/myMeedRituals"
                    className={`nav-item ${isActive("/dashboard/member/myMeedRituals") ? "active" : ""}`}
                  >
                    MyMRIs
                  </Link>
                  <Link
                    href="/dashboard/member/closeMyDay"
                    className={`nav-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}
                  >
                    CloseMyDay
                  </Link>
                  <div className="managerial-group">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={openTogetherWorkspace}
                      title="Together"
                      className={`nav-icon-button ${isActive("/dashboard/member/workTogether") ? "active" : ""}`}
                    >
                      <Users size={18} className="together-icon" />
                    </motion.button>
                  </div>
                </>
              )}
              {status === "unauthenticated" && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleLogin("admin")}
                    className="nav-button bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800 text-white"
                  >
                    Admin Login
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleLogin("team_manager")}
                    className="nav-button bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 text-white"
                  >
                    Manager Login
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleLogin("member")}
                    className="nav-button bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-800 text-white"
                  >
                    Member Login
                  </motion.button>
                </>
              )}
            </div>
          </div>
          {/* Right Section: User Info, Logout, and Mobile Toggle */}
          <div className="flex items-center gap-3">
            {(role === "admin" || role === "team_manager" || role === "member") && (
              <>
                <motion.div whileHover={{ scale: 1.05 }} className="hidden md:flex">
                  <Link href={profilePath} className={`user-info ${isActive(profilePath) ? "active" : ""}`}>
                    <img
                      src={userImage || "/default-avatar.png"}
                      alt="User Avatar"
                      onError={() => {
                        console.error("Image failed to load:", userImage);
                        setUserImage("/default-avatar.png");
                      }}
                    />
                    <div className="user-info-text">
                      <span className="name">{userName || "Loading..."}</span>
                      <span className="account-label">My Account</span>
                    </div>
                  </Link>
                </motion.div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={openLogoutModal}
                  className="hidden md:block nav-button bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white"
                >
                  Logout
                </motion.button>
              </>
            )}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="md:hidden">
              <button onClick={toggleMobileMenu} className="text-white p-2 rounded-full hover:bg-gray-700/80 dark:hover:bg-gray-600/80 transition duration-200">
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </motion.div>
          </div>
        </div>
        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mobile-menu-overlay open"
                onClick={toggleMobileMenu}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className={`mobile-menu open`}
              >
                <div className="flex justify-between items-center mb-6">
                  <span className="text-lg font-bold text-cyan-400">Menu</span>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleMobileMenu}
                    className="text-white p-2 rounded-full hover:bg-gray-700/80 dark:hover:bg-gray-600/80"
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                {(role === "admin" || role === "team_manager" || role === "member") && (
                  <motion.div whileHover={{ scale: 1.05 }}>
                    <Link
                      href={profilePath}
                      onClick={toggleMobileMenu}
                      className={`mobile-user-info ${isActive(profilePath) ? "active" : ""}`}
                    >
                      <img
                        src={userImage || "/default-avatar.png"}
                        alt="User Avatar"
                        onError={() => {
                          console.error("Image failed to load:", userImage);
                          setUserImage("/default-avatar.png");
                        }}
                      />
                      <div className="mobile-user-info-text">
                        <span className="name">{userName || "Loading..."}</span>
                        <span className="account-label">My Account</span>
                      </div>
                    </Link>
                  </motion.div>
                )}
                <div className="space-y-2">
                  {role === "admin" && (
                    <>
                      <Link
                        href="/dashboard"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item ${isActive("/dashboard") ? "active" : ""}`}
                      >
                        General Dashboard
                      </Link>
                      <Link
                        href="/dashboard/admin"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item ${isActive("/dashboard/admin") ? "active" : ""}`}
                      >
                        Dashboard
                      </Link>
                      <div className="mobile-managerial-group">
                        <Link
                          href="/dashboard/managersCommon/routineTasks"
                          onClick={toggleMobileMenu}
                          className={`mobile-menu-item ${isActive("/dashboard/managersCommon/routineTasks") ? "active" : ""}`}
                        >
                          Routine Tasks
                        </Link>
                        <Link
                          href="/dashboard/managersCommon/assignTask"
                          onClick={toggleMobileMenu}
                          className={`mobile-menu-item ${isActive("/dashboard/managersCommon/assignTask") ? "active" : ""}`}
                        >
                          Assign Task
                        </Link>
                        <a
                          href="https://meed-recruitment.onrender.com/login"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={toggleMobileMenu}
                          className={`mobile-menu-item`}
                        >
                          Recruit
                        </a>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            openTogetherWorkspace();
                            toggleMobileMenu();
                          }}
                          className={`mobile-together-button ${isActive("/dashboard/member/workTogether") ? "active" : ""}`}
                        >
                          <Users size={18} className="mobile-together-icon" />
                          Together
                        </motion.button>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          handleAddMember();
                          toggleMobileMenu();
                        }}
                        className="mobile-menu-item text-left w-full"
                      >
                        Add Member
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          handleManageMeedian();
                          toggleMobileMenu();
                        }}
                        className="mobile-menu-item text-left w-full"
                      >
                        Manage Meedian
                      </motion.button>
                    </>
                  )}
                  {role === "team_manager" && (
                    <>
                      <Link
                        href="/dashboard"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item ${isActive("/dashboard") ? "active" : ""}`}
                      >
                        General
                      </Link>
                      <Link
                        href="/dashboard/team_manager"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item ${isActive("/dashboard/team_manager") ? "active" : ""}`}
                      >
                        My Dashboard
                      </Link>
                      <Link
                        href="/dashboard/member/myMeedRituals"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item ${isActive("/dashboard/member/myMeedRituals") ? "active" : ""}`}
                      >
                        MyMRIs
                      </Link>
                      <Link
                        href="/dashboard/member/closeMyDay"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}
                      >
                        CloseMyDay
                      </Link>
                      <div className="mobile-managerial-group">
                        <Link
                          href="/dashboard/managersCommon/routineTasks"
                          onClick={toggleMobileMenu}
                          className={`mobile-menu-item ${isActive("/dashboard/managersCommon/routineTasks") ? "active" : ""}`}
                        >
                          Routine Tasks
                        </Link>
                        <Link
                          href="/dashboard/managersCommon/assignTask"
                          onClick={toggleMobileMenu}
                          className={`mobile-menu-item ${isActive("/dashboard/managersCommon/assignTask") ? "active" : ""}`}
                        >
                          Assign Task
                        </Link>
                        <a
                          href="https://meed-recruitment.onrender.com/login"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={toggleMobileMenu}
                          className={`mobile-menu-item`}
                        >
                          Recruit
                        </a>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            openTogetherWorkspace();
                            toggleMobileMenu();
                          }}
                          className={`mobile-together-button ${isActive("/dashboard/member/workTogether") ? "active" : ""}`}
                        >
                          <Users size={18} className="mobile-together-icon" />
                          Together
                        </motion.button>
                      </div>
                    </>
                  )}
                  {role === "member" && (
                    <>
                      <Link
                        href="/dashboard"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item ${isActive("/dashboard") ? "active" : ""}`}
                      >
                        General
                      </Link>
                      <Link
                        href="/dashboard/member"
                        className={`mobile-menu-item ${isActive("/dashboard/member") ? "active" : ""}`}
                      >
                        My Dashboard
                      </Link>
                      <Link
                        href="/dashboard/member/myMeedRituals"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item ${isActive("/dashboard/member/myMeedRituals") ? "active" : ""}`}
                      >
                        MyMRIs
                      </Link>
                      <Link
                        href="/dashboard/member/closeMyDay"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}
                      >
                        CloseMyDay
                      </Link>
                      <div className="mobile-managerial-group">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            openTogetherWorkspace();
                            toggleMobileMenu();
                          }}
                          className={`mobile-together-button ${isActive("/dashboard/member/workTogether") ? "active" : ""}`}
                        >
                          <Users size={18} className="mobile-together-icon" />
                          Together
                        </motion.button>
                      </div>
                    </>
                  )}
                  {status === "unauthenticated" && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          handleLogin("admin");
                          toggleMobileMenu();
                        }}
                        className="mobile-menu-item text-left w-full"
                      >
                        Admin Login
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          handleLogin("team_manager");
                          toggleMobileMenu();
                        }}
                        className="mobile-menu-item text-left w-full"
                      >
                        Manager Login
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          handleLogin("member");
                          toggleMobileMenu();
                        }}
                        className="mobile-menu-item text-left w-full"
                      >
                        Member Login
                      </motion.button>
                    </>
                  )}
                  {(role === "admin" || role === "team_manager" || role === "member") && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        openLogoutModal();
                        toggleMobileMenu();
                      }}
                      className="mobile-menu-item text-left text-red-400 hover:text-red-500 w-full"
                    >
                      Logout
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.nav>
      {/* Logout Modal Portal */}
      {mounted && typeof window !== "undefined" && isLogoutModalOpen && document?.body &&
        createPortal(<LogoutModal />, document.body)}
    </>
  );
}