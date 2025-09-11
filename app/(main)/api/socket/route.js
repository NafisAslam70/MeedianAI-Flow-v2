import { Server } from "socket.io";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  // In App Router, NextRequest may not expose a Node socket; guard for it
  const anyReq = req;
  const server = anyReq?.socket?.server;
  if (!server) {
    return NextResponse.json({ message: "Socket disabled on this platform" });
  }
  // Check if the Socket.IO server is already initialized
  if (!server.io) {
    console.log("Initializing Socket.IO server");

    const io = new Server(server, {
      path: "/api/socket",
      cors: {
        origin: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    io.on("connection", (socket) => {
      const userId = socket.handshake.query.userId;
      console.log(`User connected: ${socket.id}, userId: ${userId}`);

      socket.join(userId);
      const onlineUsers = Array.from(io.sockets.sockets.values())
        .map((s) => parseInt(s.handshake.query.userId))
        .filter((id, index, self) => id && self.indexOf(id) === index);
      io.emit("onlineUsers", onlineUsers);

      socket.on("message", (message) => {
        if (!message.recipientId || !message.senderId) {
          console.error("Invalid message:", message);
          return;
        }
        io.to(message.recipientId.toString()).emit("message", {
          ...message,
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        });
      });

      socket.on("typing", ({ userId, isTyping }) => {
        socket.broadcast.emit("typing", { userId, isTyping });
      });

      socket.on("messageRead", ({ messageId }) => {
        io.emit("messageRead", { messageId });
      });

      socket.on("webrtc-signal", ({ signal, userId, recipientId }) => {
        if (!recipientId || !signal || !userId) {
          console.error("Invalid WebRTC signal:", { signal, userId, recipientId });
          return;
        }
        io.to(recipientId.toString()).emit("webrtc-signal", { signal, userId });
      });

      socket.on("task-update", (data) => {
        io.emit("task-update", data);
      });

      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}, userId: ${userId}`);
        const updatedOnlineUsers = Array.from(io.sockets.sockets.values())
          .map((s) => parseInt(s.handshake.query.userId))
          .filter((id, index, self) => id && self.indexOf(id) === index);
        io.emit("onlineUsers", updatedOnlineUsers);
      });
    });

    server.io = io;
  } else {
    console.log("Socket.IO server already initialized");
  }

  return NextResponse.json({ message: "Socket.IO server initialized" });
}
