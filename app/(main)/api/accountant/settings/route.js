// // app/(main)/api/accountant/settings/route.js
// import { NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import { db } from "@/lib/db";
// import { accountingSettings } from "@/lib/schema";

// function canUse(session) {
//   return session?.user?.role === "admin" || session?.user?.team_manager_type === "accountant";
// }

// export async function GET() {
//   const session = await auth();
//   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   if (!canUse(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

//   const rows = await db.select().from(accountingSettings);
//   const s = rows?.[0] || null;
//   return NextResponse.json({
//     settings: s || {
//       booksStartDate: null,
//       openingCash: 0,
//       openingUPI: 0,
//       openingBank: 0,
//     },
//   });
// }

// export async function POST(req) {
//   const session = await auth();
//   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   if (!canUse(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

//   const body = await req.json();
//   const booksStartDate = body?.booksStartDate ? new Date(body.booksStartDate) : new Date();
//   const openingCash = Number(body?.openingCash || 0);
//   const openingUPI  = Number(body?.openingUPI  || 0);
//   const openingBank = Number(body?.openingBank || 0);

//   const rows = await db.select().from(accountingSettings);
//   if (rows?.length) {
//     const [upd] = await db
//       .update(accountingSettings)
//       .set({ booksStartDate, openingCash, openingUPI, openingBank, updatedAt: new Date() })
//       .where(accountingSettings.id.eq(rows[0].id))
//       .returning();
//     return NextResponse.json({ settings: upd });
//   } else {
//     const [ins] = await db
//       .insert(accountingSettings)
//       .values({
//         booksStartDate,
//         openingCash, openingUPI, openingBank,
//         singleton: true,
//       })
//       .returning();
//     return NextResponse.json({ settings: ins });
//   }
// }
