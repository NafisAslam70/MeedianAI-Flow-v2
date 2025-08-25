"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, Users } from "lucide-react";
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

  // dropdown state
  const [isManageOpen, setIsManageOpen] = useState(false);

  // --- EFFECTS ---
  useEffect(() => {
    setMounted(true);
    if (session?.user) {
      setUserName(session.user.name || "User");
      setUserImage(session.user.image || "/default-avatar.png");
      console.log("Session updated:", { name: session.user.name, image: session.user.image, role: session.user.role });
    }
  }, [session]);

  // close Managerial dropdown on route change
  useEffect(() => {
    setIsManageOpen(false);
  }, [pathname]);

  // click-away for Managerial dropdown (desktop)
  useEffect(() => {
    function onDocClick(e) {
      const wrapper = document.querySelector(".nav-dropdown");
      if (isManageOpen && wrapper && !wrapper.contains(e.target)) setIsManageOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [isManageOpen]);

  // block render until ready
  if (status === "loading" || !mounted) {
    return <div className="bg-gray-900 text-white p-4">Loading...</div>;
  }

  // hide navbar on together workspace page
  if (pathname.includes("/workTogether")) return null;

  // --- HELPERS ---
  const role = session?.user?.role || "user";
  const profilePath = role ? `/dashboard/${role === "team_manager" ? "team_manager" : role}/profile` : "/";
  const performancePath = "/dashboard/member/myPerformance";
  const isActive = (href) => pathname.replace(/\/$/, "") === href.replace(/\/$/, "");
  const toggleMobileMenu = () => setIsMobileMenuOpen((v) => !v);
  const openLogoutModal = () => setIsLogoutModalOpen(true);
  const closeLogoutModal = () => setIsLogoutModalOpen(false);

  const handleLogin = (role) => router.push(`/login?role=${role}`);
  const handleAddMember = () => router.push("/dashboard/admin/addUser");
  const handleManageMeedian = () => router.push("/dashboard/admin/manageMeedian");
  const openTogetherWorkspace = () => window.open("/dashboard/member/workTogether", "_blank");
  const handleLogout = async () => {
    setIsLogoutModalOpen(false);
    await signOut({ redirect: false });
    router.push("/");
  };

  const LogoutModal = () => (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="text-lg font-semibold text-white mb-4">Confirm Logout</h2>
        <p className="text-gray-200 mb-6">Are you sure you want to log out?</p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition duration-200 min-h-[44px]"
          >
            Yes, Log Out
          </button>
          <button
            onClick={closeLogoutModal}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-medium transition duration-200 min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ====== STYLES ====== */}
      <style jsx global>{`
        /* Modal */
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
          padding: 16px;
          border-radius: 12px;
          max-width: 90%;
          width: 400px;
          text-align: center;
          box-shadow: 0 8px 16px rgba(0,0,0,0.3);
          border: 1px solid #4b5563;
        }
        @media (max-width: 640px) {
          .modal-content {
            padding: 12px;
            max-width: 95vw;
          }
        }

        /* Mobile Menu shell */
        .mobile-menu {
          position: fixed;
          top: 0;
          right: 0;
          height: 100%;
          width: 80%;
          max-width: 300px;
          background: #111827;
          transform: translateX(100%);
          transition: transform 0.3s ease-in-out;
          z-index: 9999;
          box-shadow: -4px 0 16px rgba(0,0,0,0.6);
          padding: 1rem;
          border-left: 1px solid #374151;
        }
        .mobile-menu.open { transform: translateX(0); }

        .mobile-menu-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 9998;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
          pointer-events: none;
        }
        .mobile-menu-overlay.open { opacity: 1; pointer-events: auto; }

        /* Menu items (mobile + desktop) */
        .mobile-menu-item, .nav-item {
          display: block;
          padding: 0.5rem 0.75rem;
          font-size: 0.9rem;
          font-weight: 500;
          border-radius: 8px;
          transition: all 0.2s ease;
          color: #f3f4f6;
        }
        .mobile-menu-item:hover, .nav-item:hover {
          background: rgba(255,255,255,0.1);
          color: #22d3ee;
        }
        .mobile-menu-item.active, .nav-item.active {
          color: #22d3ee;
          background: linear-gradient(to right, #22d3ee22, #37415144);
        }
        .nav-item.active::after, .mobile-menu-item.active::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 48%;
          height: 2px;
          background: linear-gradient(90deg, #22d3ee, #3b82f6);
          border-radius: 2px;
        }

        /* Buttons */
        .nav-button {
          padding: 0.5rem 0.9rem;
          font-weight: 600;
          font-size: 0.85rem;
          border-radius: 10px;
          transition: all 0.25s ease;
          white-space: nowrap;
          box-shadow: 0 4px 14px rgba(0,0,0,0.25);
          min-h: 44px;
        }
        .nav-button:hover { transform: translateY(-2px); filter: brightness(1.1); }

        /* Icon button (Together) */
        .nav-icon-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          border-radius: 9999px;
          transition: all 0.25s ease;
          min-h: 44px;
          min-w: 44px;
        }
        .nav-icon-button:hover {
          background: rgba(255,255,255,0.1);
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

        /* Managerial dropdown (desktop) */
        .nav-dropdown { position: relative; }
        .nav-dropdown-btn {
          padding: 0.5rem 0.75rem;
          font-weight: 600;
          font-size: 0.9rem;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          transition: all .2s ease;
          color: #f3f4f6;
        }
        .nav-dropdown-btn:hover {
          background: rgba(255,255,255,.1);
          transform: translateY(-2px);
          color: #22d3ee;
        }
        .nav-dropdown-menu {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 200px;
          background: #0b1220;
          border: 1px solid #1f2a44;
          border-radius: 12px;
          padding: 6px;
          box-shadow: 0 12px 30px rgba(0,0,0,.4);
          z-index: 10001;
        }
        .nav-dropdown-item {
          display: block;
          padding: 0.5rem 0.7rem;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          color: #f3f4f6;
        }
        .nav-dropdown-item:hover {
          background: #122034;
          color: #22d3ee;
        }

        /* User chip (desktop) */
        .user-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.8rem;
          border-radius: 10px;
          border: 2px solid #4b5563;
          background: #1f2937;
          box-shadow: 0 3px 10px rgba(0,0,0,0.2);
          transition: all .25s ease;
        }
        .user-info:hover {
          transform: translateY(-2px);
          background: #263244;
          border-color: #22d3ee;
        }
        .user-info.active {
          background: #22d3ee;
          color: #0b1220;
          border-color: #ffffff;
          box-shadow: 0 0 10px rgba(34,211,238,0.5);
        }
        .user-info img {
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          border: 2px solid #22d3ee;
          object-fit: cover;
          transition: all .25s ease;
        }
        .user-info:hover img { transform: scale(1.05); }
        .user-info-text { 
          display: flex; 
          flex-direction: column; 
          line-height: 1.1; 
          max-width: 120px;
        }
        .user-info-text .name {
          font-weight: 600;
          font-size: 0.85rem;
          color: #f3f4f6;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .user-info-text .account-label {
          font-size: 0.7rem;
          color: #d1d5db;
          background: rgba(255,255,255,.1);
          padding: 0.1rem 0.35rem;
          border-radius: 5px;
          margin-top: 2px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* User chip (mobile) */
        .mobile-user-info {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.4rem 0.6rem;
          border-radius: 10px;
          margin-bottom: 0.5rem;
          border: 2px solid #4b5563;
          background: #1f2937;
          transition: all .2s ease;
          max-width: 80%;
          min-height: 44px;
        }
        .mobile-user-info:hover {
          background: #263244;
          border-color: #22d3ee;
        }
        .mobile-user-info.active {
          background: #22d3ee;
          color: #0b1220;
          border-color: #ffffff;
          box-shadow: 0 0 10px rgba(34,211,238,0.5);
        }
        .mobile-user-info img {
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          border: 2px solid #22d3ee;
          object-fit: cover;
        }
        .mobile-user-info-text {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
          max-width: 150px;
        }
        .mobile-user-info-text .name {
          font-weight: 600;
          font-size: 0.8rem;
          color: #f3f4f6;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mobile-user-info-text .account-label {
          font-size: 0.65rem;
          color: #d1d5db;
          background: rgba(255,255,255,.1);
          padding: 0.1rem 0.3rem;
          border-radius: 5px;
          margin-top: 2px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Mobile together button */
        .mobile-together-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          transition: all .2s ease;
          color: #f3f4f6;
        }
        .mobile-together-button:hover {
          background: rgba(255,255,255,.1);
          color: #22d3ee;
        }

        /* Navbar background */
        nav {
          background: linear-gradient(90deg, #0b1220, #111827 30%, #1f2937 70%, #0b1220);
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .user-info, .user-info.active, .mobile-user-info, .mobile-user-info.active,
          .together-icon, .mobile-together-icon {
            animation: none;
            transform: none;
            box-shadow: none;
          }
        }
      `}</style>

      {/* ====== NAVBAR ====== */}
      <nav className="text-white px-3 py-2 w-full sticky top-0 z-40 shadow-lg border-b border-cyan-900/40">
        <div className="flex items-center justify-between w-full px-2 sm:px-4 lg:px-6">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <img src="/flow1.png" alt="Logo" className="w-7 h-7 rounded-full border border-cyan-400 p-1" />
            <Link
              href="/"
              className={`text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent hover:from-cyan-300 hover:to-blue-300 transition ${
                isActive("/") ? "drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" : ""
              }`}
            >
              MeedianAI-Flow
            </Link>
          </div>

          {/* Center: Desktop nav */}
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center space-x-2">
            {role === "admin" && (
              <>
                <Link href="/dashboard" className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}>General</Link>
                <Link href="/dashboard/admin" className={`nav-item ${isActive("/dashboard/admin") ? "active" : ""}`}>Dashboard</Link>
                <div className="nav-dropdown">
                  <button
                    type="button"
                    onClick={() => setIsManageOpen((v) => !v)}
                    className="nav-dropdown-btn"
                    aria-expanded={isManageOpen}
                    aria-haspopup="menu"
                  >
                    Managerial ▾
                  </button>
                  {isManageOpen && (
                    <div className="nav-dropdown-menu" role="menu">
                      <Link href="/dashboard/managersCommon/routineTasks" className="nav-dropdown-item">Routine Tasks</Link>
                      <Link href="/dashboard/managersCommon/assignTask" className="nav-dropdown-item">Assign Task</Link>
                      <a href="https://meed-recruitment.onrender.com/login" target="_blank" rel="noopener noreferrer" className="nav-dropdown-item">Recruit</a>
                    </div>
                  )}
                </div>
                <button onClick={openTogetherWorkspace} title="Together" className={`nav-icon-button ${isActive("/dashboard/member/workTogether") ? "active" : ""}`}>
                  <Users size={18} className="together-icon" />
                </button>
                <button onClick={handleAddMember} className="nav-button bg-teal-600 hover:bg-teal-700 text-white">Add Member</button>
                <button onClick={handleManageMeedian} className="nav-button bg-blue-600 hover:bg-blue-700 text-white">Manage Meedian</button>
                <Link href={performancePath} className={`nav-item ${isActive(performancePath) ? "active" : ""}`}>MyPerformance</Link>
              </>
            )}
            {role === "team_manager" && (
              <>
                <Link href="/dashboard" className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}>General</Link>
                <Link href="/dashboard/team_manager" className={`nav-item ${isActive("/dashboard/team_manager") ? "active" : ""}`}>My Dashboard</Link>
                <Link href="/dashboard/member/myMeedRituals" className={`nav-item ${isActive("/dashboard/member/myMeedRituals") ? "active" : ""}`}>MyMRIs</Link>
                <Link href="/dashboard/member/closeMyDay" className={`nav-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}>CloseMyDay</Link>
                <Link href={performancePath} className={`nav-item ${isActive(performancePath) ? "active" : ""}`}>MyPerformance</Link>
                <div className="nav-dropdown">
                  <button type="button" onClick={() => setIsManageOpen((v) => !v)} className="nav-dropdown-btn">Managerial ▾</button>
                  {isManageOpen && (
                    <div className="nav-dropdown-menu" role="menu">
                      <Link href="/dashboard/managersCommon/routineTasks" className="nav-dropdown-item">Routine Tasks</Link>
                      <Link href="/dashboard/managersCommon/assignTask" className="nav-dropdown-item">Assign Task</Link>
                      <a href="https://meed-recruitment.onrender.com/login" target="_blank" rel="noopener noreferrer" className="nav-dropdown-item">Recruit</a>
                    </div>
                  )}
                </div>
                <button onClick={openTogetherWorkspace} title="Together" className={`nav-icon-button ${isActive("/dashboard/member/workTogether") ? "active" : ""}`}>
                  <Users size={18} className="together-icon" />
                </button>
              </>
            )}
            {role === "member" && (
              <>
                <Link href="/dashboard" className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}>General</Link>
                <Link href="/dashboard/member" className={`nav-item ${isActive("/dashboard/member") ? "active" : ""}`}>My Dashboard</Link>
                <Link href="/dashboard/member/myMeedRituals" className={`nav-item ${isActive("/dashboard/member/myMeedRituals") ? "active" : ""}`}>MyMRIs</Link>
                <Link href="/dashboard/member/closeMyDay" className={`nav-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}>CloseMyDay</Link>
                <Link href={performancePath} className={`nav-item ${isActive(performancePath) ? "active" : ""}`}>MyPerformance</Link>
                <button onClick={openTogetherWorkspace} title="Together" className={`nav-icon-button ${isActive("/dashboard/member/workTogether") ? "active" : ""}`}>
                  <Users size={18} className="together-icon" />
                </button>
              </>
            )}
            {status === "unauthenticated" && (
              <>
                <button onClick={() => handleLogin("admin")} className="nav-button bg-indigo-600 hover:bg-indigo-700 text-white">Admin Login</button>
                <button onClick={() => handleLogin("team_manager")} className="nav-button bg-purple-600 hover:bg-purple-700 text-white">Manager Login</button>
                <button onClick={() => handleLogin("member")} className="nav-button bg-teal-600 hover:bg-teal-700 text-white">Member Login</button>
              </>
            )}
          </div>

          {/* Right: User chip + Logout + Mobile toggler */}
          <div className="flex items-center gap-2">
            {(role === "admin" || role === "team_manager" || role === "member") && (
              <>
                <Link href={profilePath} className={`user-info hidden md:flex ${isActive(profilePath) ? "active" : ""}`}>
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
                <button onClick={openLogoutModal} className="hidden md:block nav-button bg-red-600 hover:bg-red-700 text-white">Logout</button>
              </>
            )}
            <div className="md:hidden">
              <button onClick={toggleMobileMenu} className="text-white p-2 rounded-full hover:bg-gray-700 transition min-h-[44px] min-w-[44px]" aria-label="Toggle menu">
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* ====== MOBILE MENU ====== */}
        {isMobileMenuOpen && (
          <>
            <div className="mobile-menu-overlay open" onClick={toggleMobileMenu} />
            <div className={`mobile-menu ${isMobileMenuOpen ? "open" : ""}`}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-base font-bold text-cyan-400">Menu</span>
                <button onClick={toggleMobileMenu} className="text-white p-2 rounded-full hover:bg-gray-700 min-h-[44px] min-w-[44px]" aria-label="Close menu">
                  <X size={20} />
                </button>
              </div>

              {(role === "admin" || role === "team_manager" || role === "member") && (
                <Link href={profilePath} onClick={toggleMobileMenu} className={`mobile-user-info ${isActive(profilePath) ? "active" : ""}`}>
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
              )}

              <div className="space-y-1">
                {role === "admin" && (
                  <>
                    <Link href="/dashboard" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard") ? "active" : ""}`}>General</Link>
                    <Link href="/dashboard/admin" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/admin") ? "active" : ""}`}>Dashboard</Link>
                    <details className="mb-2">
                      <summary className="mobile-menu-item cursor-pointer select-none">Managerial</summary>
                      <div className="pl-2">
                        <Link href="/dashboard/managersCommon/routineTasks" onClick={toggleMobileMenu} className="mobile-menu-item">Routine Tasks</Link>
                        <Link href="/dashboard/managersCommon/assignTask" onClick={toggleMobileMenu} className="mobile-menu-item">Assign Task</Link>
                        <a href="https://meed-recruitment.onrender.com/login" target="_blank" rel="noopener noreferrer" onClick={toggleMobileMenu} className="mobile-menu-item">Recruit</a>
                      </div>
                    </details>
                    <button
                      onClick={() => { openTogetherWorkspace(); toggleMobileMenu(); }}
                      className={`mobile-together-button ${isActive("/dashboard/member/workTogether") ? "active" : ""}`}
                    >
                      <Users size={18} className="mobile-together-icon" />
                      Together
                    </button>
                    <button onClick={() => { handleAddMember(); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">Add Member</button>
                    <button onClick={() => { handleManageMeedian(); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">Manage Meedian</button>
                    <Link href={performancePath} onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive(performancePath) ? "active" : ""}`}>MyPerformance</Link>
                  </>
                )}
                {role === "team_manager" && (
                  <>
                    <Link href="/dashboard" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard") ? "active" : ""}`}>General</Link>
                    <Link href="/dashboard/team_manager" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/team_manager") ? "active" : ""}`}>My Dashboard</Link>
                    <Link href="/dashboard/member/myMeedRituals" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/member/myMeedRituals") ? "active" : ""}`}>MyMRIs</Link>
                    <Link href="/dashboard/member/closeMyDay" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}>CloseMyDay</Link>
                    <Link href={performancePath} onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive(performancePath) ? "active" : ""}`}>MyPerformance</Link>
                    <details className="mb-2">
                      <summary className="mobile-menu-item cursor-pointer select-none">Managerial</summary>
                      <div className="pl-2">
                        <Link href="/dashboard/managersCommon/routineTasks" onClick={toggleMobileMenu} className="mobile-menu-item">Routine Tasks</Link>
                        <Link href="/dashboard/managersCommon/assignTask" onClick={toggleMobileMenu} className="mobile-menu-item">Assign Task</Link>
                        <a href="https://meed-recruitment.onrender.com/login" target="_blank" rel="noopener noreferrer" onClick={toggleMobileMenu} className="mobile-menu-item">Recruit</a>
                      </div>
                    </details>
                    <button
                      onClick={() => { openTogetherWorkspace(); toggleMobileMenu(); }}
                      className={`mobile-together-button ${isActive("/dashboard/member/workTogether") ? "active" : ""}`}
                    >
                      <Users size={18} className="mobile-together-icon" />
                      Together
                    </button>
                  </>
                )}
                {role === "member" && (
                  <>
                    <Link href="/dashboard" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard") ? "active" : ""}`}>General</Link>
                    <Link href="/dashboard/member" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/member") ? "active" : ""}`}>My Dashboard</Link>
                    <Link href="/dashboard/member/myMeedRituals" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/member/myMeedRituals") ? "active" : ""}`}>MyMRIs</Link>
                    <Link href="/dashboard/member/closeMyDay" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}>CloseMyDay</Link>
                    <Link href={performancePath} onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive(performancePath) ? "active" : ""}`}>MyPerformance</Link>
                    <button
                      onClick={() => { openTogetherWorkspace(); toggleMobileMenu(); }}
                      className={`mobile-together-button ${isActive("/dashboard/member/workTogether") ? "active" : ""}`}
                    >
                      <Users size={18} className="mobile-together-icon" />
                      Together
                    </button>
                  </>
                )}
                {(role === "admin" || role === "team_manager" || role === "member") && (
                  <button
                    onClick={() => { openLogoutModal(); toggleMobileMenu(); }}
                    className="mobile-menu-item text-left text-red-400 hover:text-red-300 w-full"
                  >
                    Logout
                  </button>
                )}
                {status === "unauthenticated" && (
                  <>
                    <button onClick={() => { handleLogin("admin"); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">Admin Login</button>
                    <button onClick={() => { handleLogin("team_manager"); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">Manager Login</button>
                    <button onClick={() => { handleLogin("member"); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">Member Login</button>
                  </>
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

// "use client";
// import { useSession, signOut } from "next-auth/react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";
// import { useEffect, useState } from "react";
// import { Menu, X, Users } from "lucide-react";
// import { createPortal } from "react-dom";

// export default function Navbar() {
//   const { data: session, status } = useSession();
//   const pathname = usePathname();
//   const router = useRouter();

//   const [mounted, setMounted] = useState(false);
//   const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
//   const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
//   const [userName, setUserName] = useState(session?.user?.name || "User");
//   const [userImage, setUserImage] = useState(session?.user?.image || "/default-avatar.png");

//   // NEW: managerial dropdown state
//   const [isManageOpen, setIsManageOpen] = useState(false);

//   useEffect(() => {
//     setMounted(true);

//     // Update local state when session changes
//     if (session?.user) {
//       setUserName(session.user.name || "User");
//       const image = session.user.image || "/default-avatar.png";
//       setUserImage(image);
//       console.log("Session updated:", { name: session.user.name, image, role: session.user.role });
//     }

//     // Fetch profile data on profile page or after update
//     const fetchProfile = async () => {
//       try {
//         const response = await fetch("/api/member/profile");
//         const data = await response.json();
//         if (response.ok) {
//           setUserName(data.user.name || "User");
//           const image = data.user.image || "/default-avatar.png";
//           setUserImage(image);
//           await fetch("/api/auth/session", { credentials: "include" });
//           console.log("Profile fetched:", { name: data.user.name, image });
//         } else {
//           console.error("Profile fetch failed:", data);
//         }
//       } catch (err) {
//         console.error("Failed to fetch profile:", err);
//       }
//     };

//     // Listen for profile updates from Profile.jsx
//     const handleProfileUpdate = (event) => {
//       if (event.data?.type === "PROFILE_UPDATED") {
//         fetchProfile();
//       }
//     };

//     if (pathname.includes("/profile")) {
//       fetchProfile(); // Initial fetch on profile page
//       window.addEventListener("message", handleProfileUpdate);
//       const interval = setInterval(fetchProfile, 5000); // Refetch every 5 seconds
//       return () => {
//         window.removeEventListener("message", handleProfileUpdate);
//         clearInterval(interval);
//       };
//     }
//   }, [pathname, session]);

//   // close managerial dropdown on route change
//   useEffect(() => {
//     setIsManageOpen(false);
//   }, [pathname]);

//   // optional: click-away to close dropdown
//   useEffect(() => {
//     function onDocClick(e) {
//       const el = document.querySelector(".nav-dropdown");
//       if (isManageOpen && el && !el.contains(e.target)) setIsManageOpen(false);
//     }
//     document.addEventListener("click", onDocClick);
//     return () => document.removeEventListener("click", onDocClick);
//   }, [isManageOpen]);

//   // Prevent rendering until session is loaded and component is mounted
//   if (status === "loading" || !mounted) {
//     return <div className="bg-gray-900 text-white p-4">Loading...</div>;
//   }

//   // Hide navbar inside WorkTogether full-screen workspace
//   if (pathname.includes("/workTogether")) {
//     return null;
//   }

//   const role = session?.user?.role || "user";

//   const handleLogout = async () => {
//     setIsLogoutModalOpen(false);
//     await signOut({ redirect: false });
//     router.push("/");
//   };

//   const handleLogin = (role) => router.push(`/login?role=${role}`);
//   const handleAddMember = () => router.push("/dashboard/admin/addUser");
//   const handleManageMeedian = () => router.push("/dashboard/admin/manageMeedian");
//   const toggleMobileMenu = () => setIsMobileMenuOpen((v) => !v);
//   const openLogoutModal = () => setIsLogoutModalOpen(true);
//   const closeLogoutModal = () => setIsLogoutModalOpen(false);

//   const isActive = (href) => {
//     const isA = pathname.replace(/\/$/, "") === href.replace(/\/$/, "");
//     // console.log(`isActive check: href=${href}, pathname=${pathname}, isActive=${isA}`);
//     return isA;
//   };

//   const openTogetherWorkspace = () => {
//     window.open("/dashboard/member/workTogether", "_blank");
//   };

//   const profilePath = role ? `/dashboard/${role === "team_manager" ? "team_manager" : role}/profile` : "/";
//   // MyPerformance is ALWAYS under member
//   const performancePath = "/dashboard/member/myPerformance";

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
//       <style jsx global>{`
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
//           border-left: 1px solid #4b5563;
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
//         .mobile-menu-item.active {
//           color: #22d3ee;
//           font-weight: 600;
//           background: #374151;
//           position: relative;
//         }
//         .mobile-menu-item.active::after {
//           content: '';
//           position: absolute;
//           bottom: -4px;
//           left: 50%;
//           transform: translateX(-50%);
//           width: 50%;
//           height: 2px;
//           background: #22d3ee;
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

//         /* NEW: Managerial dropdown (desktop) */
//         .nav-dropdown {
//           position: relative;
//         }
//         .nav-dropdown-btn {
//           padding: 0.4rem 0.75rem;
//           font-weight: 600;
//           font-size: 0.85rem;
//           border-radius: 6px;
//           display: inline-flex;
//           align-items: center;
//           gap: 0.4rem;
//           transition: all .2s ease;
//         }
//         .nav-dropdown-btn:hover {
//           background: rgba(255,255,255,.1);
//           transform: translateY(-2px);
//         }
//         .nav-dropdown-menu {
//           position: absolute;
//           top: calc(100% + 8px);
//           left: 0;
//           min-width: 220px;
//           background: #111827; /* gray-900 */
//           border: 1px solid #374151; /* gray-700 */
//           border-radius: 10px;
//           padding: 6px;
//           box-shadow: 0 10px 30px rgba(0,0,0,.35);
//           z-index: 10001;
//         }
//         .nav-dropdown-item {
//           display: block;
//           padding: 0.55rem 0.65rem;
//           border-radius: 8px;
//           font-size: 0.9rem;
//           font-weight: 500;
//           white-space: nowrap;
//         }
//         .nav-dropdown-item:hover {
//           background: #1f2937; /* gray-800 */
//           color: #22d3ee;      /* cyan-400 */
//         }

//         /* mobile managerial wrapper (details) inherits existing styles */
//       `}</style>

//       <nav className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-4 py-3 w-full sticky top-0 z-40 shadow-lg">
//         <div className="flex items-center justify-between w-full px-2 sm:px-4 lg:px-6">
//           {/* Left Section: Logo */}
//           <div className="flex items-center gap-2">
//             <img src="/flow1.png" alt="Logo" className="w-8 h-8 rounded-full border border-cyan-400 p-1" />
//             <Link href="/" className={`text-xl font-bold tracking-tight hover:text-cyan-300 transition duration-200 ${isActive("/") ? "text-cyan-300 active" : ""}`}>
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

//                 {/* MyPerformance */}
//                 <Link
//                   href={performancePath}
//                   className={`nav-item hover:text-cyan-300 ${isActive(performancePath) ? "text-cyan-300 active" : ""}`}
//                 >
//                   MyPerformance
//                 </Link>

//                 {/* Managerial dropdown (desktop) */}
//                 <div className="nav-dropdown">
//                   <button
//                     type="button"
//                     onClick={() => setIsManageOpen((v) => !v)}
//                     className="nav-dropdown-btn"
//                     aria-expanded={isManageOpen}
//                     aria-haspopup="menu"
//                   >
//                     Managerial <span className={`transition-transform ${isManageOpen ? "rotate-180" : ""}`}>▾</span>
//                   </button>

//                   {isManageOpen && (
//                     <div className="nav-dropdown-menu" role="menu">
//                       <Link href="/dashboard/managersCommon/routineTasks" className="nav-dropdown-item">
//                         Routine Tasks
//                       </Link>
//                       <Link href="/dashboard/managersCommon/assignTask" className="nav-dropdown-item">
//                         Assign Task
//                       </Link>
//                       <a
//                         href="https://meed-recruitment.onrender.com/login"
//                         target="_blank"
//                         rel="noopener noreferrer"
//                         className="nav-dropdown-item"
//                       >
//                         Recruit
//                       </a>
//                     </div>
//                   )}
//                 </div>

//                 {/* Together OUTSIDE dropdown */}
//                 <button
//                   onClick={openTogetherWorkspace}
//                   title="Together"
//                   className={`nav-icon-button relative hover:text-cyan-300 ${isActive("/dashboard/member/workTogether") ? "text-cyan-300 active" : ""}`}
//                 >
//                   <Users size={18} className="together-icon" />
//                 </button>

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

//                 {/* MyPerformance */}
//                 <Link
//                   href={performancePath}
//                   className={`nav-item hover:text-cyan-300 ${isActive(performancePath) ? "text-cyan-300 active" : ""}`}
//                 >
//                   MyPerformance
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

//                 {/* Managerial dropdown (desktop) */}
//                 <div className="nav-dropdown">
//                   <button
//                     type="button"
//                     onClick={() => setIsManageOpen((v) => !v)}
//                     className="nav-dropdown-btn"
//                     aria-expanded={isManageOpen}
//                     aria-haspopup="menu"
//                   >
//                     Managerial <span className={`transition-transform ${isManageOpen ? "rotate-180" : ""}`}>▾</span>
//                   </button>

//                   {isManageOpen && (
//                     <div className="nav-dropdown-menu" role="menu">
//                       <Link href="/dashboard/managersCommon/routineTasks" className="nav-dropdown-item">
//                         Routine Tasks
//                       </Link>
//                       <Link href="/dashboard/managersCommon/assignTask" className="nav-dropdown-item">
//                         Assign Task
//                       </Link>
//                       <a
//                         href="https://meed-recruitment.onrender.com/login"
//                         target="_blank"
//                         rel="noopener noreferrer"
//                         className="nav-dropdown-item"
//                       >
//                         Recruit
//                       </a>
//                     </div>
//                   )}
//                 </div>

//                 {/* Together OUTSIDE dropdown */}
//                 <button
//                   onClick={openTogetherWorkspace}
//                   title="Together"
//                   className={`nav-icon-button relative hover:text-cyan-300 ${isActive("/dashboard/member/workTogether") ? "text-cyan-300 active" : ""}`}
//                 >
//                   <Users size={18} className="together-icon" />
//                 </button>
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

//                 {/* MyPerformance */}
//                 <Link
//                   href={performancePath}
//                   className={`nav-item hover:text-cyan-300 ${isActive(performancePath) ? "text-cyan-300 active" : ""}`}
//                 >
//                   MyPerformance
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

//                 {/* Member only had Together button already */}
//                 <button
//                   onClick={openTogetherWorkspace}
//                   title="Together"
//                   className={`nav-icon-button relative hover:text-cyan-300 ${isActive("/dashboard/member/workTogether") ? "text-cyan-300 active" : ""}`}
//                 >
//                   <Users size={18} className="together-icon" />
//                 </button>
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

//           {/* Right Section: User Info, Logout, and Mobile Toggle */}
//           <div className="flex items-center gap-2">
//             {(role === "admin" || role === "team_manager" || role === "member") && (
//               <>
//                 <Link href={profilePath} className={`user-info hidden md:flex ${isActive(profilePath) ? "active" : ""}`}>
//                   <img
//                     src={userImage || "/default-avatar.png"}
//                     alt="User Avatar"
//                     onError={() => {
//                       console.error("Image failed to load:", userImage);
//                       setUserImage("/default-avatar.png");
//                     }}
//                   />
//                   <div className="user-info-text">
//                     <span className="name">{userName || "Loading..."}</span>
//                     <span className="account-label">My Account</span>
//                   </div>
//                 </Link>
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
//                 <Link href={profilePath} onClick={toggleMobileMenu} className={`mobile-user-info ${isActive(profilePath) ? "active" : ""}`}>
//                   <img
//                     src={userImage || "/default-avatar.png"}
//                     alt="User Avatar"
//                     onError={() => {
//                       console.error("Image failed to load:", userImage);
//                       setUserImage("/default-avatar.png");
//                     }}
//                   />
//                   <div className="mobile-user-info-text">
//                     <span className="name">{userName || "Loading..."}</span>
//                     <span className="account-label">My Account</span>
//                   </div>
//                 </Link>
//               )}

//               <div className="space-y-1">
//                 {role === "admin" && (
//                   <>
//                     <Link
//                       href="/dashboard"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard") ? "text-cyan-400 active" : ""}`}
//                     >
//                       General Dashboard
//                     </Link>
//                     <Link
//                       href="/dashboard/admin"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/admin") ? "text-cyan-400 active" : ""}`}
//                     >
//                       Dashboard
//                     </Link>

//                     {/* MyPerformance */}
//                     <Link
//                       href={performancePath}
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${isActive(performancePath) ? "text-cyan-400 active" : ""}`}
//                     >
//                       MyPerformance
//                     </Link>

//                     {/* Managerial collapsible */}
//                     <details className="mb-2">
//                       <summary className="mobile-menu-item cursor-pointer select-none">
//                         Managerial
//                       </summary>
//                       <div className="pl-2">
//                         <Link
//                           href="/dashboard/managersCommon/routineTasks"
//                           onClick={toggleMobileMenu}
//                           className="mobile-menu-item"
//                         >
//                           Routine Tasks
//                         </Link>
//                         <Link
//                           href="/dashboard/managersCommon/assignTask"
//                           onClick={toggleMobileMenu}
//                           className="mobile-menu-item"
//                         >
//                           Assign Task
//                         </Link>
//                         <a
//                           href="https://meed-recruitment.onrender.com/login"
//                           target="_blank"
//                           rel="noopener noreferrer"
//                           onClick={toggleMobileMenu}
//                           className="mobile-menu-item"
//                         >
//                           Recruit
//                         </a>
//                       </div>
//                     </details>

//                     {/* Together outside */}
//                     <button
//                       onClick={() => {
//                         openTogetherWorkspace();
//                         toggleMobileMenu();
//                       }}
//                       className={`mobile-together-button hover:text-cyan-400 ${isActive("/dashboard/member/workTogether") ? "text-cyan-400 active" : ""}`}
//                     >
//                       <Users size={18} className="mobile-together-icon" />
//                       Together
//                     </button>

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
//                       className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard") ? "text-cyan-400 active" : ""}`}
//                     >
//                       General
//                     </Link>
//                     <Link
//                       href="/dashboard/team_manager"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/team_manager") ? "text-cyan-400 active" : ""}`}
//                     >
//                       My Dashboard
//                     </Link>

