// import { NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import { db } from "@/lib/db";
// import { classFeeMeta } from "@/lib/schema";
// import { eq } from "drizzle-orm";

// const canUse = (s) => s?.user?.role === "admin" || s?.user?.team_manager_type === "accountant";

// export async function GET() {
//   const session = await auth();
//   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   if (!canUse(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

//   const items = await db.select().from(classFeeMeta);
//   return NextResponse.json({ items });
// }

// export async function POST(req) {
//   const session = await auth();
//   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   if (!canUse(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

//   const body = await req.json();
//   const { className, dayscholarMonthlyFee = 0, hostellerMonthlyFee = 0 } = body || {};
//   if (!className) return NextResponse.json({ error: "className required" }, { status: 400 });

//   const existing = await db.query.classFeeMeta.findFirst({ where: (t, { eq }) => eq(t.className, className) });
//   if (existing) {
//     const [upd] = await db
//       .update(classFeeMeta)
//       .set({
//         dayscholarMonthlyFee: Number(dayscholarMonthlyFee || 0),
//         hostellerMonthlyFee: Number(hostellerMonthlyFee || 0),
//         updatedAt: new Date(),
//       })
//       .where(eq(classFeeMeta.id, existing.id))
//       .returning();
//     return NextResponse.json({ item: upd });
//   } else {
//     const [ins] = await db
//       .insert(classFeeMeta)
//       .values({
//         className,
//         dayscholarMonthlyFee: Number(dayscholarMonthlyFee || 0),
//         hostellerMonthlyFee: Number(hostellerMonthlyFee || 0),
//       })
//       .returning();
//     return NextResponse.json({ item: ins });
//   }
// }
