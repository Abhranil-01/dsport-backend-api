import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.set("trust proxy", 1); 
/* =========================
   SECURE CORS CONFIG
========================= */


const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://dsportdb.online",
  "https://www.dsportdb.online",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow server-to-server / Postman
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, origin); // 👈 IMPORTANT
      }

      return callback(new Error("CORS not allowed"));
    },
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

export { app };
