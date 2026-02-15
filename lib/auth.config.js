// lib/auth.config.js
import Credentials from "next-auth/providers/credentials";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const authConfig = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" }, // Changed to email only
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
        team_manager_type: { label: "Team Manager Type", type: "text" },
      },
      async authorize(credentials) {
        console.log("Authorize input:", {
          email: credentials?.email,
          password: credentials?.password,
          role: credentials?.role,
          team_manager_type: credentials?.team_manager_type,
        });

        const email = credentials?.email?.toLowerCase();
        const password = credentials?.password;
        const role = credentials?.role;
        const team_manager_type = credentials?.team_manager_type;

        if (!email || !password) {
          console.log("Missing email or password");
          return null;
        }

        try {
          const { db } = await import("@/lib/db");
          const [user] = await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              password: users.password,
              active: users.active,
              role: users.role,
              team_manager_type: users.team_manager_type,
              whatsapp_number: users.whatsapp_number,
              whatsapp_enabled: users.whatsapp_enabled,
              image: users.image, // Added
              session_nonce: users.sessionNonce,
            })
            .from(users)
            .where(eq(users.email, email));

          console.log("User found:", user);

          if (!user) {
            console.log("No user found for email:", email);
            return null;
          }
          if (user.active === false) {
            console.log("Inactive account:", email);
            return null;
          }

          // Validate password (Note: Replace with bcrypt in production)
          const isValid = password === user.password;
          console.log("Password comparison result:", isValid);

          if (!isValid) {
            console.log("Password validation failed");
            return null;
          }

          // Validate role if provided
          if (role && role !== user.role) {
            console.log("Role mismatch: expected", user.role, "got", role);
            return null;
          }

          // Validate team_manager_type if provided and user is team_manager
          if (role === "team_manager" && team_manager_type && team_manager_type !== user.team_manager_type) {
            console.log("Team manager type mismatch: expected", user.team_manager_type, "got", team_manager_type);
            return null;
          }

          return {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            team_manager_type: user.team_manager_type,
            whatsapp_number: user.whatsapp_number,
            whatsapp_enabled: user.whatsapp_enabled,
            image: user.image || "/default-avatar.png", // Added
            session_nonce: user.session_nonce || null,
          };
        } catch (error) {
          console.error("Authorize error:", error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name; // Added
        token.email = user.email; // Added
        token.role = user.role;
        token.team_manager_type = user.team_manager_type;
        token.whatsapp_number = user.whatsapp_number; // Added
        token.whatsapp_enabled = user.whatsapp_enabled; // Added
        token.image = user.image; // Added
        token.session_nonce = user.session_nonce || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id;
        session.user.name = token.name; // Added
        session.user.email = token.email; // Added
        session.user.role = token.role;
        session.user.team_manager_type = token.team_manager_type;
        session.user.whatsapp_number = token.whatsapp_number; // Added
        session.user.whatsapp_enabled = token.whatsapp_enabled; // Added
        session.user.image = token.image; // Added
        session.user.session_nonce = token.session_nonce || null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // Support Auth.js v5 env naming (AUTH_SECRET) and legacy NEXTAUTH_SECRET
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  debug: true,
};
