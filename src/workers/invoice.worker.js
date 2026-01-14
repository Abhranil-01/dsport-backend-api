import "dotenv/config";
import { Worker } from "bullmq";
import { redis } from "../config/redis.js";
import connectDB from "../db/index.js";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { generateInvoicePdf } from "../services/invoice.service.js";
import { uploadInvoiceOnCloudinary } from "../utils/uploadInvoiceOnCloudinary.js";
import { invoiceEmailTemplate } from "../utils/orderEmails.js";
import { addEmailJob } from "../utils/addEmailJob.js";
import fs from "fs/promises";

console.log("🧾 Invoice Worker: Starting...");
await connectDB();
console.log("🧾 Invoice Worker: DB Connected");

new Worker(
  "invoice-queue",
  async (job) => {
    console.log("📥 Invoice Job Received:", job.id);
    console.log("📦 Job Data:", job.data);

    const { orderId, userId, addressSnapshot } = job.data;

    console.log("🔍 Fetching order & user...");
    const order = await Order.findById(orderId);
    const user = await User.findById(userId);

    if (!order || !user) {
      console.error("❌ Invalid order or user", { orderId, userId });
      throw new Error("Invalid order or user");
    }

    console.log("✅ Order & User Found:", order._id);

    console.log("📝 Generating Invoice PDF...");
    const invoice = await generateInvoicePdf(
      order,
      user,
      addressSnapshot
    );
    console.log("📄 Invoice PDF Generated:", invoice.invoicePath);

    console.log("☁️ Uploading Invoice to Cloudinary...");
    const uploadRes = await uploadInvoiceOnCloudinary(
      invoice.invoicePath
    );
    console.log("☁️ Upload Success:", uploadRes.secure_url);

    order.invoiceUrl = uploadRes.secure_url;
    order.invoiceStatus = "READY";
    await order.save();
    console.log("💾 Order Updated with Invoice URL");

    console.log("📧 Pushing Email Job...");
    const orderDate = (order.createdAt || order.updatedAt)
  ? new Date(order.createdAt || order.updatedAt).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  : "N/A";
console.log(orderDate);

    await addEmailJob({
      to: [user.email, addressSnapshot?.email].filter(Boolean),
      subject: `Invoice - Order ${order._id}`,
      html: invoiceEmailTemplate({
        username: user.fullname,
        orderId: order._id,
        orderDate:orderDate,
        totalAmount: order.totalPayableAmount,
      }),
      attachments: [
        {
          filename: `Invoice_${order._id}.pdf`,
          path: order.invoiceUrl,
        },
      ],
      priority: 2,
    });

    console.log("✅ Email Job Added Successfully");
    console.log("🧹 Cleaning up local invoice file...");

try {
  await fs.unlink(invoice.invoicePath);
  console.log("🗑️ Local invoice deleted:", invoice.invoicePath);
} catch (err) {
  console.warn(
    "⚠️ Failed to delete local invoice (non-blocking):",
    err.message
  );
}


    return {
      orderId: order._id.toString(),
      invoiceUrl: order.invoiceUrl,
    };
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

console.log("🧾 Invoice Worker: Listening on invoice-queue");
