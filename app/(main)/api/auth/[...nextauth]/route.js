import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

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
      async authorize(credentials, req) {
        console.log("Authorize input:", {
          email: credentials?.email,
          password: credentials?.password,
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
              image: users.image, // Add image field
            })
            .from(users)
            .where(eq(users.email, email));

          console.log("User found:", user);

          if (!user) {
            console.log("No user found for email:", email);
            throw new Error("No user found with the provided email");
          }

          // TODO: Replace with bcrypt comparison in production
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
            image: user.image || "/default-avatar.png", // Include image with fallback
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
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.team_manager_type = user.team_manager_type;
        token.image = user.image; // Add image to JWT
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.team_manager_type = token.team_manager_type;
        session.user.image = token.image || "/default-avatar.png"; // Add image to session
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  error: async (error, req, res) => {
    if (error === "CredentialsSignin") {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(req?.body?.error || "Authentication failed")}`, req.url));
    }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, req.url));
  },
};

const { handlers } = NextAuth(authOptions);
export const { GET, POST } = handlers;