import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, assignedTasks, messages } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, inArray } from "drizzle-orm";
import twilio from "twilio";

/* ============================ Twilio client ============================ */
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER } = process.env;
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/* ============================ Utilities ============================ */
const toE164 = (n) => {
  if (!n) return null;
  const x = n.trim();
  const withPlus = x.startsWith("+") ? x : `+${x}`;
  return /^\+[1-9]\d{1,14}$/.test(withPlus) ? withPlus : null;
};

const gbDate = (d = new Date()) =>
  d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function computeDeadline(deadlineRaw) {
  if (!deadlineRaw) return { deadlineText: "Not set", daysLabel: "N/A" };
  const dt = new Date(deadlineRaw);
  if (Number.isNaN(dt.getTime())) return { deadlineText: "Not set", daysLabel: "N/A" };

  const now = new Date();
  const diffDays = Math.ceil((dt.getTime() - now.getTime()) / 86400000);
  const deadlineText = dt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  if (diffDays >= 0) return { deadlineText, daysLabel: String(diffDays) };
  return { deadlineText, daysLabel: `overdue by ${Math.abs(diffDays)}` };
}

const S = (v, fallback = "") => {
  const x = v ?? fallback;
  return typeof x === "string" ? x : String(x);
};

/* ============================ WhatsApp Sender ============================ */
async function sendWhatsappReminder(toNumber, content) {
  if (!TWILIO_WHATSAPP_NUMBER) throw new Error("Missing env TWILIO_WHATSAPP_NUMBER");
  const e164 = toE164(toNumber);
  if (!e164) throw new Error(`Invalid E.164 WhatsApp number: ${toNumber}`);

  const contentSid = "HX2a9a52d590c963f47e4147d8636d951e"; // task_reminder

  // STRICTLY strings; no null/undefined; no literal "undefined"/"null"
  const vars = {
    "1": S(content?.recipientName, "User"),
    "2": S(content?.updaterName, "Manager"),
    "3": S(content?.taskTitle, "Untitled Task"),
    "4": S(content?.taskStatus, "Unknown"),
    "5": S(content?.deadline, "Not set"),
    "6": S(content?.daysLabel, "N/A"),
    "7": S(content?.logComment, "No recent updates"),
    "8": S(content?.dateTime, gbDate()),
  };
  for (const k of Object.keys(vars)) {
    if (vars[k] === "undefined" || vars[k] === "null") vars[k] = "";
  }

  // Build JSON string (and verify it round-trips)
  const contentVariables = JSON.stringify(vars);
  try {
    const roundTrip = JSON.parse(contentVariables);
    if (!roundTrip || typeof roundTrip !== "object") throw new Error("contentVariables not an object");
  } catch (e) {
    throw new Error(`contentVariables JSON invalid: ${(e && e.message) || e}`);
  }

  const payload = {
    from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${e164}`,
    contentSid,
    contentVariables,
  };

  // DEBUG (redact number)
  console.log("[WA DEBUG] create payload:", {
    from: payload.from,
    to: `whatsapp:${e164.slice(0, 5)}…`,
    contentSid,
    contentVariables,
  });

  const resp = await twilioClient.messages.create(payload);
  return resp?.sid;
}

/* ============================ POST ============================ */
export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) || {};
    const { taskId, userIds, taskTitle, taskStatus, deadline, latestLog } = body;

    // Normalize user IDs
    let ids = [];
    if (Array.isArray(userIds)) {
      ids = userIds.map((x) => parseInt(x, 10)).filter(Number.isFinite);
    } else if (typeof userIds === "string") {
      try {
        const arr = JSON.parse(userIds);
        ids = Array.isArray(arr) ? arr.map((x) => parseInt(x, 10)).filter(Number.isFinite) : [];
      } catch {
        return NextResponse.json({ error: "Invalid userIds format" }, { status: 400 });
      }
    }

    if (!taskId || !taskTitle || ids.length === 0) {
      return NextResponse.json({ error: "Missing or invalid inputs" }, { status: 400 });
    }

    // Fetch task (for canonical status/deadline)
    const [task] = await db
      .select({ id: assignedTasks.id, deadline: assignedTasks.deadline, status: assignedTasks.status })
      .from(assignedTasks)
      .where(eq(assignedTasks.id, taskId));

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const { deadlineText, daysLabel } = computeDeadline(task?.deadline || deadline || null);

    // Sender
    const [sender] = await db.select({ name: users.name }).from(users).where(eq(users.id, session.user.id));
    if (!sender) return NextResponse.json({ error: "Sender not found" }, { status: 400 });

    // Recipients
    const recipients = await db
      .select({ id: users.id, name: users.name, whatsapp_number: users.whatsapp_number, whatsapp_enabled: users.whatsapp_enabled })
      .from(users)
      .where(inArray(users.id, ids));

    // If no recipients match, just log action and return 200
    if (!recipients?.length) {
      const inserts = ids.map((uid) => ({
        senderId: session.user.id,
        recipientId: uid,
        content: `Reminder sent for task "${taskTitle}" [task:${taskId}]`,
        createdAt: new Date(),
        status: "sent",
      }));
      if (inserts.length) await db.insert(messages).values(inserts);
      return NextResponse.json({ message: "No matching recipients; action logged." }, { status: 200 });
    }

    const nowStr = gbDate();
    const results = await Promise.all(
      recipients.map(async (r) => {
        if (!r.whatsapp_enabled || !r.whatsapp_number) {
          return { id: r.id, skipped: true, reason: "whatsapp_disabled_or_missing_number" };
        }
        try {
          const sid = await sendWhatsappReminder(r.whatsapp_number, {
            recipientName: r.name,
            updaterName: sender.name,
            taskTitle,
            taskStatus: taskStatus || task.status || "Unknown",
            deadline: deadlineText,
            daysLabel,
            logComment: latestLog || "No recent updates",
            dateTime: nowStr,
          });
          return { id: r.id, sid };
        } catch (e) {
          // Capture full error message (avoid passing raw error objects to JSON)
          const msg = typeof e?.message === "string" ? e.message : String(e);
          console.error(`[WA ERROR] user ${r.id}:`, msg);
          return { id: r.id, error: msg };
        }
      })
    );

    // Always log action to messages
    const inserts = recipients.map((r) => ({
      senderId: session.user.id,
      recipientId: r.id,
      content: `Reminder sent for task "${taskTitle}" [task:${taskId}]`,
      createdAt: new Date(),
      status: "sent",
    }));
    if (inserts.length) await db.insert(messages).values(inserts);

    const sent = results.filter((x) => x.sid);
    const failed = results.filter((x) => x.error);

    if (!sent.length && failed.length) {
      return NextResponse.json({ error: "Failed to send all WhatsApp reminders", failed }, { status: 502 });
    }

    return NextResponse.json({ message: "Reminders processed", sent, failed }, { status: 200 });
  } catch (err) {
    // Never return raw Error objects; stringify message only
    const msg = typeof err?.message === "string" ? err.message : String(err);
    console.error("Error sending reminders:", msg, err?.stack);
    return NextResponse.json({ error: `Failed to send reminders: ${msg}` }, { status: 500 });
  }
}
