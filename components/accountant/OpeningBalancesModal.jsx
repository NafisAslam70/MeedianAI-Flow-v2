// components/accountant/OpeningBalancesModal.jsx
"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function OpeningBalancesModal({ open, onClose }) {
  const [loading, setLoading] = useState(true);
  const [booksStartDate, setBooksStartDate] = useState("");
  const [openingCash, setOpeningCash] = useState(0);
  const [openingUPI, setOpeningUPI] = useState(0);
  const [openingBank, setOpeningBank] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch("/api/accountant/settings");
        const d = await r.json();
        if (d?.settings) {
          setBooksStartDate(d.settings.booksStartDate?.slice(0,10) || "");
          setOpeningCash(d.settings.openingCash || 0);
          setOpeningUPI(d.settings.openingUPI || 0);
          setOpeningBank(d.settings.openingBank || 0);
        }
      } finally { setLoading(false); }
    })();
  }, [open]);

  const save = async () => {
    try {
      const r = await fetch("/api/accountant/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booksStartDate, openingCash: Number(openingCash)||0, openingUPI: Number(openingUPI)||0, openingBank: Number(openingBank)||0 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setMsg("Saved!");
      setTimeout(()=>{ setMsg(""); onClose?.(); }, 800);
    } catch (e) {
      setMsg(e.message || "Error");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/60 backdrop-blur-md z-[90] flex items-center justify-center p-4">
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} exit={{y:20,opacity:0}} className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl p-5 border">
            <h3 className="text-lg font-bold mb-3">Initialize Accounts (one time)</h3>
            {loading ? <div className="h-24 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse" /> : (
              <>
                <label className="block mb-2 text-sm">Books Start Date</label>
                <input type="date" className="w-full mb-3 px-3 py-2 rounded-xl border" value={booksStartDate} onChange={e=>setBooksStartDate(e.target.value)} />
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Opening Cash" value={openingCash} setValue={setOpeningCash} />
                  <Field label="Opening UPI" value={openingUPI} setValue={setOpeningUPI} />
                  <Field label="Opening Bank" value={openingBank} setValue={setOpeningBank} />
                </div>
                {msg && <p className="mt-3 text-sm">{msg}</p>}
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={()=>onClose?.()} className="px-4 py-2 rounded-xl border">Cancel</button>
                  <button onClick={save} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">Save</button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
function Field({ label, value, setValue }) {
  return (
    <label className="text-sm">
      <div className="mb-1">{label}</div>
      <input type="number" className="w-full px-3 py-2 rounded-xl border" value={value} onChange={e=>setValue(e.target.value)} />
    </label>
  );
}
