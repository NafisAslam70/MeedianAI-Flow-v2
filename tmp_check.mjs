import { db } from "./lib/db.js";
import { finalDailyAttendance } from "./lib/schema.js";
import { and, eq } from "drizzle-orm";

const rows = await db.select().from(finalDailyAttendance).limit(5);
console.log(rows);
