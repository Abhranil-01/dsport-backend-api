import crypto from "crypto";
import fs from "fs-extra";
import path from "path";
import PDFDocument from "pdfkit";
import mongoose from "mongoose";
// your razorpay instance
import nodemailer from "nodemailer";

// Models (adjust imports if you keep models elsewhere)
import { Order } from "../models/order.model.js";
import mongooseModels from "mongoose"; // for dynamic models if needed
const Address = mongoose.model("Address");
const AddToCart = mongoose.model("AddToCart");
const ProductPriceAndSizeAndStock = mongoose.model("ProductPriceAndSizeAndStock");
const ProductColorWiseItem = mongoose.model("ProductColorWiseItem");

// --- Nodemailer transporter (ENV variables)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true", // true for 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Utility: create invoices directory if not exists
const INVOICE_DIR = path.join(process.cwd(), "invoices");
fs.ensureDirSync(INVOICE_DIR);

// Helper: generate PDF invoice (Professional layout)
async function generateInvoicePdf(order, user, address) {
  // order: order doc populated with items.productId (if not populated, fetch necessary product info)
  // user: optional user info (name, email, phone)
  // address: address doc

  const invoiceFileName = `invoice_${order._id}.pdf`;
  const invoicePath = path.join(INVOICE_DIR, invoiceFileName);

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });

      const stream = fs.createWriteStream(invoicePath);
      doc.pipe(stream);

      // Header: logo + store name
      if (process.env.STORE_LOGO_PATH && fs.existsSync(process.env.STORE_LOGO_PATH)) {
        try {
          doc.image(process.env.STORE_LOGO_PATH, 40, 40, { fit: [100, 50] });
        } catch (e) { /* ignore if image fails */ }
      }
      doc.fontSize(20).text(process.env.STORE_NAME || "Your Store", 150, 45, { align: "right" });
      doc.moveDown();

      // Invoice title / meta
      doc.fontSize(14).text(`Invoice`, { align: "left" });
      doc.fontSize(10).text(`Invoice ID: ${order._id}`, { align: "right" });
      doc.text(`Order Date: ${order.createdAt.toLocaleString()}`, { align: "right" });
      doc.text(`Payment: ${order.paymentStatus}`, { align: "right" });
      doc.moveDown();

      // Billing/Shipping address
      doc.fontSize(12).text("Billing / Shipping Address", { underline: true });
      const addrParts = [
        address.fullName || "",
        address.addressLine1 || "",
        address.addressLine2 || "",
        `${address.city || ""} ${address.state || ""} ${address.postalCode || ""}`,
        address.country || "India",
        `Phone: ${address.phone || ""}`,
      ].filter(Boolean);
      doc.fontSize(10).text(addrParts.join("\n"));
      doc.moveDown();

      // Table header
      const tableTop = doc.y + 10;
      doc.fontSize(11);
      doc.text("Item", 40, tableTop);
      doc.text("Qty", 320, tableTop, { width: 50, align: "right" });
      doc.text("Price", 380, tableTop, { width: 80, align: "right" });
      doc.text("Subtotal", 470, tableTop, { width: 80, align: "right" });
      doc.moveDown();

      // Draw a line
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();

      // Items rows
      let itemsY = doc.y + 5;
      for (const item of order.items) {
        // item.productId could be ObjectId or populated doc
        let productTitle = "";
        let thumbnailPath = null;
        if (item.productId && item.productId.title) {
          productTitle = item.productId.title;
          thumbnailPath = item.productId.thumbnailPath || item.productId.imageUrl;
        } else {
          // fetch product basic info if not populated
          const p = await ProductColorWiseItem.findById(item.productId).lean().select("title thumbnailPath imageUrl");
          productTitle = p?.title || "Product";
          thumbnailPath = p?.thumbnailPath || p?.imageUrl;
        }

        // Optionally place thumbnail (small)
        if (thumbnailPath && fs.existsSync(path.join(process.cwd(), thumbnailPath))) {
          try {
            doc.image(path.join(process.cwd(), thumbnailPath), 42, itemsY, { fit: [50, 50] });
          } catch (e) { /* ignore image error */ }
        }

        // Texts
        const titleX = thumbnailPath ? 100 : 40;
        doc.fontSize(10).text(productTitle, titleX, itemsY, { width: 220 });
        const qtyX = 320;
        doc.text(String(item.quantity), qtyX, itemsY, { width: 50, align: "right" });
        doc.text(`₹ ${item.price / item.quantity}`, 380, itemsY, { width: 80, align: "right" });
        doc.text(`₹ ${item.price}`, 470, itemsY, { width: 80, align: "right" });

        itemsY += 60;
        doc.moveTo(40, itemsY - 10).lineTo(555, itemsY - 10).stroke();
      }

      // Totals & tax (basic)
      const subtotal = order.items.reduce((s, it) => s + it.price, 0);
      const taxPercent = Number(process.env.INVOICE_TAX_PERCENT || 0); // e.g., 18 for GST
      const taxAmount = +(subtotal * (taxPercent / 100));
      const grandTotal = +(subtotal + taxAmount);

      doc.moveDown();
      doc.fontSize(11);
      const rightColX = 470;
      doc.text(`Subtotal: ₹ ${subtotal.toFixed(2)}`, rightColX, doc.y, { width: 150, align: "right" });
      doc.moveDown(0.5);
      if (taxPercent > 0) {
        doc.text(`Tax (${taxPercent}%): ₹ ${taxAmount.toFixed(2)}`, rightColX, doc.y, { width: 150, align: "right" });
        doc.moveDown(0.5);
      }
      doc.fontSize(12).text(`Total: ₹ ${grandTotal.toFixed(2)}`, rightColX, doc.y, { width: 150, align: "right" });
      doc.moveDown(1.5);

      // Footer note
      doc.fontSize(9).text(process.env.INVOICE_FOOTER_NOTE || "Thank you for shopping with us!", 40, doc.y, { align: "left" });

      doc.end();

      stream.on("finish", () => {
        resolve({ invoicePath, invoiceFileName });
      });

      stream.on("error", (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

// Main verifyPayment controller
export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Validate incoming
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json(new ApiError(400, "Missing razorpay fields"));
  }

  const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json(new ApiError(400, "Invalid signature"));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the order in DB that has this razorpay order id
    const order = await Order.findOne({ "payment.orderId": razorpay_order_id }).session(session);

    if (!order) {
      throw new ApiError(404, "Order not found for this razorpay order id");
    }

    // Update payment info
    order.payment = {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      status: "Paid",
      method: req.body.method || "Online",
    };
    order.paymentStatus = "Paid";
    order.deliveryStatus = "Processing";

    // Save order
    await order.save({ session });

    // Reduce stock was already done at order creation; if you want to re-check, do it here (omitted)

    // Generate invoice PDF and save file
    // Populate order.items.productId for product titles/thumbnail
    await order.populate({ path: "items.productId", select: "title thumbnailPath imageUrl" }).execPopulate();

    // Fetch address
    const address = await Address.findById(order.addressId).lean();

    // Optionally fetch user info (for email)
    const User = mongoose.model("User");
    const user = await User.findById(order.user).lean();

    const { invoicePath, invoiceFileName } = await generateInvoicePdf(order, user, address);

    // If you'd like to upload invoice to S3 instead of local FS:
    //  - upload invoicePath to S3 and set invoiceUrl = s3Url
    //  - remove local file if desired

    // Compose invoice public URL (if you serve '/invoices' statically)
    const invoiceBaseUrl = process.env.INVOICE_BASE_URL || process.env.APP_BASE_URL || ""; // e.g., https://cdn.yoursite.com/invoices
    const invoiceUrl = invoiceBaseUrl ? `${invoiceBaseUrl}/${invoiceFileName}` : invoicePath;

    // Save invoiceUrl to order
    order.invoiceUrl = invoiceUrl;
    await order.save({ session });

    // Clear matching items from user's cart:
    // Remove cart items whose productId and size match an ordered item for this user
    const productSizePairs = order.items.map(i => ({
      productId: i.productId._id ? i.productId._id : i.productId,
      sizeId: i.size ? i.size.toString() : null
    }));

    const productIds = productSizePairs.map(p => p.productId);
    await AddToCart.deleteMany({ user: order.user, productId: { $in: productIds } }).session(session);

    // Send invoice via email
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: `Invoice for Order ${order._id}`,
      text: `Hi ${user.name || ""},\n\nThanks for your order. Attached is the invoice for Order ${order._id}.\n\nRegards,\n${process.env.STORE_NAME || "Your Store"}`,
      attachments: [
        {
          filename: invoiceFileName,
          path: invoicePath
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json(new ApiResponse(200, { order }, "Payment verified and invoice sent"));
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    // Log error server-side for debugging
    console.error("verifyPayment error:", err);
    return res.status(500).json(new ApiError(500, err.message));
  }
});
