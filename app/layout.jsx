"use client";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function RootLayout({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen relative overflow-x-hidden bg-gradient-to-br from-gray-50 to-blue-100">
        {mounted && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ duration: 2 }}
          >
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-4 h-4 bg-blue-300 rounded-full opacity-20"
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
              className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23B0C4DE%22%20fill-opacity%3D%220.1%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30v4h-4v2h4v4h2v-4h4v-2h-4v-4h-2zM6%2034v4h4v2h-4v4h-2v-4h-4v-2h4v-4h2zM6%204v-4h-4v2h4v4h2v-4h4v-2h-4z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 8, repeat: Infinity, repeatType: "reverse" }}
            />
          </motion.div>
        )}
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
