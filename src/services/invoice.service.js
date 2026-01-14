/* ================= NODE CORE ================= */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ================= THIRD-PARTY ================= */
import PDFDocument from "pdfkit";
import fse from "fs-extra";
import nodemailer from "nodemailer";

/* ================= DATABASE MODELS ================= */
import { OrderItem } from "../models/orderItems.model.js";
import { Order } from "../models/order.model.js";
import { ProductColorWiseItem } from "../models/productColorWiseItem.model.js";
import { ProductPriceAndSizeAndStock } from "../models/ProductPriceAndSizeAndStock.model.js";
import {ProductCoverImage} from '../models/productCoverImage.js'
import {Product} from '../models/product.model.js'
/* ================= OPTIONAL (IF USED) ================= */
// If you log errors
// import logger from "../utils/logger.js";

// Fix __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load font file path (used when generating each PDF)
const FONT_PATH = path.join(
  __dirname,
  "..",
  "assets",
  "fonts",
  "NotoSans-Regular.ttf"
);
// Nodemailer transporter (ensure env variables are set)

// Invoice directory
// const INVOICE_DIR = "/tmp";
// fse.ensureDirSync(INVOICE_DIR);

// Generate invoice PDF (returns { invoicePath, invoiceFileName })

export const generateInvoicePdf = async (order, user, address) => {
  const formatINR = (value) =>
    Number(value ?? 0).toLocaleString("en-IN");

  /* ================= FETCH ORDER ITEMS ================= */
  const orderItems = await OrderItem.find({ orderId: order._id })
    .populate({
      path: "productColorItem",
      populate: { path: "productId" },
    })
    .populate("sizeId");

  const invoiceDir = path.join(process.cwd(), "tmp");
  await fse.ensureDir(invoiceDir);

  const invoicePath = path.join(
    invoiceDir,
    `Invoice_${order._id}.pdf`
  );

  /* ================= CREATE PDF ================= */
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const stream = fs.createWriteStream(invoicePath);
  doc.pipe(stream);
  doc.font(FONT_PATH);

  /* ================= HEADER ================= */
  doc
    .fontSize(22)
    .fillColor("#0d6efd")
    .text("Dsport", { align: "left" })
    .fontSize(10)
    .fillColor("gray")
    .text("All Sports. One Store.")
    .moveDown();

  doc
    .fontSize(12)
    .fillColor("black")
    .text(`Invoice ID: ${order._id}`, { align: "right" })
    .text(
      `Date: ${new Date(order.createdAt).toLocaleDateString()}`,
      { align: "right" }
    )
    .text(`Payment Mode: ${order.paymentMode || "N/A"}`, {
      align: "right",
    })
    .text(`Payment Status: ${order.paymentStatus || "N/A"}`, {
      align: "right",
    });

  doc.moveDown(2);

  /* ================= BILLING ================= */
  doc
    .fontSize(12)
    .fillColor("#0d6efd")
    .text("Billing & Shipping Details")
    .moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor("black")
    .text(address?.name || user?.fullname || "Customer")
    .text(address?.address || "")
    .text(
      `${address?.city || ""}, ${address?.state || ""} - ${
        address?.pincode || ""
      }`
    )
    .text(address?.country || "India")
    .text(`Phone: ${address?.phone || "N/A"}`)
    .text(`Email: ${address?.email || user?.email || "N/A"}`);

  doc.moveDown(2);

  /* ================= TABLE HEADER ================= */
  const tableTop = doc.y;
  const col = { sn: 40, name: 70, size: 330, qty: 390, price: 450 };

  doc
    .fontSize(10)
    .text("#", col.sn, tableTop)
    .text("Product", col.name, tableTop)
    .text("Size", col.size, tableTop)
    .text("Qty", col.qty, tableTop)
    .text("Price", col.price, tableTop);

  doc
    .moveTo(40, tableTop + 15)
    .lineTo(550, tableTop + 15)
    .stroke();

  /* ================= TABLE ROWS ================= */
  let position = tableTop + 25;

  orderItems.forEach((item, index) => {
    const productName =
      item?.productColorItem?.productId?.productName ||
      "Unknown Product";

    const colorName =
      item?.productColorItem?.productColorName || "";

    const productText = `${productName} ${colorName}`;

    const rowHeight =
      Math.max(
        doc.heightOfString(productText, { width: 180 }),
        16
      ) + 8;

    doc
      .fontSize(10)
      .text(index + 1, col.sn, position)
      .text(productText, col.name, position, { width: 180 })
      .text(item?.sizeId?.size || "Default", col.size, position)
      .text(String(item?.quantity ?? 0), col.qty, position)
      .text(`₹${formatINR(item?.price)}`, col.price, position);

    position += rowHeight;
  });

  doc.moveDown(3);

  /* ================= SUMMARY ================= */
  doc
    .fontSize(10)
    .text(`Subtotal: ₹${formatINR(order.totalPrice)}`, {
      align: "right",
    })
    .text(`Discount: -₹${formatINR(order.discountPrice)}`, {
      align: "right",
    })
    .text(`Tax: ₹${formatINR(order.tax)}`, { align: "right" })
    .text(
      `Delivery: ₹${formatINR(order.deliveryCharge)}`,
      { align: "right" }
    )
    .text(
      `Handling: ₹${formatINR(order.handlingCharge)}`,
      { align: "right" }
    )
    .moveDown(0.5)
    .fontSize(12)
    .text(
      `Total Payable: ₹${formatINR(
        order.totalPayableAmount
      )}`,
      { align: "right" }
    );

  /* ================= FOOTER ================= */
  doc.moveDown(3);
  doc
    .fontSize(9)
    .fillColor("gray")
    .text(
      "This is a system generated invoice. No signature required.",
      { align: "center" }
    )
    .text(
      `© ${new Date().getFullYear()} Dsport. All rights reserved.`,
      { align: "center" }
    );

  doc.end();

  await new Promise((resolve) => stream.on("finish", resolve));

  return { invoicePath };
};

