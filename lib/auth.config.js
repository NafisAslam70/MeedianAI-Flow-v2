import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq, or } from "drizzle-orm";

export const authConfig = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email, Nickname, or MedianID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("Authorize input:", { identifier: credentials?.identifier, password: credentials?.password });

        const identifier = credentials?.identifier?.toLowerCase();
        const password = credentials?.password;

        if (!identifier || !password) {
          console.log("Missing identifier or password");
          return null;
        }

        try {
          const [user] = await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              nickname: users.nickname,
              medianID: users.medianID,
              password: users.password,
              role: users.role,
            })
            .from(users)
            .where(
              or(
                eq(users.email, identifier),
                eq(users.nickname, identifier),
                eq(users.medianID, identifier.toUpperCase())
              )
            );

          console.log("User found:", user);

          if (!user) {
            console.log("No user found for identifier:", identifier);
            return null;
          }

          const isValid = password === user.password;
          console.log("Password comparison result:", isValid);

          if (!isValid) {
            console.log("Password validation failed");
            return null;
          }

          return {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
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
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true, // Keep debug enabled for troubleshooting
};