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
    return <div className="bg-gray-900 text-white p-4">Loading...</div>;
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
        .mobile-menu-item.active {
          color: #22d3ee;
          font-weight: 600;
          background: #374151;
        }
        .mobile-menu-item.active::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 50%;
          height: 2px;
          background: #22d3ee;
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
            <Link href="/" className={`text-xl font-bold tracking-tight hover:text-cyan-300 transition duration-200 ${isActive("/") ? "text-cyan-300 active" : ""}`}>
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
          {/* Right Section: User Info, Logout, and Mobile Toggle */}
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
                    <Link
                      href="/dashboard"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard") ? "text-cyan-400 active" : ""}`}
                    >
                      General Dashboard
                    </Link>
                    <Link
                      href="/dashboard/admin"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/admin") ? "text-cyan-400 active" : ""}`}
                    >
                      Dashboard
                    </Link>
                    <div className="mobile-managerial-group">
                      <Link
                        href="/dashboard/managersCommon/routineTasks"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-400 active" : ""}`}
                      >
                        Routine Tasks
                      </Link>
                      <Link
                        href="/dashboard/managersCommon/assignTask"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-400 active" : ""}`}
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
                        className={`mobile-together-button hover:text-cyan-400 ${isActive("/dashboard/member/workTogether") ? "text-cyan-400 active" : ""}`}
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
                      className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard") ? "text-cyan-400 active" : ""}`}
                    >
                      General
                    </Link>
                    <Link
                      href="/dashboard/team_manager"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/team_manager") ? "text-cyan-400 active" : ""}`}
                    >
                      My Dashboard
                    </Link>
                    <Link
                      href="/dashboard/member/myMeedRituals"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/member/myMeedRituals") ? "text-cyan-400 active" : ""}`}
                    >
                      MyMRIs
                    </Link>
                    <Link
                      href="/dashboard/member/closeMyDay"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/member/closeMyDay") ? "text-cyan-400 active" : ""}`}
                    >
                      CloseMyDay
                    </Link>
                    <div className="mobile-managerial-group">
                      <Link
                        href="/dashboard/managersCommon/routineTasks"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/managersCommon/routineTasks") ? "text-cyan-400 active" : ""}`}
                      >
                        Routine Tasks
                      </Link>
                      <Link
                        href="/dashboard/managersCommon/assignTask"
                        onClick={toggleMobileMenu}
                        className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/managersCommon/assignTask") ? "text-cyan-400 active" : ""}`}
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
                        className={`mobile-together-button hover:text-cyan-400 ${isActive("/dashboard/member/workTogether") ? "text-cyan-400 active" : ""}`}
                      >
                        <Users size={18} className="mobile-together-icon" />
                        Together
                      </button>
                    </div>
                  </>
                )}
                {role === "member" && (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard") ? "text-cyan-400 active" : ""}`}
                    >
                      General
                    </Link>
                    <Link
                      href="/dashboard/member"
                      className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/member") ? "text-cyan-400 active" : ""}`}
                    >
                      My Dashboard
                    </Link>
                    <Link
                      href="/dashboard/member/myMeedRituals"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/member/myMeedRituals") ? "text-cyan-400 active" : ""}`}
                    >
                      MyMRIs
                    </Link>
                    <Link
                      href="/dashboard/member/closeMyDay"
                      onClick={toggleMobileMenu}
                      className={`mobile-menu-item hover:text-cyan-400 ${isActive("/dashboard/member/closeMyDay") ? "text-cyan-400 active" : ""}`}
                    >
                      CloseMyDay
                    </Link>
                    <div className="mobile-managerial-group">
                      <button
                        onClick={() => {
                          openTogetherWorkspace();
                          toggleMobileMenu();
                        }}
                        className={`mobile-together-button hover:text-cyan-400 ${isActive("/dashboard/member/workTogether") ? "text-cyan-400 active" : ""}`}
                      >
                        <Users size={18} className="mobile-together-icon" />
                        Together
                      </button>
                    </div>
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