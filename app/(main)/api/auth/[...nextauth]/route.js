// import NextAuth from "next-auth";
// import Credentials from "next-auth/providers/credentials";
// import { db } from "@/lib/db";
// import { users } from "@/lib/schema";
// import { eq } from "drizzle-orm";

// export const authOptions = {
//   providers: [
//     Credentials({
//       name: "Credentials",
//       credentials: {
//         email: { label: "Email", type: "text" },
//         password: { label: "Password", type: "password" },
//       },
//       async authorize(credentials) {
//         console.log("Authorize input:", credentials);
//         if (!credentials?.email || !credentials?.password) {
//           console.log("Missing email or password");
//           return null;
//         }
//         const email = credentials.email.toLowerCase();
//         const [user] = await db.select().from(users).where(eq(users.email, email));
//         console.log("User found:", user);
//         if (!user) {
//           console.log("No user found for email:", email);
//           return null;
//         }
//         const isValid = credentials.password === user.password; // Note: Use bcrypt for production
//         console.log("Password valid:", isValid);
//         if (!isValid) {
//           console.log("Password mismatch for user:", user.email);
//           return null;
//         }
//         const userData = {
//           id: user.id.toString(),
//           name: user.name,
//           email: user.email,
//           role: user.role,
//         };
//         console.log("Returning user:", userData);
//         return userData;
//       },
//     }),
//   ],
//   session: { strategy: "jwt" },
//   callbacks: {
//     async jwt({ token, user }) {
//       if (user) {
//         token.id = user.id;
//         token.role = user.role;
//       }
//       return token;
//     },
//     async session({ session, token }) {
//       if (session?.user) {
//         session.user.id = token.id;
//         session.user.role = token.role;
//       }
//       return session;
//     },
//   },
//   pages: { signIn: "/login", error: "/login" },
//   secret: process.env.NEXTAUTH_SECRET,
//   debug: true,
// };

// const { handlers } = NextAuth(authOptions);
// export const { GET, POST } = handlers;

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// Disable static generation for dynamic behavior
export const dynamic = "force-dynamic";

export const authOptions = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
        team_manager_type: { label: "Team Manager Type", type: "text" },
      },
      async authorize(credentials) {
        console.log("🔐 Authorize input:", credentials);

        if (!credentials?.email || !credentials?.password || !credentials?.role) {
          throw new Error("Missing required credentials.");
        }

        const email = credentials.email.toLowerCase();
        const role = credentials.role;
        const team_manager_type = credentials.team_manager_type;

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

        if (!user) throw new Error("User not found.");
        if (credentials.password !== user.password) throw new Error("Invalid password.");
        if (role !== user.role) throw new Error("Role mismatch.");
        if (role === "team_manager" && team_manager_type !== user.team_manager_type) {
          throw new Error("Team manager type mismatch.");
        }

        return {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          team_manager_type: user.team_manager_type || null,
        };
      },
    }),
  ],

  // 🔐 Store session using JWT
  session: {
    strategy: "jwt",
  },
  jwt: {
    encryption: false, // <--- force JWT signing instead of encryption
  },


  // ✅ Critical: set cookie path to allow middleware to read session token
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
      },
    },
  },

  // 🧠 Enrich JWT and session with custom claims
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.team_manager_type = user.team_manager_type;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.team_manager_type = token.team_manager_type;
      }
      return session;
    },
  },

  // 🧭 Pages
  pages: {
    signIn: "/login",
    error: "/login",
  },

  // 🔐 Required for encryption
  secret: process.env.NEXTAUTH_SECRET,

  // 🛠️ Debug only in development
  debug: process.env.NODE_ENV === "development",
};

const { handlers } = NextAuth(authOptions);
export const { GET, POST } = handlers;
