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
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

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
        if (
          !credentials?.email ||
          !credentials?.password ||
          !credentials?.role
        ) {
          throw new Error("Email, password and role are required.");
        }

        const email = credentials.email.toLowerCase();
        const [{ id, name, password, role, team_manager_type } = {}] =
          await db
            .select()
            .from(users)
            .where(eq(users.email, email));

        if (!id) throw new Error("No user found.");

        // TODO: bcrypt in prod
        if (password !== credentials.password) {
          throw new Error("Invalid password.");
        }

        if (role !== credentials.role) {
          throw new Error("Role mismatch with account.");
        }

        if (
          role === "team_manager" &&
          credentials.team_manager_type &&
          credentials.team_manager_type !== team_manager_type
        ) {
          throw new Error("Team‑manager category mismatch.");
        }

        return {
          id: id.toString(),
          name,
          email,
          role,
          team_manager_type: team_manager_type ?? null,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.team_manager_type = user.team_manager_type;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.team_manager_type = token.team_manager_type;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== "production",
};

const { handlers } = NextAuth(authOptions);
export const { GET, POST } = handlers;
