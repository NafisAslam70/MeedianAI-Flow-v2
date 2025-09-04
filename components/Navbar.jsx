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
  Mountain,
  ClipboardList,
  ClipboardCheck,
  CalendarCheck2,
  CalendarX2,
  Calendar,
  UserPlus,
  ArrowRight,
  User,
  BarChart2,
  MessageSquare,
  Send
} from "lucide-react";
import AboutMeedModal from "@/components/AboutMeedModal";
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
  // NEW: Profile side-sheet (widgets)
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // NEW: MRIs side-sheet
  const [isMRISheetOpen, setIsMRISheetOpen] = useState(false);
  const [isAboutMeedOpen, setIsAboutMeedOpen] = useState(false);
  // MRIs preview state
  const [todayAMRIs, setTodayAMRIs] = useState([]);
  const [todayNMRIs, setTodayNMRIs] = useState([]);
  const [loadingMRIPreview, setLoadingMRIPreview] = useState(false);
  const [mriPreviewErr, setMriPreviewErr] = useState("");
  // Current MRN for Profile sheet quick status
  const [currentMRN, setCurrentMRN] = useState(null);
  const [loadingMRN, setLoadingMRN] = useState(false);
  // All Meedians directory
  const [isAllMeediansOpen, setIsAllMeediansOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedMeedian, setSelectedMeedian] = useState(null);

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
    const anyOpen = isExecuteOpen || isManagerialOpen || isLogoutModalOpen || isProfileOpen || isAllMeediansOpen;
    if (anyOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isExecuteOpen, isManagerialOpen, isLogoutModalOpen, isProfileOpen, isAllMeediansOpen]);

  // Load current MRN when the Profile sheet opens (and poll while open)
  useEffect(() => {
    if (!isProfileOpen || status !== "authenticated") return;
    let intervalId;
    const fetchCurrent = async () => {
      try {
        setLoadingMRN(true);
        const res = await fetch("/api/member/meRightNow?action=current", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setCurrentMRN(data.current || null);
      } catch {
        /* ignore */
      } finally {
        setLoadingMRN(false);
      }
    };
    fetchCurrent();
    intervalId = window.setInterval(fetchCurrent, 10000);
    return () => intervalId && clearInterval(intervalId);
  }, [isProfileOpen, status]);

  // Load all members when All Meedians modal opens
  useEffect(() => {
    if (!isAllMeediansOpen || status !== "authenticated") return;
    let aborted = false;
    (async () => {
      try {
        setLoadingAllUsers(true);
        setUsersError("");
        const res = await fetch("/api/member/users", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (!aborted) setAllUsers(Array.isArray(data.users) ? data.users : []);
      } catch (e) {
        if (!aborted) setUsersError(e.message || "Failed to load users");
      } finally {
        if (!aborted) setLoadingAllUsers(false);
      }
    })();
    return () => { aborted = true; };
  }, [isAllMeediansOpen, status]);

  // Fetch today's MRIs when MRIs sheet opens
  useEffect(() => {
    if (!isMRISheetOpen || status !== "authenticated") return;
    let aborted = false;
    (async () => {
      try {
        setLoadingMRIPreview(true);
        setMriPreviewErr("");
        const res = await fetch("/api/member/myMRIs?section=today", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (!aborted) {
          setTodayAMRIs(Array.isArray(data.aMRIs) ? data.aMRIs.slice(0, 4) : []);
          setTodayNMRIs(Array.isArray(data.nMRIs) ? data.nMRIs.slice(0, 4) : []);
        }
      } catch (e) {
        if (!aborted) setMriPreviewErr(e.message || "Failed to load MRIs preview");
      } finally {
        if (!aborted) setLoadingMRIPreview(false);
      }
    })();
    return () => { aborted = true; };
  }, [isMRISheetOpen, status]);


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

  // pretty time since
  const timeSince = (iso) => {
    try {
      const t = new Date(iso).getTime();
      const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m}m`;
      return `${s}s`;
    } catch {
      return "";
    }
  };

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
            <h3 className="text-lg font-semibold text-cyan-300">Towards Greatness</h3>
            <p className="text-sm text-gray-300/80 mt-1">Ritual over result. Begin with sincerity.</p>
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
              <Mountain size={20} />
            </div>
            <div className="action-body">
              <div className="action-title">My Rituals Right Now</div>
              <div className="action-sub">Let’s enter our mission today.</div>
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

          <button
            className="action-card group"
            onClick={() => {
              setIsExecuteOpen(false);
              router.push("/dashboard?open=mrn");
            }}
          >
            <div className="action-icon">
              <Sparkles size={20} />
            </div>
            <div className="action-body">
              <div className="action-title">Meedians in Action</div>
              <div className="action-sub">See all MRNs (active + resting)</div>
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

  // NEW: Profile Widgets Side Sheet (same visual language as Managerial)
  const ProfileSheet = () => (
    <div className={`sheet-overlay ${isProfileOpen ? "open" : ""}`} aria-hidden={!isProfileOpen} onClick={() => setIsProfileOpen(false)}>
      <aside className={`sheet-panel ${isProfileOpen ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="Profile Widgets" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h3 className="sheet-title">My Widgets</h3>
          <button className="nav-icon-button" aria-label="Close" onClick={() => setIsProfileOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="sheet-content">
          {/* Current MRN quick status (distinct design) */}
          <button
            className={`current-mrn-row ${currentMRN ? "active" : "rest"}`}
            onClick={() => { setIsProfileOpen(false); setIsMeNowOpen(true); }}
            title="View or update your current MRN"
          >
            <span className="mrn-icon">
              <span className="icon-wrap"><Mountain size={18} /></span>
              {currentMRN ? (
                <span className="live-dot" aria-hidden />
              ) : (
                <span className="rest-dot" aria-hidden />
              )}
            </span>
            <span className="mrn-main">
              <span className="mrn-title">
                {currentMRN ? (currentMRN.itemTitle || "Current MRN") : "Rest and Recover"}
                {currentMRN && (
                  <>
                    <span className="live-badge">LIVE</span>
                    <span className="spark-icon" aria-hidden><Sparkles size={14} /></span>
                  </>
                )}
              </span>
              <span className="mrn-sub">
                {loadingMRN
                  ? "Checking…"
                  : currentMRN
                    ? `since ${currentMRN.startedAt ? timeSince(currentMRN.startedAt) : "—"}`
                    : "No active MRN"}
              </span>
            </span>
            <ArrowRight size={16} className="mrn-go" />
          </button>

          <button
            className="action-row"
            onClick={() => { setIsProfileOpen(false); router.push(profilePath); }}
          >
            <span className="row-icon"><User size={18} /></span>
            <span className="row-main">
              <span className="row-title">Profile Settings</span>
              <span className="row-sub">Update your info and preferences</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <button
            className="action-row"
            onClick={() => { setIsProfileOpen(false); router.push(performancePath); }}
          >
            <span className="row-icon"><BarChart2 size={18} /></span>
            <span className="row-main">
              <span className="row-title">My Performance</span>
              <span className="row-sub">See your metrics and progress</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <button
            className="action-row"
            onClick={() => { setIsProfileOpen(false); router.push(`${profilePath}?open=leave`); }}
          >
            <span className="row-icon"><CalendarCheck2 size={18} /></span>
            <span className="row-main">
              <span className="row-title">Leave Request</span>
              <span className="row-sub">Submit leave for approval</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <button
            className="action-row"
            onClick={() => { setIsProfileOpen(false); router.push(`${profilePath}?open=talk`); }}
          >
            <span className="row-icon"><MessageSquare size={18} /></span>
            <span className="row-main">
              <span className="row-title">Talk to Superintendent</span>
              <span className="row-sub">Start a direct chat</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <button
            className="action-row"
            onClick={() => { setIsProfileOpen(false); router.push(`${profilePath}?open=direct`); }}
          >
            <span className="row-icon"><Send size={18} /></span>
            <span className="row-main">
              <span className="row-title">Send Direct Message</span>
              <span className="row-sub">Compose a WhatsApp message</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          {(role === "admin" || role === "team_manager") && (
            <button
              className="action-row"
              onClick={() => { setIsProfileOpen(false); router.push(`${profilePath}?open=sent`); }}
            >
              <span className="row-icon"><ClipboardCheck size={18} /></span>
              <span className="row-main">
                <span className="row-title">Sent Message History</span>
                <span className="row-sub">Review your messages</span>
              </span>
              <ArrowRight size={16} className="row-go" />
            </button>
          )}

          {/* All Meedians directory */}
          <button
            className="action-row"
            onClick={() => { setIsAllMeediansOpen(true); }}
          >
            <span className="row-icon"><Users size={18} /></span>
            <span className="row-main">
              <span className="row-title">All Meedians</span>
              <span className="row-sub">Names, roles and WhatsApp (admins’ numbers hidden)</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>
        </div>
      </aside>
    </div>
  );

  // NEW: MRIs Side Sheet
  const MRISheet = () => (
    <div className={`sheet-overlay ${isMRISheetOpen ? "open" : ""}`} aria-hidden={!isMRISheetOpen} onClick={() => setIsMRISheetOpen(false)}>
      <aside className={`sheet-panel ${isMRISheetOpen ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="MRIs" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h3 className="sheet-title">MRIs</h3>
          <button className="nav-icon-button" aria-label="Close" onClick={() => setIsMRISheetOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="sheet-content">
          {/* Current MRN quick status (reuse design) */}
          <button
            className={`current-mrn-row ${currentMRN ? "active" : "rest"}`}
            onClick={() => { setIsMeNowOpen(true); }}
            title="View or update your current MRN"
          >
            <span className="mrn-icon">
              <span className="icon-wrap"><Mountain size={18} /></span>
              {currentMRN ? <span className="live-dot" aria-hidden /> : <span className="rest-dot" aria-hidden />}
            </span>
            <span className="mrn-main">
              <span className="mrn-title">
                {currentMRN ? (currentMRN.itemTitle || "Current MRN") : "Rest and Recover"}
                {currentMRN && (<><span className="live-badge">LIVE</span><span className="spark-icon" aria-hidden><Sparkles size={14} /></span></>)}
              </span>
              <span className="mrn-sub">
                {loadingMRN ? "Checking…" : currentMRN ? `since ${currentMRN.startedAt ? new Date(currentMRN.startedAt).toLocaleTimeString() : "—"}` : "No active MRN"}
              </span>
            </span>
            <ArrowRight size={16} className="mrn-go" />
          </button>

          {/* Open full MyMRIs page */}
          <button
            className="action-row"
            onClick={() => { setIsMRISheetOpen(false); router.push("/dashboard/member/myMeedRituals"); }}
          >
            <span className="row-icon"><Calendar size={18} /></span>
            <span className="row-main">
              <span className="row-title">MyMRIs</span>
              <span className="row-sub">Open your MRIs page</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <div className="rounded-xl border border-cyan-900/40 bg-white/5 p-3">
            <div className="text-sm font-semibold text-cyan-200 mb-2">Today’s MRIs</div>
            {loadingMRIPreview ? (
              <div className="text-xs text-cyan-300/80">Loading…</div>
            ) : mriPreviewErr ? (
              <div className="text-xs text-rose-300">{mriPreviewErr}</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <div className="text-xs text-cyan-300/80 mb-1">A‑MRIs</div>
                  {todayAMRIs.length === 0 ? (
                    <div className="text-xs text-cyan-100/70">None</div>
                  ) : (
                    <ul className="text-xs text-cyan-100/90 list-disc ml-4">
                      {todayAMRIs.map((t, i) => (
                        <li key={`a-${i}`}>{t.title}{t.description ? ` — ${t.description}` : ""}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="text-xs text-cyan-300/80 mb-1">N‑MRIs</div>
                  {todayNMRIs.length === 0 ? (
                    <div className="text-xs text-cyan-100/70">None</div>
                  ) : (
                    <ul className="text-xs text-cyan-100/90 list-disc ml-4">
                      {todayNMRIs.map((s, i) => (
                        <li key={`n-${i}`}>{s.name || `Slot ${s.id}`}{s.time ? ` — ${s.time}` : ""}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="action-row" onClick={() => setIsAboutMeedOpen(true)}>

            <span className="row-icon"><Sparkles size={18} /></span>
            <span className="row-main">
              <span className="row-title">About MEED</span>
              <span className="row-sub">Blueprint • Principles • Operations • Pledges</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>


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
        /* ====== Current MRN row (distinct look) ====== */
        .current-mrn-row {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 10px;
          width: 100%;
          border-radius: 14px;
          padding: 10px 12px;
          border: 1px solid rgba(239,68,68,0.25);
          background: linear-gradient(135deg, rgba(239,68,68,0.85), rgba(220,38,38,0.92));
          position: relative;
          text-align: left;
          box-shadow: 0 8px 20px rgba(239,68,68,0.25), inset 0 0 30px rgba(255,255,255,0.06);
          overflow: hidden;
        }
        .current-mrn-row:hover { filter: brightness(1.04); }
        .current-mrn-row .mrn-icon { position: relative; display: flex; align-items: center; }
        .current-mrn-row .icon-wrap {
          width: 32px; height: 32px; display: grid; place-items: center;
          border-radius: 10px;
          background: radial-gradient(120px 120px at 30% 20%, rgba(248,113,113,0.45), transparent), rgba(255,255,255,0.10);
          border: 1px solid rgba(248,113,113,0.35);
          color: #fee2e2;
        }
        .current-mrn-row .live-dot,
        .current-mrn-row .rest-dot {
          position: absolute; right: -2px; bottom: -2px; width: 9px; height: 9px;
          border-radius: 9999px; border: 1px solid rgba(0,0,0,0.2);
        }
        .current-mrn-row .live-dot { background: #ef4444; box-shadow: 0 0 0 6px rgba(239,68,68,0.25); animation: pulseDot 1.4s infinite; }
        .current-mrn-row .rest-dot { background: #9ca3af; box-shadow: 0 0 0 6px rgba(156,163,175,0.18); }
        @keyframes pulseDot { 0%{transform:scale(1)} 50%{transform:scale(1.2)} 100%{transform:scale(1)} }
        .current-mrn-row .mrn-main { min-width: 0; }
        .current-mrn-row .mrn-title { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; color: #fff5f5; text-shadow: 0 1px 0 rgba(0,0,0,0.1); }
        .current-mrn-row .mrn-sub { display:block; font-size: 12px; color: rgba(255,255,255,0.9); margin-top: 2px; }
        .current-mrn-row .live-badge {
          font-size: 10px; font-weight: 800; letter-spacing: .3px; color: #7f1d1d;
          background: linear-gradient(135deg, #fecaca, #fee2e2);
          padding: 2px 6px; border-radius: 999px; border: 1px solid rgba(127,29,29,0.25);
        }
        .current-mrn-row.rest { border-color: rgba(148,163,184,0.15); background: linear-gradient(135deg, rgba(148,163,184,0.15), rgba(51,65,85,0.12)); box-shadow: none; }
        .current-mrn-row .mrn-go { color: rgba(226,232,240,0.8); }

        /* Sparkle overlay animation */
        .current-mrn-row.active::after {
          content: "";
          position: absolute; inset: -20% -10% auto -10%; height: 140%;
          background: radial-gradient(12px 8px at 20% 30%, rgba(255,255,255,0.35), transparent 60%),
                      radial-gradient(10px 6px at 60% 20%, rgba(255,255,255,0.25), transparent 60%),
                      radial-gradient(8px 5px at 80% 60%, rgba(255,255,255,0.2), transparent 60%);
          animation: sweep 4.5s linear infinite;
          pointer-events: none;
        }
        .spark-icon { color: #fff; opacity: .9; filter: drop-shadow(0 0 6px rgba(255,255,255,.5)); animation: twinkle 1.8s ease-in-out infinite; }
        @keyframes sweep { 0%{ transform: translateX(-20%) translateY(-10%) rotate(8deg);} 100%{ transform: translateX(60%) translateY(-10%) rotate(8deg);} }
        @keyframes twinkle { 0%,100%{ transform: scale(1); opacity: .75;} 50%{ transform: scale(1.15); opacity: 1; } }

      `}</style>

      {showNavbar && (
        <nav className="text-white px-3 py-2 w-full sticky top-0 z-40 shadow-lg border-b border-cyan-900/40">
          <div className="flex items-center justify-between w-full px-2 sm:px-4 lg:px-6 min-w-0">
            {/* left: logo */}
            <div className="flex items-center gap-2 min-w-0">
              <img src="/flow1.png" alt="Logo" className="w-7 h-7 rounded-full border border-cyan-400 p-1" />
              <Link
                href="/"
                className={`text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent hover:from-cyan-300 hover:to-blue-300 transition truncate max-w-[40vw] sm:max-w-none ${
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

                  {/* Towards Greatness launcher */}
                  {/* to-greatness moved next to My Dashboard */}

                  <button onClick={handleAddMember} className="nav-button bg-teal-600 hover:bg-teal-700 text-white">Add Member</button>
                  <button onClick={handleManageMeedian} className="nav-button bg-blue-600 hover:bg-blue-700 text-white">Manage Meedian</button>
                  <Link href={performancePath} className={`nav-item ${isActive(performancePath) ? "active" : ""}`}>MyPerformance</Link>
                </>
              )}

              {role === "team_manager" && (
                <>
                  <Link href="/dashboard" className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}>General</Link>
                  <Link href="/dashboard/team_manager" className={`nav-item ${isActive("/dashboard/team_manager") ? "active" : ""}`}>My Dashboard</Link>
                  <button type="button" onClick={() => setIsExecuteOpen(true)} className={`nav-item relative ${isExecuteOpen ? "active" : ""}`} aria-haspopup="dialog" aria-expanded={isExecuteOpen} aria-label="Open to-greatness" title="to-greatness"><span className="mr-1">to-greatness</span><span className="inline-block align-middle animate-bounce">👀</span></button>
                  <button type="button" onClick={() => setIsMRISheetOpen(true)} className={`nav-item ${isMRISheetOpen ? "active" : ""}`}>MRIs</button>
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

                  {/* to-greatness moved next to My Dashboard */}
                </>
              )}

              {role === "member" && (
                <>
                  <Link href="/dashboard" className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}>General</Link>
                  <Link href="/dashboard/member" className={`nav-item ${isActive("/dashboard/member") ? "active" : ""}`}>My Dashboard</Link>
                  <button type="button" onClick={() => setIsExecuteOpen(true)} className={`nav-item relative ${isExecuteOpen ? "active" : ""}`} aria-haspopup="dialog" aria-expanded={isExecuteOpen} aria-label="Open to-greatness" title="to-greatness"><span className="mr-1">to-greatness</span><span className="inline-block align-middle animate-bounce">👀</span></button>
                  <button type="button" onClick={() => setIsMRISheetOpen(true)} className={`nav-item ${isMRISheetOpen ? "active" : ""}`}>MRIs</button>
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

                  {/* to-greatness moved next to My Dashboard */}
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
            <div className="flex items-center gap-2 flex-shrink-0">
              {(role === "admin" || role === "team_manager" || role === "member") && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(true)}
                    className={`user-info hidden md:flex ${isActive(profilePath) ? "active" : ""}`}
                    aria-haspopup="dialog"
                    aria-expanded={isProfileOpen}
                    aria-label="Open profile widgets"
                    title="My Account"
                  >
                    <img
                      src={userImage || "/default-avatar.png"}
                      alt="User Avatar"
                      onError={() => setUserImage("/default-avatar.png")}
                    />
                    <div className="user-info-text">
                      <span className="name">{userName || "Loading..."}</span>
                      <span className="account-label">My Account</span>
                    </div>
                  </button>
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
                  <button onClick={() => { setIsProfileOpen(true); toggleMobileMenu(); }} className={`mobile-user-info ${isActive(profilePath) ? "active" : ""}`}>
                    <img
                      src={userImage || "/default-avatar.png"}
                      alt="User Avatar"
                      onError={() => setUserImage("/default-avatar.png")}
                    />
                    <div className="mobile-user-info-text">
                      <span className="name">{userName || "Loading..."}</span>
                      <span className="account-label">My Account</span>
                    </div>
                  </button>
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
                        Towards Greatness
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
                    <button onClick={() => { setIsMRISheetOpen(true); toggleMobileMenu(); }} className={`mobile-menu-item ${isMRISheetOpen ? "active" : ""}`}>MRIs</button>
                      <Link href="/dashboard/member/closeMyDay" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}>CloseMyDay</Link>
                      <Link href={performancePath} onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive(performancePath) ? "active" : ""}`}>MyPerformance</Link>

                      <button onClick={() => { setIsManagerialOpen(true); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">
                        Managerial
                      </button>
                  <button onClick={() => { setIsExecuteOpen(true); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">
                    Towards Greatness
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
                    Towards Greatness
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

      {mounted && typeof window !== "undefined" && isProfileOpen && document?.body &&
        createPortal(<ProfileSheet />, document.body)}

      {mounted && typeof window !== "undefined" && isAboutMeedOpen && document?.body &&
        createPortal(
          <AboutMeedModal open={isAboutMeedOpen} onClose={() => setIsAboutMeedOpen(false)} />,
          document.body
        )}

      {mounted && typeof window !== "undefined" && isMRISheetOpen && document?.body &&
        createPortal(<MRISheet />, document.body)}

      {/* All Meedians directory modal */}
      {mounted && typeof window !== "undefined" && isAllMeediansOpen && document?.body &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[10040]" role="dialog" aria-modal="true" aria-label="All Meedians" onClick={() => { setIsAllMeediansOpen(false); setSelectedMeedian(null); }}>
            <div className="bg-slate-900/90 text-cyan-50 rounded-2xl border border-slate-500/40 shadow-2xl w-[92vw] max-w-5xl max-h-[86vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-500/30">
                <div>
                  <div className="text-cyan-300 font-semibold">All Meedians</div>
                  <div className="text-xs text-slate-300/80">Names, roles and WhatsApp (admins’ numbers hidden)</div>
                </div>
                <button className="nav-icon-button" aria-label="Close" onClick={() => { setIsAllMeediansOpen(false); setSelectedMeedian(null); }}>
                  <X size={18} />
                </button>
              </div>
              <div className="p-4">
                <input
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-slate-500/30 text-cyan-50 placeholder:text-slate-300/70 outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Search by name, role or number…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                {usersError && <div className="text-rose-300 text-sm mt-2">{usersError}</div>}
                {!selectedMeedian ? (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[64vh] overflow-y-auto pr-1">
                  {loadingAllUsers ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-slate-500/30 opacity-60">
                        <div className="w-9 h-9 rounded-full bg-slate-600/50" />
                        <div className="min-w-0">
                          <div className="font-semibold">Loading…</div>
                          <div className="text-xs text-slate-300/80">—</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    (allUsers || [])
                      .filter(u => {
                        const q = searchText.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          String(u.name||"").toLowerCase().includes(q) ||
                          String(u.role||"").toLowerCase().includes(q) ||
                          String(u.whatsapp_number||"").toLowerCase().includes(q)
                        );
                      })
                      .map((u) => {
                        const roleLabel = String(u.role||"").replaceAll("_"," ");
                        return (
                          <button key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-slate-500/30 hover:bg-white/10 text-left" onClick={() => setSelectedMeedian(u)}>
                            <img src={getValidImageUrl(u.image)} alt={u.name} className="w-9 h-9 rounded-full border border-cyan-700/40 object-cover" />
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{u.name || "—"}</div>
                              <div className="text-xs text-slate-300/80 truncate">{roleLabel || "—"}{u.team_manager_type ? ` · ${String(u.team_manager_type).replaceAll("_"," ")}` : ""}</div>
                            </div>
                          </button>
                        );
                      })
                  )}
                </div>
                ) : (
                  <div className="mt-3 max-h-[64vh] overflow-y-auto pr-1">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-slate-500/30">
                      <img src={getValidImageUrl(selectedMeedian.image)} alt={selectedMeedian.name} className="w-12 h-12 rounded-full border border-cyan-700/40 object-cover" />
                      <div className="min-w-0">
                        <div className="font-semibold text-lg">{selectedMeedian.name || "—"}</div>
                        <div className="text-sm text-slate-300/80">{String(selectedMeedian.role||"").replaceAll("_"," ")}{selectedMeedian.team_manager_type ? ` · ${String(selectedMeedian.team_manager_type).replaceAll("_"," ")}` : ""}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-white/5 border border-slate-500/30">
                        <div className="text-xs text-slate-300/80">WhatsApp</div>
                        <div className="text-sm">{String(selectedMeedian.role) === "admin" ? "Hidden" : (selectedMeedian.whatsapp_number || "—")}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-slate-500/30">
                        <div className="text-xs text-slate-300/80">Account Type</div>
                        <div className="text-sm">{selectedMeedian.type || "—"}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-slate-500/30">
                        <div className="text-xs text-slate-300/80">Member Scope</div>
                        <div className="text-sm">{selectedMeedian.member_scope ? String(selectedMeedian.member_scope).replaceAll("_"," ") : "—"}</div>
                      </div>
                      {selectedMeedian.immediate_supervisor ? (
                        <div className="p-3 rounded-xl bg-white/5 border border-slate-500/30">
                          <div className="text-xs text-slate-300/80">Immediate Supervisor</div>
                          <div className="text-sm">ID #{selectedMeedian.immediate_supervisor}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t border-slate-500/30 flex justify-between">
                {selectedMeedian ? (
                  <button className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm" onClick={() => setSelectedMeedian(null)}>Back</button>
                ) : <span />}
                <button className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm" onClick={() => { setIsAllMeediansOpen(false); setSelectedMeedian(null); }}>Close</button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <MeRightNow
        open={isMeNowOpen}
        onClose={() => setIsMeNowOpen(false)}
        onOpenTogether={openTogetherWorkspace}
      />
    </>
  );
}
