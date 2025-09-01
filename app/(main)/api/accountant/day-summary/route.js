// import { NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import { db } from "@/lib/db";
// import {
//   accountantDaySummaries,
//   accountingSettings,
//   feeReceipts,
//   expenses as expTbl,
//   transportFees,
//   admissionFees,
// } from "@/lib/schema";
// import { and, eq, gte, lte, lt } from "drizzle-orm";

// function onlyAdminOrAccountant(session) {
//   return session?.user?.role === "admin" || session?.user?.team_manager_type === "accountant";
// }
// function range(dateStr) {
//   const start = new Date(`${dateStr}T00:00:00`);
//   const end = new Date(`${dateStr}T23:59:59.999`);
//   return { start, end };
// }
// function prevDate(dateStr) {
//   const d = new Date(`${dateStr}T00:00:00`);
//   d.setDate(d.getDate() - 1);
//   return d.toISOString().slice(0, 10);
// }

// export async function GET(req) {
//   const session = await auth();
//   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   if (!onlyAdminOrAccountant(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

//   const { searchParams } = new URL(req.url);
//   const date = searchParams.get("date");
//   const userId = Number(searchParams.get("userId") || session.user.id);
//   if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

//   const { start, end } = range(date);

//   // 1) If saved already, return it
//   const existing = await db.query.accountantDaySummaries.findFirst({
//     where: (t, { and, eq, gte, lte }) => and(eq(t.userId, userId), gte(t.date, start), lte(t.date, end)),
//   });
//   if (existing) return NextResponse.json({ summary: existing });

//   // 2) Load settings + previous day's closing to propose opening cash
//   const settings = (await db.select().from(accountingSettings))[0] || null;

//   const { start: prevStart, end: prevEnd } = range(prevDate(date));
//   const prev = await db.query.accountantDaySummaries.findFirst({
//     where: (t, { and, eq, gte, lte }) => and(eq(t.userId, userId), gte(t.date, prevStart), lte(t.date, prevEnd)),
//   });

//   const suggestedOpeningCash =
//     prev?.closingCash ??
//     settings?.openingCash ??
//     0;

//   // 3) Prefill totals from transactions
//   const receiptsRows = await db
//     .select()
//     .from(feeReceipts)
//     .where(and(gte(feeReceipts.collectedAt, start), lte(feeReceipts.collectedAt, end)));

//   const transportRows = await db
//     .select()
//     .from(transportFees)
//     .where(and(gte(transportFees.collectedAt, start), lte(transportFees.collectedAt, end)));

//   const admissionRows = await db
//     .select()
//     .from(admissionFees)
//     .where(and(gte(admissionFees.collectedAt, start), lte(admissionFees.collectedAt, end)));

//   const expensesRows = await db
//     .select()
//     .from(expTbl)
//     .where(and(gte(expTbl.paidAt, start), lte(expTbl.paidAt, end)));

//   const sum = (arr, pick) => arr.reduce((a, b) => a + (pick(b) || 0), 0);

//   // by method
//   const cashReceipts = sum(receiptsRows.filter(r => r.method === "cash"), r => r.amount)
//     + sum(transportRows.filter(r => r.method === "cash"), r => r.amount)
//     + sum(admissionRows.filter(r => r.method === "cash"), r => r.amount);

//   const upiReceipts = sum(receiptsRows.filter(r => r.method === "upi"), r => r.amount)
//     + sum(transportRows.filter(r => r.method === "upi"), r => r.amount)
//     + sum(admissionRows.filter(r => r.method === "upi"), r => r.amount);

//   const bankReceipts = sum(receiptsRows.filter(r => r.method === "bank"), r => r.amount)
//     + sum(transportRows.filter(r => r.method === "bank"), r => r.amount)
//     + sum(admissionRows.filter(r => r.method === "bank"), r => r.amount);