//                     {/* MyPerformance */}
//                     <Link
//                       href={performancePath}
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${isActive(performancePath) ? "text-cyan-400 active" : ""}`}
//                     >
//                       MyPerformance
//                     </Link>

//                     <Link
//                       href="/dashboard/member/myMeedRituals"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/member/myMeedRituals") ? "text-cyan-400 active" : ""}`}
//                     >
//                       MyMRIs
//                     </Link>
//                     <Link
//                       href="/dashboard/member/closeMyDay"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/member/closeMyDay") ? "text-cyan-400 active" : ""}`}
//                     >
//                       CloseMyDay
//                     </Link>

//                     {/* Managerial collapsible */}
//                     <details className="mb-2">
//                       <summary className="mobile-menu-item cursor-pointer select-none">
//                         Managerial
//                       </summary>
//                       <div className="pl-2">
//                         <Link
//                           href="/dashboard/managersCommon/routineTasks"
//                           onClick={toggleMobileMenu}
//                           className="mobile-menu-item"
//                         >
//                           Routine Tasks
//                         </Link>
//                         <Link
//                           href="/dashboard/managersCommon/assignTask"
//                           onClick={toggleMobileMenu}
//                           className="mobile-menu-item"
//                         >
//                           Assign Task
//                         </Link>
//                         <a
//                           href="https://meed-recruitment.onrender.com/login"
//                           target="_blank"
//                           rel="noopener noreferrer"
//                           onClick={toggleMobileMenu}
//                           className="mobile-menu-item"
//                         >
//                           Recruit
//                         </a>
//                       </div>
//                     </details>

