// FILE: app/api/others/jaas-jwt/route.js
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { auth } from "@/lib/auth";
function getPem () {
  const b64 = process.env.JAAS_PRIVATE_KEY_B64;
  if (!b64) throw new Error("JAAS_PRIVATE_KEY_B64 undefined");
  const pem = Buffer.from(b64, "base64").toString("utf8");
  if (!/BEGIN (RSA )?PRIVATE KEY/.test(pem)) throw new Error("Bad PEM");
  return pem;
}
export async function GET () {
  const session = await auth();
  if (!session || !["admin", "team_manager", "member"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenant = (process.env.JAAS_APP_ID || "meedian-dev").trim();
  const room = (process.env.NEXT_PUBLIC_JAAS_ROOM || "MeedianTogetherMain").trim();
  const kid = process.env.JAAS_KID;
  const pem = getPem();
  const payload = {
    aud : "jitsi",
    iss : "chat",
    sub : tenant,
    room,
    context : {
      user : {
        id: session.user.id,
        name: session.user.name,
        moderator: session.user.role === "admin"
      },
      features : { livestreaming:false, recording:false, transcription:false }
    },
    exp : Math.floor(Date.now() / 1000) + 60 * 60
  };
  let token;
  try {
    token = jwt.sign(payload, pem, { algorithm:"RS256", keyid:kid });
  } catch (e) {
    console.error("JWT sign error", e);
    return NextResponse.json({ error:"JWT signing failed" }, { status:500 });
  }
  return NextResponse.json({ jwt: token });
}
