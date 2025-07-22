import { useRef, useEffect } from "react";
import io from "socket.io-client";

let socketInstance = null;

export function useSocket(userId) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    if (!socketInstance) {
      socketInstance = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000", {
        path: "/api/socket",
        query: { userId },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }

    socketRef.current = socketInstance;

    return () => {
      if (socketInstance && socketInstance.connected) {
        socketInstance.disconnect();
        socketInstance = null;
      }
    };
  }, [userId]);

  return socketRef.current;
}