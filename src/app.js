import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "./queues/invoiceQueueEvents.queues.js"
const app = express();

/* =========================
   TRUST PROXY (IMPORTANT)
========================= */
app.set("trust proxy", 1);

/* =========================
   CORS CONFIG
========================= */
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : ["http://localhost:3000", "http://localhost:5173"];
app.use(
  cors({
    origin: true, // reflect request origin
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);




/* =========================
   MIDDLEWARES
========================= */

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(express.static("public"));
app.use(cookieParser());

/* =========================
   HEALTH / ROOT ROUTE (FIXES 500)
========================= */

app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "DSport Backend API is running 🚀",
  });
});

/* =========================
   ROUTES
========================= */

import userRouter from "./routes/user.routes.js";
import adminRouter from "./routes/admin.routes.js";
import categoryRouter from "./routes/categories.routes.js";
import subCategoryRouter from "./routes/subCategories.routes.js";
import productRouter from "./routes/product.routes.js";
import addToCartRouter from "./routes/addToCart.routes.js";
import addressRouter from "./routes/address.routes.js";
import orderRouter from "./routes/order.routes.js";
import chargesRouter from "./routes/charges.routes.js";
import reviewRating from "./routes/reviewRating.routes.js";

app.use("/api/v1/users", userRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1", categoryRouter);
app.use("/api/v1", subCategoryRouter);
app.use("/api/v1", productRouter);
app.use("/api/v1/cart", addToCartRouter);
app.use("/api/v1/address", addressRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/charges", chargesRouter);
app.use("/api/v1", reviewRating);

/* =========================
   GLOBAL ERROR HANDLER
========================= */

app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

/* =========================
   404 HANDLER
========================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

export { app };
