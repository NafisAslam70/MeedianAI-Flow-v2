"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function DayCloseModal({ open, onClose, defaultDate }) {
  const [date, setDate] = useState(defaultDate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [cash, setCash] = useState(0);
  const [upi, setUpi] = useState(0);
  const [bank, setBank] = useState(0);
  const [transport, setTransport] = useState(0);
  const [admissions, setAdmissions] = useState(0);
  const [expenses, setExpenses] = useState(0);

  const [receiptsAdj, setReceiptsAdj] = useState(0);
  const [expensesAdj, setExpensesAdj] = useState(0);

  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");

  const [notes, setNotes] = useState("");
  const [locked, setLocked] = useState(false);

  const totalReceipts = useMemo(
    () => (Number(cash)||0) + (Number(upi)||0) + (Number(bank)||0) + (Number(transport)||0) + (Number(admissions)||0) + (Number(receiptsAdj)||0),
    [cash, upi, bank, transport, admissions, receiptsAdj]
  );
  const totalExpenses = useMemo(
    () => (Number(expenses)||0) + (Number(expensesAdj)||0),
    [expenses, expensesAdj]
  );
  const net = useMemo(() => totalReceipts - totalExpenses, [totalReceipts, totalExpenses]);

  useEffect(() => {
    if (!open) return;
    const run = async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/accountant/day-summary?date=${date}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to fetch");
        const s = d.summary || {};
        setCash(s.cash || 0);
        setUpi(s.upi || 0);
        setBank(s.bank || 0);
        setTransport(s.transport || 0);
        setAdmissions(s.admissions || 0);
        setExpenses(s.expenses || 0);
        setOpeningCash(s.openingCash ?? "");
        setClosingCash(s.closingCash ?? "");
        setNotes(s.notes || "");
        setReceiptsAdj(s.adjustments?.receiptsAdj || 0);
        setExpensesAdj(s.adjustments?.expensesAdj || 0);
        setLocked(!!s.isLocked);
      } catch (e) {
        setErr(e.message || "Error");
        setTimeout(() => setErr(""), 3000);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [open, date]);

  const submit = async (lock) => {
    try {
      setSaving(true);
      const r = await fetch("/api/accountant/day-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          cash: Number(cash)||0,
          upi: Number(upi)||0,
          bank: Number(bank)||0,
          transport: Number(transport)||0,
          admissions: Number(admissions)||0,
          expenses: Number(expenses)||0,
          openingCash: openingCash === "" ? null : Number(openingCash),
          closingCash: closingCash === "" ? null : Number(closingCash),
          notes,
          adjustments: { receiptsAdj: Number(receiptsAdj)||0, expensesAdj: Number(expensesAdj)||0, note: notes || "" },
          lock
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to save");
      setOk(lock ? "Day closed & locked!" : "Saved draft");
      setLocked(lock || locked);
      setTimeout(() => setOk(""), 2500);
      if (lock) onClose?.();
    } catch (e) {
      setErr(e.message || "Error");
      setTimeout(() => setErr(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-[80] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: 24, scale: .98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: .98, opacity: 0 }}
            className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl border border-white/10 p-4 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold">Day Close Summary (Accounts)</h2>
              <input
                type="date"
                value={date}
                onChange={(e)=>setDate(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm bg-white/70 dark:bg-slate-800/60 border border-gray-200/40 dark:border-white/10"
                disabled={locked}
              />
            </div>

            {err && <p className="mb-3 text-red-600 text-sm">{err}</p>}
            {ok && <p className="mb-3 text-green-600 text-sm">{ok}</p>}

            {loading ? (
              <div className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800" />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card title="Receipts">
                    <GridInput label="Cash" value={cash} setValue={setCash} disabled />
                    <GridInput label="UPI" value={upi} setValue={setUpi} disabled />
                    <GridInput label="Bank" value={bank} setValue={setBank} disabled />
                    <GridInput label="Transport" value={transport} setValue={setTransport} disabled />
                    <GridInput label="Admissions" value={admissions} setValue={setAdmissions} disabled />
                    <GridInput label="Adj. (+/-)" value={receiptsAdj} setValue={setReceiptsAdj} />
                    <Row label="Total Receipts" value={totalReceipts} bold />
                  </Card>

                  <Card title="Expenses">
                    <GridInput label="Total Expenses" value={expenses} setValue={setExpenses} disabled />
                    <GridInput label="Adj. (+/-)" value={expensesAdj} setValue={setExpensesAdj} />
                    <Row label="Net (R - E)" value={net} bold />
                  </Card>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <Card title="Cash Book (optional)">
                    <GridInput label="Opening Cash" value={openingCash} setValue={setOpeningCash} editableString />
                    <GridInput label="Closing Cash" value={closingCash} setValue={setClosingCash} editableString />
                  </Card>
                  <Card title="Notes">
                    <textarea
                      value={notes} onChange={(e)=>setNotes(e.target.value)}
                      placeholder="Remarks / carry forwards / exceptions"
                      className="w-full h-28 p-3 rounded-xl border bg-white/70 dark:bg-slate-800/60"
                    />
                  </Card>
                </div>

                <div className="flex justify-end gap-3 mt-5">
                  <button onClick={()=>onClose?.()} className="px-4 py-2 rounded-xl border" disabled={saving}>Cancel</button>
                  {!locked && (
                    <>
                      <button onClick={()=>submit(false)} className="px-4 py-2 rounded-xl border" disabled={saving}>Save draft</button>
                      <button onClick={()=>submit(true)} className="px-4 py-2 rounded-xl bg-indigo-600 text-white" disabled={saving}>Close Day</button>
                    </>
                  )}
                  {locked && <span className="text-sm text-gray-500">Locked</span>}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-gray-100/30 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}

function GridInput({ label, value, setValue, disabled, editableString }) {
  const onChange = (e) => {
    const v = e.target.value;
    if (editableString) setValue(v);
    else setValue(v === "" ? 0 : Number(v));
  };
  return (
    <label className="flex items-center justify-between gap-3 mb-2">
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
      <input
        type="number"
        value={value}
        onChange={onChange}
        className="w-36 px-3 py-2 rounded-xl border bg-white/70 dark:bg-slate-800/60 text-right"
        disabled={disabled}
      />
    </label>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-sm">{label}</span>
      <span>₹ {value || 0}</span>
    </div>
  );
}
