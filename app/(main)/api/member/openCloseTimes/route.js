/* app/api/member/openCloseTimes/route.js
   Accepts BOTH   /api/member/openCloseTimes
           and    /api/member/openCloseTimes?userType=residential
*/
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  users,
  openCloseTimes,
  userOpenCloseTimes,
} from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(req) {
  /* 0️⃣  who’s calling? */
  const session = await auth();
  if (!session || !["admin","team_manager","member"].includes(session.user.role))
    return NextResponse.json({ error:"Unauthorized" }, { status:401 });

  const userId  = +session.user.id;
  const url     = new URL(req.url);
  let   userType= url.searchParams.get("userType");   // optional

  /* 1️⃣  derive userType if it wasn’t provided */
  if (!userType) {
    const [{ type }] = await db
      .select({ type: users.type })
      .from(users)
      .where(eq(users.id, userId));
    if (!type)
      return NextResponse.json({ error:"User not found" }, { status:404 });
    userType = type;
  }

  /* 2️⃣  default times for that type */
  const [def] = await db
    .select({
      dayOpenTime:        openCloseTimes.dayOpenTime,
      dayCloseTime:       openCloseTimes.dayCloseTime,
      closingWindowStart: openCloseTimes.closingWindowStart,
      closingWindowEnd:   openCloseTimes.closingWindowEnd,
    })
    .from(openCloseTimes)
    .where(eq(openCloseTimes.userType, userType));

  if (!def)
    return NextResponse.json({ error:"No open/close config" }, { status:404 });

  /* 3️⃣  per-user custom overrides */
  const [custom] = await db
    .select({
      useCustom:   userOpenCloseTimes.useCustomTimes,
      dayOpenTime: userOpenCloseTimes.dayOpenedAt,
      dayCloseTime:userOpenCloseTimes.dayClosedAt,
    })
    .from(userOpenCloseTimes)
    .where(eq(userOpenCloseTimes.userId, userId));

  const times = {
    dayOpenTime:  custom?.useCustom ? custom.dayOpenTime  : def.dayOpenTime,
    dayCloseTime: custom?.useCustom ? custom.dayCloseTime : def.dayCloseTime,
    closingWindowStart: def.closingWindowStart,
    closingWindowEnd:   def.closingWindowEnd,
  };

  return NextResponse.json({ times });
}
