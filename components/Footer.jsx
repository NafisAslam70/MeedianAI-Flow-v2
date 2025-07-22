"use client";
import { motion } from "framer-motion";

export default function Footer() {
  return (
    <footer className="h-10 bg-gray-900 text-white flex items-center justify-center relative overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
      />
      <motion.p
        className="text-sm font-light relative z-10 flex items-center space-x-2"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <span>© 2025 Proudly developed by</span>
        <a
          href="https://github.com/nafees-aslam"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-300 hover:text-blue-400 transition-colors duration-300"
        >
          Nafees Aslam
        </a>
        <a
          href="https://github.com/nafees-aslam"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-white transition-colors duration-300"
          aria-label="GitHub Profile"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48v-1.69c-2.78.6-3.36-1.34-3.36-1.34-.46-1.16-1.12-1.47-1.12-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.64-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0112 6.8c.85 0 1.71.11 2.52.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10.01 10.01 0 0022 12c0-5.52-4.48-10-10-10z" />
          </svg>
        </a>
        <a
          href="https://www.linkedin.com/in/nafis-aslam/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-white transition-colors duration-300"
          aria-label="LinkedIn Profile"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14zm-9.5 6.5H7v8h2.5v-8zm1.25-2a1.75 1.75 0 100 3.5 1.75 1.75 0 000-3.5zm6.75 5.25c0-1.25-.75-2.25-2-2.25-.5 0-1 .25-1.25.75v-1.25H12v8h2.5v-4.5c0-.75.5-1.25 1-1.25s1 .5 1 1.25v4.5H19v-5.25z" />
          </svg>
        </a>
      </motion.p>
    </footer>
  );
}