// lib/auth.js
// import NextAuth from "next-auth";
// import { authConfig } from "./auth.config";

// export const { auth, handlers } = NextAuth(authConfig);
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
        team_manager_type: { label: "Team Manager Type", type: "text" },
      },
      async authorize(credentials) {
        console.log("Authorize input:", {
          email: credentials?.email,
          role: credentials?.role,
          team_manager_type: credentials?.team_manager_type,
        });

        if (!credentials?.email || !credentials?.password || !credentials?.role) {
          console.log("Missing email, password, or role");
          throw new Error("Missing required credentials: email, password, or role");
        }

        const email = credentials.email.toLowerCase();
        const role = credentials.role;
        const team_manager_type = credentials.team_manager_type;

        try {
          const [user] = await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              password: users.password,
              role: users.role,
              team_manager_type: users.team_manager_type,
            })
            .from(users)
            .where(eq(users.email, email));

          console.log("User found:", user);

          if (!user) {
            console.log("No user found for email:", email);
            throw new Error("No user found with the provided email");
          }

          // TODO: Replace with bcrypt in production
          const isValid = credentials.password === user.password;
          console.log("Password valid:", isValid);
          if (!isValid) {
            console.log("Password mismatch for user:", user.email);
            throw new Error("Invalid password");
          }

          if (role !== user.role) {
            console.log("Role mismatch: expected", user.role, "got", role);
            throw new Error("Selected role does not match user account");
          }

          if (role === "team_manager" && team_manager_type && team_manager_type !== user.team_manager_type) {
            console.log("Team manager type mismatch: expected", user.team_manager_type, "got", team_manager_type);
            throw new Error("Selected team manager type does not match user account");
          }

          const userData = {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            team_manager_type: user.team_manager_type || null,
          };
          console.log("Returning user:", userData);
          return userData;
        } catch (error) {
          console.error("Authorize error:", error.message);
          throw new Error(error.message);
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.team_manager_type = user.team_manager_type;
      }
      console.log("JWT callback:", token);
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.team_manager_type = token.team_manager_type;
      }
      console.log("Session callback:", session);
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === "production" ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  debug: true,
};

export const { auth, handlers } = NextAuth(authOptions);