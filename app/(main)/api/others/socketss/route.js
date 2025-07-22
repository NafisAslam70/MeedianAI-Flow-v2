import { Server } from "socket.io";
import { NextResponse } from "next/server";
import http from "http";

let io = null;

export async function GET(req) {
  if (!io) {
    const httpServer = http.createServer();
    io = new Server(httpServer, {
      path: "/api/others/socket",
      cors: {
        origin: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log(`User connected: ${socket.id}, userId: ${socket.handshake.query.userId}`);

      const onlineUsers = Array.from(io.sockets.sockets.values())
        .map((s) => parseInt(s.handshake.query.userId))
        .filter((id, index, self) => id && self.indexOf(id) === index);
      io.emit("onlineUsers", onlineUsers);

      socket.on("message", (message) => {
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

      socket.join(socket.handshake.query.userId);
    });

    httpServer.listen(0); // Let the system assign a port
  }

  return NextResponse.json({ message: "Socket.IO server initialized" });
}

export async function POST(req) {
  return NextResponse.json({ message: "Socket.IO polling" });
}