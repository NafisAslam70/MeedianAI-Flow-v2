// // app/(main)/api/accountant/expenses/route.js
// import { NextResponse } from "next/server";
// import { db } from "@/lib/db";
// import { auth } from "@/lib/auth";
// import { expenses as expTbl } from "@/lib/schema";
// import { and, eq, gte, lte, desc } from "drizzle-orm";

// function canUse(session) {
//   return session?.user?.role === "admin" || session?.user?.team_manager_type === "accountant";
// }
// const dayRange = (dateStr) => {
//   const start = new Date(`${dateStr}T00:00:00`);
//   const end = new Date(`${dateStr}T23:59:59.999`);
//   return { start, end };
// };
// const sum = (arr, pick) => arr.reduce((a, b) => a + (pick(b) || 0), 0);

// export async function GET(req) {
//   const session = await auth();
//   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   if (!canUse(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

//   const { searchParams } = new URL(req.url);
//   const date = searchParams.get("date"); // YYYY-MM-DD (optional)
//   const paidBy = searchParams.get("paidBy"); // cash|upi|bank (optional)
//   const page = Number(searchParams.get("page") || 1);
//   const pageSize = Math.min(100, Number(searchParams.get("pageSize") || 50));
//   const offset = (page - 1) * pageSize;

//   const { start, end } = date ? dayRange(date) : { start: null, end: null };
//   const conds = [];
//   if (date) conds.push(and(gte(expTbl.paidAt, start), lte(expTbl.paidAt, end)));
//   if (paidBy) conds.push(eq(expTbl.paidBy, paidBy));

//   const where = conds.length ? and(...conds) : undefined;

//   const rows = await db
//     .select()
//     .from(expTbl)
//     .where(where)
//     .orderBy(desc(expTbl.paidAt))
//     .limit(pageSize)
//     .offset(offset);

//   const items = rows || [];
//   const totals = {
//     cash: sum(items.filter((r) => r.paidBy === "cash"), (r) => Number(r.amount)),
//     upi: sum(items.filter((r) => r.paidBy === "upi"), (r) => Number(r.amount)),
//     bank: sum(items.filter((r) => r.paidBy === "bank"), (r) => Number(r.amount)),
//     total: sum(items, (r) => Number(r.amount)),
//   };

//   return NextResponse.json({ items, totals });
// }

// export async function POST(req) {
//   const session = await auth();
//   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   if (!canUse(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

//   const body = await req.json();
//   const { category, amount, paidBy, note, paidAt } = body || {};
//   if (!category || !amount || !paidBy) {
//     return NextResponse.json({ error: "category, amount, paidBy are required" }, { status: 400 });
//   }

//   const payload = {
//     category,
//     amount: Number(amount) || 0,
//     paidBy,
//     note: note || null,
//     paidAt: paidAt ? new Date(paidAt) : new Date(),
//     createdBy: session.user.id,
//   };

//   const [ins] = await db.insert(expTbl).values(payload).returning();
//   return NextResponse.json({ item: ins });
// }
