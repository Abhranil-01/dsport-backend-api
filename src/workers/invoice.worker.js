import "dotenv/config";
import { Worker } from "bullmq";
import { redis } from "../config/redis.js";
import connectDB from "../db/index.js";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { generateInvoicePdf } from "../services/invoice.service.js";
import { uploadInvoiceOnCloudinary } from "../utils/uploadInvoiceOnCloudinary.js";

import { invoiceEmailTemplate } from "../utils/orderEmails.js";


await connectDB();

new Worker(
  "invoice-queue",
  async (job) => {
    const { orderId, userId, addressSnapshot } = job.data;

    const order = await Order.findById(orderId);
    const user = await User.findById(userId);

    if (!order || !user) throw new Error("Invalid order or user");

    const invoice = await generateInvoicePdf(
      order,
      user,
      addressSnapshot
    );

    const uploadRes = await uploadInvoiceOnCloudinary(
      invoice.invoicePath
    );

    order.invoiceUrl = uploadRes.secure_url;
    order.invoiceStatus = "READY";
    await order.save();

    // 🔥 PUSH EMAIL JOB (NOT SEND DIRECTLY)
    await addEmailJob({
      to: [user.email, addressSnapshot?.email].filter(Boolean),
      subject: `Invoice - Order ${order._id}`,
      html: invoiceEmailTemplate({
        username: user.fullname,
        orderId: order._id,
        totalAmount: order.totalPayableAmount,
      }),
      attachments: [
        {
          filename: `Invoice_${order._id}.pdf`,
          path: invoice.invoicePath,
        },
      ],
      priority: 2,
    });

    return { invoice: "CREATED" };
  },
  {
    connection: redis,
    concurrency: 5,
  }
);
