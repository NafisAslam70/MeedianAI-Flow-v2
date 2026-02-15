// lib/auth.js
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { eq } from "drizzle-orm";

// Wrap auth to enforce sessionNonce invalidation (logout-all support)
const { auth: baseAuth, handlers } = NextAuth(authConfig);

export const auth = async (...args) => {
  const session = await baseAuth(...args);
  if (!session?.user?.id) return session;
  try {
    const { db } = await import("@/lib/db");
    const { users } = await import("@/lib/schema");
    const [row] = await db
      .select({ nonce: users.sessionNonce })
      .from(users)
      .where(eq(users.id, Number(session.user.id)));
    const currentNonce = row?.nonce || null;
    const tokenNonce = session.user.session_nonce || null;
    if (currentNonce && tokenNonce && currentNonce !== tokenNonce) return null; // force re-login
    return session;
  } catch (e) {
    console.error("auth nonce check failed", e);
    return session; // fail soft to avoid blocking auth entirely
  }
};
export { handlers };
