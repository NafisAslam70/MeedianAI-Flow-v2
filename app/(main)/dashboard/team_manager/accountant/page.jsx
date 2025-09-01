"use client";

import React, { useEffect, useMemo, useState } from "react";

/* =========================
   Small helpers
========================= */
const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString("en-IN") : "0");
const todayStr = () => new Date().toISOString().slice(0, 10);
const yyyymm = (d) => (d || todayStr()).slice(0, 7);
const cls = (...xs) => xs.filter(Boolean).join(" ");
const rupee = (n) => `₹ ${fmt(n)}`;

/* =========================
   Reusable UI
========================= */
function Section({ title, children, right }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-gray-900/60 shadow-sm mb-3">
      <div className="px-3 py-2 border-b border-gray-100/80 dark:border-white/10 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
        {right || null}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg border-gray-200 dark:border-white/10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-3 py-2 font-medium text-gray-800 dark:text-gray-100 flex items-center justify-between"
      >
        <span>{title}</span>
        <span className="text-xs">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

/* =========================
   Fetch helpers
========================= */
async function apiGet(url) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `GET ${url} failed`);
  return j;
}
async function apiPost(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `POST ${url} failed`);
  return j;
}

/* =========================
   Accountant / Fees App
========================= */
export default function Accountant() {
  const [tab, setTab] = useState("dashboard"); // "dashboard" | "collect" | "students" | "dayclose" | "settings"

  /* ---------- shared state ---------- */
  const [date, setDate] = useState(todayStr()); // used on Dashboard & Day Close
  const month = yyyymm(date);

  /* ---------- settings/meta ---------- */
  const [settings, setSettings] = useState({
    booksStartDate: "",
    openingCash: 0,
    openingUPI: 0,
    openingBank: 0,
  });
  const [feeMeta, setFeeMeta] = useState({
    // simplified meta: heads & default amounts; backend can expand by class/hostel/etc.
    heads: [], // [{id, name, kind:'tuition'|'hostel'|'transport'|'supplies'|'other', periodicity:'monthly'|'one-time', defaultAmount, className? }]
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingHead, setSavingHead] = useState(false);
  const [newHead, setNewHead] = useState({
    name: "",
    kind: "tuition",
    periodicity: "monthly",
    defaultAmount: "",
    className: "",
  });

  /* ---------- dashboard ---------- */
  const [receipts, setReceipts] = useState({ items: [], totals: { cash: 0, upi: 0, bank: 0, total: 0 } });
  const [expenses, setExpenses] = useState({ items: [], totals: { cash: 0, upi: 0, bank: 0, total: 0 } });
  const [overview, setOverview] = useState({
    totals: { paid: 0, due: 0, total: 0 },
    byClass: [], // [{className, paid, due, total}]
    hostel: { paid: 0, due: 0, total: 0 },
    transport: { paid: 0, due: 0, total: 0 },
  });
  const [addingExpense, setAddingExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: "", amount: "", paidBy: "cash", note: "" });

  /* ---------- day close ---------- */
  const [summary, setSummary] = useState(null);
  const [dayForm, setDayForm] = useState({
    openingCash: 0,
    cashIn: 0,
    cashOut: 0,
    adjustments: 0,
    notes: "",
    upiIn: 0,
    bankIn: 0,
    expensesTotal: 0,
  });
  const computedClosing = useMemo(() => {
    const oc = Number(dayForm.openingCash || 0);
    const ci = Number(dayForm.cashIn || 0);
    const co = Number(dayForm.cashOut || 0);
    const adj = Number(dayForm.adjustments || 0);
    return oc + ci - co + adj;
  }, [dayForm]);
  const [savingClose, setSavingClose] = useState(false);

  /* ---------- collect fees ---------- */
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]); // students search results
  const [selected, setSelected] = useState(null); // selected student object
  const [account, setAccount] = useState(null); // dues/paid per month & heads
  const [collectForm, setCollectForm] = useState({
    method: "cash", // 'cash' | 'upi' | 'bank'
    note: "",
    items: [], // [{month:'YYYY-MM', headId, amount}]
  });
  const totalCollect = useMemo(() => collectForm.items.reduce((s, x) => s + Number(x.amount || 0), 0), [collectForm]);

  /* ---------- students ---------- */
  const [students, setStudents] = useState([]);
  const [stuFilters, setStuFilters] = useState({ className: "", q: "" });
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({
    name: "",
    admission_number: "",
    class_name: "",
    section_type: "junior",
    guardian_name: "",
    guardian_phone: "",
    is_hosteller: false,
    transport_chosen: false,
  });

  /* =========================
     Loaders
  ========================= */
  async function loadAccountantDay(d = date) {
    const [s, r, e, sum] = await Promise.all([
      apiGet("/api/accountant/settings"),
      apiGet(`/api/accountant/receipts?date=${d}`),
      apiGet(`/api/accountant/expenses?date=${d}`),
      apiGet(`/api/accountant/summary?date=${d}`),
    ]);
    setSettings({
      booksStartDate: s?.settings?.booksStartDate ? s.settings.booksStartDate.slice(0, 10) : "",
      openingCash: Number(s?.settings?.openingCash || 0),
      openingUPI: Number(s?.settings?.openingUPI || 0),
      openingBank: Number(s?.settings?.openingBank || 0),
    });
    setReceipts({ items: r?.items || [], totals: r?.totals || { cash: 0, upi: 0, bank: 0, total: 0 } });
    setExpenses({ items: e?.items || [], totals: e?.totals || { cash: 0, upi: 0, bank: 0, total: 0 } });

    const sm = sum?.summary || null;
    setSummary(sm);
    setDayForm({
      openingCash: Number(sm?.openingCash || 0),
      cashIn: Number(sm?.cash || 0), // clubbed CASH in
      cashOut: Number(sm?._computed?.cashExpenses || 0),
      adjustments: 0,
      notes: "",
      upiIn: Number(sm?.upi || 0),
      bankIn: Number(sm?.bank || 0),
      expensesTotal: Number(sm?.expenses || 0),
    });
  }

  async function loadOverview(m = month) {
    // Implement this endpoint to compute paid/due totals per month/class/hostel/transport
    // Expected shape shown above in overview state.
    try {
      const j = await apiGet(`/api/fees/overview?month=${m}`);
      setOverview({
        totals: j?.totals || { paid: 0, due: 0, total: 0 },
        byClass: j?.byClass || [],
        hostel: j?.hostel || { paid: 0, due: 0, total: 0 },
        transport: j?.transport || { paid: 0, due: 0, total: 0 },
      });
    } catch (err) {
      // fallback empty; no alert to avoid noise
      setOverview((s) => ({ ...s, byClass: [], totals: { paid: 0, due: 0, total: 0 } }));
    }
  }

  async function loadFeeMeta() {
    try {
      const j = await apiGet("/api/meta/fees");
      setFeeMeta({ heads: j?.heads || [] });
    } catch {
      setFeeMeta({ heads: [] });
    }
  }

  async function searchStudents(q) {
    try {
      setSearching(true);
      const j = await apiGet(`/api/students/search?q=${encodeURIComponent(q)}`);
      setResults(j?.items || []);
    } catch (e) {
      alert(e.message || "Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function fetchStudentAccount(studentId) {
    try {
      const j = await apiGet(`/api/students/${studentId}/account`); // expect dues/paid per month & heads
      setAccount(j || null);
      // reset form items
      setCollectForm((s) => ({ ...s, items: [] }));
    } catch (e) {
      alert(e.message || "Failed loading account");
      setAccount(null);
    }
  }

  async function loadStudentsList() {
    try {
      setLoadingStudents(true);
      const params = new URLSearchParams();
      if (stuFilters.className) params.set("class", stuFilters.className);
      if (stuFilters.q) params.set("q", stuFilters.q);
      const j = await apiGet(`/api/students?${params.toString()}`);
      setStudents(j?.items || []);
    } catch (e) {
      alert(e.message || "Failed loading students");
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }

  /* initial + reactive loads */
  useEffect(() => {
    loadAccountantDay().catch(console.error);
    loadOverview().catch(console.error);
    loadFeeMeta().catch(console.error);
  }, []);
  useEffect(() => {
    loadAccountantDay(date).catch(console.error);
    loadOverview(yyyymm(date)).catch(console.error);
  }, [date]);

  /* =========================
     Actions
  ========================= */
  async function addExpense() {
    if (!newExpense.category || !newExpense.amount) {
      alert("Category and amount are required");
      return;
    }
    try {
      setAddingExpense(true);
      await apiPost("/api/accountant/expenses", {
        category: newExpense.category,
        amount: Number(newExpense.amount || 0),
        paidBy: newExpense.paidBy || "cash",
        note: newExpense.note || null,
        paidAt: `${date}T12:00:00`,
      });
      setNewExpense({ category: "", amount: "", paidBy: "cash", note: "" });
      await loadAccountantDay(date);
    } catch (e) {
      alert(e.message || "Failed to add expense");
    } finally {
      setAddingExpense(false);
    }
  }

  async function saveDay(lock = false) {
    try {
      setSavingClose(true);
      const body = {
        date,
        cash: Number(dayForm.cashIn || 0),
        upi: Number(dayForm.upiIn || 0),
        bank: Number(dayForm.bankIn || 0),
        expenses: Number(dayForm.expensesTotal || 0),
        openingCash: Number(dayForm.openingCash || 0),
        closingCash: computedClosing,
        notes: dayForm.notes || "",
        lock,
        _computedCashExpenses: Number(dayForm.cashOut || 0),
      };
      const res = await apiPost("/api/accountant/summary", body);
      setSummary(res?.summary || null);
      alert(lock ? "Day closed & locked." : "Day summary saved.");
      await loadAccountantDay(date);
    } catch (e) {
      alert(e.message || "Failed saving day");
    } finally {
      setSavingClose(false);
    }
  }

  async function saveSettings() {
    try {
      setSavingSettings(true);
      await apiPost("/api/accountant/settings", {
        booksStartDate: settings.booksStartDate || todayStr(),
        openingCash: Number(settings.openingCash || 0),
        openingUPI: Number(settings.openingUPI || 0),
        openingBank: Number(settings.openingBank || 0),
      });
      alert("Accounting settings saved.");
    } catch (e) {
      alert(e.message || "Failed saving settings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function upsertFeeHead() {
    if (!newHead.name || !newHead.defaultAmount) {
      alert("Head name and default amount are required");
      return;
    }
    try {
      setSavingHead(true);
      const body = {
        name: newHead.name.trim(),
        kind: newHead.kind,
        periodicity: newHead.periodicity,
        defaultAmount: Number(newHead.defaultAmount || 0),
        className: newHead.className || null,
      };
      await apiPost("/api/meta/fees", body);
      setNewHead({ name: "", kind: "tuition", periodicity: "monthly", defaultAmount: "", className: "" });
      await loadFeeMeta();
      alert("Fee head saved.");
    } catch (e) {
      alert(e.message || "Failed saving head");
    } finally {
      setSavingHead(false);
    }
  }

  async function addStudent() {
    if (!newStudent.name || !newStudent.admission_number || !newStudent.class_name) {
      alert("Name, Admission No, and Class are required");
      return;
    }
    try {
      setAddingStudent(true);
      await apiPost("/api/students", newStudent);
      setNewStudent({
        name: "",
        admission_number: "",
        class_name: "",
        section_type: "junior",
        guardian_name: "",
        guardian_phone: "",
        is_hosteller: false,
        transport_chosen: false,
      });
      await loadStudentsList();
      alert("Student added.");
    } catch (e) {
      alert(e.message || "Failed adding student");
    } finally {
      setAddingStudent(false);
    }
  }

  async function collectNow() {
    if (!selected?.id || collectForm.items.length === 0) {
      alert("Pick at least one fee item to collect.");
      return;
    }
    try {
      const payload = {
        studentId: selected.id,
        method: collectForm.method,
        note: collectForm.note || null,
        items: collectForm.items.map((x) => ({
          month: x.month,
          headId: x.headId,
          amount: Number(x.amount || 0),
        })),
        collectedAt: new Date().toISOString(),
      };
      const j = await apiPost("/api/fees/collect", payload);
      alert(`Receipt #${j?.receipt?.number || j?.receipt?.id || "created"} for ${rupee(totalCollect)}`);
      // refresh today's receipts + student account
      await Promise.all([loadAccountantDay(date), fetchStudentAccount(selected.id)]);
      setCollectForm((s) => ({ ...s, items: [] }));
    } catch (e) {
      alert(e.message || "Failed to collect");
    }
  }

  /* =========================
     Derived figures (dashboard)
  ========================= */
  const cashInToday = Number(receipts?.totals?.cash || 0);
  const cashOutToday = Number(expenses?.totals?.cash || 0);
  const openingCash = Number(dayForm.openingCash || 0);
  const cashInHand = openingCash + cashInToday - cashOutToday + Number(dayForm.adjustments || 0);

  /* =========================
     Render
  ========================= */
  return (
    <div className="p-3">
      {/* Top Nav / Tabs */}
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Accounts & Fees</h2>
        <div className="ml-auto flex gap-1 flex-wrap">
          {[
            ["dashboard", "Dashboard"],
            ["collect", "Collect Fees"],
            ["students", "Students"],
            ["dayclose", "Day Close"],
            ["settings", "Settings / Meta"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={cls(
                "px-3 py-1 rounded",
                tab === k ? "bg-indigo-600 text-white" : "bg-gray-200 hover:bg-gray-300"
              )}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Date / Month picker (shared for Dashboard & Day Close) */}
      {(tab === "dashboard" || tab === "dayclose") && (
        <div className="flex items-center gap-2 mb-3">
          <label className="text-sm text-gray-600 dark:text-gray-300">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayStr())}
            className="px-2 py-1 border rounded"
          />
          <span className="text-xs text-gray-500">({new Date(date).toDateString()})</span>
        </div>
      )}

      {/* =========================
          DASHBOARD
      ========================= */}
      {tab === "dashboard" && (
        <>
          {/* Month overview */}
          <Section
            title={`Month Overview — ${month}`}
            right={
              <div className="text-sm text-gray-600">
                Paid: <b>{rupee(overview.totals.paid)}</b> &nbsp; | &nbsp; Due:{" "}
                <b>{rupee(overview.totals.due)}</b> &nbsp; | &nbsp; Expected:{" "}
                <b>{rupee(overview.totals.total)}</b>
              </div>
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-lg p-3 bg-white shadow border">
                <div className="text-xs text-gray-500">Opening Cash</div>
                <div className="text-xl font-bold">{rupee(openingCash)}</div>
              </div>
              <div className="rounded-lg p-3 bg-white shadow border">
                <div className="text-xs text-gray-500">Cash In Today</div>
                <div className="text-xl font-bold">{rupee(cashInToday)}</div>
              </div>
              <div className="rounded-lg p-3 bg-white shadow border">
                <div className="text-xs text-gray-500">Cash Out (Expenses)</div>
                <div className="text-xl font-bold">{rupee(cashOutToday)}</div>
              </div>
              <div className="rounded-lg p-3 bg-white shadow border">
                <div className="text-xs text-gray-500">Cash In Hand Now</div>
                <div className="text-xl font-bold">{rupee(cashInHand)}</div>
              </div>
            </div>

            <Collapsible title="Breakup: UPI/Bank & Totals (Today)" defaultOpen={false}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded border p-2">
                  <div className="text-xs text-gray-500">UPI In</div>
                  <div className="text-lg font-semibold">{rupee(receipts?.totals?.upi || 0)}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-gray-500">Bank In</div>
                  <div className="text-lg font-semibold">{rupee(receipts?.totals?.bank || 0)}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-gray-500">All Methods In</div>
                  <div className="text-lg font-semibold">{rupee(receipts?.totals?.total || 0)}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-gray-500">All Methods Out</div>
                  <div className="text-lg font-semibold">{rupee(expenses?.totals?.total || 0)}</div>
                </div>
              </div>
            </Collapsible>
          </Section>

          <Section title="Class-wise (Month)">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-1 pr-3">Class</th>
                    <th className="py-1 pr-3 text-right">Paid</th>
                    <th className="py-1 pr-3 text-right">Due</th>
                    <th className="py-1 pr-3 text-right">Expected</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview.byClass || []).length === 0 ? (
                    <tr>
                      <td className="py-2 text-center text-gray-400" colSpan={4}>
                        No data
                      </td>
                    </tr>
                  ) : (
                    overview.byClass.map((c) => (
                      <tr key={c.className} className="border-t">
                        <td className="py-1 pr-3">{c.className}</td>
                        <td className="py-1 pr-3 text-right">{rupee(c.paid)}</td>
                        <td className="py-1 pr-3 text-right">{rupee(c.due)}</td>
                        <td className="py-1 pr-3 text-right">{rupee(c.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Section title="Hostel (Month)">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border p-2">
                  <div className="text-xs text-gray-500">Paid</div>
                  <div className="text-lg font-semibold">{rupee(overview.hostel.paid)}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-gray-500">Due</div>
                  <div className="text-lg font-semibold">{rupee(overview.hostel.due)}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-gray-500">Expected</div>
                  <div className="text-lg font-semibold">{rupee(overview.hostel.total)}</div>
                </div>
              </div>
            </Section>

            <Section title="Transport (Month)">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border p-2">
                  <div className="text-xs text-gray-500">Paid</div>
                  <div className="text-lg font-semibold">{rupee(overview.transport.paid)}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-gray-500">Due</div>
                  <div className="text-lg font-semibold">{rupee(overview.transport.due)}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-gray-500">Expected</div>
                  <div className="text-lg font-semibold">{rupee(overview.transport.total)}</div>
                </div>
              </div>
            </Section>
          </div>

          {/* Today Receipts */}
          <Section title="Today's Receipts">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-1 pr-3">Time</th>
                    <th className="py-1 pr-3">Kind</th>
                    <th className="py-1 pr-3">Student</th>
                    <th className="py-1 pr-3">Class</th>
                    <th className="py-1 pr-3">Method</th>
                    <th className="py-1 pr-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-gray-800">
                  {(receipts?.items || []).length === 0 ? (
                    <tr>
                      <td className="py-2 text-center text-gray-400" colSpan={6}>
                        No receipts
                      </td>
                    </tr>
                  ) : (
                    (receipts?.items || []).map((r) => (
                      <tr key={`${r.kind}-${r.id}`} className="border-t">
                        <td className="py-1 pr-3">{new Date(r.collectedAt || r.createdAt).toLocaleTimeString()}</td>
                        <td className="py-1 pr-3 capitalize">{r.kind}</td>
                        <td className="py-1 pr-3">{r.studentName || "-"}</td>
                        <td className="py-1 pr-3">{r.className || "-"}</td>
                        <td className="py-1 pr-3 uppercase">{r.method}</td>
                        <td className="py-1 pr-3 text-right">{rupee(r.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td colSpan={5} className="py-1 pr-3 text-right">
                      Total
                    </td>
                    <td className="py-1 pr-3 text-right">{rupee(receipts?.totals?.total || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>

          {/* Today Expenses + quick add */}
          <Section
            title="Today's Expenses"
            right={
              <div className="flex items-center gap-2">
                <input
                  placeholder="Category"
                  className="px-2 py-1 border rounded"
                  value={newExpense.category}
                  onChange={(e) => setNewExpense((s) => ({ ...s, category: e.target.value }))}
                />
                <input
                  placeholder="Amount"
                  className="px-2 py-1 border rounded w-28"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense((s) => ({ ...s, amount: e.target.value }))}
                />
                <select
                  className="px-2 py-1 border rounded"
                  value={newExpense.paidBy}
                  onChange={(e) => setNewExpense((s) => ({ ...s, paidBy: e.target.value }))}
                >
                  <option value="cash">cash</option>
                  <option value="upi">upi</option>
                  <option value="bank">bank</option>
                </select>
                <input
                  placeholder="Note"
                  className="px-2 py-1 border rounded"
                  value={newExpense.note}
                  onChange={(e) => setNewExpense((s) => ({ ...s, note: e.target.value }))}
                />
                <button
                  onClick={addExpense}
                  disabled={addingExpense}
                  className={cls("px-3 py-1 rounded", addingExpense ? "bg-gray-400" : "bg-indigo-600 text-white")}
                >
                  {addingExpense ? "Saving..." : "Add"}
                </button>
              </div>
            }
          >
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-1 pr-3">Time</th>
                    <th className="py-1 pr-3">Category</th>
                    <th className="py-1 pr-3">Method</th>
                    <th className="py-1 pr-3">Note</th>
                    <th className="py-1 pr-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-gray-800">
                  {(expenses?.items || []).length === 0 ? (
                    <tr>
                      <td className="py-2 text-center text-gray-400" colSpan={5}>
                        No expenses
                      </td>
                    </tr>
                  ) : (
                    (expenses?.items || []).map((x) => (
                      <tr key={x.id} className="border-t">
                        <td className="py-1 pr-3">{new Date(x.paidAt || x.createdAt).toLocaleTimeString()}</td>
                        <td className="py-1 pr-3">{x.category}</td>
                        <td className="py-1 pr-3 uppercase">{x.paidBy}</td>
                        <td className="py-1 pr-3">{x.note || "-"}</td>
                        <td className="py-1 pr-3 text-right">{rupee(x.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td colSpan={4} className="py-1 pr-3 text-right">
                      Total
                    </td>
                    <td className="py-1 pr-3 text-right">{rupee(expenses?.totals?.total || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>
        </>
      )}

      {/* =========================
          COLLECT FEES
      ========================= */}
      {tab === "collect" && (
        <>
          <Section
            title="Find Student"
            right={
              <div className="flex items-center gap-2">
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchStudents(searchQ)}
                  placeholder="Search name / admission / phone"
                  className="px-2 py-1 border rounded w-64"
                />
                <button
                  onClick={() => searchStudents(searchQ)}
                  className="px-3 py-1 rounded bg-indigo-600 text-white"
                  disabled={searching}
                >
                  {searching ? "Searching…" : "Search"}
                </button>
              </div>
            }
          >
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-1 pr-3">Student</th>
                    <th className="py-1 pr-3">Class</th>
                    <th className="py-1 pr-3">Admission #</th>
                    <th className="py-1 pr-3">Guardian</th>
                    <th className="py-1 pr-3">Phone</th>
                    <th className="py-1 pr-3">Hostel</th>
                    <th className="py-1 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 ? (
                    <tr>
                      <td className="py-2 text-center text-gray-400" colSpan={7}>
                        No results
                      </td>
                    </tr>
                  ) : (
                    results.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="py-1 pr-3">{s.name}</td>
                        <td className="py-1 pr-3">{s.className}</td>
                        <td className="py-1 pr-3">{s.admission_number}</td>
                        <td className="py-1 pr-3">{s.guardian_name || "-"}</td>
                        <td className="py-1 pr-3">{s.guardian_phone || "-"}</td>
                        <td className="py-1 pr-3">{s.is_hosteller ? "Yes" : "No"}</td>
                        <td className="py-1 pr-3">
                          <button
                            className="px-2 py-1 text-xs rounded bg-emerald-600 text-white"
                            onClick={() => {
                              setSelected(s);
                              fetchStudentAccount(s.id);
                            }}
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          {selected && (
            <Section
              title={`Collect for: ${selected.name} (${selected.className || "-"})`}
              right={<span className="text-xs text-gray-600">Admission #{selected.admission_number}</span>}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <h4 className="font-semibold mb-2">Dues (by month & head)</h4>
                  <div className="overflow-auto border rounded">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500">
                          <th className="py-1 px-2">Month</th>
                          <th className="py-1 px-2">Head</th>
                          <th className="py-1 px-2 text-right">Amount</th>
                          <th className="py-1 px-2">Add</th>
                        </tr>
                      </thead>
                      <tbody>
                        {account?.dues?.length ? (
                          account.dues.map((d) => (
                            <tr key={`${d.month}-${d.headId}`} className="border-t">
                              <td className="py-1 px-2">{d.month}</td>
                              <td className="py-1 px-2">{d.headName}</td>
                              <td className="py-1 px-2 text-right">{rupee(d.amount)}</td>
                              <td className="py-1 px-2">
                                <button
                                  className="px-2 py-1 text-xs rounded bg-indigo-600 text-white"
                                  onClick={() =>
                                    setCollectForm((s) => ({
                                      ...s,
                                      items: [
                                        ...s.items,
                                        { month: d.month, headId: d.headId, headName: d.headName, amount: d.amount },
                                      ],
                                    }))
                                  }
                                >
                                  Add
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="py-2 text-center text-gray-400" colSpan={4}>
                              No pending dues
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <Collapsible title="Paid history (recent)" defaultOpen={false}>
                    <div className="overflow-auto border rounded mt-2">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500">
                            <th className="py-1 px-2">Date</th>
                            <th className="py-1 px-2">Month</th>
                            <th className="py-1 px-2">Head</th>
                            <th className="py-1 px-2">Method</th>
                            <th className="py-1 px-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {account?.recent?.length ? (
                            account.recent.map((x) => (
                              <tr key={x.id} className="border-t">
                                <td className="py-1 px-2">
                                  {new Date(x.collectedAt || x.createdAt).toLocaleDateString()}
                                </td>
                                <td className="py-1 px-2">{x.month}</td>
                                <td className="py-1 px-2">{x.headName}</td>
                                <td className="py-1 px-2 uppercase">{x.method}</td>
                                <td className="py-1 px-2 text-right">{rupee(x.amount)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="py-2 text-center text-gray-400" colSpan={5}>
                                No payments yet
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Collapsible>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">New Receipt</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm">Method</label>
                      <select
                        className="px-2 py-1 border rounded"
                        value={collectForm.method}
                        onChange={(e) => setCollectForm((s) => ({ ...s, method: e.target.value }))}
                      >
                        <option value="cash">cash</option>
                        <option value="upi">upi</option>
                        <option value="bank">bank</option>
                      </select>
                    </div>

                    {/* Manual item adder (for ad-hoc / supplies etc) */}
                    <Collapsible title="Add custom item (optional)" defaultOpen={false}>
                      <div className="flex flex-col md:flex-row gap-2 items-start">
                        <input
                          type="month"
                          className="px-2 py-1 border rounded"
                          defaultValue={yyyymm(todayStr())}
                          onChange={(e) => (e.target.dataset.m = e.target.value)}
                          data-m={yyyymm(todayStr())}
                        />
                        <select
                          className="px-2 py-1 border rounded"
                          onChange={(e) => (e.target.dataset.h = e.target.value)}
                          data-h={feeMeta.heads[0]?.id || ""}
                        >
                          {feeMeta.heads.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Amount"
                          className="px-2 py-1 border rounded w-32"
                          onChange={(e) => (e.target.dataset.a = e.target.value)}
                          data-a=""
                        />
                        <button
                          className="px-3 py-1 rounded bg-emerald-600 text-white"
                          onClick={(e) => {
                            const wrap = e.currentTarget.parentElement;
                            const m = wrap.querySelector('input[type="month"]')?.dataset?.m || yyyymm(todayStr());
                            const h = wrap.querySelector("select")?.dataset?.h || feeMeta.heads[0]?.id;
                            const amount = wrap.querySelector('input[type="number"]')?.dataset?.a || 0;
                            const head = feeMeta.heads.find((x) => String(x.id) === String(h));
                            if (!head) return alert("Pick a head");
                            setCollectForm((s) => ({
                              ...s,
                              items: [...s.items, { month: m, headId: head.id, headName: head.name, amount }],
                            }));
                          }}
                        >
                          Add Item
                        </button>
                      </div>
                    </Collapsible>

                    <div className="border rounded">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500">
                            <th className="py-1 px-2">Month</th>
                            <th className="py-1 px-2">Head</th>
                            <th className="py-1 px-2 w-28 text-right">Amount</th>
                            <th className="py-1 px-2">Remove</th>
                          </tr>
                        </thead>
                        <tbody>
                          {collectForm.items.length === 0 ? (
                            <tr>
                              <td className="py-2 text-center text-gray-400" colSpan={4}>
                                Nothing to collect
                              </td>
                            </tr>
                          ) : (
                            collectForm.items.map((x, idx) => (
                              <tr key={`${x.month}-${x.headId}-${idx}`} className="border-t">
                                <td className="py-1 px-2">{x.month}</td>
                                <td className="py-1 px-2">{x.headName || x.headId}</td>
                                <td className="py-1 px-2 text-right">
                                  <input
                                    type="number"
                                    className="px-2 py-1 border rounded w-24 text-right"
                                    value={x.amount}
                                    onChange={(e) =>
                                      setCollectForm((s) => {
                                        const next = [...s.items];
                                        next[idx] = { ...next[idx], amount: e.target.value };
                                        return { ...s, items: next };
                                      })
                                    }
                                  />
                                </td>
                                <td className="py-1 px-2">
                                  <button
                                    className="px-2 py-1 text-xs rounded bg-rose-600 text-white"
                                    onClick={() =>
                                      setCollectForm((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }))
                                    }
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {collectForm.items.length > 0 && (
                          <tfoot>
                            <tr className="border-t font-semibold">
                              <td className="py-1 px-2 text-right" colSpan={2}>
                                Total
                              </td>
                              <td className="py-1 px-2 text-right">{rupee(totalCollect)}</td>
                              <td />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    <label className="text-sm block">Note (optional)</label>
                    <textarea
                      className="w-full border rounded p-2"
                      rows={3}
                      value={collectForm.note}
                      onChange={(e) => setCollectForm((s) => ({ ...s, note: e.target.value }))}
                      placeholder="Any reference / UPI txn id etc."
                    />

                    <div className="flex gap-2">
                      <button
                        className={cls(
                          "px-4 py-2 rounded",
                          collectForm.items.length === 0 ? "bg-gray-400 text-white" : "bg-emerald-600 text-white"
                        )}
                        disabled={collectForm.items.length === 0}
                        onClick={collectNow}
                      >
                        Collect {collectForm.items.length > 0 ? `(${rupee(totalCollect)})` : ""}
                      </button>
                      <button
                        className="px-4 py-2 rounded bg-gray-200"
                        onClick={() => setCollectForm((s) => ({ ...s, items: [], note: "" }))}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          )}
        </>
      )}

      {/* =========================
          STUDENTS
      ========================= */}
      {tab === "students" && (
        <>
          <Section
            title="Students"
            right={
              <div className="flex items-center gap-2">
                <input
                  placeholder="Filter by class (e.g., IV)"
                  className="px-2 py-1 border rounded w-40"
                  value={stuFilters.className}
                  onChange={(e) => setStuFilters((s) => ({ ...s, className: e.target.value }))}
                />
                <input
                  placeholder="Search name / admission / phone"
                  className="px-2 py-1 border rounded w-64"
                  value={stuFilters.q}
                  onChange={(e) => setStuFilters((s) => ({ ...s, q: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && loadStudentsList()}
                />
                <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={loadStudentsList}>
                  {loadingStudents ? "Loading…" : "Search"}
                </button>
              </div>
            }
          >
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-1 pr-3">Name</th>
                    <th className="py-1 pr-3">Class</th>
                    <th className="py-1 pr-3">Admission #</th>
                    <th className="py-1 pr-3">Guardian</th>
                    <th className="py-1 pr-3">Phone</th>
                    <th className="py-1 pr-3">Hostel</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td className="py-2 text-center text-gray-400" colSpan={6}>
                        No students
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="py-1 pr-3">{s.name}</td>
                        <td className="py-1 pr-3">{s.className}</td>
                        <td className="py-1 pr-3">{s.admission_number}</td>
                        <td className="py-1 pr-3">{s.guardian_name || "-"}</td>
                        <td className="py-1 pr-3">{s.guardian_phone || "-"}</td>
                        <td className="py-1 pr-3">{s.is_hosteller ? "Yes" : "No"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Add New Student">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input
                  className="px-2 py-1 border rounded w-full"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent((s) => ({ ...s, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Admission #</label>
                <input
                  className="px-2 py-1 border rounded w-full"
                  value={newStudent.admission_number}
                  onChange={(e) => setNewStudent((s) => ({ ...s, admission_number: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Class</label>
                <input
                  placeholder="e.g., I, II, III, IV…"
                  className="px-2 py-1 border rounded w-full"
                  value={newStudent.class_name}
                  onChange={(e) => setNewStudent((s) => ({ ...s, class_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Section Type</label>
                <select
                  className="px-2 py-1 border rounded w-full"
                  value={newStudent.section_type}
                  onChange={(e) => setNewStudent((s) => ({ ...s, section_type: e.target.value }))}
                >
                  <option value="junior">junior</option>
                  <option value="senior">senior</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Guardian Name</label>
                <input
                  className="px-2 py-1 border rounded w-full"
                  value={newStudent.guardian_name}
                  onChange={(e) => setNewStudent((s) => ({ ...s, guardian_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Guardian Phone</label>
                <input
                  className="px-2 py-1 border rounded w-full"
                  value={newStudent.guardian_phone}
                  onChange={(e) => setNewStudent((s) => ({ ...s, guardian_phone: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="is_hosteller"
                  type="checkbox"
                  checked={newStudent.is_hosteller}
                  onChange={(e) => setNewStudent((s) => ({ ...s, is_hosteller: e.target.checked }))}
                />
                <label htmlFor="is_hosteller" className="text-sm">
                  Hosteller
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="transport_chosen"
                  type="checkbox"
                  checked={newStudent.transport_chosen}
                  onChange={(e) => setNewStudent((s) => ({ ...s, transport_chosen: e.target.checked }))}
                />
                <label htmlFor="transport_chosen" className="text-sm">
                  Transport
                </label>
              </div>
            </div>
            <div className="mt-3">
              <button
                onClick={addStudent}
                disabled={addingStudent}
                className={cls("px-4 py-2 rounded", addingStudent ? "bg-gray-400" : "bg-indigo-600 text-white")}
              >
                {addingStudent ? "Saving…" : "Add Student"}
              </button>
            </div>
          </Section>
        </>
      )}

      {/* =========================
          DAY CLOSE
      ========================= */}
      {tab === "dayclose" && (
        <>
          <Section title="Day Close – Summary (clubbed cash)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-sm">Opening Cash</label>
                <input
                  type="number"
                  className="px-2 py-1 border rounded w-full"
                  value={dayForm.openingCash}
                  onChange={(e) => setDayForm((s) => ({ ...s, openingCash: e.target.value }))}
                />
                <label className="block text-sm">Cash Received Today</label>
                <input
                  type="number"
                  className="px-2 py-1 border rounded w-full"
                  value={dayForm.cashIn}
                  onChange={(e) => setDayForm((s) => ({ ...s, cashIn: e.target.value }))}
                />
                <label className="block text-sm">Cash Expenses Today</label>
                <input
                  type="number"
                  className="px-2 py-1 border rounded w-full"
                  value={dayForm.cashOut}
                  onChange={(e) => setDayForm((s) => ({ ...s, cashOut: e.target.value }))}
                />
                <label className="block text-sm">Adjustments (if any)</label>
                <input
                  type="number"
                  className="px-2 py-1 border rounded w-full"
                  value={dayForm.adjustments}
                  onChange={(e) => setDayForm((s) => ({ ...s, adjustments: e.target.value }))}
                />
                <div className="text-lg font-semibold mt-2">Closing Cash: {rupee(computedClosing)}</div>
              </div>

              <div className="space-y-2">
                <Collapsible title="Details (UPI/Bank/Total Expenses)" defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="border rounded p-2">
                      <div className="text-xs text-gray-500">UPI In</div>
                      <div className="text-lg font-semibold">{rupee(dayForm.upiIn)}</div>
                    </div>
                    <div className="border rounded p-2">
                      <div className="text-xs text-gray-500">Bank In</div>
                      <div className="text-lg font-semibold">{rupee(dayForm.bankIn)}</div>
                    </div>
                    <div className="border rounded p-2 col-span-2">
                      <div className="text-xs text-gray-500">Total Expenses (All Methods)</div>
                      <div className="text-lg font-semibold">{rupee(dayForm.expensesTotal)}</div>
                    </div>
                  </div>
                </Collapsible>
                <label className="block text-sm mt-2">Notes</label>
                <textarea
                  className="w-full border rounded p-2"
                  rows={4}
                  value={dayForm.notes}
                  onChange={(e) => setDayForm((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Any comments for verification…"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => saveDay(false)}
                disabled={savingClose}
                className={cls("px-4 py-2 rounded", savingClose ? "bg-gray-400" : "bg-indigo-600 text-white")}
              >
                {savingClose ? "Saving…" : "Save Summary"}
              </button>
              <button
                onClick={() => saveDay(true)}
                disabled={savingClose || summary?.isLocked}
                className={cls(
                  "px-4 py-2 rounded",
                  summary?.isLocked ? "bg-gray-400 text-white" : "bg-green-600 text-white"
                )}
                title={summary?.isLocked ? "Already locked" : "Lock and close the day"}
              >
                {summary?.isLocked ? "Locked" : "Save & Lock Day"}
              </button>
            </div>
          </Section>

          <Collapsible title="Who paid today? (students)" defaultOpen>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-1 pr-3">Time</th>
                    <th className="py-1 pr-3">Kind</th>
                    <th className="py-1 pr-3">Student</th>
                    <th className="py-1 pr-3">Class</th>
                    <th className="py-1 pr-3">Method</th>
                    <th className="py-1 pr-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-gray-800">
                  {(receipts?.items || []).length === 0 ? (
                    <tr>
                      <td className="py-2 text-center text-gray-400" colSpan={6}>
                        No receipts
                      </td>
                    </tr>
                  ) : (
                    (receipts?.items || []).map((r) => (
                      <tr key={`${r.kind}-${r.id}`} className="border-t">
                        <td className="py-1 pr-3">{new Date(r.collectedAt || r.createdAt).toLocaleTimeString()}</td>
                        <td className="py-1 pr-3 capitalize">{r.kind}</td>
                        <td className="py-1 pr-3">{r.studentName || "-"}</td>
                        <td className="py-1 pr-3">{r.className || "-"}</td>
                        <td className="py-1 pr-3 uppercase">{r.method}</td>
                        <td className="py-1 pr-3 text-right">{rupee(r.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Collapsible>
        </>
      )}

      {/* =========================
          SETTINGS / META
      ========================= */}
      {tab === "settings" && (
        <>
          <Section title="One-time Accounting Settings">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Books Start Date</label>
                <input
                  type="date"
                  value={settings.booksStartDate || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, booksStartDate: e.target.value }))}
                  className="px-2 py-1 border rounded w-full"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Opening Cash</label>
                <input
                  type="number"
                  value={settings.openingCash}
                  onChange={(e) => setSettings((s) => ({ ...s, openingCash: e.target.value }))}
                  className="px-2 py-1 border rounded w-full"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Opening UPI</label>
                <input
                  type="number"
                  value={settings.openingUPI}
                  onChange={(e) => setSettings((s) => ({ ...s, openingUPI: e.target.value }))}
                  className="px-2 py-1 border rounded w-full"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Opening Bank</label>
                <input
                  type="number"
                  value={settings.openingBank}
                  onChange={(e) => setSettings((s) => ({ ...s, openingBank: e.target.value }))}
                  className="px-2 py-1 border rounded w-full"
                />
              </div>
            </div>
            <div className="mt-3">
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className={cls("px-4 py-2 rounded", savingSettings ? "bg-gray-400" : "bg-indigo-600 text-white")}
              >
                {savingSettings ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </Section>

          <Section
            title="Fee Heads / Meta"
            right={
              <div className="text-xs text-gray-600">
                Define heads (tuition/hostel/transport/supplies) with optional class-specific defaults.
              </div>
            }
          >
            <div className="overflow-auto mb-3 border rounded">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-1 px-2">Head</th>
                    <th className="py-1 px-2">Kind</th>
                    <th className="py-1 px-2">Periodicity</th>
                    <th className="py-1 px-2">Class (if specific)</th>
                    <th className="py-1 px-2 text-right">Default Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(feeMeta.heads || []).length === 0 ? (
                    <tr>
                      <td className="py-2 text-center text-gray-400" colSpan={5}>
                        No heads defined
                      </td>
                    </tr>
                  ) : (
                    feeMeta.heads.map((h) => (
                      <tr key={h.id} className="border-t">
                        <td className="py-1 px-2">{h.name}</td>
                        <td className="py-1 px-2">{h.kind}</td>
                        <td className="py-1 px-2">{h.periodicity}</td>
                        <td className="py-1 px-2">{h.className || "-"}</td>
                        <td className="py-1 px-2 text-right">{rupee(h.defaultAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
              <div>
                <label className="block text-sm mb-1">Head Name</label>
                <input
                  className="px-2 py-1 border rounded w-full"
                  value={newHead.name}
                  onChange={(e) => setNewHead((s) => ({ ...s, name: e.target.value }))}
                  placeholder="e.g., Tuition"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Kind</label>
                <select
                  className="px-2 py-1 border rounded w-full"
                  value={newHead.kind}
                  onChange={(e) => setNewHead((s) => ({ ...s, kind: e.target.value }))}
                >
                  <option value="tuition">tuition</option>
                  <option value="hostel">hostel</option>
                  <option value="transport">transport</option>
                  <option value="supplies">supplies</option>
                  <option value="other">other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Periodicity</label>
                <select
                  className="px-2 py-1 border rounded w-full"
                  value={newHead.periodicity}
                  onChange={(e) => setNewHead((s) => ({ ...s, periodicity: e.target.value }))}
                >
                  <option value="monthly">monthly</option>
                  <option value="one-time">one-time</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Class (optional)</label>
                <input
                  className="px-2 py-1 border rounded w-full"
                  value={newHead.className}
                  onChange={(e) => setNewHead((s) => ({ ...s, className: e.target.value }))}
                  placeholder="IV / VII / etc."
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Default Amount</label>
                <input
                  type="number"
                  className="px-2 py-1 border rounded w-full"
                  value={newHead.defaultAmount}
                  onChange={(e) => setNewHead((s) => ({ ...s, defaultAmount: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-3">
              <button
                onClick={upsertFeeHead}
                disabled={savingHead}
                className={cls("px-4 py-2 rounded", savingHead ? "bg-gray-400" : "bg-emerald-600 text-white")}
              >
                {savingHead ? "Saving…" : "Add / Update Head"}
              </button>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
