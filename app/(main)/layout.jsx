"use client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function MainLayout({ children }) {
  const { status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-blue-50">
        <div className="text-lg font-semibold text-gray-700 animate-pulse">Loading session...</div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-white bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23B0C4DE%22%20fill-opacity%3D%220.1%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30v4h-4v2h4v4h2v-4h4v-2h-4v-4h-2zM6%2034v4h4v2h-4v4h-2v-4h-4v-2h4v-4h2zM6%204v-4h-4v2h4v4h2v-4h4v-2h-4z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] bg-fixed relative overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="animate-float">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-blue-200 rounded-full opacity-30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${5 + Math.random() * 5}s linear infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes float {
          0% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-20px) translateX(10px);
          }
          100% {
            transform: translateY(0) translateX(0);
          }
        }
        .animate-float div {
          animation: float linear infinite;
        }
      `}</style>
      <Navbar />
      <main className="flex-1 p-6 bg-white/80 backdrop-blur-sm shadow-lg rounded-lg mx-4 my-6 md:mx-8 lg:mx-16 border border-gray-100 relative z-10">
        {children}
      </main>
      <Footer />
    </div>
  );
}