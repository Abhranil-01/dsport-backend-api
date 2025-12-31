import { Server } from "socket.io";

let io;

export const initSocket = (httpServer) => {
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : ["http://localhost:5173", "http://localhost:3000"];

io = new Server(httpServer, {
  transports: ["polling","websocket"], // 🔑 REQUIRED FOR VERCEL
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});


  io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

    // 🔐 Admin room
    socket.on("JOIN_ADMIN", () => {
      socket.join("ADMIN");
      console.log(`👮 Admin joined ADMIN room: ${socket.id}`);
    });

    // 👤 User room (optional)
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

export const getIO = () => {
  return io; // may be undefined early — that's OK
};
