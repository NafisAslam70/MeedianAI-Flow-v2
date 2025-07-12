import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const authOptions = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("Authorize input:", credentials);
        if (!credentials?.email || !credentials?.password) {
          console.log("Missing email or password");
          return null;
        }
        const email = credentials.email.toLowerCase();
        const [user] = await db.select().from(users).where(eq(users.email, email));
        console.log("User found:", user);
        if (!user) {
          console.log("No user found for email:", email);
          return null;
        }
        const isValid = credentials.password === user.password; // Note: Use bcrypt for production
        console.log("Password valid:", isValid);
        if (!isValid) {
          console.log("Password mismatch for user:", user.email);
          return null;
        }
        const userData = {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        };
        console.log("Returning user:", userData);
        return userData;
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
  pages: { signIn: "/login", error: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
};

const { handlers } = NextAuth(authOptions);
export const { GET, POST } = handlers;