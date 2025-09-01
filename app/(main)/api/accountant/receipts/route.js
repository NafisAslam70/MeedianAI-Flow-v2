// app/(main)/api/accountant/receipts/route.js
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  feeReceipts,
  transportFees,
  admissionFees,
  paymentMethodEnum,
} from "@/lib/schema";
import { and, gte, lte, desc } from "drizzle-orm";

function canUse(session) {
  return session?.user?.role === "admin" || session?.user?.team_manager_type === "accountant";
}
const range = (dateStr) => {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { start, end };
};
const sum = (arr, pick) => arr.reduce((a, b) => a + (pick(b) || 0), 0);

export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUse(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD (optional, defaults today)
  const { start, end } = range(date || new Date().toISOString().slice(0,10));

  const fees = await db
    .select()
    .from(feeReceipts)
    .where(and(gte(feeReceipts.collectedAt, start), lte(feeReceipts.collectedAt, end)))
    .orderBy(desc(feeReceipts.collectedAt));

  const transports = await db
    .select()
    .from(transportFees)
    .where(and(gte(transportFees.collectedAt, start), lte(transportFees.collectedAt, end)))
    .orderBy(desc(transportFees.collectedAt));

  const admissions = await db
    .select()
    .from(admissionFees)
    .where(and(gte(admissionFees.collectedAt, start), lte(admissionFees.collectedAt, end)))
    .orderBy(desc(admissionFees.collectedAt));

  const items = [
    ...(fees || []).map(r => ({ kind: "school", ...r })),
    ...(transports || []).map(r => ({ kind: "transport", ...r })),
    ...(admissions || []).map(r => ({ kind: "admission", ...r })),
  ];

  const byMethod = (m) => items.filter(r => r.method === m);
  const totals = {
    cash: sum(byMethod("cash"), (r) => Number(r.amount)),
    upi: sum(byMethod("upi"), (r) => Number(r.amount)),
    bank: sum(byMethod("bank"), (r) => Number(r.amount)),
    total: sum(items, (r) => Number(r.amount)),
  };

  return NextResponse.json({ items, totals });
}

/* Optional generic POST so you can log a quick receipt if needed:
   body: { kind: "school"|"transport"|"admission", studentName, className, monthFor?, amount, method, reference? }
*/
export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUse(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { kind, studentName, className, monthFor, amount, method, reference } = body || {};
  if (!kind || !studentName || !amount || !method) {
    return NextResponse.json({ error: "kind, studentName, amount, method are required" }, { status: 400 });
  }

  const common = {
    studentName,
    className: className || null,
    monthFor: monthFor || null,
    amount: Number(amount) || 0,
    method,
    reference: reference || null,
    collectedAt: new Date(),
    createdBy: session.user.id,
  };

  let ret;
  if (kind === "school") {
    [ret] = await db.insert(feeReceipts).values(common).returning();
  } else if (kind === "transport") {
    [ret] = await db.insert(transportFees).values(common).returning();
  } else if (kind === "admission") {
    const toInsert = { ...common };
    delete toInsert.monthFor;
    [ret] = await db.insert(admissionFees).values(toInsert).returning();
  } else {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }

  return NextResponse.json({ item: ret });
}
