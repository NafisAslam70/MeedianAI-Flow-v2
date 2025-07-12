import { config } from "dotenv";
config({ path: ".env.local" }); // Load .env.local

import { db } from "./lib/db.js";
import { users } from "./lib/schema.js";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function createAdminUser() {
  const email = "a1@gmail.com";
  const plaintextPassword = "admin123"; // Replace with your desired password
  const hashedPassword = await bcrypt.hash(plaintextPassword, 10);

  // Check if user already exists
  const existingUser = await db.select().from(users).where(eq(users.email, email));
  if (existingUser.length > 0) {
    // Update existing user
    await db
      .update(users)
      .set({ password: hashedPassword, name: "Admin User", role: "admin" })
      .where(eq(users.email, email));
    console.log(`Updated admin user ${email}. Use plaintext password: ${plaintextPassword}`);
  } else {
    // Create new user
    await db.insert(users).values({
      email,
      name: "Admin User",
      password: hashedPassword,
      role: "admin",
    });
    console.log(`Created admin user ${email}. Use plaintext password: ${plaintextPassword}`);
  }
}

createAdminUser().catch((error) => {
  console.error("Error creating/updating admin user:", error);
});