// server.js
import { Server } from "socket.io";
import { createServer } from "http";

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Track online users
const onlineUsers = new Set();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    onlineUsers.add(Number(userId));
    io.emit("user-status", { userId: Number(userId), status: "online" });
  }

  socket.on("send-message", (message) => {
    io.emit("new-message", message);
  });

  socket.on("disconnect", () => {
    if (userId) {
      onlineUsers.delete(Number(userId));
      io.emit("user-status", { userId: Number(userId), status: "offline" });
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.WEBSOCKET_PORT || 5001; // Changed to 5001
server.listen(PORT, () => console.log(`WebSocket server running on port ${PORT}`));