import { NextResponse } from "next/server";
import twilio from "twilio";

export async function GET() {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID } =
    process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET) {
    return NextResponse.json(
      { error: "Missing TWILIO_ACCOUNT_SID or TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET" },
      { status: 500 }
    );
  }
  if (!TWILIO_TWIML_APP_SID) {
    return NextResponse.json({ error: "Missing TWILIO_TWIML_APP_SID" }, { status: 500 });
  }

  // Simple identity; in real use, tie to the logged-in user id
  const identity = "web-agent";

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: TWILIO_TWIML_APP_SID,
    incomingAllow: false,
  });

  const token = new AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY_SID,
    TWILIO_API_KEY_SECRET,
    { identity }
  );
  token.addGrant(voiceGrant);

  return NextResponse.json({ token: token.toJwt(), identity });
}
