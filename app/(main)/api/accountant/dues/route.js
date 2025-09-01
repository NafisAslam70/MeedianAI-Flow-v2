import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { students, feeReceipts } from "@/lib/schema";
import { classFeeMeta } from "@/lib/schema"; // add table below if not present
import { like, and, eq } from "drizzle-orm";

const canUse = (s) => s?.user?.role === "admin" || s?.user?.team_manager_type === "accountant";

export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUse(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0,7); // YYYY-MM

  // load meta + students
  const [meta, studs] = await Promise.all([
    db.select().from(classFeeMeta),
    db.select().from(students),
  ]);

  // expected by class: sum of monthly fee per student (hosteller vs dayscholar)
  const byClass = {};
  for (const s of studs) {
    const m = meta.find((x) => x.className === s.class_name);
    const fee = s.residential_status === "hosteller"
      ? Number(m?.hostellerMonthlyFee || 0)
      : Number(m?.dayscholarMonthlyFee || 0);
    if (!byClass[s.class_name]) byClass[s.class_name] = { count: 0, expected: 0, received: 0 };
    byClass[s.class_name].count += 1;
    byClass[s.class_name].expected += fee;
  }

  // received for the month from feeReceipts (school fees only)
  const feeRows = await db
    .select()
    .from(feeReceipts)
    .where(eq(feeReceipts.monthFor, month));

  for (const r of feeRows) {
    const key = r.className || "Unknown";
    if (!byClass[key]) byClass[key] = { count: 0, expected: 0, received: 0 };
    byClass[key].received += Number(r.amount || 0);
  }

  const classes = Object.entries(byClass)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([className, v]) => ({
      className,
      count: v.count,
      expected: v.expected,
      received: v.received,
      due: Math.max(0, v.expected - v.received),
    }));

  const totals = classes.reduce(
    (a, c) => ({
      count: a.count + c.count,
      expected: a.expected + c.expected,
      received: a.received + c.received,
      due: a.due + c.due,
    }),
    { count: 0, expected: 0, received: 0, due: 0 }
  );

  return NextResponse.json({ classes, totals, month });
}
