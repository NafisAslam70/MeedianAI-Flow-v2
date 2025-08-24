import { motion } from "framer-motion";

const DC_ORIGIN = "https://deep-calendar.vercel.app";

function fromMinutes(m) {
  const H = String(Math.floor(m / 60)).padStart(2, "0");
  const M = String(m % 60).padStart(2, "0");
  return `${H}:${M}`;
}

function depthBadge(d) {
  if (d === 3) return { text: "L3", border: "border-indigo-600", bg: "bg-indigo-50/80", textColor: "text-indigo-600" };
  if (d === 2) return { text: "L2", border: "border-blue-600", bg: "bg-blue-50/80", textColor: "text-blue-600" };
  return { text: "L1", border: "border-teal-600", bg: "bg-teal-50/80", textColor: "text-teal-600" };
}

function humanMinutes(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const DeepCalendarModal = ({ open, onClose, items, window, goalById }) => {
  if (!open) return null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white/95 backdrop-blur-lg shadow-2xl border border-gray-200/50">
        <div className="flex items-center justify-between border-b border-gray-200/50 p-5">
          <div className="font-semibold text-lg text-gray-900">Today’s Routine</div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-lg border border-gray-200/50 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-100/80"
            onClick={onClose}
          >
            Close
          </motion.button>
        </div>
        <div className="max-h-[60vh] overflow-auto p-5">
          <div className="mb-3 text-sm text-gray-600">
            {window ? (
              <>
                Window: <b className="text-gray-800">{fromMinutes(window.openMin)}–{fromMinutes(window.closeMin)}</b>
              </>
            ) : (
              "Window: —"
            )}
          </div>
          {Array.isArray(items) && items.length ? (
            <ul className="space-y-3">
              {items.map((it, idx) => {
                const active = it.startMin <= nowMin && nowMin < it.endMin;
                const badge = depthBadge(it.depthLevel);
                const durMin = Math.max(1, it.endMin - it.startMin);
                const goalLabel = it.goalId && goalById[it.goalId]?.label ? goalById[it.goalId].label : null;
                return (
                  <li
                    key={it.id ?? idx}
                    className={`rounded-lg border p-3 ${active ? "ring-2 ring-teal-500" : ""} ${badge.bg} ${badge.border} transition-all`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-800">
                        {fromMinutes(it.startMin)}–{fromMinutes(it.endMin)} • {it.label || "Block"}
                      </div>
                      <div className={`ml-2 shrink-0 text-xs font-semibold ${badge.textColor}`}>
                        {badge.text}
                      </div>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-3">
                      <div>
                        <span className="text-gray-500">Duration:</span> {humanMinutes(durMin)}
                      </div>
                      <div>
                        <span className="text-gray-500">Depth:</span> {badge.text}
                      </div>
                      <div className="truncate">
                        <span className="text-gray-500">Goal:</span> {goalLabel || (it.goalId ? `#${it.goalId}` : "—")}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-sm text-gray-600">No blocks scheduled for today.</div>
          )}
          <div className="mt-3 rounded-lg bg-gray-50/80 p-2 text-xs text-gray-700">
            Powered by <span className="font-medium">DeepCalendar</span>.{" "}
            <a className="text-teal-600 underline hover:text-teal-700" href={DC_ORIGIN} target="_blank" rel="noreferrer">
              Explore DeepCalendar →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

const ActiveBlockView = ({ item }) => {
  const badge = depthBadge(item.depthLevel);
  const durMin = Math.max(1, item.endMin - item.startMin);
  return (
    <div className={`rounded-lg border p-2 ${badge.bg} ${badge.border} transition-all`} title={`Depth ${badge.text}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="truncate font-semibold text-gray-800">{item.label ?? "Deep block"}</span>
        <span className="ml-2 shrink-0">{fromMinutes(item.startMin)}–{fromMinutes(item.endMin)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
        <span>{badge.text}</span>
        <span>{humanMinutes(durMin)}</span>
      </div>
    </div>
  );
};

export { DeepCalendarModal, ActiveBlockView, fromMinutes, depthBadge, humanMinutes };