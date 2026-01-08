import { Server } from "socket.io";

let io;

export const initSocket = (httpServer) => {
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
    : ["http://localhost:5173", "http://localhost:3000"];

  io = new Server(httpServer, {
    transports: ["polling", "websocket"], // required for Vercel
    cors: {
      origin: allowedOrigins,  // must match Express
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

    socket.on("JOIN_ADMIN", () => {
      socket.join("ADMIN");
      console.log(`👮 Admin joined ADMIN room: ${socket.id}`);
    });

    socket.on("JOIN_USER", (userId) => {
      if (!userId) return;
      socket.join(`USER_${userId}`);
      console.log(`👤 User joined USER_${userId}`);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);
    });
  });
};

export const getIO = () => io;
