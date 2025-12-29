import "dotenv/config";
import http from "http";
import connectDB from "./db/index.js";
import { app } from "./app.js";
import { initSocket } from "./socket.js"; // 👈 socket init

connectDB()
  .then(() => {
    const server = http.createServer(app);

    // ✅ Initialize socket.io
    initSocket(server);
    const PORT = process.env.PORT || 8000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    server.on("error", (err) => {
      console.log("ERR", err);
      throw err;
    });
  })
  .catch((err) => {
    console.log("MongoDB Connection failed: " + err);
  });