//                     {/* Together outside */}
//                     <button
//                       onClick={() => {
//                         openTogetherWorkspace();
//                         toggleMobileMenu();
//                       }}
//                       className={`mobile-together-button hover:text-cyan-400 ${isActive("/dashboard/member/workTogether") ? "text-cyan-400 active" : ""}`}
//                     >
//                       <Users size={18} className="mobile-together-icon" />
//                       Together
//                     </button>
//                   </>
//                 )}

//                 {role === "member" && (
//                   <>
//                     <Link
//                       href="/dashboard"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard") ? "text-cyan-400 active" : ""}`}
//                     >
//                       General
//                     </Link>
//                     <Link
//                       href="/dashboard/member"
//                       className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/member") ? "text-cyan-400 active" : ""}`}
//                       onClick={toggleMobileMenu}
//                     >
//                       My Dashboard
//                     </Link>

//                     {/* MyPerformance */}
//                     <Link
//                       href={performancePath}
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${isActive(performancePath) ? "text-cyan-400 active" : ""}`}
//                     >
//                       MyPerformance
//                     </Link>

//                     <Link
//                       href="/dashboard/member/myMeedRituals"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/member/myMeedRituals") ? "text-cyan-400 active" : ""}`}
//                     >
//                       MyMRIs
//                     </Link>
//                     <Link
//                       href="/dashboard/member/closeMyDay"
//                       onClick={toggleMobileMenu}
//                       className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/member/closeMyDay") ? "text-cyan-400 active" : ""}`}
//                     >
//                       CloseMyDay
//                     </Link>

//                     {/* Together */}
//                     <button
//                       onClick={() => {
//                         openTogetherWorkspace();
//                         toggleMobileMenu();
//                       }}
//                       className={`mobile-together-button hover:text-cyan-400 ${isActive("/dashboard/member/workTogether") ? "text-cyan-400 active" : ""}`}
//                     >
//                       <Users size={18} className="mobile-together-icon" />
//                       Together
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
