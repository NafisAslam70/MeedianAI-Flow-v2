"use client";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import React from "react";

function AnimatedMeshes() {
  const width = 60; // Increased for full-width landscape spread
  const height = 8; // Kept as-is for perfect height and viewport fit
  const colors = Object.keys(THREE.Color.NAMES);

  return (
    <>
      {Array.from({ length: 60 }, (_, i) => (
        <Mesh key={i} index={i} z={(i / 60) * 6} height={height} width={width} colors={colors} />
      ))}
    </>
  );
}

function Mesh({ index, z, height, width, colors }) {
  const ref = React.useRef();
  const [data] = React.useState({
    x: THREE.MathUtils.randFloatSpread(width), // Full-width spread
    y: THREE.MathUtils.randFloatSpread(height),
    z: -z,
    rotationX: Math.random() * Math.PI,
    rotationZ: Math.random() * Math.PI,
    spin: THREE.MathUtils.randFloat(6, 10),
  });

  useFrame((state, dt) => {
    if (dt < 0.1) {
      ref.current.position.set(
        data.x,
        data.y + Math.sin(state.clock.elapsedTime + index) * 0.3,
        -z
      );
      ref.current.rotation.set(
        data.rotationX + dt / data.spin,
        Math.sin(index * 1000 + state.clock.elapsedTime / 10) * Math.PI * 0.5,
        data.rotationZ + dt / data.spin
      );
    }
  });

  return (
    <mesh ref={ref} scale={0.4}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={colors[Math.floor(Math.random() * colors.length)]} />
    </mesh>
  );
}

