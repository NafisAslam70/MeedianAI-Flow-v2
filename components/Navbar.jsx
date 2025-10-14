"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Instagram } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Menu,
  X,
  Bell,
  BellDot,
  Users,
  Sparkles,
  Mountain,
  ClipboardList,
  ClipboardCheck,
  ShieldCheck,
  AlertTriangle,
  DoorOpen,
  CalendarCheck2,
  CalendarX2,
  Calendar,
  Clock,
  Boxes,
  ArrowRight,
  User,
  BarChart2,
  MessageSquare,
  Send,
  HelpCircle,
  Brain,
  Scan
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
  // role is needed by effects above the helpers section; define it early
  const role = session?.user?.role || "user";

  const { data: managerControls, isLoading: managerControlsLoading } = useSWR(
    role === "team_manager" ? "/api/admin/manageMeedian?section=controlsShareSelf" : null,
    (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json()),
    { dedupingInterval: 60000 }
  );
  const hasAdminClubGrant = useMemo(() => {
    if (role !== "team_manager") return false;
    const grants = managerControls?.grants || [];
    return grants.some((g) => g.section === "adminClub" && g.canWrite !== false);
  }, [role, managerControls]);

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
  // Tooltip control for execute launcher (in case :hover isn't reliable)
  const [showExecTooltip, setShowExecTooltip] = useState(false);
  const [suppressExecTooltip, setSuppressExecTooltip] = useState(false);
  // NEW: Managerial side-sheet
  const [isManagerialOpen, setIsManagerialOpen] = useState(false);
  // NEW: Profile side-sheet (widgets)
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // NEW: MRIs side-sheet
  const [isMRISheetOpen, setIsMRISheetOpen] = useState(false);
  const [isAboutMeedOpen, setIsAboutMeedOpen] = useState(false);
  // Notifications
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
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
  
  // Walkthrough state
  const [showExecWalkthrough, setShowExecWalkthrough] = useState(false);
  const [execStep, setExecStep] = useState(0);
  const [showFullWalkthrough, setShowFullWalkthrough] = useState(false);
  const [fullStep, setFullStep] = useState(0);

  const showAdminClubButton = role === "admin" || role === "team_manager";
  const adminClubDisabled = role === "team_manager" && (!hasAdminClubGrant || managerControlsLoading);

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

  // notifications polling
  useEffect(() => {
    if (status !== "authenticated") return;
    let stop = false;
    const fetchNotifs = async () => {
      try {
        const [unreadRes, allRes] = await Promise.all([
          fetch("/api/member/notifications?unread=1&limit=1", { cache: "no-store" }),
          isNotifOpen ? fetch("/api/member/notifications?limit=20", { cache: "no-store" }) : Promise.resolve(null),
        ]);
        if (!stop) {
          if (unreadRes?.ok) {
            const j = await unreadRes.json();
            setNotifUnread((j.notifications || []).length);
          }
          if (isNotifOpen && allRes?.ok) {
            const j2 = await allRes.json();
            setNotifItems(j2.notifications || []);
          }
        }
      } catch {}
    };
    fetchNotifs();
    const id = window.setInterval(fetchNotifs, 12000);
    return () => { stop = true; window.clearInterval(id); };
  }, [status, isNotifOpen]);

  // Day Close waiting: block navbar if compulsory + pending
  const { data: dayClose, error: dcErr } = useSWR(
    status === "authenticated" ? "/api/member/dayClose/dayCloseStatus" : null,
    (u) => fetch(u, { cache: "no-store" }).then((r) => r.json())
  );
  const isPendingDayClose = String(dayClose?.status || '').toLowerCase() === 'pending';
  const navBlocked = !!(dayClose?.dayCloseWaitCompulsory && isPendingDayClose);
  const fullScreenBlock = !!(navBlocked && dayClose?.dayCloseWaitFullscreen);

  // Warn before closing tab when full-screen block is active
  useEffect(() => {
    if (!fullScreenBlock) {
      window.onbeforeunload = null;
      return;
    }
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.onbeforeunload = null;
    };
  }, [fullScreenBlock]);

  // Hover/interaction tooltip for both levels while blocked
  const [tip, setTip] = useState({ visible: false, x: 0, y: 0 });
  const tipText = "Waiting for Day Close approval…";
  const showTip = (e) => setTip({ visible: true, x: e.clientX || 0, y: e.clientY || 0 });
  const moveTip = (e) => setTip((t) => (t.visible ? { ...t, x: e.clientX || t.x, y: e.clientY || t.y } : t));
  const hideTip = () => setTip((t) => ({ ...t, visible: false }));

  

  // close overlays on route change
  useEffect(() => {
    setIsExecuteOpen(false);
    setIsManagerialOpen(false);
  }, [pathname]);

  // keyboard shortcuts (keep BEFORE any returns for stable hook order)
  useEffect(() => {
    const handler = (e) => {
      // Removed Ctrl/Cmd shortcuts to avoid interfering with copy/paste
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
        setShowExecWalkthrough(false);
        setShowFullWalkthrough(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isExecuteOpen, role]);

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

  // Deep-link Execute modal: open when URL contains ?execute=1, then clean URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('execute') === '1') {
        setIsExecuteOpen(true);
        url.searchParams.delete('execute');
        const newUrl = url.pathname + (url.search ? url.search : '') + url.hash;
        window.history.replaceState(null, '', newUrl);
      }
    } catch {}
  }, []);

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

  // Allow other components to open Execute via a custom event
  useEffect(() => {
    const handler = () => setIsExecuteOpen(true);
    window.addEventListener('open-execute', handler);
    return () => window.removeEventListener('open-execute', handler);
  }, []);

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
  // role defined earlier for use in effects
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
  const handleAdminClubClick = () => {
    setIsManagerialOpen(false);
    if (role === "team_manager") {
      if (managerControlsLoading) {
        window.alert("Checking your access… please try again in a moment.");
        return;
      }
      if (!hasAdminClubGrant) {
        window.alert("You are not allowed for this");
        return;
      }
    }
    router.push("/dashboard/admin/admin-club");
  };
  const handleLogout = async () => {
    setIsLogoutModalOpen(false);
    await signOut({ redirect: false });
    router.push("/");
  };
  const openMeRightNow = () => setIsMeNowOpen(true);
  const startExecWalkthrough = () => { setShowExecWalkthrough(true); setExecStep(0); };
  const closeExecWalkthrough = () => setShowExecWalkthrough(false);
  const nextExecStep = () => setExecStep((s) => Math.min(2, s + 1));
  const prevExecStep = () => setExecStep((s) => Math.max(0, s - 1));
  const startFullWalkthrough = () => { setShowFullWalkthrough(true); setFullStep(0); };
  const closeFullWalkthrough = () => setShowFullWalkthrough(false);
  const nextFullStep = () => setFullStep((s) => Math.min(2, s + 1));
  const prevFullStep = () => setFullStep((s) => Math.max(0, s - 1));

  // Execute launcher (icon-only with animated climber + hover tooltip)
  const hideExecTooltipQuick = () => {
    setShowExecTooltip(false);
    setSuppressExecTooltip(true);
    setTimeout(() => setSuppressExecTooltip(false), 250);
  };

  const handleExecuteOpen = () => {
    setIsExecuteOpen(true);
    hideExecTooltipQuick();
  };

  const handleStartWalkthrough = () => {
    startExecWalkthrough();
    hideExecTooltipQuick();
  };

  const handleEnterMRN = () => {
    openMeRightNow();
    hideExecTooltipQuick();
  };

  const ExecuteLauncher = () => (
    <div
      className={`execute-wrap ${showExecTooltip ? "open" : ""} ${suppressExecTooltip ? "hide-tooltip" : ""}`}
      onMouseEnter={() => setShowExecTooltip(true)}
      onMouseLeave={() => setShowExecTooltip(false)}
      onFocus={() => setShowExecTooltip(true)}
      onBlur={() => setShowExecTooltip(false)}
    >
      <button
        type="button"
        onClick={handleExecuteOpen}
        className={`execute-launcher ${isExecuteOpen ? "active" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={isExecuteOpen}
        aria-label="Open execution actions"
        title="Execute"
      >
        <span className="spark"><Sparkles size={12} /></span>
        <span className="climb">
          <Mountain size={18} />
          <span className="climber" aria-hidden>🧗</span>
        </span>
        <span className="dot" aria-hidden />
      </button>
      <div className="execute-tooltip" role="tooltip">
        <div className="tooltip-title">Towards Greatness</div>
        <div className="tooltip-sub">Ritual over result. Begin with sincerity.</div>
        <ol className="tooltip-steps">
          <li>Ensure your day is opened</li>
          <li>Choose your MRI type</li>
          <li>
            If O‑MRI or N‑MRI: enter MRN and join MeedTogether if internet is fine. If A‑MRI: enter MRN and perform your ritual with students.
          </li>
        </ol>
        <div className="tooltip-actions">
          <button className="tooltip-btn" onClick={handleStartWalkthrough}>
            <HelpCircle size={14} />
            <span>Start Walkthrough</span>
          </button>
          <button className="tooltip-btn" onClick={handleEnterMRN}>
            <Mountain size={14} />
            <span>Enter MRN</span>
          </button>
        </div>
      </div>
      {/* Walkthrough moved to global portal below */}
    </div>
  );

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
          {(() => {
            // fetch escalation counts only when open
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { data } = useSWR(isManagerialOpen ? "/api/managersCommon/escalations?section=counts" : null, (u)=>fetch(u).then(r=>r.json()));
            const openCount = role === 'admin' ? (data?.openTotalCount ?? 0) : (data?.forYouCount ?? 0);
            return (
              <button
                className="action-row"
                onClick={() => { setIsManagerialOpen(false); router.push("/dashboard/managersCommon/escalations"); }}
              >
                <span className="row-icon"><AlertTriangle size={18} /></span>
                <span className="row-main">
                  <span className="row-title">Escalations</span>
                  <span className="row-sub">Raise, act, and review matters</span>
                </span>
                <span className="ml-2 inline-flex min-w-[20px] justify-center rounded-full bg-teal-600 text-white text-[11px] px-2 py-0.5">
                  {openCount}
                </span>
                <ArrowRight size={16} className="row-go" />
              </button>
            );
          })()}

          {(() => {
            // Support Tickets counts (open = not resolved/closed)
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { data: t } = useSWR(isManagerialOpen ? "/api/managersCommon/tickets?view=queue" : null, (u)=>fetch(u).then(r=>r.json()));
            const status = t?.statusSummary || {};
            const openTickets = Object.entries(status).reduce((acc,[k,v]) => acc + ((k!=="resolved" && k!=="closed") ? v : 0), 0);
            return (
              <button
                className="action-row"
                onClick={() => { setIsManagerialOpen(false); router.push("/dashboard/managersCommon/tickets"); }}
              >
                <span className="row-icon"><MessageSquare size={18} /></span>
                <span className="row-main">
                  <span className="row-title">Support Tickets</span>
                  <span className="row-sub">Open and pending tickets</span>
                </span>
                <span className="ml-2 inline-flex min-w-[20px] justify-center rounded-full bg-indigo-600 text-white text-[11px] px-2 py-0.5">
                  {openTickets || 0}
                </span>
                <ArrowRight size={16} className="row-go" />
              </button>
            );
          })()}

          {/* Club access moved to bottom */}

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

          {(() => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { data: dc } = useSWR(isManagerialOpen ? "/api/managersCommon/dayCloseRequests?section=counts" : null, (u)=>fetch(u).then(r=>r.json()));
            const dcCount = dc?.pendingCount ?? 0;
            return (
              <button
                className="action-row"
                onClick={() => { setIsManagerialOpen(false); router.push("/dashboard/managersCommon/approveCloseDay"); }}
              >
                <span className="row-icon"><CalendarCheck2 size={18} /></span>
                <span className="row-main">
                  <span className="row-title">Day Close Request</span>
                  <span className="row-sub">Review and approve day closures</span>
                </span>
                <span className="ml-2 inline-flex min-w-[20px] justify-center rounded-full bg-indigo-600 text-white text-[11px] px-2 py-0.5">
                  {dcCount}
                </span>
                <ArrowRight size={16} className="row-go" />
              </button>
            );
          })()}

          {(() => {
            // Leave Requests count (pending)
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { data: lr } = useSWR(isManagerialOpen ? "/api/managersCommon/approve-leave-request" : null, (u)=>fetch(u).then(r=>r.json()));
            const pendingLeaves = (lr?.requests || []).filter(r => (r.status || '').toLowerCase() === 'pending').length;
            return (
              <button
                className="action-row"
                onClick={() => { setIsManagerialOpen(false); router.push("/dashboard/managersCommon/approveLeave"); }}
              >
                <span className="row-icon"><CalendarX2 size={18} /></span>
                <span className="row-main">
                  <span className="row-title">Leave Requests</span>
                  <span className="row-sub">Pending approvals</span>
                </span>
                <span className="ml-2 inline-flex min-w-[20px] justify-center rounded-full bg-amber-600 text-white text-[11px] px-2 py-0.5">
                  {pendingLeaves}
                </span>
                <ArrowRight size={16} className="row-go" />
              </button>
            );
          })()}

          <button
            className="action-row"
            onClick={() => { setIsManagerialOpen(false); router.push("/dashboard/managersCommon/attendance-report"); }}
          >
            <span className="row-icon"><ClipboardCheck size={18} /></span>
            <span className="row-main">
              <span className="row-title">Daily Attendance Report</span>
              <span className="row-sub">View and export present/absent lists</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          {(role === 'team_manager' || role === 'admin') && (
            <>
              <div className="my-2 border-t border-slate-700/40" />
              <div className={`club-duo${showAdminClubButton ? '' : ' club-duo--single'}`}>
                <button
                  className="club-duo-btn"
                  onClick={() => { setIsManagerialOpen(false); router.push("/dashboard/managersCommon/managerial-club"); }}
                >
                  <span className="club-duo-icon"><ClipboardList size={20} /></span>
                  <span className="club-duo-main">
                    <span className="club-duo-title">Managerial Club</span>
                    <span className="club-duo-sub">PT & routine operations</span>
                  </span>
                  <ArrowRight size={16} className="club-duo-go" />
                </button>
                {showAdminClubButton && (
                  <button
                    className={`club-duo-btn club-duo-btn--admin ${adminClubDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                    onClick={handleAdminClubClick}
                    aria-disabled={adminClubDisabled}
                  >
                    <span className="club-duo-icon"><ShieldCheck size={20} /></span>
                    <span className="club-duo-main">
                      <span className="club-duo-title">Admin Club</span>
                      <span className="club-duo-sub">
                        {role === 'team_manager' && !hasAdminClubGrant ? 'Request leadership access' : 'Leadership daily reviews'}
                      </span>
                    </span>
                    <ArrowRight size={16} className="club-duo-go" />
                  </button>
                )}
              </div>
              <button
                className="action-row mt-2"
                onClick={() => { setIsManagerialOpen(false); router.push("/dashboard/admin/manageMeedian"); }}
              >
                <span className="row-icon"><Boxes size={18} /></span>
                <span className="row-main">
                  <span className="row-title">Manage Meedian</span>
                  <span className="row-sub">Open Admin sidebar (access-controlled)</span>
                </span>
                <ArrowRight size={16} className="row-go" />
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );

  // NEW: Profile Widgets Side Sheet (same visual language as Managerial)
  const ProfileSheet = () => (
    <div className={`sheet-overlay ${isProfileOpen ? "open" : ""}`} aria-hidden={!isProfileOpen} onClick={() => setIsProfileOpen(false)}>
      <aside className={`sheet-panel ${isProfileOpen ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="Profile Widgets" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header sticky top-0 z-[2] bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-900/80">
          <h3 className="sheet-title">My Widgets</h3>
          <button className="nav-icon-button" aria-label="Close" onClick={() => setIsProfileOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="sheet-content overflow-y-auto max-h-[calc(100vh-56px)]">
          {/* Current MRN quick status (distinct design) */}
          <button
            className={`current-mrn-row ${currentMRN ? "active" : "rest"} sm:py-3 sm:px-3 py-2 px-2`}
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

          {/* Open Day quick action */}
          <button
            className="action-row sm:py-3 sm:px-3 py-2 px-2"
            onClick={() => { setIsProfileOpen(false); router.push("/dashboard/member#open-day"); }}
          >
            <span className="row-icon"><Clock size={18} /></span>
            <span className="row-main">
              <span className="row-title text-sm sm:text-base">Open Your Day</span>
              <span className="row-sub text-[11px] sm:text-xs">Scan moderator’s session or share your code</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <button
            className="action-row sm:py-3 sm:px-3 py-2 px-2"
            onClick={() => { setIsProfileOpen(false); router.push("/dashboard/member/myMeedRituals?takeAttendance=1"); }}
          >
            <span className="row-icon"><Scan size={18} /></span>
            <span className="row-main">
              <span className="row-title text-sm sm:text-base">Take Attendance</span>
              <span className="row-sub text-[11px] sm:text-xs">Launch the scanner for your assigned program</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <button
            className="action-row sm:py-3 sm:px-3 py-2 px-2"
            onClick={() => { setIsProfileOpen(false); router.push("/dashboard/member/gate"); }}
          >
            <span className="row-icon"><DoorOpen size={18} /></span>
            <span className="row-main">
              <span className="row-title text-sm sm:text-base">Campus In / Out</span>
              <span className="row-sub text-[11px] sm:text-xs">Choose to log exit or confirm your return</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <button
            className="action-row sm:py-3 sm:px-3 py-2 px-2"
            onClick={() => { setIsProfileOpen(false); router.push(profilePath); }}
          >
            <span className="row-icon"><User size={18} /></span>
            <span className="row-main">
              <span className="row-title text-sm sm:text-base">Profile Settings</span>
              <span className="row-sub text-[11px] sm:text-xs">Update your info and preferences</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <button
            className="action-row sm:py-3 sm:px-3 py-2 px-2"
            onClick={() => { setIsProfileOpen(false); router.push(performancePath); }}
          >
            <span className="row-icon"><BarChart2 size={18} /></span>
            <span className="row-main">
              <span className="row-title text-sm sm:text-base">My Performance</span>
              <span className="row-sub text-[11px] sm:text-xs">See your metrics and progress</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <button
            className="action-row sm:py-3 sm:px-3 py-2 px-2"
            onClick={() => { setIsProfileOpen(false); router.push(`${profilePath}?open=leave`); }}
          >
            <span className="row-icon"><CalendarCheck2 size={18} /></span>
            <span className="row-main">
              <span className="row-title text-sm sm:text-base">Leave Request</span>
              <span className="row-sub text-[11px] sm:text-xs">Submit leave for approval</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          <button
            className="action-row sm:py-3 sm:px-3 py-2 px-2"
            onClick={() => { setIsProfileOpen(false); router.push("/dashboard/member/tickets"); }}
          >
            <span className="row-icon"><HelpCircle size={18} /></span>
            <span className="row-main">
              <span className="row-title text-sm sm:text-base">Raise a Ticket</span>
              <span className="row-sub text-[11px] sm:text-xs">Report an issue or request support</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

            <button
              className="action-row sm:py-3 sm:px-3 py-2 px-2"
              onClick={() => { setIsProfileOpen(false); router.push(`${profilePath}?open=talk`); }}
            >
            <span className="row-icon"><MessageSquare size={18} /></span>
            <span className="row-main">
              <span className="row-title">Talk to Superintendent</span>
              <span className="row-sub">Start a direct chat</span>
            </span>
            <ArrowRight size={16} className="row-go" />
          </button>

          {(role === "admin" || role === "team_manager") && (
            <button
              className="action-row sm:py-3 sm:px-3 py-2 px-2"
              onClick={() => { setIsProfileOpen(false); router.push(`${profilePath}?open=direct`); }}
            >
              <span className="row-icon"><Send size={18} /></span>
              <span className="row-main">
                <span className="row-title">Send Direct Message</span>
                <span className="row-sub">Compose a WhatsApp message</span>
              </span>
              <ArrowRight size={16} className="row-go" />
            </button>
          )}

          {(role === "admin" || role === "team_manager") && (
            <button
              className="action-row sm:py-3 sm:px-3 py-2 px-2"
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
          {/* App Walkthrough quick actions (also visible in MRIs side sheet) */}
          <div className="rounded-xl border border-cyan-900/40 bg-white/5 p-3">
            <div className="text-sm font-semibold text-cyan-200 mb-2">App Walkthrough</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button className="action-row" onClick={() => { setIsMRISheetOpen(false); startExecWalkthrough(); }}>
                <span className="row-icon"><Mountain size={18} /></span>
                <span className="row-main">
                  <span className="row-title">MRI Execution Walkthrough</span>
                  <span className="row-sub">Step-by-step guidance to execute</span>
                </span>
                <ArrowRight size={16} className="row-go" />
              </button>
              <button className="action-row" onClick={() => { setIsMRISheetOpen(false); startFullWalkthrough(); }}>
                <span className="row-icon"><HelpCircle size={18} /></span>
                <span className="row-main">
                  <span className="row-title">Full App Walkthrough</span>
                  <span className="row-sub">Tour the main features</span>
                </span>
                <ArrowRight size={16} className="row-go" />
              </button>
            </div>
          </div>

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
        /* Notifications panel */
        .notif-panel { position: absolute; right: 0; top: calc(100% + 10px); width: 320px; background: #0b1220; border: 1px solid rgba(34,211,238,0.25); border-radius: 12px; box-shadow: 0 12px 30px rgba(0,0,0,0.5); padding: 8px; z-index: 10010; }
        .notif-item { display: grid; grid-template-columns: auto 1fr; gap: 8px; padding: 8px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(148,163,184,0.12); }
        .notif-item.unread { background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.25); }
        .notif-title { font-weight: 700; color: #bff7ff; font-size: 0.9rem; }
        .notif-body { font-size: 0.82rem; color: #cfefff; }
        .notif-time { font-size: 0.72rem; color: #9fb6c6; }
        .notif-dot { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 9999px; background: #ef4444; box-shadow: 0 0 10px #ef4444; }

        /* Playful sparkle highlight for Community (non‑formal) */
        .community-sparkle { position: relative; }
        .community-sparkle::after {
          content: '';
          position: absolute;
          inset: -6px;
          border-radius: 9999px;
          pointer-events: none;
          box-shadow: 0 0 14px rgba(244,114,182,0.18), 0 0 22px rgba(34,211,238,0.16);
          animation: shimmerRing 2.8s linear infinite;
        }
        .community-sparkle .sparkle-emoji {
          position: absolute;
          top: -4px; right: -4px;
          font-size: 12px;
          filter: drop-shadow(0 0 6px rgba(255,255,255,0.6));
          animation: bounceSpark 2s ease-in-out infinite;
        }
        @keyframes bounceSpark { 0%,100%{ transform: translateY(0); opacity: .9; } 50%{ transform: translateY(-3px); opacity: 1; } }
        @keyframes shimmerRing {
          0%   { box-shadow: 0 0 10px rgba(34,211,238,0.12), 0 0 18px rgba(244,114,182,0.10); }
          50%  { box-shadow: 0 0 20px rgba(244,114,182,0.22), 0 0 30px rgba(34,211,238,0.18); }
          100% { box-shadow: 0 0 10px rgba(34,211,238,0.12), 0 0 18px rgba(244,114,182,0.10); }
        }

        .user-info {
          position: relative;
          /* flex applied via Tailwind (md:flex); do not force display here so 'hidden' works on mobile */
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.8rem;
          border-radius: 10px;
          border: 2px solid #4b5563;
          background: #1f2937;
          box-shadow: 0 3px 10px rgba(0,0,0,0.2);
          transition: all .25s ease;
        }
        .notif-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          background: #ef4444;
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          border-radius: 9999px;
          padding: 0 6px;
          line-height: 16px;
          min-width: 16px;
          text-align: center;
          border: 1px solid rgba(11,18,32,0.9);
          box-shadow: 0 0 0 2px rgba(11,18,32,0.4);
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

        /* Force dark navbar background (toggle can be reintroduced later) */
        nav { background: linear-gradient(90deg, #0b1220, #111827 30%, #1f2937 70%, #0b1220) !important; }
        .brand-text { background: linear-gradient(90deg,#67e8f9,#60a5fa); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .brand-text.glow { text-shadow: 0 0 8px rgba(34,211,238,0.6); }
        .beta-badge { font-size: 10px; font-weight: 900; color: #0b1220; background: linear-gradient(90deg,#fef08a,#fca5a5); padding: 2px 6px; border-radius: 999px; margin-left: 6px; }
        @media (max-width: 640px) {
          .beta-badge { font-size: 9px; padding: 1px 5px; }
        }
        .slogan {
          font-size: 11px;
          color: #c7f9ff;
          opacity: .95;
          letter-spacing: .2px;
          text-shadow: 0 0 6px rgba(34,211,238,.35);
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
          align-self: flex-start; /* start directly under the brand text (below 'M') */
          margin-top: 2px;
          padding: 2px 8px;
          border-radius: 9999px;
          border: 1px solid rgba(34,211,238,.25);
          background:
            linear-gradient(180deg, rgba(34,211,238,.20), rgba(59,130,246,.14));
          box-shadow: 0 6px 14px rgba(34,211,238,.18);
          backdrop-filter: blur(2px);
        }
        @media (max-width: 768px) {
          .slogan { font-size: 10px; padding: 1px 6px; gap: 3px; }
          .slogan-brain svg { width: 12px; height: 12px; }
        }
        .slogan-brain { display: inline-flex; align-items: center; justify-content: center; color: #facc15; /* amber */ margin-left: 2px; position: relative; top: .5px; filter: drop-shadow(0 0 6px rgba(250,204,21,.5)); animation: brainPulse 2.4s ease-in-out infinite; }
        .slogan-brain svg { display: block; width: 14px; height: 14px; }
        @keyframes brainPulse {
          0%, 100% { transform: translateY(0) scale(1); opacity: .85; }
          50% { transform: translateY(-1px) scale(1.12); opacity: 1; }
        }

        /* ====== Brand Sparkle (logo + text) ====== */
        .brand-wrap { position: relative; }
        .brand-wrap .brand-sweep {
          position: absolute; inset: -20% auto -20% -30%; width: 60px;
          background: linear-gradient(75deg, rgba(255,255,255,0), rgba(255,255,255,0.45), rgba(255,255,255,0));
          filter: blur(6px);
          transform: skewX(-10deg);
          pointer-events: none;
          animation: brandSweep 3.2s linear infinite;
        }
        @keyframes brandSweep { 0% { left: -30%; } 100% { left: 120%; } }
        .brand-wrap .brand-star {
          position: absolute; width: 6px; height: 6px; border-radius: 9999px; pointer-events: none;
          background: radial-gradient(circle at 50% 50%, #fff 0 35%, rgba(255,255,255,0) 70%);
          filter: drop-shadow(0 0 6px rgba(255,255,255,0.8));
          animation: twinkleBrand 1.8s ease-in-out infinite;
        }
        .brand-wrap .brand-star.star1 { top: -4px; left: 32%; animation-delay: .15s; }
        .brand-wrap .brand-star.star2 { top: 60%; left: 88%; animation-delay: .6s; }
        .brand-wrap .brand-star.star3 { top: 90%; left: 8%; animation-delay: 1.05s; }
        @keyframes twinkleBrand {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        /* Highlight MRIs */
        .mris-highlight {
          color: #fef3c7;
          border: 1px solid rgba(250,204,21,0.35);
          background: linear-gradient(180deg, rgba(250,204,21,0.18), rgba(250,204,21,0.08));
          box-shadow: 0 0 12px rgba(250,204,21,0.24);
        }
        .mris-highlight:hover {
          filter: brightness(1.1);
          box-shadow: 0 0 16px rgba(250,204,21,0.35);
        }

        /* ====== Execute launcher (small + creative) ====== */
        .execute-wrap { position: relative; display: inline-block; }
        .execute-launcher {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          padding: 0.35rem;
          border-radius: 9999px;
          border: 1px solid rgba(239,68,68,0.6);
          background:
            radial-gradient(140px 70px at 20% 10%, rgba(239,68,68,0.18), rgba(0,0,0,0))
            ,linear-gradient(180deg, #0b1220, #111827);
          color: #ffe9ec;
          transition: all .2s ease;
          box-shadow: inset 0 0 0 1px rgba(239,68,68,0.25), 0 0 0 0 rgba(239,68,68,0.35);
        }
        .execute-launcher:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(239,68,68,0.25);
          color: #ffd6db;
        }
        .execute-launcher .climb {
          position: relative;
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px;
          border-radius: 9999px;
          background: rgba(239,68,68,0.10);
          border: 1px solid rgba(239,68,68,0.45);
          overflow: hidden;
        }
        .execute-launcher .climber {
          position: absolute;
          right: 2px; bottom: 0px;
          font-size: 12px;
          transform: translateY(1px);
          animation: climb 2.8s ease-in-out infinite;
          filter: drop-shadow(0 0 6px rgba(255,255,255,0.7));
        }
        @keyframes climb {
          0% { transform: translate(2px, 6px) scale(1); opacity: .9; }
          50% { transform: translate(-6px, -4px) scale(1.05); opacity: 1; }
          100% { transform: translate(2px, 6px) scale(1); opacity: .9; }
        }
        .execute-launcher .spark {
          display: inline-flex;
          padding: 4px;
          border-radius: 9999px;
          border: 1px solid rgba(244,114,182,0.45);
          background: rgba(244,114,182,0.12);
          animation: pulseGlow 2.2s ease-in-out infinite;
        }
        .execute-launcher .dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 10px #ef4444, 0 0 22px rgba(239,68,68,0.65);
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
        /* Hover tooltip for execution guidance */
        .execute-tooltip {
          position: absolute;
          top: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%) translateY(-6px);
          width: max(260px, 36ch);
          background: #0f172a;
          border: 1px solid rgba(34,211,238,0.25);
          box-shadow: 0 12px 30px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.02);
          border-radius: 12px;
          padding: 10px 12px;
          color: #e2f5ff;
          opacity: 0; pointer-events: none;
          transition: opacity .12s ease, transform .12s ease;
          z-index: 10021;
        }
        /* Actively suppress tooltip even if hover is true */
        .execute-wrap.hide-tooltip .execute-tooltip {
          opacity: 0 !important;
          pointer-events: none !important;
          transform: translateX(-50%) translateY(-6px) !important;
        }
        .execute-wrap:hover .execute-tooltip,
        .execute-wrap.open .execute-tooltip,
        .execute-launcher:focus + .execute-tooltip {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
          pointer-events: auto;
        }
        .execute-tooltip::after {
          content: '';
          position: absolute;
          bottom: 100%; left: 50%; transform: translateX(-50%) rotate(45deg);
          width: 12px; height: 12px;
          background: #0f172a;
          border-left: 1px solid rgba(34,211,238,0.25);
          border-bottom: 1px solid rgba(34,211,238,0.25);
          transform-origin: center;
        }
        /* Formal accent for Execute Now (crisp, neutral) */
        .formal-label {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 2px 10px; border-radius: 9999px;
          border: 1px solid rgba(148,163,184,0.35);
          background: rgba(255,255,255,0.04);
          font-weight: 800; letter-spacing: .2px;
        }
        .formal-accent {
          display: inline-block; width: 6px; height: 6px; border-radius: 9999px;
          background: linear-gradient(180deg, #22d3ee, #3b82f6);
          box-shadow: 0 0 0 4px rgba(34,211,238,0.12);
        }
        .tooltip-title { font-weight: 800; font-size: 0.95rem; color: #bff7ff; }
        .tooltip-sub { font-size: 0.8rem; color: #b1c8d6; margin-top: 2px; margin-bottom: 6px; }
        .tooltip-steps { margin: 0; padding-left: 1.15rem; font-size: 0.82rem; color: #d9f4ff; display: grid; gap: 4px; }
        .tooltip-steps li::marker { color: #22d3ee; font-weight: 700; }
        .tooltip-actions { display: flex; justify-content: flex-end; margin-top: 8px; gap: 8px; }
        .tooltip-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 8px; background: rgba(6,182,212,0.12); border: 1px solid rgba(6,182,212,0.3); color: #c7f9ff; font-weight: 700; font-size: 12px; }
        .tooltip-btn:hover { background: rgba(6,182,212,0.18); }

        /* Walkthrough modal */
        .walkthrough-overlay { position: fixed; inset: 0; background: rgba(2,8,20,0.65); backdrop-filter: blur(2px); z-index: 10030; display: grid; place-items: center; }
        .walkthrough { position: relative; width: min(460px, 92vw); background: #0b1220; border: 1px solid rgba(239,68,68,0.35); border-radius: 12px; box-shadow: 0 16px 36px rgba(0,0,0,0.6); }
        .walkthrough-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid rgba(148,163,184,0.1); }
        .walkthrough-title { font-weight: 800; color: #ffd6db; }
        .walkthrough-close { display: inline-flex; align-items: center; justify-content: center; padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); }
        .walkthrough-close:hover { background: rgba(255,255,255,0.06); }
        .walkthrough-body { padding: 10px 12px; display: grid; gap: 8px; color: #f3f4f6; }
        .w-step-title { font-weight: 800; color: #ffe9ec; }
        .w-step-text { font-size: 0.9rem; color: #d9e6ff; }
        .w-step-actions { display: flex; gap: 8px; margin-top: 6px; }
        .w-btn { padding: 6px 10px; border-radius: 10px; background: rgba(34,197,94,0.12); color: #d1fae5; border: 1px solid rgba(34,197,94,0.35); font-weight: 700; font-size: 12px; }
        .w-btn:hover { background: rgba(34,197,94,0.18); }
        .w-btn.alt { background: rgba(59,130,246,0.12); color: #dbeafe; border: 1px solid rgba(59,130,246,0.35); }
        .w-btn.alt:hover { background: rgba(59,130,246,0.18); }
        .walkthrough-controls { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-top: 1px solid rgba(148,163,184,0.1); }
        .w-ctrl { padding: 6px 12px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #f3f4f6; font-weight: 700; font-size: 12px; }
        .w-ctrl[disabled] { opacity: 0.5; cursor: not-allowed; }
        .w-ctrl.primary { background: linear-gradient(180deg, rgba(239,68,68,0.25), rgba(239,68,68,0.18)); border-color: rgba(239,68,68,0.45); color: #ffe9ec; }

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
        .sheet-club {
          display: grid;
          gap: 8px;
          padding: 10px;
          border-radius: 14px;
          border: 1px solid rgba(191, 247, 255, 0.1);
          background: linear-gradient(180deg, rgba(15,33,48,0.85), rgba(11,22,34,0.92));
        }
        .sheet-club-header {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sheet-club-title {
          font-size: 0.82rem;
          font-weight: 600;
          color: #c2f9ff;
          letter-spacing: 0.01em;
        }
        .sheet-club-sub {
          font-size: 0.7rem;
          color: rgba(226, 248, 255, 0.55);
        }
        .sheet-club-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        }
        .club-tile {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 12px;
          border-radius: 14px;
          border: 1px solid rgba(191, 247, 255, 0.15);
          background: linear-gradient(180deg, rgba(10,25,39,0.92), rgba(8,19,30,0.88));
          color: #e8fdff;
          text-align: center;
          transition: transform .12s ease, border-color .12s ease, background .12s ease;
        }
        .club-tile:hover {
          transform: translateY(-1px);
          border-color: rgba(191, 247, 255, 0.4);
          background: linear-gradient(180deg, rgba(16,37,54,0.96), rgba(10,24,36,0.94));
        }
        .club-tile:active {
          transform: translateY(0);
        }
        .club-icon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(191, 247, 255, 0.12);
          border: 1px solid rgba(191, 247, 255, 0.2);
          color: #c8f9ff;
        }
        .club-label {
          font-size: 0.72rem;
          font-weight: 600;
          line-height: 1.1;
          color: rgba(232, 253, 255, 0.92);
        }
        .club-duo {
          display: flex;
          width: 100%;
          gap: 12px;
          margin: 12px 0 4px;
        }
        .club-duo--single { justify-content: flex-start; }
        .club-duo-btn {
          flex: 1 1 0%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(34, 211, 238, 0.32);
          background:
            radial-gradient(120% 120% at 15% 0%, rgba(34,211,238,0.18), rgba(9,20,35,0.9) 58%),
            #091425;
          color: #e1fbff;
          transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease;
          text-align: left;
        }
        .club-duo-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(59, 210, 255, 0.55);
          box-shadow: 0 12px 28px -18px rgba(34,211,238,0.65);
        }
        .club-duo-btn--admin {
          border-color: rgba(244, 180, 255, 0.38);
          background:
            radial-gradient(120% 120% at 18% -10%, rgba(244,114,182,0.2), rgba(16,18,32,0.92) 60%),
            #0b1324;
          color: #f9eeff;
        }
        .club-duo-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 9999px;
          border: 1px solid rgba(34,211,238,0.32);
          background: rgba(34,211,238,0.12);
        }
        .club-duo-btn--admin .club-duo-icon {
          border-color: rgba(244, 180, 255, 0.38);
          background: rgba(244,114,182,0.16);
        }
        .club-duo-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .club-duo-title {
          font-size: 0.82rem;
          font-weight: 700;
          color: rgba(226, 253, 255, 0.96);
        }
        .club-duo-btn--admin .club-duo-title {
          color: rgba(254, 244, 255, 0.98);
        }
        .club-duo-sub {
          font-size: 0.7rem;
          color: rgba(189, 219, 234, 0.78);
          margin-top: 2px;
        }
        .club-duo-btn--admin .club-duo-sub {
          color: rgba(250, 222, 255, 0.75);
        }
        .club-duo-go {
          opacity: .75;
          transition: transform .12s ease, opacity .12s ease;
        }
        .club-duo-btn:hover .club-duo-go {
          transform: translateX(2px);
          opacity: 1;
        }
        .action-row {
          display: grid;
          grid-template-columns: 30px 1fr auto;
          align-items: center;
          gap: 8px;
          padding: 8px;
          border-radius: 10px;
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
          width: 28px;
          height: 28px;
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
          font-size: 0.85rem;
          color: #bff7ff;
        }
        .action-row .row-sub {
          font-size: 0.72rem;
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
          gap: 8px;
          width: 100%;
          border-radius: 12px;
          padding: 8px 10px;
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
          width: 28px; height: 28px; display: grid; place-items: center;
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

      {fullScreenBlock && (
        <div
          className="fixed inset-0 z-[100000] bg-black/30 backdrop-blur-sm flex items-center justify-center"
          onMouseEnter={showTip}
          onMouseMove={moveTip}
          onMouseLeave={hideTip}
          onMouseDown={showTip}
          onClick={showTip}
        >
          <div className="rounded-2xl bg-white/95 border border-rose-200 px-6 py-4 text-center shadow-lg">
            <div className="text-sm font-semibold text-rose-700">Waiting for Day Close approval…</div>
            <div className="text-xs text-slate-600 mt-1">Please stay on this page until your supervisor approves or rejects.</div>
          </div>
        </div>
      )}

      {showNavbar && (
        <nav className="px-3 py-2 w-full sticky top-0 z-40 shadow-lg border-b border-cyan-900/40 text-white relative">
          {navBlocked && (
            <div
              className="absolute inset-0 bg-black/10 cursor-not-allowed z-[100]"
              title="Waiting for Day Close approval"
              onMouseEnter={showTip}
              onMouseMove={moveTip}
              onMouseLeave={hideTip}
              onMouseDown={showTip}
              onClick={showTip}
            />
          )}
          <div className="flex items-center justify-between w-full px-2 sm:px-4 lg:px-6 min-w-0">
            {/* left: logo */}
            <div className="brand-wrap flex items-center gap-1.5 sm:gap-2 min-w-0">
              <img src="/flow1.png" alt="Logo" className="logo-animation w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-cyan-400 p-0.5 sm:p-1 shadow-md" />
              <div className="flex flex-col items-start leading-tight min-w-0">
                <Link
                  href="/"
                  className={`text-base sm:text-xl font-extrabold tracking-tight brand-text transition truncate max-w-[40vw] sm:max-w-none ${
                    isActive("/") ? "glow" : ""
                  }`}
                >
                  MeedianAI‑Flow <span className="beta-badge">beta</span>
                </Link>
                <span className="slogan hidden sm:block">A team towards Mastery <span className="slogan-brain" aria-hidden="true"><Brain size={14} strokeWidth={2.25} /></span></span>
              </div>
              <span className="brand-sweep" aria-hidden />
              <span className="brand-star star1" aria-hidden />
              <span className="brand-star star2" aria-hidden />
              <span className="brand-star star3" aria-hidden />
            </div>

            {/* center: nav links */}
            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center space-x-2">
              {role === "admin" && (
                <>
                  <Link href="/dashboard" className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}>General</Link>
                  <Link href="/dashboard/admin" className={`nav-item ${isActive("/dashboard/admin") ? "active" : ""}`}>Dashboard</Link>

                  {/* Execution icon */}
                  <ExecuteLauncher />
                  {/* Highlighted MRIs */}
                  <button type="button" onClick={() => setIsMRISheetOpen(true)} className={`nav-item mris-highlight ${isMRISheetOpen ? "active" : ""}`}>MRIs</button>
                  {/* CloseMyDay for admins too */}
                  <Link href="/dashboard/member/closeMyDay" className={`nav-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}>CloseMyDay</Link>
                  
                  {/* Community (social icon) */}
                  <Link href="/dashboard/member/meed-community" title="Community" aria-label="Community"
                    className={`nav-icon-button community-sparkle ${isActive("/dashboard/member/meed-community") ? "active" : ""}`}>
                    <Instagram className="w-4 h-4" />
                    <span className="sparkle-emoji" aria-hidden>✨</span>
                  </Link>

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
                  
                  {/* MyPerformance removed from center nav (available in Profile) */}
                </>
              )}

              {role === "team_manager" && (
                <>
                  <Link href="/dashboard" className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}>General</Link>
                  <Link href="/dashboard/team_manager" className={`nav-item ${isActive("/dashboard/team_manager") ? "active" : ""}`}>My Dashboard</Link>
                  <ExecuteLauncher />
                  <button type="button" onClick={() => setIsMRISheetOpen(true)} className={`nav-item mris-highlight ${isMRISheetOpen ? "active" : ""}`}>MRIs</button>
                  <Link href="/dashboard/member/closeMyDay" className={`nav-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}>CloseMyDay</Link>
                  {/* Community (social icon) */}
                  <Link href="/dashboard/member/meed-community" title="Community" aria-label="Community"
                    className={`nav-icon-button community-sparkle ${isActive("/dashboard/member/meed-community") ? "active" : ""}`}>
                    <Instagram className="w-4 h-4" />
                    <span className="sparkle-emoji" aria-hidden>✨</span>
                  </Link>
                  {/* MyPerformance removed from center nav (available in Profile) */}

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
                  <ExecuteLauncher />
                  <button type="button" onClick={() => setIsMRISheetOpen(true)} className={`nav-item mris-highlight ${isMRISheetOpen ? "active" : ""}`}>MRIs</button>
                  <Link href="/dashboard/member/closeMyDay" className={`nav-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}>CloseMyDay</Link>
                  <Link href="/dashboard/member/meed-repo" className={`nav-item ${isActive("/dashboard/member/meed-repo") ? "active" : ""}`}>Meed Repo</Link>
                  
                  {/* Community (social icon) */}
                  <Link href="/dashboard/member/meed-community" title="Community" aria-label="Community"
                    className={`nav-icon-button community-sparkle ${isActive("/dashboard/member/meed-community") ? "active" : ""}`}>
                    <Instagram className="w-4 h-4" />
                    <span className="sparkle-emoji" aria-hidden>✨</span>
                  </Link>
                  {/* MyPerformance removed from center nav (available in Profile) */}

                  {/* Members should not see Managerial */}
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

            {/* right: (md+) profile/logout • (sm) hamburger only */}
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              {(role === "admin" || role === "team_manager" || role === "member") && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(true)}
                    className={`user-info ${isActive(profilePath) ? "active" : ""}`}
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
                    {notifUnread > 0 && <span className="notif-badge" aria-label={`${notifUnread} unread notifications`}>{Math.min(99, notifUnread)}</span>}
                    <div className="user-info-text hidden lg:flex">
                      <span className="name">{userName || "Loading..."}</span>
                      <span className="account-label">My Account</span>
                    </div>
                  </button>
                  {/* Notifications beside profile */}
                  <div className="relative">
                    <button type="button" onClick={() => setIsNotifOpen((v)=>!v)} className={`nav-icon-button ${isNotifOpen ? 'active' : ''} relative`} title="Notifications" aria-haspopup="true" aria-expanded={isNotifOpen}>
                      {notifUnread > 0 ? <BellDot className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                      {notifUnread > 0 && <span className="notif-dot" aria-hidden />}
                    </button>
                    {isNotifOpen && (
                      <div className="notif-panel" role="menu" aria-label="Notifications" onClick={(e)=>e.stopPropagation()}>
                        <div className="flex items-center justify-between px-1 mb-1">
                          <div className="text-cyan-300 font-semibold">Notifications</div>
                          <div className="flex items-center gap-3">
                            <button className="text-xs text-cyan-200 hover:text-white" onClick={async ()=>{ await fetch('/api/member/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ all: true, read: true })}); setNotifUnread(0); setIsNotifOpen(false); }}>Mark all read</button>
                            <button className="text-xs text-cyan-200 hover:text-white" onClick={()=>{ router.push('/dashboard/member/notifications'); setIsNotifOpen(false); }}>View all</button>
                          </div>
                        </div>
                        <div className="grid gap-1 max-h-72 overflow-auto pr-1">
                        {notifItems.length === 0 ? (
                          <div className="text-sm text-slate-300 px-2 py-4">No recent notifications.</div>
                        ) : notifItems.map((n) => (
                            <button key={n.id} className={`notif-item ${n.read ? '' : 'unread'} text-left`} onClick={()=>{ if(n.entityKind==='ticket' && n.entityId){ router.push(`/dashboard/member/tickets?ticketId=${n.entityId}`); } else { router.push('/dashboard/member/notifications'); } setIsNotifOpen(false); }}>
                              <div className="pt-0.5">{n.type?.includes('task') ? '🗂️' : n.type?.includes('chat') ? '💬' : n.type?.includes('community') ? '🧩' : '📌'}</div>
                              <div>
                                <div className="notif-title">{n.title || 'Notification'}</div>
                                {n.body && <div className="notif-body">{n.body}</div>}
                                <div className="notif-time">{new Date(n.createdAt).toLocaleString()}</div>
                              </div>
                            </button>
                        ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={openLogoutModal}
                    className="nav-button bg-red-600 hover:bg-red-700 text-white"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
            {/* mobile: hamburger only */}
            <div className="md:hidden flex items-center gap-2 flex-shrink-0">
              {(role === "admin" || role === "team_manager" || role === "member") && (
                <div className="relative">
                  <button
                    onClick={() => setIsNotifOpen((v) => !v)}
                    className="text-white p-2 rounded-full hover:bg-gray-700 transition min-h-[44px] min-w-[44px] relative"
                    aria-label="Notifications"
                  >
                    {notifUnread > 0 ? <BellDot size={20} /> : <Bell size={20} />}
                    {notifUnread > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-1.5 py-[1px] shadow">{notifUnread}</span>}
                  </button>
                  {isNotifOpen && (
                    <div className="notif-panel" role="menu" aria-label="Notifications" onClick={(e)=>e.stopPropagation()}>
                      <div className="flex items-center justify-between px-1 mb-1">
                        <div className="text-cyan-300 font-semibold">Notifications</div>
                        <button className="text-xs text-cyan-200 hover:text-white" onClick={async ()=>{ await fetch('/api/member/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ all: true, read: true })}); setNotifUnread(0); setIsNotifOpen(false); }}>Mark all read</button>
                      </div>
                      <div className="grid gap-1 max-h-72 overflow-auto pr-1">
                        {notifItems.length === 0 ? (
                          <div className="text-sm text-slate-300 px-2 py-4">No recent notifications.</div>
                        ) : notifItems.map((n) => (
                          <button key={n.id} className={`notif-item ${n.read ? '' : 'unread'} text-left`} onClick={()=>{ if(n.entityKind==='ticket' && n.entityId){ router.push(`/dashboard/member/tickets?ticketId=${n.entityId}`); } else { router.push('/dashboard/member/notifications'); } setIsNotifOpen(false); }}>
                            <div className="pt-0.5">{n.type?.includes('task') ? '🗂️' : n.type?.includes('chat') ? '💬' : n.type?.includes('community') ? '🧩' : '📌'}</div>
                            <div>
                              <div className="notif-title">{n.title || 'Notification'}</div>
                              {n.body && <div className="notif-body">{n.body}</div>}
                              <div className="notif-time">{new Date(n.createdAt).toLocaleString()}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={toggleMobileMenu}
                className="text-white p-2 rounded-full hover:bg-gray-700 transition min-h-[44px] min-w-[44px]"
                aria-label="Open menu"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
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
                        <span className="formal-accent" aria-hidden />
                        <span className="formal-label">Execute Now</span>
                      </button>

                      <button onClick={() => { handleAddMember(); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">Add Member</button>
                      <button onClick={() => { handleManageMeedian(); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">Manage Meedian</button>
                      <Link href="/dashboard/member/meed-community" onClick={toggleMobileMenu} className={`mobile-menu-item community-sparkle ${isActive("/dashboard/member/meed-community") ? "active" : ""}`}>
                        Community <span className="sparkle-emoji" aria-hidden>✨</span>
                      </Link>
                      {/* MyPerformance removed from mobile nav (in Profile) */}
                    </>
                  )}

                  {role === "team_manager" && (
                    <>
                      <Link href="/dashboard" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard") ? "active" : ""}`}>General</Link>
                      <Link href="/dashboard/team_manager" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/team_manager") ? "active" : ""}`}>My Dashboard</Link>
                      <button onClick={() => { setIsMRISheetOpen(true); toggleMobileMenu(); }} className={`mobile-menu-item ${isMRISheetOpen ? "active" : ""}`}>MRIs</button>
                      {/* Execute Now directly after MRIs */}
                      <button onClick={() => { setIsExecuteOpen(true); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">
                        <span className="formal-accent" aria-hidden />
                        <span className="formal-label">Execute Now</span>
                      </button>
                      <Link href="/dashboard/member/closeMyDay" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}>CloseMyDay</Link>
                      {/* MyPerformance removed from mobile nav (in Profile) */}

                  <button onClick={() => { setIsManagerialOpen(true); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">
                    Managerial
                  </button>
                  <Link href="/dashboard/member/meed-community" onClick={toggleMobileMenu} className={`mobile-menu-item community-sparkle ${isActive("/dashboard/member/meed-community") ? "active" : ""}`}>
                    Community <span className="sparkle-emoji" aria-hidden>✨</span>
                  </Link>
                    </>
                  )}

                  {role === "member" && (
                    <>
                      <Link href="/dashboard" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard") ? "active" : ""}`}>General</Link>
                      <Link href="/dashboard/member" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/member") ? "active" : ""}`}>My Dashboard</Link>
                      <Link href="/dashboard/member/myMeedRituals" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/member/myMeedRituals") ? "active" : ""}`}>MyMRIs</Link>
                      {/* Execute Now directly after MyMRIs */}
                      <button onClick={() => { setIsExecuteOpen(true); toggleMobileMenu(); }} className="mobile-menu-item text-left w-full">
                        <span className="formal-accent" aria-hidden />
                        <span className="formal-label">Execute Now</span>
                      </button>
                      <Link href="/dashboard/member/closeMyDay" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/member/closeMyDay") ? "active" : ""}`}>CloseMyDay</Link>
                      <Link href="/dashboard/member/meed-repo" onClick={toggleMobileMenu} className={`mobile-menu-item ${isActive("/dashboard/member/meed-repo") ? "active" : ""}`}>Meed Repo</Link>
                      <Link href="/dashboard/member/meed-community" onClick={toggleMobileMenu} className={`mobile-menu-item community-sparkle ${isActive("/dashboard/member/meed-community") ? "active" : ""}`}>
                        Community <span className="sparkle-emoji" aria-hidden>✨</span>
                      </Link>
                      {/* MyPerformance removed from mobile nav (in Profile) */}
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

      {(navBlocked || fullScreenBlock) && tip.visible && (
        <div
          className="fixed z-[100001] pointer-events-none"
          style={{ left: Math.max(8, tip.x + 12), top: Math.max(8, tip.y + 12) }}
          role="status"
          aria-live="polite"
        >
          <div className="rounded-lg border border-rose-300 bg-rose-50/95 text-rose-800 text-xs font-semibold px-3 py-1.5 shadow">
            {tipText}
          </div>
        </div>
      )}

      {/* portals (outside so they can appear even if nav is hidden) */}
      {mounted && typeof window !== "undefined" && isLogoutModalOpen && document?.body &&
        createPortal(<LogoutModal />, document.body)}

      {mounted && typeof window !== "undefined" && isExecuteOpen && document?.body &&
        createPortal(<ExecuteModal />, document.body)}

      {mounted && typeof window !== "undefined" && isManagerialOpen && (role === "admin" || role === "team_manager") && document?.body &&
        createPortal(<ManagerialSheet />, document.body)}

      {mounted && typeof window !== "undefined" && showExecWalkthrough && document?.body && createPortal(
        <div className="walkthrough-overlay" role="dialog" aria-modal="true" aria-label="Execution walkthrough" onClick={closeExecWalkthrough}>
          <div className="walkthrough" onClick={(e) => e.stopPropagation()}>
            <div className="walkthrough-header">
              <span className="walkthrough-title">Execute Walkthrough</span>
              <button className="walkthrough-close" aria-label="Close" onClick={closeExecWalkthrough}><X size={14} /></button>
            </div>
            <div className="walkthrough-body">
              {execStep === 0 && (
                <div>
                  <div className="w-step-title">1) Open Your Day</div>
                  <div className="w-step-text">Make sure today is started so your MRNs and rituals can be tracked properly.</div>
                  <div className="w-step-actions">
                    <button className="w-btn" onClick={openMeRightNow}>Open MRN</button>
                  </div>
                </div>
              )}
              {execStep === 1 && (
                <div>
                  <div className="w-step-title">2) Choose MRI Type</div>
                  <div className="w-step-text">Pick A‑MRI, O‑MRI or N‑MRI based on what you’re about to do.</div>
                  <div className="w-step-actions">
                    <button className="w-btn" onClick={() => { setIsMRISheetOpen(true); }}>Open MRIs</button>
                  </div>
                </div>
              )}
              {execStep === 2 && (
                <div>
                  <div className="w-step-title">3) Enter MRN and Execute</div>
                  <div className="w-step-text">
                    O‑MRI / N‑MRI: enter your MRN and join MeedTogether if the internet is fine. A‑MRI: enter MRN and perform your ritual with students.
                  </div>
                  <div className="w-step-actions">
                    <button className="w-btn" onClick={openMeRightNow}>Enter MRN</button>
                    <button className="w-btn alt" onClick={openTogetherWorkspace}>MeedTogether</button>
                  </div>
                </div>
              )}
            </div>
            <div className="walkthrough-controls">
              <button className="w-ctrl" onClick={prevExecStep} disabled={execStep === 0}>Back</button>
              {execStep < 2 ? (
                <button className="w-ctrl primary" onClick={nextExecStep}>Next</button>
              ) : (
                <button className="w-ctrl primary" onClick={closeExecWalkthrough}>Done</button>
              )}
            </div>
          </div>
        </div>,
      document.body)}

      {mounted && typeof window !== "undefined" && showFullWalkthrough && document?.body && createPortal(
        <div className="walkthrough-overlay" role="dialog" aria-modal="true" aria-label="Full app walkthrough" onClick={closeFullWalkthrough}>
          <div className="walkthrough" onClick={(e) => e.stopPropagation()}>
            <div className="walkthrough-header">
              <span className="walkthrough-title">Full App Walkthrough</span>
              <button className="walkthrough-close" aria-label="Close" onClick={closeFullWalkthrough}><X size={14} /></button>
            </div>
            <div className="walkthrough-body">
              {fullStep === 0 && (
                <div>
                  <div className="w-step-title">1) Explore Your Dashboard</div>
                  <div className="w-step-text">Open your main dashboard to review your day and priorities.</div>
                  <div className="w-step-actions">
                    <button className="w-btn" onClick={() => router.push(`/dashboard/${role === 'team_manager' ? 'team_manager' : role}`)}>Open Dashboard</button>
                  </div>
                </div>
              )}
              {fullStep === 1 && (
                <div>
                  <div className="w-step-title">2) Widgets, MRIs and Profile</div>
                  <div className="w-step-text">Use "My Meed Widgets" to access MRN, performance, leave and messaging in one place.</div>
                  <div className="w-step-actions">
                    <button className="w-btn" onClick={() => setIsProfileOpen(true)}>Open My Meed Widgets</button>
                    <button className="w-btn alt" onClick={() => setIsMRISheetOpen(true)}>Open MRIs</button>
                  </div>
                </div>
              )}
              {fullStep === 2 && (
                <div>
                  <div className="w-step-title">3) Managerial & Day Close</div>
                  <div className="w-step-text">If you are a manager, open Managerial actions. Members can close their day and submit updates.</div>
                  <div className="w-step-actions">
                    {(role === 'admin' || role === 'team_manager') && (
                      <button className="w-btn" onClick={() => setIsManagerialOpen(true)}>Open Managerial</button>
                    )}
                    <button className="w-btn alt" onClick={() => router.push('/dashboard/member/closeMyDay')}>Open CloseMyDay</button>
                  </div>
                </div>
              )}
            </div>
            <div className="walkthrough-controls">
              <button className="w-ctrl" onClick={() => setFullStep((s)=> Math.max(0, s-1))} disabled={fullStep === 0}>Back</button>
              {fullStep < 2 ? (
                <button className="w-ctrl primary" onClick={() => setFullStep((s)=> Math.min(2, s+1))}>Next</button>
              ) : (
                <button className="w-ctrl primary" onClick={closeFullWalkthrough}>Done</button>
              )}
            </div>
          </div>
        </div>,
      document.body)}

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
