"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Menu,
  X,
  Users,
  Sparkles,
  ClipboardList,
  ClipboardCheck,
  CalendarCheck2,
  CalendarX2,
  UserPlus,
  ArrowRight
} from "lucide-react";
import { createPortal } from "react-dom";
import MeRightNow from "@/components/MeRightNow";

/* ======================= utils ======================= */
const getValidImageUrl = (url) => {
  if (!url || typeof url !== "string") return "/default-avatar.png";
  const clean = url.trim();
  if (!clean || clean.toLowerCase() === "null" || clean.toLowerCase() === "undefined") {
    return "/default-avatar.png";
  }
  return clean;
};

export default function Navbar() {
  const { data: session, status, update } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  /* ======================= state ======================= */
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [userName, setUserName] = useState(session?.user?.name || "User");
  const [userImage, setUserImage] = useState(getValidImageUrl(session?.user?.image));
  // Execute launcher (modal)
  const [isExecuteOpen, setIsExecuteOpen] = useState(false);
  // MeRightNow component modal
  const [isMeNowOpen, setIsMeNowOpen] = useState(false);
  // NEW: Managerial side-sheet
  const [isManagerialOpen, setIsManagerialOpen] = useState(false);

  /* ======================= effects ======================= */
  // mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // sync username/avatar from session
  useEffect(() => {
    if (session?.user) {
      setUserName(session.user.name || "User");
      setUserImage(getValidImageUrl(session.user.image));
    }
  }, [session]);

  // profile polling when on /profile + postMessage listener for live updates
  useEffect(() => {
    if (status !== "authenticated") return;

    let intervalId;

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/member/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.user) {
          if (data.user.name) setUserName(data.user.name);
          if (data.user.image) setUserImage(getValidImageUrl(data.user.image));
        }
      } catch {
        // ignore
      }
    };

    fetchProfile();

    if (pathname.includes("/profile")) {
      intervalId = window.setInterval(fetchProfile, 5000);
    }

    const onMsg = (event) => {
      if (event.data?.type === "PROFILE_UPDATED") {
        if (event.data.imageUrl) {
          const img = getValidImageUrl(event.data.imageUrl);
          setUserImage(img);
          if (update) update({ user: { image: img } });
        }
        if (event.data.name) {
          setUserName(event.data.name);
          if (update) update({ user: { name: event.data.name } });
        }
      }
    };
    window.addEventListener("message", onMsg);

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("message", onMsg);
    };
  }, [status, pathname, update]);

  // close overlays on route change
  useEffect(() => {
    setIsExecuteOpen(false);
    setIsManagerialOpen(false);
  }, [pathname]);

  // keyboard shortcuts (keep BEFORE any returns for stable hook order)
  useEffect(() => {
    const handler = (e) => {
      // Execute: Ctrl/Cmd + C
      if ((e.key === "c" || e.key === "C") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsExecuteOpen(true);
      }
      // Managerial: Ctrl/Cmd + M
      if ((e.key === "m" || e.key === "M") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsManagerialOpen(true);
      }
      // quick-enter MeRightNow if Execute modal is open and user hits Enter
      if (e.key === "Enter" && isExecuteOpen) {
        setIsExecuteOpen(false);
        setIsMeNowOpen(true);
      }
      // Esc closes open overlays
      if (e.key === "Escape") {
        setIsExecuteOpen(false);
        setIsManagerialOpen(false);
        setIsLogoutModalOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isExecuteOpen]);

  // Optional: prevent body scroll when any overlay is open
  useEffect(() => {
    const anyOpen = isExecuteOpen || isManagerialOpen || isLogoutModalOpen;
    if (anyOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isExecuteOpen, isManagerialOpen, isLogoutModalOpen]);

  /* ======================= helpers ======================= */
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
  const openMeRightNow = () => setIsMeNowOpen(true);

  /* ======================= components ======================= */
  const LogoutModal = () => (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Confirm logout">
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

  const ExecuteModal = () => (
    <div className="execute-overlay" role="dialog" aria-modal="true" aria-label="Choose an execution mode" onClick={() => setIsExecuteOpen(false)}>
      <div className="execute-modal animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-cyan-300">Execute</h3>
            <p className="text-sm text-gray-300/80 mt-1">Pick what you want to do—then jump right in.</p>
          </div>
          <button onClick={() => setIsExecuteOpen(false)} className="nav-icon-button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="execute-grid">
          <button
            className="action-card group"
            onClick={() => {
              setIsExecuteOpen(false);
              openMeRightNow();
            }}
          >
            <div className="action-icon">
              <Sparkles size={20} />
            </div>
            <div className="action-body">
              <div className="action-title">Me Right Now</div>
              <div className="action-sub">Pick the task you’re doing now and lock in.</div>
            </div>
            <span className="action-go" aria-hidden><ArrowRight size={16} /></span>
          </button>

          <button
            className="action-card group"
            onClick={() => {
              setIsExecuteOpen(false);
              openTogetherWorkspace();
            }}
          >
            <div className="action-icon">
              <Users size={20} />
            </div>
            <div className="action-body">
              <div className="action-title">Together</div>
              <div className="action-sub">Hop into a shared workspace with your team.</div>
            </div>
            <span className="action-go" aria-hidden><ArrowRight size={16} /></span>
          </button>
        </div>

        <div className="mt-2 text-[11px] text-gray-400/80">
          Tip: Open with <span className="kbd">Ctrl/Cmd</span> + <span className="kbd">C</span>, then <span className="kbd">Enter</span>.
        </div>
      </div>
    </div>
  );

  // NEW: Managerial Side Sheet
  const ManagerialSheet = () => (
    <div className={`sheet-overlay ${isManagerialOpen ? "open" : ""}`} aria-hidden={!isManagerialOpen} onClick={() => setIsManagerialOpen(false)}>
      <aside className={`sheet-panel ${isManagerialOpen ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="Managerial" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h3 className="sheet-title">Managerial</h3>
          <button className="nav-icon-button" aria-label="Close" onClick={() => setIsManagerialOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="sheet-content">
          <button
            className="action-row"
            onClick={() => { setIsManagerialOpen(false); router.push("/dashboard/managersCommon/routineTasks"); }}
          >
            <span className="row-icon"><ClipboardList size={18} /></span>
            <span className="row-main">
              <span className="row-title">Routine Tasks</span>
              <span className="row-sub">Daily/weekly ops checklists</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <button
            className="action-row"
            onClick={() => { setIsManagerialOpen(false); router.push("/dashboard/managersCommon/assignTask"); }}
          >
            <span className="row-icon"><ClipboardCheck size={18} /></span>
            <span className="row-main">
              <span className="row-title">Assign Task</span>
              <span className="row-sub">Create & dispatch tasks</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <button
            className="action-row"
            onClick={() => { setIsManagerialOpen(false); router.push("/dashboard/managersCommon/approveCloseDay"); }}
          >
            <span className="row-icon"><CalendarCheck2 size={18} /></span>
            <span className="row-main">
              <span className="row-title">Day Close Request</span>
              <span className="row-sub">Review and approve day closures</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <button
            className="action-row"
            onClick={() => { setIsManagerialOpen(false); router.push("/dashboard/managersCommon/approveLeave"); }}
          >
            <span className="row-icon"><CalendarX2 size={18} /></span>
            <span className="row-main">
              <span className="row-title">Leave Request</span>
              <span className="row-sub">Approve or decline leave</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <a
            href="https://meed-recruitment.onrender.com/login"
            target="_blank"
            rel="noopener noreferrer"
            className="action-row link-row"
            onClick={() => setIsManagerialOpen(false)}
          >
            <span className="row-icon"><UserPlus size={18} /></span>
            <span className="row-main">
              <span className="row-title">Recruit</span>
              <span className="row-sub">Open recruiting portal</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </a>
        </div>
      </aside>
    </div>
  );

  /* ======================= render ======================= */
  const showNavbar = !pathname.includes("/workTogether");

  return (
    <>
      <style jsx global>{`
        /* ====== Base Modals ====== */
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

        /* ====== Mobile drawer ====== */
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

        .mobile-menu-item, .nav-item {
          position: relative;
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

        .nav-button {
          padding: 0.5rem 0.9rem;
          font-weight: 600;
          font-size: 0.85rem;
          border-radius: 10px;
          transition: all 0.25s ease;
          white-space: nowrap;
          box-shadow: 0 4px 14px rgba(0,0,0,0.25);
          min-height: 44px;
        }
        .nav-button:hover { transform: translateY(-2px); filter: brightness(1.1); }

        .nav-icon-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.55rem;
          border-radius: 9999px;
          transition: all 0.25s ease;
          min-height: 40px;
          min-width: 40px;
          border: 1px solid transparent;
        }
        .nav-icon-button:hover {
          background: rgba(255,255,255,0.1);
          transform: translateY(-2px);
        }

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
        .user-info-text { display: flex; flex-direction: column; line-height: 1.1; }
        .user-info-text .name {
          font-weight: 600;
          font-size: 0.85rem;
          color: #f3f4f6;
        }
        .user-info-text .account-label {
          font-size: 0.7rem;
          color: #d1d5db;
          background: rgba(255,255,255,.1);
          padding: 0.1rem 0.35rem;
          border-radius: 5px;
          margin-top: 2px;
          text-align: center;
        }

        .mobile-user-info {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.7rem;
          border-radius: 10px;
          margin-bottom: 0.5rem;
          border: 2px solid #4b5563;
          background: #1f2937;
          transition: all .2s ease;
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
          width: 30px;
          height: 30px;
          border-radius: 9999px;
          border: 2px solid #22d3ee;
          object-fit: cover;
        }
        .mobile-user-info-text { display: flex; flex-direction: column; line-height: 1.1; }
        .mobile-user-info-text .name {
          font-weight: 600;
          font-size: 0.85rem;
          color: #f3f4f6;
        }
        .mobile-user-info-text .account-label {
          font-size: 0.65rem;
          color: #d1d5db;
          background: rgba(255,255,255,.1);
          padding: 0.1rem 0.35rem;
          border-radius: 5px;
          margin-top: 2px;
          text-align: center;
        }

        nav {
          background: linear-gradient(90deg, #0b1220, #111827 30%, #1f2937 70%, #0b1220);
        }

        /* ====== Execute launcher (small + creative) ====== */
        .execute-launcher {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.35rem 0.6rem;
          border-radius: 9999px;
          border: 1px solid #164e63;
          background: radial-gradient(120px 60px at 20% 10%, rgba(6,182,212,0.15), rgba(0,0,0,0)) #0b1220;
          color: #e6fbff;
          font-weight: 700;
          font-size: 0.8rem;
          letter-spacing: 0.02em;
          transition: all .2s ease;
          box-shadow: inset 0 0 0 1px rgba(34,211,238,0.15), 0 0 0 0 rgba(34,211,238,0.4);
        }
        .execute-launcher:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(34,211,238,0.15);
          color: #a5f3fc;
        }
        .execute-launcher .spark {
          display: inline-flex;
          padding: 4px;
          border-radius: 9999px;
          border: 1px solid rgba(34,211,238,0.35);
          background: rgba(34,211,238,0.08);
          animation: pulseGlow 2.2s ease-in-out infinite;
        }
        .execute-launcher .dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22d3ee;
          box-shadow: 0 0 8px #22d3ee, 0 0 16px rgba(34,211,238,0.6);
          opacity: 0.85;
          animation: breathe 3.2s ease-in-out infinite;
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.35); }
          50%      { box-shadow: 0 0 0 6px rgba(34,211,238,0.0); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50%      { transform: scale(1.1); opacity: 1; }
        }

        /* ====== Execute modal ====== */
        .execute-overlay {
          position: fixed;
          inset: 0;
          background: rgba(1, 7, 15, 0.78);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10020;
          animation: fadeIn .12s ease-out;
        }
        .execute-modal {
          width: min(560px, 92vw);
          border-radius: 14px;
          padding: 14px;
          background:
            radial-gradient(400px 120px at -10% -10%, rgba(34,211,238,0.08), transparent),
            radial-gradient(280px 120px at 110% 120%, rgba(59,130,246,0.08), transparent),
            #0b1220;
          border: 1px solid rgba(34,211,238,0.18);
          box-shadow: 0 8px 26px rgba(0,0,0,0.45),
                      inset 0 0 0 1px rgba(255,255,255,0.02);
        }
        .animate-pop { animation: pop .16s ease-out; }
        @keyframes pop {
          0%   { transform: scale(.96); opacity: .2; }
          100% { transform: scale(1);   opacity: 1;  }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }

        .execute-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 12px;
          margin-bottom: 6px;
        }
        @media (max-width: 520px) {
          .execute-grid { grid-template-columns: 1fr; }
        }

        .action-card {
          display: grid;
          grid-template-columns: 40px 1fr auto;
          align-items: center;
          gap: 10px;
          width: 100%;
          text-align: left;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #1f2a44;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.0)),
            #0e1726;
          color: #e5faff;
          transition: transform .15s ease, border-color .15s ease, background .15s ease;
        }
        .action-card:hover {
          transform: translateY(-2px);
          border-color: #214a63;
          background:
            linear-gradient(180deg, rgba(34,211,238,0.06), rgba(34,211,238,0.02)),
            #0f1a2b;
        }
        .action-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 9999px;
          border: 1px solid rgba(34,211,238,0.28);
          background: rgba(34,211,238,0.08);
        }
        .action-body { min-width: 0; }
        .action-title {
          font-weight: 700;
          font-size: 0.95rem;
          color: #bff7ff;
        }
        .action-sub {
          font-size: 0.82rem;
          color: #b1c8d6;
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .action-go {
          opacity: 0.7;
          transition: transform .12s ease, opacity .12s ease;
        }
        .action-card:hover .action-go {
          transform: translateX(2px);
          opacity: 1;
        }

        .kbd {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 6px;
          border: 1px solid #334155;
          background: #0f172a;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 10.5px;
          line-height: 1.2;
          color: #cbd5e1;
        }

        /* ====== Managerial Side Sheet ====== */
        .sheet-overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 8, 20, 0.55);
          backdrop-filter: blur(2px);
          z-index: 10015;
          opacity: 0;
          pointer-events: none;
          transition: opacity .15s ease;
        }
        .sheet-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }
        .sheet-panel {
          position: fixed;
          top: 0;
          right: 0;
          height: 100%;
          width: min(420px, 92vw);
          background:
            radial-gradient(360px 140px at 110% -10%, rgba(34,211,238,0.08), transparent),
            #0b1220;
          border-left: 1px solid rgba(34,211,238,0.2);
          box-shadow: -12px 0 28px rgba(0,0,0,0.5);
          transform: translateX(100%);
          transition: transform .18s ease;
          z-index: 10016;
          display: flex;
          flex-direction: column;
        }
        .sheet-panel.open { transform: translateX(0); }
        .sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 14px 10px 14px;
          border-bottom: 1px solid rgba(148,163,184,0.08);
        }
        .sheet-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: #bff7ff;
        }
        .sheet-content {
          padding: 8px;
          display: grid;
          gap: 8px;
          overflow-y: auto;
        }
        .action-row {
          display: grid;
          grid-template-columns: 36px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 12px;
          border: 1px solid #1f2a44;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.0)),
            #0e1726;
          color: #e5faff;
          text-align: left;
          width: 100%;
          transition: transform .12s ease, border-color .12s ease, background .12s ease;
        }
        .action-row:hover {
          transform: translateY(-1px);
          border-color: #214a63;
          background:
            linear-gradient(180deg, rgba(34,211,238,0.06), rgba(34,211,238,0.02)),
            #0f1a2b;
        }
        .action-row .row-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 9999px;
          border: 1px solid rgba(34,211,238,0.28);
          background: rgba(34,211,238,0.08);
        }
        .action-row .row-main {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .action-row .row-title {
          font-weight: 700;
          font-size: 0.93rem;
          color: #bff7ff;
        }
        .action-row .row-sub {
          font-size: 0.8rem;
          color: #b1c8d6;
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .action-row .row-go {
          opacity: .75;
          transition: transform .12s ease, opacity .12s ease;
        }
        .action-row:hover .row-go { transform: translateX(2px); opacity: 1; }

        @media (max-width: 640px) {
          .modal-content { padding: 12px; max-width: 95vw; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nav-icon-button, .execute-launcher, .action-card, .execute-modal, .sheet-panel {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      {showNavbar && (
        <nav className="text-white px-3 py-2 w-full sticky top-0 z-40 shadow-lg border-b border-cyan-900/40">
          <div className="flex items-center justify-between w-full px-2 sm:px-4 lg:px-6">
            {/* left: logo */}
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

            {/* center: nav links */}
            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center space-x-2">
              {role === "admin" && (
                <>
                  <Link href="/dashboard" className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}>General</Link>
                  <Link href="/dashboard/admin" className={`nav-item ${isActive("/dashboard/admin") ? "active" : ""}`}>Dashboard</Link>

                  {/* Managerial button -> opens side sheet */}
                  <button
                    type="button"
                    onClick={() => setIsManagerialOpen(true)}
                    className="nav-button bg-slate-800 hover:bg-slate-700 text-cyan-200"
                    aria-haspopup="dialog"
                    aria-expanded={isManagerialOpen}
                    aria-label="Open managerial actions"
                    title="Managerial"
                  >
                    Managerial
                  </button>

                  {/* Execute launcher */}
                  <button
                    type="button"
                    onClick={() => setIsExecuteOpen(true)}
                    className="execute-launcher"
                    aria-haspopup="dialog"
                    aria-expanded={isExecuteOpen}
                    aria-label="Open execute options"
                    title="Execute"
                  >
                    <span className="spark"><Sparkles size={16} /></span>
                    Execute
                    <span className="dot" />
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

                  <button
                    type="button"
                    onClick={() => setIsManagerialOpen(true)}
                    className="nav-button bg-slate-800 hover:bg-slate-700 text-cyan-200"
                    aria-haspopup="dialog"
                    aria-expanded={isManagerialOpen}
                    aria-label="Open managerial actions"
                    title="Managerial"
                  >
                    Managerial
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsExecuteOpen(true)}
                    className="execute-launcher"
                    aria-haspopup="dialog"
                    aria-expanded={isExecuteOpen}
                    aria-label="Open execute options"
                    title="Execute"
                  >
                    <span className="spark"><Sparkles size={16} /></span>
                    Execute
                    <span className="dot" />
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

                  <button
                    type="button"
                    onClick={() => setIsManagerialOpen(true)}
                    className="nav-button bg-slate-800 hover:bg-slate-700 text-cyan-200"
                    aria-haspopup="dialog"
                    aria-expanded={isManagerialOpen}
                    aria-label="Open managerial actions"
                    title="Managerial"
                  >
                    Managerial
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsExecuteOpen(true)}
                    className="execute-launcher"
                    aria-haspopup="dialog"
                    aria-expanded={isExecuteOpen}
                    aria-label="Open execute options"
                    title="Execute"
                  >
                    <span className="spark"><Sparkles size={16} /></span>
                    Execute
                    <span className="dot" />
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

            {/* right: profile + mobile burger */}
            <div className="flex items-center gap-2">
              {(role === "admin" || role === "team_manager" || role === "member") && (
                <>
                  <Link href={profilePath} className={`user-info hidden md:flex ${isActive(profilePath) ? "active" : ""}`}>
                    <img
                      src={userImage || "/default-avatar.png"}
                      alt="User Avatar"
                      onError={() => setUserImage("/default-avatar.png")}
                    />
                    <div className="user-info-text">
                      <span className="name">{userName || "Loading..."}</span>
                      <span className="account-label">My Account</span>
                    </div>
                  </Link>
                  <button onClick={openLogoutModal} className="hidden md:block nav-button bg-red-600 hover:bg-red-700 text-white">
                    Logout
                  </button>
                </>
              )}
              <div className="md:hidden">
                <button onClick={toggleMobileMenu} className="text-white p-2 rounded-full hover:bg-gray-700 transition min-h-[44px] min-w-[44px]">
                  {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>

          {/* mobile drawer */}
          {isMobileMenuOpen && (
            <>
              <div className="mobile-menu-overlay open" onClick={toggleMobileMenu} />
              <div className={`mobile-menu ${isMobileMenuOpen ? "open" : ""}`}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-base font-bold text-cyan-400">Menu</span>
                  <button onClick={toggleMobileMenu} className="text-white p-2 rounded-full hover:bg-gray-700 min-h-[44px] min-w-[44px]">
                    <X size={20} />
                  </button>
                </div>

                {(role === "admin" || role === "team_manager" || role === "member") && (
                  <Link href={profilePath} onClick={toggleMobileMenu} className={`mobile-user-info ${isActive(profilePath) ? "active" : ""}`}>
                    <img
                      src={userImage || "/default-avatar.png"}
                      alt="User Avatar"
                      onError={() => setUserImage("/default-avatar.png")}
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

                      {/* Mobile: open Managerial side sheet */}
                      <button
                        onClick={() => { setIsManagerialOpen(true); toggleMobileMenu(); }}
                        className="mobile-menu-item text-left w-full"
                      >
                        Managerial
                      </button>

                      {/* Mobile: open Execute modal */}
                      <button onClick={() => { setIsExecuteOpen(true); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">
                        Execute
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

                      <button onClick={() => { setIsManagerialOpen(true); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">
                        Managerial
                      </button>
                      <button onClick={() => { setIsExecuteOpen(true); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">
                        Execute
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

                      <button onClick={() => { setIsManagerialOpen(true); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">
                        Managerial
                      </button>
                      <button onClick={() => { setIsExecuteOpen(true); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">
                        Execute
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
      )}

      {/* portals (outside so they can appear even if nav is hidden) */}
      {mounted && typeof window !== "undefined" && isLogoutModalOpen && document?.body &&
        createPortal(<LogoutModal />, document.body)}

      {mounted && typeof window !== "undefined" && isExecuteOpen && document?.body &&
        createPortal(<ExecuteModal />, document.body)}

      {mounted && typeof window !== "undefined" && isManagerialOpen && document?.body &&
        createPortal(<ManagerialSheet />, document.body)}

      <MeRightNow
        open={isMeNowOpen}
        onClose={() => setIsMeNowOpen(false)}
        onOpenTogether={openTogetherWorkspace}
      />
    </>
  );
}