export default function Home() {
  const [selectedRole, setSelectedRole] = useState("");
  const [tempRole, setTempRole] = useState("");
  const [error, setError] = useState("");

  const roles = ["admin", "team_manager", "member"];

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  const textVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, delay: 0.2 } },
  };

  const buttonVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, delay: 0.3 } },
    hover: { scale: 1.1, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.4)", transition: { duration: 0.2 } },
    tap: { scale: 0.9 },
  };

  const handleRoleSelect = () => {
    if (tempRole) {
      setSelectedRole(tempRole);
      setTempRole("");
    } else {
      setError("Please select a role.");
      setTimeout(() => setError(""), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative h-screen w-screen overflow-hidden flex items-center justify-center bg-gradient-to-br from-teal-100/90 via-blue-100/90 to-gray-50/90"
    >
      {/* 3D Background Canvas */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={null}>
          <Canvas camera={{ fov: 60, position: [0, 0, 25] }}>
            <ambientLight intensity={0.6} />
            <pointLight position={[15, 10, 10]} intensity={1.2} />
            <AnimatedMeshes />
            <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
          </Canvas>
        </Suspense>
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 w-full max-w-5xl mx-auto bg-white/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 flex flex-col gap-6 h-[90vh] justify-between">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-2 left-2 right-2 text-base font-medium p-3 rounded-lg shadow bg-red-100 text-red-700 z-20"
              onClick={() => setError("")}
            >
              {error} (Click to dismiss)
            </motion.p>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center gap-4 text-center"
        >
          <div className="flex items-center gap-3">
            <svg className="w-10 h-10 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v2h5m-2-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Welcome to Meedian</h1>
          </div>
          <motion.p
            className="text-base sm:text-lg text-gray-600 italic max-w-xl"
            variants={textVariants}
          >
            Transform your workflow with our immersive 3D platform. Choose your role to begin.
          </motion.p>
        </motion.div>

        {/* Role Selection */}
        {!selectedRole && (
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-4"
          >
            <h2 className="text-xl font-semibold text-gray-800 text-center">Select Your Role</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {roles.map((role, index) => (
                <motion.div
                  key={`role-${role}-${index}`}
                  className={`relative p-4 rounded-xl shadow-md cursor-pointer transition-all duration-300 ${
                    tempRole === role
                      ? "bg-teal-100 border-2 border-teal-500"
                      : "bg-white hover:bg-teal-50 hover:shadow-lg"
                  } flex flex-col items-center justify-center h-24`}
                  whileHover={{ scale: 1.1, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.4)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setTempRole(role)}
                  role="button"
                  aria-label={`Select ${role} role`}
                >
                  <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-teal-500"></div>
                  <h3 className="text-base font-semibold text-gray-800 text-center">
                    {role === "admin" ? "Admin" : role === "team_manager" ? "Team Manager" : "Team Member"}
                  </h3>
                </motion.div>
              ))}
            </div>
            <motion.button
              onClick={handleRoleSelect}
              disabled={!tempRole}
              className={`w-full max-w-xs mx-auto px-6 py-3 rounded-xl text-base font-semibold ${
                !tempRole
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-gradient-to-r from-teal-600 to-blue-600 text-white hover:from-teal-700 hover:to-blue-700"
              }`}
              variants={buttonVariants}
              initial="hidden"
              animate="visible"
              whileHover="hover"
              whileTap="tap"
            >
              Select Role
            </motion.button>
          </motion.div>
        )}

        {/* Feature Section */}
        {!selectedRole && (
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-4"
          >
            <motion.h2
              className="text-xl sm:text-2xl font-bold text-gray-800 text-center"
              variants={textVariants}
            >
              Why Choose Meedian?
            </motion.h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  title: "Seamless Collaboration",
                  desc: "Work together in real-time, anywhere.",
                  icon: "M12 4v16m8-8H4",
                },
                {
                  title: "Skill Development",
                  desc: "Grow from novice to expert.",
                  icon: "M13 10V3L4 14h7v7l9-11h-7z",
                },
                {
                  title: "Trusted by Teams",
                  desc: "Join 10,000+ teams worldwide.",
                  icon: "M5 13l4 4L19 7",
                },
              ].map((feature, index) => (
                <motion.div
                  key={`feature-${index}`}
                  className="bg-white p-4 rounded-xl shadow-md flex flex-col items-center text-center"
                  whileHover={{ scale: 1.1, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.4)" }}
                >
                  <svg
                    className="w-8 h-8 text-teal-600 mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={feature.icon} />
                  </svg>
                  <h3 className="text-base font-semibold text-gray-800">{feature.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Social Proof Section */}
        {!selectedRole && (
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-4"
          >
            <motion.h2
              className="text-xl sm:text-2xl font-bold text-gray-800 text-center"
              variants={textVariants}
            >
              Trusted by Teams Worldwide
            </motion.h2>
            <div className="flex flex-wrap justify-center gap-4">
              {["TechCorp", "InnovateX", "GrowEasy"].map((company, index) => (
                <motion.div
                  key={`logo-${index}`}
                  className="h-10 w-24 bg-gray-200 rounded flex items-center justify-center text-gray-600 text-sm"
                  whileHover={{ scale: 1.1 }}
                >
                  {company}
                </motion.div>
              ))}
            </div>
            <motion.p
              className="text-base text-gray-600 italic text-center"
              variants={textVariants}
            >
              “Meedian transformed how we collaborate!” – Sarah, Team Manager
            </motion.p>
          </motion.div>
        )}

        {/* Role Confirmation */}
        {selectedRole && (
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-4 text-center"
          >
            <div className="flex items-center gap-3 justify-center">
              <svg className="w-10 h-10 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                Ready to Start as {selectedRole === "admin" ? "Admin" : selectedRole === "team_manager" ? "Team Manager" : "Team Member"}
              </h1>
            </div>
            <motion.p
              className="text-base text-gray-600 italic"
              variants={textVariants}
            >
              {selectedRole === "admin"
                ? "Manage teams with precision."
                : selectedRole === "team_manager"
                ? "Lead with powerful tools."
                : "Collaborate and excel."}
            </motion.p>
            <div className="bg-white rounded-xl shadow-md p-4 space-y-3">
              <Link href={`/login?role=${selectedRole}`}>
                <motion.button
                  className="w-full px-6 py-2 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-xl text-base font-semibold hover:from-teal-700 hover:to-blue-700 shadow-md flex items-center justify-center"
                  variants={buttonVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  whileTap="tap"
                >
                  <span className="mr-2">👤</span> Proceed to Login
                </motion.button>
              </Link>
              <motion.button
                onClick={() => setSelectedRole("")}
                className="w-full px-6 py-2 bg-gray-200 text-gray-800 rounded-xl text-base font-semibold hover:bg-gray-300"
                variants={buttonVariants}
                initial="hidden"
                animate="visible"
                whileHover="hover"
                whileTap="tap"
              >
                Back to Role Selection
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}