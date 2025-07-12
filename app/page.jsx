"use client";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Home() {
  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
  };

  const textVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, delay: 0.2 } },
  };

  const buttonVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, delay: 0.4 } },
    hover: { scale: 1.05, transition: { duration: 0.3 } },
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-100">
      {/* Animated Background */}
      <motion.div
        className="absolute inset-0"
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

      {/* Login Card */}
      <motion.div
        className="relative z-10 max-w-md w-full mx-4 p-8 bg-gradient-to-br from-white to-gray-50 backdrop-blur-md rounded-xl shadow-xl border border-gray-100"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="text-center">
          <motion.h1
            className="text-4xl font-serif font-bold text-gray-800 mb-4"
            variants={textVariants}
          >
            Meedian
          </motion.h1>
          <motion.p
            className="text-sm text-gray-500 mb-6 italic"
            variants={textVariants}
          >
            Welcome to Meedian, where we nurture blooming buds to mavens
          </motion.p>
          <div className="space-y-4">
            <Link href="/login?role=admin">
              <motion.button
                className="w-full py-3 bg-green-600 text-white rounded-lg flex items-center justify-center"
                variants={buttonVariants}
                initial="hidden"
                animate="visible"
                whileHover="hover"
              >
                <span className="mr-2">👤</span> Login as Admin
              </motion.button>
            </Link>
            <Link href="/login?role=member">
              <motion.button
                className="w-full py-3 bg-white border-2 border-blue-200 text-gray-700 rounded-lg flex items-center justify-center"
                variants={buttonVariants}
                initial="hidden"
                animate="visible"
                whileHover="hover"
              >
                <span className="mr-2">👥</span> Login as Team Member
              </motion.button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}