//   const cashExpenses = sum(expensesRows.filter(e => e.paidBy === "cash"), e => e.amount);
//   const upiExpenses  = sum(expensesRows.filter(e => e.paidBy === "upi"),  e => e.amount);
//   const bankExpenses = sum(expensesRows.filter(e => e.paidBy === "bank"), e => e.amount);

//   const totalExpenses = cashExpenses + upiExpenses + bankExpenses;

//   // Suggested cash closing = opening cash + cash inflow - cash outflow
//   const suggestedClosingCash = suggestedOpeningCash + cashReceipts - cashExpenses;

//   return NextResponse.json({
//     summary: {
//       userId,
//       date: start,

//       // store receipts buckets
//       cash: cashReceipts, upi: upiReceipts, bank: bankReceipts,
//       transport: sum(transportRows, r => r.amount),
//       admissions: sum(admissionRows, r => r.amount),
//       expenses: totalExpenses,

//       // propose opening/closing cash (user can edit before lock)
//       openingCash: suggestedOpeningCash,
//       closingCash: suggestedClosingCash,

//       // UI niceties
//       isLocked: false,
//       notes: "",
//       adjustments: { receiptsAdj: 0, expensesAdj: 0, note: "" },
//       expenseBreakdown: {},

//       // expose the raw computed bits if you want to show them
//       _computed: {
//         cashExpenses, upiExpenses, bankExpenses,
//       },
//     },
//   });
// }

// export async function POST(req) {
//   const session = await auth();
//   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   if (!onlyAdminOrAccountant(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

//   const body = await req.json();
//   const {
//     date,
//     cash=0, upi=0, bank=0, transport=0, admissions=0,
//     expenses=0,
//     openingCash=null, closingCash=null,
//     notes="",
//     adjustments=null, expenseBreakdown=null,
//     lock=false,
//     userId: userIdParam,
//   } = body || {};
//   if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

//   const userId = Number(userIdParam || session.user.id);
//   const { start, end } = range(date);

//   const existing = await db.query.accountantDaySummaries.findFirst({
//     where: (t, { and, eq, gte, lte }) => and(eq(t.userId, userId), gte(t.date, start), lte(t.date, end)),
//   });
//   if (existing?.isLocked) return NextResponse.json({ error: "Day already locked" }, { status: 409 });

//   // If openingCash still null, fallback to prev closing or settings opening
//   let oc = openingCash;
//   if (oc === null || oc === undefined) {
//     const settings = (await db.select().from(accountingSettings))[0] || null;
//     const prevStr = prevDate(date);
//     const { start: pS, end: pE } = range(prevStr);
//     const prev = await db.query.accountantDaySummaries.findFirst({
//       where: (t, { and, eq, gte, lte }) => and(eq(t.userId, userId), gte(t.date, pS), lte(t.date, pE)),
//     });
//     oc = prev?.closingCash ?? settings?.openingCash ?? 0;
//   }

//   if (existing) {
//     const [upd] = await db
//       .update(accountantDaySummaries)
//       .set({
//         cash, upi, bank, transport, admissions,
//         expenses,
//         openingCash: oc,
//         closingCash: closingCash ?? oc + cash - (body._computedCashExpenses || 0), // if you pass it
//         notes,
//         adjustments,
//         expenseBreakdown,
//         isLocked: lock ? true : false,
//         updatedAt: new Date(),
//       })
//       .where(eq(accountantDaySummaries.id, existing.id))
//       .returning();
//     return NextResponse.json({ summary: upd });
//   } else {
//     const [ins] = await db
//       .insert(accountantDaySummaries)
//       .values({
//         userId,
//         date: start,
//         cash, upi, bank, transport, admissions,
//         expenses,
//         openingCash: oc,
//         closingCash: closingCash ?? oc + cash, // simple fallback; UI should have sent final closing
//         notes,
//         adjustments,
//         expenseBreakdown,
//         isLocked: lock ? true : false,
//       })
//       .returning();
//     return NextResponse.json({ summary: ins });
//   }
// }
