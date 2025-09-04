"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, Compass, Target, Heart, Star, Sparkles } from "lucide-react";

export default function AboutMeedModal({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="about-meed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10060] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={onClose}
          aria-modal
          role="dialog"
          aria-label="About MEED"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[96vw] max-w-4xl max-h-[86vh] overflow-hidden rounded-3xl border border-cyan-900/30 shadow-2xl bg-gradient-to-br from-[#0b1220] via-[#0e1730] to-[#0b1220] text-cyan-50"
          >
            {/* Header */}
            <div className="relative px-5 py-4 border-b border-cyan-900/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl border border-cyan-900/40 bg-white/10">
                  <BookOpen className="w-5 h-5 text-cyan-300" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-cyan-100">About MEED</h3>
                  <p className="text-xs text-cyan-200/80">Blueprint • Principles • Operations • Pledges</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" aria-label="Close">
                <X className="w-4 h-4 text-cyan-200" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto max-h-[74vh] space-y-6">
              {/* Intro */}
              <section className="rounded-2xl border border-cyan-900/40 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 mt-0.5 text-yellow-300" />
                  <p className="text-sm leading-relaxed text-cyan-100/90">
                    The MEED Blueprint is the educational constitution of Meed Public School. It aligns worldly competence with spiritual depth and is operationalized through disciplined daily rituals (MRIs): day openings, academic (AMRI) and non‑academic (NMRI) rhythms, and reflective closures.
                  </p>
                </div>
              </section>

              {/* Principles */}
              <section>
                <h4 className="text-sm font-semibold tracking-wide text-cyan-200 mb-3">Foundational Principles</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Card icon={<Compass className="w-4 h-4" />} title="Vision with Depth" desc="Basirat: begin with insight, aim with clarity." />
                  <Card icon={<Heart className="w-4 h-4" />} title="Sincerity & Justice" desc="Ikhlas & Adl: pure intent and fair action." />
                  <Card icon={<Target className="w-4 h-4" />} title="Depth in Knowledge" desc="Itqan: precision, contemplation, focused study." />
                  <Card icon={<Star className="w-4 h-4" />} title="Discipline over Outcome" desc="Nizam: rituals build resilience; effort over results." />
                  <Card icon={<Sparkles className="w-4 h-4" />} title="Perseverance & Sustainability" desc="Sabr & Istiqamah: keep the flame steady." />
                </div>
              </section>

              {/* Operations */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-cyan-900/40 bg-white/5 p-4">
                  <h4 className="text-sm font-semibold text-cyan-200 mb-2">Operations Manual — MRIs</h4>
                  <ul className="list-disc ml-5 text-sm space-y-1 text-cyan-100/90">
                    <li>AMRIs: academic program slots with Person‑in‑Charge + TOD.</li>
                    <li>NMRIs: non‑program slots for character, health, recreation, rest.</li>
                    <li>Daily cadence: day open, focused blocks, reflective shutdowns.</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-cyan-900/40 bg-white/5 p-4">
                  <h4 className="text-sm font-semibold text-cyan-200 mb-2">Daily Slot Architecture</h4>
                  <p className="text-sm text-cyan-100/90"><span className="font-semibold">17</span> micro‑rituals across <span className="font-semibold">7</span> blocks.</p>
                  <p className="text-xs text-cyan-200/80 mt-1">AMRIs: 0, 3, 4, 6, 10, 13, 14 • NMRIs: others (incl. Blitz windows)</p>
                </div>
              </section>

              {/* Pledge */}
              <section className="rounded-2xl border border-cyan-900/40 bg-white/5 p-4">
                <h4 className="text-sm font-semibold text-cyan-200 mb-2">Student Pledge (Excerpt)</h4>
                <p className="text-sm text-cyan-100/90 leading-relaxed">
                  “I pledge sincerity, depth and discipline; to uphold rituals over results, persevere through difficulty, honor parents’ sacrifice, and carry this day with integrity, gratitude and faith. This is my promise. This is my identity. This is my future.”
                </p>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Card({ icon, title, desc }) {
  return (
    <div className="rounded-2xl border border-cyan-900/40 bg-white/5 p-3">
      <div className="flex items-center gap-2 text-cyan-200 mb-1">
        <span className="inline-flex w-6 h-6 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-900/40">
          {icon}
        </span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="text-xs text-cyan-100/80 leading-relaxed">{desc}</p>
    </div>
  );
}

