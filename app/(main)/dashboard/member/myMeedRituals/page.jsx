"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Calendar, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import RoutineTrackerModal from "@/components/member/RoutineTrackerModal";
import QrCode from "@/components/QrCode";
import { format } from "date-fns";
import useSWR from "swr";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

export default function MyMRIs() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;

  if (status === "loading") return <div>Loading...</div>;
  if (!["member", "team_manager"].includes(role)) {
    return <div>Access Denied</div>;
  }

  const [isAssignedTasksModalOpen, setIsAssignedTasksModalOpen] = useState(false);
  const [isRoutineTasksModalOpen, setIsRoutineTasksModalOpen] = useState(false);
  const [isAMRIsModalOpen, setIsAMRIsModalOpen] = useState(false);
  const [isNMRIsModalOpen, setIsNMRIsModalOpen] = useState(false);
  const [isSlotDescriptionModalOpen, setIsSlotDescriptionModalOpen] = useState(false);
  const [isMSPModalOpen, setIsMSPModalOpen] = useState(false);
  const [isMHCPModalOpen, setIsMHCPModalOpen] = useState(false);
  const [isMNPModalOpen, setIsMNPModalOpen] = useState(false);
  const [isMAPModalOpen, setIsMAPModalOpen] = useState(false);
  const [isMGHPModalOpen, setIsMGHPModalOpen] = useState(false);
  const [isRMRIInfoOpen, setIsRMRIInfoOpen] = useState(false);
  const [rRoleModalOpen, setRRoleModalOpen] = useState(false);
  const [rTaskModalOpen, setRTaskModalOpen] = useState(false);
  const [isRoleExecuteOpen, setIsRoleExecuteOpen] = useState(false);
  const [selectedRoleBundle, setSelectedRoleBundle] = useState(null); // { roleKey, roleName, tasks: [] }
  const [selectedRTask, setSelectedRTask] = useState(null); // { roleName, task }
  const [selectedExecTask, setSelectedExecTask] = useState(null); // task object for Execute modal
  const [selectedExecKind, setSelectedExecKind] = useState('none'); // scanner | none | custom
  const [scanPanel, setScanPanel] = useState({ session: null, sessionToken: "", userTokenInput: "", logs: [] , starting: false, ingesting: false});
  const [sessionEvents, setSessionEvents] = useState([]);
  const [showSessionQR, setShowSessionQR] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [error, setError] = useState(null);
  const [todayAMRIs, setTodayAMRIs] = useState([]);
  const [todayNMRIs, setTodayNMRIs] = useState([]);
  const [weeklyAMRIs, setWeeklyAMRIs] = useState([]);
  const [weeklyNMRIs, setWeeklyNMRIs] = useState([]);
  const [routineTasks, setRoutineTasks] = useState([]);
  const [isLoadingNMRIs, setIsLoadingNMRIs] = useState(true);
  const { data: roleTasksData, error: roleTasksError } = useSWR(
    session?.user?.id ? "/api/member/mris/role-tasks" : null,
    fetcher
  );

  // Fetch today's A-MRIs and N-MRIs
  const { data: todayMRIsData, error: todayMRIsError } = useSWR(
    session?.user?.id ? "/api/member/myMRIs?section=today" : null,
    fetcher
  );

  // Fetch weekly A-MRIs and N-MRIs
  const { data: weeklyMRIsData, error: weeklyMRIsError } = useSWR(
    session?.user?.id ? "/api/member/myMRIs?section=weekly" : null,
    fetcher
  );

  // Fetch assigned tasks
  const { data: assignedTasksData, error: assignedTasksError } = useSWR(
    session?.user?.id ? "/api/member/assignedTasks?action=tasks&date=2025-07-28" : null,
    fetcher
  );

  // Fetch routine tasks
  const { data: routineTasksData, error: routineTasksError } = useSWR(
    session?.user?.id ? "/api/member/routine-tasks?action=routineTasks&date=2025-07-28" : null,
    fetcher
  );

  useEffect(() => {
    // Handle today's A-MRIs and N-MRIs
    if (todayMRIsData) {
      setTodayAMRIs(todayMRIsData.aMRIs || []);
      setTodayNMRIs(todayMRIsData.nMRIs || []);
      setIsLoadingNMRIs(false);
    }
    if (todayMRIsError) {
      setError("Failed to load today's MRIs. Using placeholders.");
      setTodayAMRIs([{ title: "Prepare daily report", description: "" }, { title: "Team sync meeting", description: "" }, { title: "Review project updates", description: "" }]);
      setTodayNMRIs([{ id: 1, name: "Update task tracker", time: "09:00:00 - 10:00:00" }]);
      setTimeout(() => setError(null), 3000);
      setIsLoadingNMRIs(false);
    }

    // Handle weekly A-MRIs and N-MRIs
    if (weeklyMRIsData) {
      setWeeklyAMRIs(weeklyMRIsData.aMRIs || []);
      setWeeklyNMRIs(weeklyMRIsData.nMRIs || []);
    }
    if (weeklyMRIsError) {
      setError("Failed to load weekly MRIs. Using placeholders.");
      setWeeklyAMRIs([
        { day: "Monday", tasks: ["Task A1", "Task A2", "Task A3"] },
        { day: "Tuesday", tasks: ["Task A4", "Task A5"] },
        { day: "Wednesday", tasks: ["Task A6", "Task A7"] },
        { day: "Thursday", tasks: ["Task A8", "Task A9"] },
        { day: "Friday", tasks: ["Task A10"] },
        { day: "Saturday", tasks: [] },
        { day: "Sunday", tasks: [] },
      ]);
      setWeeklyNMRIs([
        { id: 1, name: "Supervision", time: "09:00:00 - 10:00:00" },
        { id: 2, name: "Review", time: "10:00:00 - 11:00:00" },
        { id: 3, name: "Planning", time: "11:00:00 - 12:00:00" },
      ]);
      setTimeout(() => setError(null), 3000);
    }

    // Handle assigned tasks
    if (assignedTasksData) {
      setTodayAMRIs(assignedTasksData.tasks || []);
    }
    if (assignedTasksError) {
      setError("Failed to load assigned tasks. Using placeholders.");
      setTodayAMRIs([{ title: "Prepare daily report", description: "" }, { title: "Team sync meeting", description: "" }, { title: "Review project updates", description: "" }]);
      setTimeout(() => setError(null), 3000);
    }

    // Handle routine tasks
    if (routineTasksData) {
      setRoutineTasks(routineTasksData.statuses || []);
    }
    if (routineTasksError) {
      setError("Failed to load routine tasks. Using placeholders.");
      setRoutineTasks([{ id: 1, description: "Daily check-in", status: "not_started" }, { id: 2, description: "Team report", status: "not_started" }]);
      setTimeout(() => setError(null), 3000);
    }
    if (roleTasksError) {
      // not critical, just log
      console.warn("Failed to load role tasks:", roleTasksError);
    }
  }, [session, todayMRIsData, todayMRIsError, weeklyMRIsData, weeklyMRIsError, assignedTasksData, assignedTasksError, routineTasksData, routineTasksError, roleTasksError]);

  // If role details modal is open but selectedRoleBundle lacks tasks, hydrate from latest roleTasksData
  useEffect(() => {
    if (!rRoleModalOpen || !selectedRoleBundle || !roleTasksData?.roles) return;
    if (Array.isArray(selectedRoleBundle.tasks) && selectedRoleBundle.tasks.length > 0) return;
    const rb = (roleTasksData.roles || []).find(r => String(r.roleKey) === String(selectedRoleBundle.roleKey));
    if (rb) setSelectedRoleBundle(rb);
  }, [rRoleModalOpen, selectedRoleBundle, roleTasksData]);

  // Decide execution kind for a role task (temporary router until schema supports it)
  const getExecutionKind = (roleKey, task) => {
    const rk = String(roleKey || '').toLowerCase();
    const title = String(task?.title || '').toLowerCase();
    if (rk === 'msp_ele_moderator' && (/day\s*open|open\s*day|opening/.test(title))) return 'scanner';
    return 'none';
  };

  // Poll session attendance list when a session exists (moderator view)
  useEffect(() => {
    if (!scanPanel.session?.id) return;
    let active = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/attendance?section=sessionEvents&sessionId=${scanPanel.session.id}`);
        const j = await r.json();
        if (active && r.ok) setSessionEvents(j.events || []);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { active = false; clearInterval(id); };
  }, [scanPanel.session?.id]);

  // --- Persist/restore moderator session (so reopening modal resumes same session) ---
  const SESSION_KEY = 'mri:session:msp_ele_moderator';
  const saveModeratorSession = (sess, token) => {
    try {
      if (!sess?.id || !token) return;
      const payload = { id: sess.id, token, expiresAt: sess.expiresAt };
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch {}
  };
  const loadModeratorSession = () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj?.id || !obj?.token || !obj?.expiresAt) return null;
      const exp = new Date(obj.expiresAt).getTime();
      if (Number.isFinite(exp) && Date.now() < exp) return obj;
      // expired
      localStorage.removeItem(SESSION_KEY);
      return null;
    } catch { return null; }
  };
  const clearModeratorSession = () => { try { localStorage.removeItem(SESSION_KEY); } catch {} };

  // When role modal opens for MSP Elementary Moderator, attempt to restore session
  useEffect(() => {
    if (!rRoleModalOpen) return;
    if (String(selectedRoleBundle?.roleKey || '').toLowerCase() !== 'msp_ele_moderator') return;
    if (scanPanel.session?.id) return; // already have one
    const restored = loadModeratorSession();
    if (restored) {
      setScanPanel((p) => ({ ...p, session: { id: restored.id, expiresAt: restored.expiresAt }, sessionToken: restored.token }));
    }
  }, [rRoleModalOpen, selectedRoleBundle, scanPanel.session?.id]);

  const today = format(new Date("2025-07-28T21:45:00+08:00"), "EEEE, MMMM d, yyyy");

  const getBlockForSlot = (id) => {
    if (id >= 1 && id <= 6) return "Block 1";
    if (id >= 7 && id <= 9) return "Block 2";
    if (id >= 10 && id <= 11) return "Block 3";
    if (id >= 12 && id <= 14) return "Block 4";
    if (id >= 15 && id <= 16) return "Block 5";
    if (id === 17) return "Block 6";
    return "Unknown Block";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "not_started":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Helpers for time-sensitive execution (with recurrence support)
  const deriveWindow = (task) => {
    // consider time-sensitive if explicit or if any time field is present
    const tsFlag = (v) => (typeof v === 'string' ? v.toLowerCase() === 'true' : !!v);
    const hasTimeFields = !!(task?.execAt || task?.windowStart || task?.windowEnd);
    if (!(tsFlag(task?.timeSensitive) || hasTimeFields)) return null;
    const rec = String(task.recurrence || '').toLowerCase();
    const now = new Date();
    const todayStr = now.toDateString();
    const toTodaysTime = (src) => {
      const d = new Date(src);
      const res = new Date(todayStr + ' ' + d.toTimeString());
      return res;
    };
    const weekdayMatch = (src) => new Date(src).getDay() === now.getDay();
    const monthdayMatch = (src) => new Date(src).getDate() === now.getDate();

    if (task.execAt) {
      if (rec === 'daily') {
        const at = toTodaysTime(task.execAt);
        return { type: 'point', at };
      }
      if (rec === 'weekly') {
        if (!weekdayMatch(task.execAt)) return { type: 'point', at: null }; // not today
        const at = toTodaysTime(task.execAt);
        return { type: 'point', at };
      }
      if (rec === 'monthly') {
        if (!monthdayMatch(task.execAt)) return { type: 'point', at: null };
        const at = toTodaysTime(task.execAt);
        return { type: 'point', at };
      }
      // no recurrence: use exact timestamp
      return { type: 'point', at: new Date(task.execAt) };
    }

    // window
    const wsP = task.windowStart ? new Date(task.windowStart) : null;
    const weP = task.windowEnd ? new Date(task.windowEnd) : null;
    if (rec === 'daily') {
      const start = wsP ? toTodaysTime(wsP) : null;
      const end = weP ? toTodaysTime(weP) : null;
      return { type: 'window', start, end };
    }
    if (rec === 'weekly') {
      if ((wsP && !weekdayMatch(wsP)) || (weP && !weekdayMatch(weP))) return { type: 'window', start: null, end: null };
      const start = wsP ? toTodaysTime(wsP) : null;
      const end = weP ? toTodaysTime(weP) : null;
      return { type: 'window', start, end };
    }
    if (rec === 'monthly') {
      if ((wsP && !monthdayMatch(wsP)) || (weP && !monthdayMatch(weP))) return { type: 'window', start: null, end: null };
      const start = wsP ? toTodaysTime(wsP) : null;
      const end = weP ? toTodaysTime(weP) : null;
      return { type: 'window', start, end };
    }
    // no recurrence
    return { type: 'window', start: wsP, end: weP };
  };

  const isWithinTaskWindow = (task) => {
    if (!task?.timeSensitive) return true;
    const win = deriveWindow(task);
    const now = Date.now();
    if (!win) return true;
    if (win.type === 'point') {
      if (!win.at) return false;
      const at = win.at.getTime();
      return Math.abs(now - at) <= 15 * 60 * 1000;
    }
    if (win.type === 'window') {
      const start = win.start ? win.start.getTime() : null;
      const end = win.end ? win.end.getTime() : null;
      if (start && end) return now >= start && now <= end;
      if (start && !end) return now >= start;
      if (!start && end) return now <= end;
      return true;
    }
    return true;
  };

  const availabilityBadge = (task) => {
    const tsFlag = (v) => (typeof v === 'string' ? v.toLowerCase() === 'true' : !!v);
    const hasTimeFields = !!(task?.execAt || task?.windowStart || task?.windowEnd);
    if (!(tsFlag(task?.timeSensitive) || hasTimeFields)) return { label: 'Anytime', tone: 'gray' };
    const win = deriveWindow(task);
    const now = Date.now();
    const fmt = (d) => new Date(d).toLocaleString();
    if (!win) return { label: 'Anytime', tone: 'gray' };
    if (win.type === 'point') {
      if (!win.at) return { label: 'Not today', tone: 'gray' };
      const at = win.at.getTime();
      if (Math.abs(now - at) <= 15*60*1000) return { label: 'Available now', tone: 'green' };
      return { label: (at>now? `Starts ${fmt(at)}` : `Past ${fmt(at)}`), tone: at>now? 'amber':'gray' };
    } else {
      const s = win.start ? win.start.getTime() : null;
      const e = win.end ? win.end.getTime() : null;
      const inWin = (s? now>=s:true) && (e? now<=e:true);
      if (inWin) return { label: 'Available now', tone: 'green' };
      return { label: `${s? fmt(s):'—'} – ${e? fmt(e):'—'}`, tone: 'amber' };
    }
  };

  // Local component to render a task card with hooks safely
  const TaskCard = ({ task: t, roleKey }) => {
    const cd = useTaskCountdown(t);
    const badge = availabilityBadge(t);
    const bcls = badge.tone==='green' ? 'bg-emerald-100 text-emerald-800' : badge.tone==='amber' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800';
    return (
      <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3 snap-start">
        <div className="font-semibold text-rose-900 flex items-center gap-2">
          <span className="truncate">{t.title}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${bcls}`}>{badge.label}</span>
        </div>
        {t.description && <div className="text-xs text-gray-700 mt-1">{t.description}</div>}
        {t.timeSensitive && (
          <div className="text-[11px] text-rose-900/90 mt-1">
            {t.execAt ? (
              <div><span className="font-semibold">Exec At:</span> {new Date(t.execAt).toLocaleString()}</div>
            ) : (
              (t.windowStart || t.windowEnd) ? (
                <div><span className="font-semibold">Window:</span> {t.windowStart ? new Date(t.windowStart).toLocaleString() : '—'} – {t.windowEnd ? new Date(t.windowEnd).toLocaleString() : '—'}</div>
              ) : null
            )}
            {t.recurrence && <div><span className="font-semibold">Recurs:</span> {String(t.recurrence).toUpperCase()}</div>}
            {cd.text && <div className="mt-0.5">{cd.text}</div>}
          </div>
        )}
        {Array.isArray(t.submissables) && t.submissables.length > 0 && (
          <div className="mt-2">
            <div className="text-[11px] font-semibold text-gray-700">Submissables</div>
            <ol className="list-decimal pl-5 text-xs text-gray-800 mt-1 space-y-1">
              {t.submissables.map((s, i) => (<li key={i}>{String(s)}</li>))}
            </ol>
          </div>
        )}
        {t.action && <div className="text-[12px] text-gray-700 mt-2"><span className="font-semibold">Action:</span> {t.action}</div>}
        <div className="mt-2">
          <button
            className="px-3 py-1.5 rounded text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: isWithinTaskWindow(t) ? '#e11d48' : '#9ca3af' }}
            disabled={!isWithinTaskWindow(t)}
            title={isWithinTaskWindow(t) ? 'Execute this task' : 'Outside allowed time window'}
            onClick={() => {
              setSelectedExecTask(t);
              setSelectedExecKind(getExecutionKind(roleKey, t));
              setRRoleModalOpen(false);
              setIsRoleExecuteOpen(true);
            }}
          >
            Execute Task
          </button>
        </div>
      </div>
    );
  };

  // Normalize task shape coming from various endpoints (snake_case vs camelCase, strings)
  const normalizeTask = (raw) => {
    const pick = (obj, keys) => keys.reduce((a,k)=>{ if (obj[k]!==undefined && obj[k]!==null && obj[k]!=='' && String(obj[k]).toLowerCase()!=='null') a[k]=obj[k]; return a; }, {});
    const tsFlag = (v) => (typeof v === 'string' ? v.toLowerCase() === 'true' : !!v);
    const r = { ...raw };
    // map snake_case to camelCase if present
    if (r.exec_at && !r.execAt) r.execAt = r.exec_at;
    if (r.window_start && !r.windowStart) r.windowStart = r.window_start;
    if (r.window_end && !r.windowEnd) r.windowEnd = r.window_end;
    if (r.time_sensitive !== undefined && r.timeSensitive === undefined) r.timeSensitive = r.time_sensitive;
    // clean empty strings
    const times = pick(r, ['execAt','windowStart','windowEnd']);
    Object.assign(r, times);
    // coerce booleans
    r.timeSensitive = tsFlag(r.timeSensitive);
    // keep recurrence as lower-case string if present
    if (r.recurrence) r.recurrence = String(r.recurrence).toLowerCase();
    // ensure submissables is array if possible
    if (r.submissables && !Array.isArray(r.submissables)) {
      try {
        const arr = JSON.parse(r.submissables);
        if (Array.isArray(arr)) r.submissables = arr;
      } catch {}
    }
    return r;
  };

  // Live countdown for a task: returns { mode: 'starts'|'ends'|'ended'|'idle', seconds, text }
  const useTaskCountdown = (task) => {
    const [state, setState] = useState({ mode: 'idle', seconds: 0, text: '' });
    useEffect(() => {
      let id;
      const update = () => {
        if (!task?.timeSensitive) { setState({ mode: 'idle', seconds: 0, text: '' }); return; }
        const win = deriveWindow(task);
        const now = Date.now();
        const fmt = (s) => {
          const a = Math.max(0, Math.floor(s));
          const h = Math.floor(a/3600), m = Math.floor((a%3600)/60), q = a%60;
          return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(q).padStart(2,'0')}`;
        };
        if (!win) { setState({ mode: 'idle', seconds: 0, text: '' }); return; }
        if (win.type === 'point') {
          if (!win.at) { setState({ mode: 'ended', seconds: 0, text: 'Not today' }); return; }
          const at = win.at.getTime();
          const start = at - 15*60*1000; // early window
          const end = at + 15*60*1000;   // late window
          if (now < start) {
            const secs = (start - now)/1000; setState({ mode: 'starts', seconds: secs, text: `Starts in ${fmt(secs)}` });
          } else if (now >= start && now <= end) {
            const secs = (end - now)/1000; setState({ mode: 'ends', seconds: secs, text: `Ends in ${fmt(secs)}` });
          } else {
            setState({ mode: 'ended', seconds: 0, text: 'Ended' });
          }
          return;
        }
        // window
        const s = win.start ? win.start.getTime() : null;
        const e = win.end ? win.end.getTime() : null;
        if (s && now < s) {
          const secs = (s - now)/1000; setState({ mode: 'starts', seconds: secs, text: `Starts in ${fmt(secs)}` });
          return;
        }
        if ((s? now>=s:true) && (e? now<=e:true)) {
          const target = e ?? now; // if no end, no countdown
          const secs = e ? (e - now)/1000 : 0; setState({ mode: e ? 'ends' : 'idle', seconds: secs, text: e ? `Ends in ${fmt(secs)}` : '' });
          return;
        }
        setState({ mode: 'ended', seconds: 0, text: 'Ended' });
      };
      update();
      id = setInterval(update, 1000);
      return () => id && clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [task?.timeSensitive, task?.execAt, task?.windowStart, task?.windowEnd, task?.recurrence]);
    return state;
  };

  const blocks = [
    { title: "Block 1 (Slots 1-6)", range: { start: 1, end: 6 } },
    { title: "Block 2 (Slots 7-9)", range: { start: 7, end: 9 } },
    { title: "Block 3 (Slots 10-11)", range: { start: 10, end: 11 } },
    { title: "Block 4 (Slots 12-14)", range: { start: 12, end: 14 } },
    { title: "Block 5 (Slots 15-16)", range: { start: 15, end: 16 } },
    { title: "Block 6 (Slot 17)", range: { start: 17, end: 17 } },
  ];

  const renderBlock = (block, blockIndex) => {
    const filtered = weeklyNMRIs.filter((slot) => slot.id >= block.range.start && slot.id <= block.range.end);
    let slotsContent;
    if (filtered.length === 0) {
      slotsContent = <p className="text-sm text-gray-600 text-center">No N-Rituals in this block</p>;
    } else {
      slotsContent = filtered.map((slot) => (
        <motion.div
          key={slot.id}
          className="grid grid-cols-12 gap-4 items-center p-3 rounded-xl hover:bg-gray-50/50 transition-all duration-200 text-sm text-gray-700"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: (slot.id - block.range.start) * 0.1 }}
        >
          <div className="col-span-2">Slot {slot.id}</div>
          <div className="col-span-3">{slot.name}</div>
          <div className="col-span-3">{slot.description || slot.name}</div>
          <div className="col-span-2">{slot.time}</div>
          <div className="col-span-2">
            <motion.button
              onClick={() => {
                setSelectedSlot(slot);
                setIsSlotDescriptionModalOpen(true);
              }}
              className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              View
            </motion.button>
          </div>
        </motion.div>
      ));
    }

    return (
      <div key={blockIndex} className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{block.title}</h3>
        <div className="grid grid-cols-12 gap-4 mb-4 bg-teal-50/50 rounded-xl p-3 text-sm font-semibold text-gray-800">
          <div className="col-span-2">Slot ID</div>
          <div className="col-span-3">Slot Name</div>
          <div className="col-span-3">Description</div>
          <div className="col-span-2">Time Slot</div>
          <div className="col-span-2">Action</div>
        </div>
        {slotsContent}
      </div>
    );
  };

  const nmrisContent = isLoadingNMRIs ? (
    <div className="flex flex-col items-center text-center py-8">
      <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      <p className="text-sm text-gray-600 mt-2">Loading slots...</p>
    </div>
  ) : (
    <div className="space-y-8">{blocks.map(renderBlock)}</div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gray-100 p-8 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 bg-red-50 text-red-600 p-4 rounded-xl shadow-md flex items-center gap-2"
              onClick={() => setError(null)}
            >
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error} (Click to dismiss)</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Execute modal: landscape, two halves (scanner + attendance) */}
        <AnimatePresence>
          {isRoleExecuteOpen && selectedRoleBundle && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col border border-rose-100/50"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-800">Execute — {selectedRoleBundle.roleName || selectedRoleBundle.roleKey}</h2>
                  <motion.button
                    onClick={() => setIsRoleExecuteOpen(false)}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={20} />
                  </motion.button>
                </div>
                <div className="text-xs text-gray-600 mb-3">Task execution surface. For MSP Ele Moderator Day Opening, the scanner and attendance are side-by-side.</div>
                <div className="space-y-3 flex-1 min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <span>{selectedExecTask ? normalizeTask(selectedExecTask).title : 'Task'} — Execution</span>
                      {selectedExecTask && (()=>{ const i=availabilityBadge(normalizeTask(selectedExecTask)); const cls=i.tone==='green'?'bg-emerald-100 text-emerald-800': i.tone==='amber'?'bg-amber-100 text-amber-800':'bg-gray-100 text-gray-800'; return (<span className={`text-[10px] px-2 py-0.5 rounded-full ${cls}`}>{i.label}</span>); })()}
                    </div>
                    <div className="flex items-center gap-2">
                      {scanPanel.session && (
                        <button
                          className="px-2 py-1 text-xs rounded bg-gray-700 text-white disabled:opacity-60"
                          disabled={scanPanel.ending}
                          title="End current session"
                          onClick={async ()=>{
                            try {
                              setScanPanel((p)=>({ ...p, ending: true }));
                              const r = await fetch('/api/attendance?section=sessionEnd', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sessionId: scanPanel.session.id })});
                              const j = await r.json().catch(()=>({}));
                              if(!r.ok) throw new Error(j.error||`HTTP ${r.status}`);
                              setScanPanel((p)=>({ ...p, ending: false, session: null, sessionToken: '', logs: [] }));
                              setSessionEvents([]);
                              clearModeratorSession();
                            } catch(e){
                              setScanPanel((p)=>({ ...p, ending: false }));
                              alert('Failed to end session: '+(e.message||e));
                            }
                          }}
                        >End Session</button>
                      )}
                      <button
                        className="px-2 py-1 text-xs rounded bg-rose-600 text-white disabled:opacity-60"
                        disabled={scanPanel.starting || (selectedExecKind==='scanner' && selectedExecTask && !isWithinTaskWindow(normalizeTask(selectedExecTask)))}
                        title={selectedExecKind==='scanner' && selectedExecTask && !isWithinTaskWindow(normalizeTask(selectedExecTask)) ? 'Outside allowed time window' : 'Start scanner session'}
                        onClick={async ()=>{
                          try {
                            setScanPanel((p)=>({ ...p, starting: true }));
                            const r = await fetch('/api/attendance?section=sessionStart', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ roleKey: 'msp_ele_moderator', programKey: 'MSP', track: 'elementary' })});
                            const j = await r.json();
                            if(!r.ok) throw new Error(j.error||`HTTP ${r.status}`);
                            setScanPanel((p)=>({ ...p, starting: false, session: j.session, sessionToken: j.token }));
                            try { saveModeratorSession(j.session, j.token); } catch {}
                          } catch(e){
                            setScanPanel((p)=>({ ...p, starting: false }));
                            alert('Failed to start scanner: '+(e.message||e));
                          }
                        }}
                      >{scanPanel.session ? 'Restart' : 'Start'} Session</button>
                    </div>
                  </div>
                  {selectedExecKind === 'scanner' && scanPanel.session ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch h-[60vh]">
                      {/* LEFT: Task details + Session code */}
                      <div className="bg-rose-50 border border-rose-100 rounded p-2 flex flex-col min-h-0">
                        <div className="font-semibold text-rose-900 mb-1">Day Opening — Task & Session</div>
                        {/* Day opening task details */}
                        {Array.isArray(selectedRoleBundle?.tasks) && selectedRoleBundle.tasks.length > 0 && (
                          (() => {
                            const tasks = selectedRoleBundle.tasks;
                            const pick = tasks.find((t) => /day\s*open|open\s*day|opening/i.test(String(t.title||''))) || tasks[0];
                            return (
                              <div className="mb-2 text-[12px] text-rose-900/90">
                                <div className="font-semibold">{pick?.title || 'Day Opening Task'}</div>
                                {pick?.description && (
                                  <div className="mt-0.5 text-rose-900/80">{pick.description}</div>
                                )}
                                {Array.isArray(pick?.submissables) && pick.submissables.length > 0 && (
                                  <ol className="mt-1 list-decimal pl-4 space-y-0.5">
                                    {pick.submissables.map((s, i) => (
                                      <li key={i}>{String(s)}</li>
                                    ))}
                                  </ol>
                                )}
                              </div>
                            );
                          })()
                        )}
                        <div className="text-[11px] text-rose-900/80 mb-2">
                          Display this session code for students to scan. You can also paste a personal code.
                        </div>
                        {scanPanel.sessionToken ? (
                          <div className="flex flex-col sm:flex-row gap-3 items-center">
                            <QrCode value={scanPanel.sessionToken} size={160} className="bg-white rounded p-2 border" />
                            <div className="text-[11px] text-gray-700 break-all font-mono max-w-full">
                              {scanPanel.sessionToken}
                            </div>
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-[11px] text-gray-600">Show this QR on your screen for members to scan, or paste their personal code below.</div>
                          {scanPanel.sessionToken && (
                            <button
                              type="button"
                              onClick={() => setShowSessionQR(true)}
                              className="text-xs px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-700"
                            >
                              Fullscreen QR
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end mt-2">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] text-gray-600">Member Code (paste from member’s phone)</label>
                            <input
                              value={scanPanel.userTokenInput}
                              onChange={(e)=> setScanPanel((p)=>({ ...p, userTokenInput: e.target.value }))}
                              placeholder="paste-token-here"
                              className="w-full border rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <button
                            className="px-3 py-2 rounded bg-rose-600 text-white text-xs disabled:opacity-60"
                            disabled={!scanPanel.userTokenInput || scanPanel.ingesting || (selectedExecKind==='scanner' && selectedExecTask && !isWithinTaskWindow(normalizeTask(selectedExecTask)))}
                            title={(selectedExecKind==='scanner' && selectedExecTask && !isWithinTaskWindow(normalizeTask(selectedExecTask))) ? 'Outside allowed time window' : 'Mark present'}
                            onClick={async ()=>{
                              try{
                                setScanPanel((p)=>({ ...p, ingesting: true }));
                                const r = await fetch('/api/attendance?section=ingest', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sessionToken: scanPanel.sessionToken, userToken: scanPanel.userTokenInput })});
                                const j = await r.json();
                                if(!r.ok) throw new Error(j.error||`HTTP ${r.status}`);
                                setScanPanel((p)=>({ ...p, ingesting: false, userTokenInput: "", logs: [{ ts: Date.now(), ok:true }, ...p.logs].slice(0,20) }));
                              } catch(e){
                                setScanPanel((p)=>({ ...p, ingesting: false, logs: [{ ts: Date.now(), ok:false, err: (e.message||String(e)) }, ...p.logs].slice(0,20) }));
                              }
                            }}
                          >Mark Present</button>
                        </div>
                      </div>
                      {/* RIGHT: Attendance full-height */}
                      <div className="bg-white border border-rose-100 rounded p-2 flex flex-col min-h-0">
                        <div className="font-semibold text-gray-900 mb-1">Attendance (History)</div>
                        <div className="flex-1 min-h-0">
                          {sessionEvents.length === 0 ? (
                            <div className="text-[11px] text-gray-600">No scans yet.</div>
                          ) : (
                            <ul className="h-full overflow-auto text-[12px] list-disc pl-4 pr-2">
                              {sessionEvents.map(ev => (
                                <li key={ev.id} className="text-gray-800">
                                  <span className="font-medium">{ev.name || ev.userId}</span>
                                  <span className="text-gray-500"> — {new Date(ev.at).toLocaleTimeString()}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : selectedExecKind === 'scanner' ? (
                    <div className="text-xs text-gray-700">Start a session to generate a code and begin attendance.</div>
                  ) : (
                    <div className="text-sm text-gray-700">
                      This task does not have a configured execution surface yet.
                      {selectedExecTask?.action && (
                        <div className="mt-2 text-[12px]"><span className="font-semibold">Suggested Action:</span> {selectedExecTask.action}</div>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          className="px-3 py-1.5 rounded bg-gray-800 text-white text-xs"
                          onClick={() => setIsRoleExecuteOpen(false)}
                        >Close</button>
                        <button
                          className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs"
                          onClick={() => alert('Coming soon: per-task execution flows')}
                        >Mark As Done (soon)</button>
                      </div>
                      <div className="mt-3 text-[11px] text-gray-500">Tip: we can add an execution_type column to role tasks (e.g., scanner | checklist | form) and route UI based on that.</div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Today's MRIs Column */}
          <motion.div
            className="bg-white/50 backdrop-blur-sm rounded-3xl shadow-md p-6 border border-teal-100/50 flex flex-col lg:col-span-1"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Calendar size={20} className="text-teal-600" />
                <h2 className="text-xl font-bold text-gray-800">Today's Rituals</h2>
              </div>
              <motion.button
                className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsRoutineTasksModalOpen(true)}
              >
                Routine tasks
              </motion.button>
            </div>
            <p className="text-sm text-gray-600 mb-6">{today}</p>

            {/* A-MRIs */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle size={18} className="text-teal-600" />
                A-Rituals
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {["MSP", "MHCP", "MNP"].map((program, index) => (
                  <motion.button
                    key={program}
                    className="bg-teal-50/80 rounded-xl p-3 flex items-center justify-center text-teal-800 font-semibold text-sm hover:bg-teal-100 transition-all duration-300"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => {
                      if (program === "MSP") setIsMSPModalOpen(true);
                      if (program === "MHCP") setIsMHCPModalOpen(true);
                      if (program === "MNP") setIsMNPModalOpen(true);
                    }}
                  >
                    {program}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* R-MRIs (Role-Based) */}
            {(roleTasksData?.roles || []).length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <CheckCircle size={18} className="text-rose-600" />
                  R-MRIs (Role-Based Tasks)
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {(roleTasksData.roles || []).map((r, index) => (
                    <motion.button
                      key={r.roleKey}
                      className="bg-rose-50/80 rounded-xl p-3 flex items-center justify-center text-rose-800 font-semibold text-sm hover:bg-rose-100 transition-all duration-300 text-center"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => { setSelectedRoleBundle(r); setRRoleModalOpen(true); }}
                      title={r.roleKey}
                    >
                      {r.roleName || r.roleKey}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* N-MRIs */}
            <div className="mb-6 flex-1">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Clock size={18} className="text-blue-600" />
                N-Rituals
              </h3>
              {isLoadingNMRIs ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                </div>
              ) : todayNMRIs.length === 0 ? (
                <p className="text-sm text-gray-600 text-center">No N-Rituals today</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {todayNMRIs.map((slot, index) => (
                    <motion.button
                      key={slot.id}
                      className="bg-gray-50/80 rounded-xl p-3 flex flex-col items-center justify-center text-center hover:bg-gray-100 transition-all duration-300"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setIsSlotDescriptionModalOpen(true);
                      }}
                    >
                      <p className="text-xs font-bold text-gray-800">Slot {slot.id}</p>
                      <p className="text-[0.6rem] text-gray-600">{slot.time}</p>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Buttons removed to keep column compact and avoid extra scroll */}
          </motion.div>

          {/* My All Rituals Column */}
          <motion.div
            className="bg-white/50 backdrop-blur-sm rounded-3xl shadow-md p-6 border border-teal-100/50 flex flex-col lg:col-span-2"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Calendar size={20} className="text-teal-600" />
              <h2 className="text-xl font-bold text-gray-800">All Rituals</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
              {/* A-Rituals Card */}
              <motion.div
                className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-md p-6 border border-teal-100/50 flex flex-col items-center justify-center text-center"
                whileHover={{ scale: 1.02, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.1)" }}
              >
                <Clock className="w-12 h-12 text-teal-600 mb-4" />
                <h3 className="text-lg font-bold text-gray-800 mb-2">A-Rituals</h3>
                <p className="text-sm text-gray-600 mb-4">View all A-Rituals for the week</p>
                <div className="grid grid-cols-3 gap-3 w-full">
                  {["MSP", "MHCP", "MNP", "MAP", "MGHP"].map((program, index) => (
                    <motion.button
                      key={program}
                      className="bg-teal-50/80 rounded-xl p-3 text-teal-800 font-semibold text-sm hover:bg-teal-100 transition-all duration-300"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => {
                        if (program === "MSP") setIsMSPModalOpen(true);
                        if (program === "MHCP") setIsMHCPModalOpen(true);
                        if (program === "MNP") setIsMNPModalOpen(true);
                        if (program === "MAP") setIsMAPModalOpen(true);
                        if (program === "MGHP") setIsMGHPModalOpen(true);
                      }}
                    >
                      {program}
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {/* N-Rituals Card */}
              <motion.div
                className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-md p-6 border border-teal-100/50 flex flex-col items-center justify-center text-center cursor-pointer"
                whileHover={{ scale: 1.02, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.1)" }}
                onClick={() => setIsNMRIsModalOpen(true)}
              >
                <Clock className="w-12 h-12 text-blue-600 mb-4" />
                <h3 className="text-lg font-bold text-gray-800 mb-2">N-Rituals</h3>
                <p className="text-sm text-gray-600">View all N-Rituals for the week</p>
              </motion.div>

              {/* R-Rituals Card */}
              {(roleTasksData?.roles || []).length > 0 && (
                <motion.div
                  className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-md p-6 border border-rose-100/50 flex flex-col text-left"
                  whileHover={{ scale: 1.02, boxShadow: "0 8px 16px rgba(225, 29, 72, 0.08)" }}
                >
                  <CheckCircle className="w-12 h-12 text-rose-600 mb-4" />
                  <h3 className="text-lg font-bold text-gray-800 mb-2">R-Rituals</h3>
                  <p className="text-sm text-gray-600 mb-4">Role-based tasks available to you</p>
                  <div className="grid grid-cols-2 gap-2">
                    {roleTasksData.roles
                      .flatMap((r) => (r.tasks || []).map((t) => ({ roleName: r.roleName || r.roleKey, task: t })))
                      .map((rt, idx) => (
                        <motion.button
                          key={`${rt.roleName}-${rt.task.id}`}
                          className="bg-rose-50 rounded-lg px-3 py-2 text-rose-800 text-xs font-medium hover:bg-rose-100 text-left truncate"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: idx * 0.03 }}
                          whileHover={{ scale: 1.03 }}
                          title={`${rt.roleName}: ${rt.task.title}`}
                          onClick={() => { setSelectedRTask(rt); setRTaskModalOpen(true); }}
                        >
                          {rt.task.title}
                        </motion.button>
                      ))}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Modals */}
        <AnimatePresence>
          {rRoleModalOpen && selectedRoleBundle && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col border border-rose-100/50"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-800">{selectedRoleBundle.roleName || selectedRoleBundle.roleKey}</h2>
                  <motion.button
                    onClick={() => setRRoleModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={20} />
                  </motion.button>
                </div>
                <div className="space-y-3 flex-1 min-h-0 pr-1 flex flex-col">
                  {/* Role definition tasks, each with an Execute button */}
                  <>
                    {Array.isArray(selectedRoleBundle.tasks) && selectedRoleBundle.tasks.length > 0 ? (
                      <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-3 overflow-x-auto snap-x pr-1">
                        {selectedRoleBundle.tasks.map((t) => {
                          const nt = normalizeTask(t);
                          return (
                            <TaskCard key={nt.id ?? t.id} task={nt} roleKey={selectedRoleBundle.roleKey} />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">No tasks defined for this role.</div>
                    )}
                  </>
                  
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {rTaskModalOpen && selectedRTask && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-md border border-rose-100/50"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-800">{selectedRTask.task.title}</h2>
                  <motion.button
                    onClick={() => setRTaskModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={20} />
                  </motion.button>
                </div>
                <div className="text-sm text-gray-700 mb-2">Role: <span className="font-medium">{selectedRTask.roleName}</span></div>
                {selectedRTask.task.description && (
                  <div className="text-sm text-gray-800 mb-2">{selectedRTask.task.description}</div>
                )}
                {Array.isArray(selectedRTask.task.submissables) && selectedRTask.task.submissables.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-semibold text-gray-800">Submissables</div>
                    <ol className="list-decimal pl-5 text-xs text-gray-700 mt-1 space-y-1">
                      {selectedRTask.task.submissables.map((s, i) => (<li key={i}>{String(s)}</li>))}
                    </ol>
                  </div>
                )}
                {selectedRTask.task.action && (
                  <div className="text-[12px] text-gray-700"><span className="font-semibold">Action:</span> {selectedRTask.task.action}</div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isAssignedTasksModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-md border border-teal-100/50"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Assigned Tasks</h2>
                  <motion.button
                    onClick={() => setIsAssignedTasksModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                  {todayAMRIs.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center">No assigned tasks for today.</p>
                  ) : (
                    todayAMRIs.map((task) => (
                      <div key={task.id} className="bg-gray-50/80 rounded-xl p-4">
                        <p className="text-sm font-semibold text-gray-800">{task.title}</p>
                        <p className="text-sm text-gray-600">{task.description || "No description"}</p>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                          Status: {task.status}
                        </span>
                        {task.sprints && task.sprints.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-gray-800">Sprints:</p>
                            <ul className="list-disc pl-5 text-xs text-gray-600">
                              {task.sprints.map((sprint) => (
                                <li key={sprint.id}>{sprint.title} - {sprint.status}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <motion.button
                  onClick={() => setIsAssignedTasksModalOpen(false)}
                  className="w-full bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300 mt-6"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {isRoutineTasksModalOpen && (
          <RoutineTrackerModal open={true} onClose={() => setIsRoutineTasksModalOpen(false)} />
        )}

        <AnimatePresence>
          {isAMRIsModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-md border border-teal-100/50"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Weekly A-Rituals</h2>
                  <motion.button
                    onClick={() => setIsAMRIsModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                  {weeklyAMRIs.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center">No A-Rituals this week.</p>
                  ) : (
                    weeklyAMRIs.map((day, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <h3 className="text-md font-semibold text-gray-800">{day.day}</h3>
                        <ul className="list-disc pl-5 text-sm text-gray-600">
                          {day.tasks.length === 0 ? (
                            <li>No A-Rituals for {day.day}</li>
                          ) : (
                            day.tasks.map((task, taskIndex) => (
                              <li key={taskIndex}>{task}</li>
                            ))
                          )}
                        </ul>
                      </motion.div>
                    ))
                  )}
                </div>
                <motion.button
                  onClick={() => setIsAMRIsModalOpen(false)}
                  className="w-full bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300 mt-6"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isNMRIsModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto border border-teal-100/50"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Weekly N-Rituals (Assigned Slots)</h2>
                  <motion.button
                    onClick={() => setIsNMRIsModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                {nmrisContent}
                <motion.button
                  onClick={() => setIsNMRIsModalOpen(false)}
                  className="w-full bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300 mt-6"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isSlotDescriptionModalOpen && selectedSlot && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-md border border-teal-100/50"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Slot {selectedSlot.id} Details</h2>
                  <motion.button
                    onClick={() => setIsSlotDescriptionModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <div className="space-y-3 text-sm text-gray-700">
                  <p><span className="font-semibold">Slot ID:</span> {selectedSlot.id}</p>
                  <p><span className="font-semibold">Name:</span> {selectedSlot.name}</p>
                  <p><span className="font-semibold">Time:</span> {selectedSlot.time}</p>
                  <p><span className="font-semibold">Description:</span> {selectedSlot.description || selectedSlot.name}</p>
                  <p><span className="font-semibold">Block:</span> {getBlockForSlot(selectedSlot.id)}</p>
                </div>
                <motion.button
                  onClick={() => setIsSlotDescriptionModalOpen(false)}
                  className="w-full bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300 mt-6"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fullscreen Session QR Modal (Moderator) */}
        <AnimatePresence>
          {showSessionQR && scanPanel.sessionToken && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[70]"
              onClick={() => setShowSessionQR(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl p-4 border shadow-xl max-w-full"
                onClick={(e)=> e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-gray-800">Session QR</div>
                  <button onClick={()=> setShowSessionQR(false)} className="text-gray-500 hover:text-gray-700" aria-label="Close">×</button>
                </div>
                <div className="flex items-center justify-center">
                  <QrCode value={scanPanel.sessionToken} size={380} className="bg-white rounded p-3 border" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Program Modals */}
        {["MSP", "MHCP", "MNP", "MAP", "MGHP"].map((program) => (
          <AnimatePresence key={program}>
            {(program === "MSP" && isMSPModalOpen) ||
            (program === "MHCP" && isMHCPModalOpen) ||
            (program === "MNP" && isMNPModalOpen) ||
            (program === "MAP" && isMAPModalOpen) ||
            (program === "MGHP" && isMGHPModalOpen) ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-md border border-teal-100/50"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">{program} Details</h2>
                    <motion.button
                      onClick={() => {
                        if (program === "MSP") setIsMSPModalOpen(false);
                        if (program === "MHCP") setIsMHCPModalOpen(false);
                        if (program === "MNP") setIsMNPModalOpen(false);
                        if (program === "MAP") setIsMAPModalOpen(false);
                        if (program === "MGHP") setIsMGHPModalOpen(false);
                      }}
                      className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <X size={24} />
                    </motion.button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Details for the {program} program will be displayed here.
                  </p>
                  <div className="bg-gray-50/80 rounded-xl p-4 text-sm text-gray-700">
                    <p>Coming soon: Detailed program information, schedules, and resources.</p>
                  </div>
                  <motion.button
                    onClick={() => {
                      if (program === "MSP") setIsMSPModalOpen(false);
                      if (program === "MHCP") setIsMHCPModalOpen(false);
                      if (program === "MNP") setIsMNPModalOpen(false);
                      if (program === "MAP") setIsMAPModalOpen(false);
                      if (program === "MGHP") setIsMGHPModalOpen(false);
                    }}
                    className="w-full bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300 mt-6"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Close
                  </motion.button>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        ))}
      </div>
    </motion.div>
  );
}
