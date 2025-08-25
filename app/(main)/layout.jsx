"use client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation"; // Import usePathname
import ChatBox from "@/components/ChatBox";
import { useSocket } from "@/lib/useSocket";

export default function MainLayout({ children }) {
  const { status, data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [userDetails, setUserDetails] = useState({ id: null, role: null });
  const [positions, setPositions] = useState([]);
  const [chatboxOpen, setChatboxOpen] = useState(false);
  const [chatRecipient, setChatRecipient] = useState("");
  const socket = useSocket(session?.user?.id);
  const pathname = usePathname(); // Get current route

  useEffect(() => {
    setMounted(true);
    const newPositions = [...Array(10)].map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      animationDuration: `${5 + Math.random() * 5}s`,
      animationDelay: `${Math.random() * 5}s`,
    }));
    setPositions(newPositions);
  }, []);

  useEffect(() => {
    if (session?.user) {
      setUserDetails({
        id: session.user.id || null,
        role: session.user.role || null,
      });
    }
  }, [session]);

  // Define routes where ChatBox should be hidden
  const hideChatBoxRoutes = [
    "/dashboard/admin/profile",
    "/dashboard/team_manager/profile",
    "/dashboard/member/profile",
  ];

  if (!mounted || status === "loading") {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100">
        <div className="text-lg font-semibold text-gray-700 animate-pulse">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="animate-float">
          {positions.map((pos, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-teal-200 rounded-full opacity-30"
              style={{
                left: pos.left,
                top: pos.top,
                animation: `float ${pos.animationDuration} linear infinite`,
                animationDelay: pos.animationDelay,
              }}
            />
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes float {
          0% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-20px) translateX(10px); }
          100% { transform: translateY(0) translateX(0); }
        }
        .animate-float div { animation: float linear infinite; }
      `}</style>
      <Navbar />
      <main className="flex-1 p-4 bg-white/80 backdrop-blur-sm relative z-10 overflow-y-auto md:overflow-y-hidden">
        {children}
      </main>
      <Footer className="h-10" />
      {userDetails.id && socket && !hideChatBoxRoutes.includes(pathname) && (
        <ChatBox
          userDetails={userDetails}
          socket={socket}
          isOpen={chatboxOpen}
          setIsOpen={setChatboxOpen}
          recipientId={chatRecipient}
        />
      )}
    </div>
  );
}