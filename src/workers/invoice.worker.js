import "dotenv/config";
import { Worker } from "bullmq";
import { redis } from "../config/redis.js";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { ProductColorWiseItem } from "../models/productColorWiseItem.model.js";
import { Product } from "../models/product.model.js";
import { ProductPriceAndSizeAndStock } from "../models/ProductPriceAndSizeAndStock.model.js";
import { ProductCoverImage } from "./../models/productCoverImage.js";
import { ReviewRating } from "./../models/reviewRating.model.js";
import {
  generateInvoicePdf,
  sendInvoiceEmail,
} from "../services/invoice.service.js";
import { uploadInvoiceOnCloudinary } from "../utils/uploadInvoiceOnCloudinary.js";
import fs from "fs";
import { invoiceEmailTemplate } from "../utils/orderEmails.js";
import connectDB from "./../db/index.js";

await connectDB();

new Worker(
  "invoice-queue",
  async (job) => {
    const { orderId, userId, addressSnapshot } = job.data;

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    try {
      const user = await User.findById(userId);

      const invoice = await generateInvoicePdf(order, user, addressSnapshot);

      const uploadRes = await uploadInvoiceOnCloudinary(invoice.invoicePath);

      if (!uploadRes?.secure_url) {
        throw new Error("Cloudinary upload failed");
      }

      order.invoiceUrl = uploadRes.secure_url;
      order.invoiceStatus = "READY";
      await order.save();


      const emails = [user.email, addressSnapshot.email].filter(Boolean);
      if (!user?.email && !addressSnapshot?.email) {
        throw new Error("No email found for invoice");
      }

      await sendInvoiceEmail(
        emails,
        `Invoice - Order ${order._id}`,
        null,
        invoice.invoicePath,
        `Invoice_${order._id}.pdf`,
        invoiceEmailTemplate({
          username: user.fullname,
          orderId: order._id,
          orderDate: new Date(order.createdAt).toLocaleDateString(),
          totalAmount: order.totalPayableAmount.toLocaleString("en-IN"),
        })
      );

      fs.unlink(invoice.invoicePath, () => {});

      return {
        orderId: order._id.toString(),
      };
    } catch (err) {
      order.invoiceStatus = "FAILED";
      await order.save();

      throw err;
    }
  },
  {
    connection: redis,
    concurrency: 5,
  }
);
