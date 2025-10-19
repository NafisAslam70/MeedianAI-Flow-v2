"use client";
import { motion } from "framer-motion";
import { Compass, Heart, Target, Star, Sparkles } from "lucide-react";

export default function Footer({ className = "", showFounders = true }) {
  const year = new Date().getFullYear();
  const principles = [
    { icon: <Compass size={12} />, label: "Vision" },
    { icon: <Heart size={12} />, label: "Sincerity & Objectivity" },
    { icon: <Target size={12} />, label: "Depth" },
    { icon: <Star size={12} />, label: "Discipline" },
    { icon: <Sparkles size={12} />, label: "Perseverance" },
  ];

  return (
    <footer className={`relative overflow-hidden bg-gray-900 text-white min-h-20 ${className}`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
      />

      <div className="relative z-10 w-full max-w-screen-2xl mx-auto px-3 pt-2 pb-9 min-h-20 flex items-center">
        <div className="w-full grid grid-cols-1 md:grid-cols-3 items-center gap-2">
          {/* Left: Founders */}
          <motion.div
            className="order-2 md:order-1 text-[11px] sm:text-xs text-slate-200/90 md:justify-self-start self-center"
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {showFounders ? (
              <>
                <span className="whitespace-nowrap">
                  Founder: <span className="font-semibold text-cyan-200">Mr Aslam Kamal</span>
                </span>
                <span className="mx-1">·</span>
                <span className="whitespace-nowrap">
                  Founder (Rev.): <span className="font-semibold text-cyan-200">Shaikh Zifan</span>
                </span>
              </>
            ) : (
              <span className="whitespace-nowrap">
                © {year} MeedianAI Flow. All rights reserved.
              </span>
            )}
          </motion.div>

          {/* Center: Principles ribbon */}
          <motion.ul
            className="order-1 md:order-2 w-full flex items-center justify-center flex-wrap gap-1.5 self-center"
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {principles.map((p, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-900/40 bg-white/5 px-2 py-0.5 text-[10px] text-cyan-100/90 hover:bg-white/10 transition"
                title={p.label}
              >
                <span className="text-cyan-200">{p.icon}</span>
                <span className="hidden sm:inline">{p.label}</span>
              </li>
            ))}
          </motion.ul>

          {/* Right: Credits */}
          <motion.p
            className="order-3 text-[11px] sm:text-xs font-light flex items-center justify-start md:justify-end gap-2 text-slate-200 self-center"
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
          >
            {showFounders && (
              <>
                <span>© {year} MeedianAI Flow</span>
                <span className="hidden sm:inline">·</span>
              </>
            )}
            <span className="text-slate-200">Proudly designed by</span>
            <a
              href="https://www.linkedin.com/in/nafis-aslam"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-300 hover:text-blue-400 transition-colors"
            >
              Nafees Aslam
            </a>
            <a
              href="https://github.com/nafees-aslam"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="GitHub Profile"
              title="GitHub"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48v-1.69c-2.78.6-3.36-1.34-3.36-1.34-.46-1.16-1.12-1.47-1.12-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.64-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0112 6.8c.85 0 1.71.11 2.52.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10.01 10.01 0 0022 12c0-5.52-4.48-10-10-10z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/nafis-aslam/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="LinkedIn Profile"
              title="LinkedIn"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14zm-9.5 6.5H7v8h2.5v-8zm1.25-2a1.75 1.75 0 100 3.5 1.75 1.75 0 000-3.5zm6.75 5.25c0-1.25-.75-2.25-2-2.25-.5 0-1 .25-1.25.75v-1.25H12v8h2.5v-4.5c0-.75.5-1.25 1-1.25s1 .5 1 1.25v4.5H19v-5.25z" />
              </svg>
            </a>
          </motion.p>
        </div>
      </div>
    </footer>
  );
}
