import { Server } from "socket.io";
import { NextResponse } from "next/server";

export async function GET(req, res) {
  if (!req.socket.server.io) {
    const io = new Server(req.socket.server, {
      path: "/api/socket",
      cors: {
        origin: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
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
        if (!message.recipientId || !message.senderId) return;
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
        if (!recipientId || !signal || !userId) return;
        io.to(recipientId.toString()).emit("webrtc-signal", { signal, userId });
      });

      socket.on("task-update", (data) => {
        io.emit("task-update", data);
      });

      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
        const updatedOnlineUsers = Array.from(io.sockets.sockets.values())
          .map((s) => parseInt(s.handshake.query.userId))
          .filter((id, index, self) => id && self.indexOf(id) === index);
        io.emit("onlineUsers", updatedOnlineUsers);
      });
    });

    req.socket.server.io = io;
  }

  return NextResponse.json({ message: "Socket.IO server initialized" });
}