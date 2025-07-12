import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Explicitly load .env.local

console.log("DATABASE_URL:", process.env.DATABASE_URL); // Debug log

/** @type { import("drizzle-kit").Config } */
export default {
  schema: "./lib/schema.js",
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  out: "./drizzle",
};
// export default {
//   schema: "./utils/schema.js",
//   dialect: "postgresql",
//   dbCredentials: {
//     url: process.env.DATABASE_URL,
//   },
//   out: "./drizzle",
// };