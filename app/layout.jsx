"use client";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { motion } from "framer-motion";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen relative bg-gradient-to-br from-gray-50 to-blue-100">
        <motion.div
          className="absolute inset-0 pointer-events-none z-[-1]" // Disable pointer events and set negative z-index
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 2 }}
        >
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-4 h-4 bg-blue-300 rounded-full opacity-20 pointer-events-none" // Ensure dots don’t capture events
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -30, 0],
                x: [0, 20, 0],
                scale: [1, 1.2, 1],
                rotate: [0, 360],
              }}
              transition={{
                duration: 10 + Math.random() * 5,
                repeat: Infinity,
                repeatType: "loop",
                delay: Math.random() * 2,
              }}
            />
          ))}
          <motion.div
            className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23B0C4DE%22%20fill-opacity%3D%220.1%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30v4h-4v2h4v4h2v-4h4v-2h-4v-4h-2zM6%2034v4h4v2h-4v4h-2v-4h-4v-2h4v-4h2zM6%204v-4h-4v2h4v4h2v-4h4v-2h-4z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] pointer-events-none" // Disable pointer events for SVG background
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 8, repeat: Infinity, repeatType: "reverse" }}
          />
        </motion.div>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}