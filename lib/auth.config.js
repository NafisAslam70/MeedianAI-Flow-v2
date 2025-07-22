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
        role: { label: "Role", type: "text" },
        team_manager_type: { label: "Team Manager Type", type: "text" },
      },
      async authorize(credentials) {
        console.log("Authorize input:", {
          identifier: credentials?.identifier,
          password: credentials?.password,
          role: credentials?.role,
          team_manager_type: credentials?.team_manager_type,
        });

        const identifier = credentials?.identifier?.toLowerCase();
        const password = credentials?.password;
        const role = credentials?.role;
        const team_manager_type = credentials?.team_manager_type;

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
              team_manager_type: users.team_manager_type,
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
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
};