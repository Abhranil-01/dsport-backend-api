import crypto from "crypto";
import fs from "fs";
import fse from "fs-extra";
import path from "path";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { razorpay } from "../config/razorpay.js";
import nodemailer from "nodemailer";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { AddToCart } from "../models/addToCart.model.js";
import { Order } from "../models/order.model.js";
import { Address } from "../models/address.model.js";
import { ProductColorWiseItem } from "../models/productColorWiseItem.model.js";
import { User } from "../models/user.model.js";
import { ProductPriceAndSizeAndStock } from "./../models/ProductPriceAndSizeAndStock.model.js";
import { OrderItem } from "../models/orderItems.model.js";
import { uploadFileOnCloudinary } from "../utils/uploadFilesOnCloudinary.js";
import { Charges } from "./../models/charges.model.js";
import { uploadInvoiceOnCloudinary } from "../utils/uploadInvoiceOnCloudinary.js";
import { sendEmail } from "../utils/sendEmail.js";
import { getIO } from "../socket.js";
// import crypto from 'crypto'
import {
  paymentStatusEmail,
  deliveryStatusEmail,
  orderCancelledEmail,
} from "../utils/orderEmails.js";

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
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Helper: wait for file write completion
function waitForFileComplete(filePath) {
  return new Promise((resolve) => {
    let prevSize = -1;
    const interval = setInterval(() => {
      if (!fs.existsSync(filePath)) return;
      const { size } = fs.statSync(filePath);
      if (size === prevSize && size > 0) {
        clearInterval(interval);
        resolve();
      }
      prevSize = size;
    }, 50);
  });
}

// Invoice directory
const INVOICE_DIR = "/tmp/invoices";
fse.ensureDirSync(INVOICE_DIR);

// Generate invoice PDF (returns { invoicePath, invoiceFileName })
async function generateInvoicePdf(
  orderDoc,
  userDoc,
  addressDoc,
  invoiceVersion = 1
) {
  const invoiceNumber = `INV-${orderDoc._id}-V${invoiceVersion}`;
  const invoiceFileName = `${invoiceNumber}.pdf`;
  const invoicePath = path.join(INVOICE_DIR, invoiceFileName);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 25 });
      const stream = fs.createWriteStream(invoicePath);

      if (fs.existsSync(FONT_PATH)) {
        doc.registerFont("Noto", FONT_PATH);
        doc.font("Noto");
      }

      doc.pipe(stream);

      doc.fontSize(16).text("TAX INVOICE");
      doc.moveDown();

      doc.fontSize(10).text(`Invoice No: ${invoiceNumber}`);
      doc.text(`Order ID: ${orderDoc._id}`);
      doc.text(`Date: ${new Date().toLocaleDateString()}`);
      doc.moveDown();

      doc.text(`Customer: ${addressDoc?.name}`);
      doc.text(`Email: ${userDoc?.email}`);
      doc.text(`Address: ${addressDoc?.address}`);
      doc.moveDown();

      doc.text("Items:");
      doc.moveDown(0.5);

      orderDoc.items.forEach((item, idx) => {
        doc.text(`${idx + 1}. Qty ${item.quantity}  ₹${item.price.toFixed(2)}`);
      });

      doc.moveDown();
      doc.text(`Total Payable: ₹${orderDoc.totalPayableAmount}`);

      doc.end();

      stream.on("finish", () =>
        resolve({
          invoicePath,
          invoiceFileName,
          invoiceNumber,
        })
      );
    } catch (err) {
      reject(err);
    }
  });
}

// Helper to send invoice email
async function sendInvoiceEmail(
  toEmail,
  subject,
  text,
  attachmentPath,
  attachmentName
) {
  const emailList = Array.isArray(toEmail) ? toEmail : [toEmail];
  const uniqueEmails = [...new Set(emailList)];

  for (const email of uniqueEmails) {
    const mailOptions = {
      from: process.env.SMTP_MAIL,
      to: email,
      subject:
        subject || "Invoice from " + (process.env.STORE_NAME || "Your Store"),
      text: text || "Please find your invoice.",
      html: `
        <p>Thank you for shopping with us!</p>
        ${
          attachmentPath?.startsWith("http")
            ? `<p><a href="${attachmentPath}" target="_blank">Download Invoice</a></p>`
            : `<p>Your invoice PDF is attached.</p>`
        }
      `,
      attachments:
        attachmentPath && !attachmentPath.startsWith("http")
          ? [{ filename: attachmentName, path: attachmentPath }]
          : [],
    };

    // keep sendMail awaited so caller can catch errors if they want
    await transporter.sendMail(mailOptions);
  }

  return { sentTo: uniqueEmails };
}


export const createOrderCOD = asyncHandler(async (req, res) => {
  const { cartItemIds, addressId, chargesId } = req.body;

  if (!cartItemIds || !cartItemIds.length) {
    throw new ApiError(400, "Cart items are required");
  }

  const session = await mongoose.startSession();

  let createdOrder;
  let address;
  let charges;

  try {
    /* ================= TRANSACTION ================= */
    await session.withTransaction(async () => {
      /* 1️⃣ Validate Address */
      address = await Address.findOne({
        _id: addressId,
        user: req.user._id,
      }).session(session);

      if (!address) {
        throw new ApiError(404, "Address not found");
      }

      /* 2️⃣ Fetch Cart Items */
      const cartItems = await AddToCart.find({
        _id: { $in: cartItemIds },
        userId: req.user._id,
      }).session(session);

      if (cartItems.length !== cartItemIds.length) {
        throw new ApiError(400, "Some cart items not found");
      }

      /* 3️⃣ Validate Stock */
      for (const item of cartItems) {
        const stockDoc = await ProductPriceAndSizeAndStock.findById(
          item.productPriceAndSizeAndStockId
        ).session(session);

        if (!stockDoc || stockDoc.stock < item.quantity) {
          throw new ApiError(400, "Insufficient stock");
        }
      }

      /* 4️⃣ Deduct Stock */
      for (const item of cartItems) {
        const updated = await ProductPriceAndSizeAndStock.updateOne(
          {
            _id: item.productPriceAndSizeAndStockId,
            stock: { $gte: item.quantity },
          },
          { $inc: { stock: -item.quantity } },
          { session }
        );

        if (updated.modifiedCount === 0) {
          throw new ApiError(400, "Stock update failed");
        }
      }

      /* 5️⃣ Fetch Charges */
      charges = await Charges.findOne({
        _id: chargesId,
        userId: req.user._id,
      }).session(session);

      if (!charges) {
        throw new ApiError(400, "Invalid charges data");
      }

      /* 6️⃣ Create Order */
      const [order] = await Order.create(
        [
          {
            user: req.user._id,
            addressId,

            totalQuantity: charges.totalQuantity,
            totalPrice: charges.totalPrice,
            discountPrice: charges.discountPrice,
            tax: charges.tax,
            deliveryCharge: charges.deliveryCharge,
            handlingCharge: charges.handlingCharge,
            totalPayableAmount: charges.totalPayableAmount,

            paymentMode: "COD",
            paymentStatus: "Pending",

            orderStatus: "Active",
            deliveryStatus: "Pending",
            refundStatus: "None",
          },
        ],
        { session }
      );

      createdOrder = order;

      /* 7️⃣ Order Items */
      const orderItemsData = cartItems.map((item) => ({
        orderId: createdOrder._id,
        productColorItem: item.productcolorwiseitemId,
        sizeId: item.productPriceAndSizeAndStockId,
        quantity: item.quantity,
        price: item.totalPrice,
      }));

      await OrderItem.insertMany(orderItemsData, { session });

      /* 8️⃣ Clear Cart */
      await AddToCart.deleteMany(
        { _id: { $in: cartItemIds }, userId: req.user._id },
        { session }
      );

      /* 9️⃣ Remove Charges */
      await Charges.deleteOne(
        { _id: charges._id, userId: req.user._id },
        { session }
      );
    });

    session.endSession();

    /* ================= SOCKET (IMMEDIATE & SAFE) ================= */
    const io = getIO();

    const payload = {
      orderId: createdOrder._id.toString(),
      orderStatus: createdOrder.orderStatus,
      deliveryStatus: createdOrder.deliveryStatus,
      paymentStatus: createdOrder.paymentStatus,
    };

    // ADMIN
    io.to("ADMIN").emit("ORDER_CREATED", payload);

    // USER
    io.to(`USER_${req.user._id.toString()}`).emit("ORDER_CREATED", payload);

    /* ================= RESPONSE ================= */
    res
      .status(201)
      .json(new ApiResponse(201, createdOrder, "COD order placed successfully"));

    /* ================= HEAVY ASYNC JOBS ================= */
    process.nextTick(async () => {
      try {
        const orderItems = await OrderItem.find({
          orderId: createdOrder._id,
        });

        const invoiceResult = await generateInvoicePdf(
          { ...createdOrder.toObject(), items: orderItems },
          req.user,
          address,
          1
        );

        const emails = [req.user.email, address.email].filter(Boolean);

        await sendInvoiceEmail(
          emails,
          `Your Invoice - Order ${createdOrder._id}`,
          null,
          invoiceResult.invoicePath,
          `Invoice_${createdOrder._id}.pdf`
        );

        uploadInvoiceOnCloudinary(invoiceResult.invoicePath)
          .then((res) => {
            if (res?.secure_url) {
              createdOrder.invoiceUrl = res.secure_url;
              createdOrder.save();
            }
          })
          .catch(() => {});
      } catch (err) {
        console.error("Post-order async failed:", err.message);
      }
    });
  } catch (err) {
    session.endSession();
    throw err instanceof ApiError ? err : new ApiError(500, err.message);
  }
});




export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { totalAmount } = req.body;

  console.log("TOTAL:", totalAmount);

  if (!totalAmount || totalAmount <= 0)
    throw new ApiError(400, "Invalid amount");

  const options = {
    amount: Math.round(totalAmount * 100), // convert to paise
    currency: "INR",
    receipt: "order_rcpt_" + Date.now(),
  };

  const order = await razorpay.orders.create(options);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        order,
      },
      "Razorpay order created successfully"
    )
  );
});


export const verifyPaymentAndCreateOrder = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    cartItemIds,
    addressId,
    chargesId,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, "Missing Razorpay fields");
  }

  /* 1️⃣ Verify Razorpay Signature */
  const secret =
    process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET;

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(400, "Payment verification failed");
  }

  const session = await mongoose.startSession();

  let createdOrder;
  let shippingAddress;
  let charges;

  try {
    await session.withTransaction(async () => {
      /* 2️⃣ Address */
      shippingAddress = await Address.findOne({
        _id: addressId,
        user: req.user._id,
      }).session(session);

      if (!shippingAddress) {
        throw new ApiError(404, "Address not found");
      }

      /* 3️⃣ Cart Items */
      const cartItems = await AddToCart.find({
        _id: { $in: cartItemIds },
        userId: req.user._id,
      }).session(session);

      if (cartItems.length !== cartItemIds.length) {
        throw new ApiError(400, "Some cart items not found");
      }

      /* 4️⃣ Validate Stock */
      for (const item of cartItems) {
        const stockDoc = await ProductPriceAndSizeAndStock.findById(
          item.productPriceAndSizeAndStockId
        ).session(session);

        if (!stockDoc || stockDoc.stock < item.quantity) {
          throw new ApiError(400, "Insufficient stock");
        }
      }

      /* 5️⃣ Deduct Stock */
      for (const item of cartItems) {
        const updated = await ProductPriceAndSizeAndStock.updateOne(
          {
            _id: item.productPriceAndSizeAndStockId,
            stock: { $gte: item.quantity },
          },
          { $inc: { stock: -item.quantity } },
          { session }
        );

        if (updated.modifiedCount === 0) {
          throw new ApiError(400, "Product went out of stock");
        }
      }

      /* 6️⃣ Charges */
      charges = await Charges.findOne({
        _id: chargesId,
        userId: req.user._id,
      }).session(session);

      if (!charges) {
        throw new ApiError(400, "Invalid charges data");
      }

      /* 7️⃣ Create Order */
      const [order] = await Order.create(
        [
          {
            user: req.user._id,
            addressId,

            totalQuantity: charges.totalQuantity,
            totalPrice: charges.totalPrice,
            discountPrice: charges.discountPrice,
            tax: charges.tax,
            deliveryCharge: charges.deliveryCharge,
            handlingCharge: charges.handlingCharge,
            totalPayableAmount: charges.totalPayableAmount,

            paymentMode: "Razorpay",
            paymentStatus: "Paid",

            orderStatus: "Active",
            deliveryStatus: "Pending",
            refundStatus: "None",
          },
        ],
        { session }
      );

      createdOrder = order;

      /* 8️⃣ Order Items */
      const orderItemsData = cartItems.map((item) => ({
        orderId: createdOrder._id,
        productColorItem: item.productcolorwiseitemId,
        sizeId: item.productPriceAndSizeAndStockId,
        quantity: item.quantity,
        price: item.totalPrice,
      }));

      await OrderItem.insertMany(orderItemsData, { session });

      /* 9️⃣ Clear Cart */
      await AddToCart.deleteMany(
        { _id: { $in: cartItemIds }, userId: req.user._id },
        { session }
      );

      /* 🔟 Remove Charges */
      await Charges.deleteOne(
        { _id: charges._id, userId: req.user._id },
        { session }
      );
    });

    session.endSession();

    /* 🔔 SOCKET + INVOICE (NON-BLOCKING) */
    process.nextTick(async () => {
      try {
        const io = getIO();

        const payload = {
          orderId: createdOrder._id.toString(),
          orderStatus: createdOrder.orderStatus,
          deliveryStatus: createdOrder.deliveryStatus,
          paymentStatus: createdOrder.paymentStatus,
        };

        /* ADMIN */
        io.to("ADMIN").emit("ORDER_CREATED", payload);

        /* USER (matches frontend hook) */
        io
          .to(`USER_${req.user._id}`)
          .emit("ORDER_UPDATED", payload);

        /* INVOICE */
        const orderItems = await OrderItem.find({
          orderId: createdOrder._id,
        });

        const invoiceResult = await generateInvoicePdf(
          { ...createdOrder.toObject(), items: orderItems },
          req.user,
          shippingAddress,
          1
        );

        const emails = [req.user.email, shippingAddress.email].filter(Boolean);

        await sendInvoiceEmail(
          emails,
          `Your Invoice - Order ${createdOrder._id}`,
          null,
          invoiceResult.invoicePath,
          `Invoice_${createdOrder._id}.pdf`
        );

        uploadInvoiceOnCloudinary(invoiceResult.invoicePath)
          .then((res) => {
            if (res?.secure_url) {
              createdOrder.invoiceUrl = res.secure_url;
              createdOrder.save();
            }
          })
          .catch(() => {});
      } catch (err) {
        console.error("Post-order process failed:", err.message);
      }
    });

    return res
      .status(200)
      .json(
        new ApiResponse(200, createdOrder, "Payment verified & order placed")
      );
  } catch (err) {
    session.endSession();
    throw err instanceof ApiError ? err : new ApiError(500, err.message);
  }
});



export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json(new ApiError(400, "Missing razorpay fields"));
  }

  const RAZORPAY_SECRET =
    process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET;
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json(new ApiError(400, "Invalid signature"));
  }

  return res.status(200).json(new ApiResponse(200, null, "Signature valid"));
});



export const updateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deliveryStatus, paymentStatus } = req.body;

  const session = await mongoose.startSession();
  let emailJobs = [];
  let order;

  try {
    session.startTransaction();

    order = await Order.findById(id)
      .populate("user", "email")
      .session(session);

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    // 🔒 FINAL LOCK
    if (
      order.deliveryStatus === "Delivered" ||
      order.deliveryStatus === "Cancelled"
    ) {
      throw new ApiError(400, "Order is completed and cannot be updated");
    }

    /* ================= PAYMENT STATUS ================= */
    if (paymentStatus && paymentStatus !== order.paymentStatus) {
      if (["Paid", "Refunded"].includes(order.paymentStatus)) {
        throw new ApiError(400, "Payment status is locked");
      }

      order.paymentStatus = paymentStatus;
      emailJobs.push({ type: "payment" });
    }

    /* ================= DELIVERY STATUS ================= */
    if (deliveryStatus && deliveryStatus !== order.deliveryStatus) {
      order.deliveryStatus = deliveryStatus;

      if (deliveryStatus === "Delivered") {
        order.deliveredAt = new Date();
        order.orderStatus = "Completed";
      }

      if (deliveryStatus === "Cancelled") {
        order.orderStatus = "Cancelled";
        order.cancelledAt = new Date();
      }

      emailJobs.push({ type: "delivery" });
    }

    await order.save({ session });
    await session.commitTransaction();
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    session.endSession();
  }

  /* ================= RESPONSE ================= */
  res
    .status(200)
    .json(new ApiResponse(200, order, "Order updated successfully"));

  /* ================= SOCKET + EMAIL (NON-BLOCKING) ================= */
  process.nextTick(async () => {
    try {
      const io = getIO();

      // 🚨 Hard guard (no silent socket failure)
      if (!order.user?._id) {
        throw new Error("Order user missing for socket emit");
      }

      const userId = order.user._id.toString();

      const payload = {
        orderId: order._id.toString(),
        orderStatus: order.orderStatus,
        deliveryStatus: order.deliveryStatus,
        paymentStatus: order.paymentStatus,
      };

      /* 🔔 SOCKET EMITS */
      io.to("ADMIN").emit("ORDER_UPDATED", payload);
      io.to(`USER_${userId}`).emit("ORDER_UPDATED", payload);

      /* 📧 EMAIL JOBS */
      for (const job of emailJobs) {
        if (job.type === "payment") {
          await sendEmail({
            to: order.user.email,
            subject: "Payment Status Updated",
            html: paymentStatusEmail(order),
          });
        }

        if (job.type === "delivery") {
          await sendEmail({
            to: order.user.email,
            subject: "Delivery Status Updated",
            html: deliveryStatusEmail(order),
          });
        }
      }
    } catch (err) {
      console.error("Post-update process failed:", err.message);
    }
  });
});


export const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(req.user._id),
      },
    },

    {
      $lookup: {
        from: "orderitems",
        localField: "_id",
        foreignField: "orderId",
        as: "orderItems",
      },
    },

    {
      $lookup: {
        from: "addresses",
        localField: "addressId",
        foreignField: "_id",
        as: "address",
      },
    },
    { $unwind: { path: "$address", preserveNullAndEmptyArrays: true } },

    {
      $unwind: {
        path: "$orderItems",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $lookup: {
        from: "productpriceandsizeandstocks",
        localField: "orderItems.sizeId",
        foreignField: "_id",
        as: "size",
      },
    },
    { $unwind: { path: "$size", preserveNullAndEmptyArrays: true } },

    // =========================
    // PRODUCT COLOR ITEM
    // =========================
    {
      $lookup: {
        from: "productcolorwiseitems",
        localField: "orderItems.productColorItem",
        foreignField: "_id",
        as: "productColorItem",
      },
    },
    {
      $unwind: {
        path: "$productColorItem",
        preserveNullAndEmptyArrays: true,
      },
    },

    // =========================
    // PRODUCT
    // =========================
    {
      $lookup: {
        from: "products",
        localField: "productColorItem.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },

    // =========================
    // COVER IMAGES
    // =========================
    {
      $lookup: {
        from: "productcoverimages",
        localField: "productColorItem._id",
        foreignField: "productColorId",
        as: "coverImages",
      },
    },

    // =========================
    // REVIEWS
    // =========================
    {
      $lookup: {
        from: "reviewratings",
        localField: "orderItems._id",
        foreignField: "orderItemId",
        as: "reviews",
      },
    },

    // =========================
    // GROUP BACK TO ORDER
    // =========================
    {
      $group: {
        _id: "$_id",
        user: { $first: "$user" },
        address: { $first: "$address" },
        paymentStatus: { $first: "$paymentStatus" },
        orderStatus: { $first: "$orderStatus" },
        deliveryStatus: { $first: "$deliveryStatus" },
        paymentMode: { $first: "$paymentMode" },
        deliveryCharge: { $first: "$deliveryCharge" },
        handlingCharge: { $first: "$handlingCharge" },
        tax: { $first: "$tax" },
        totalQuantity: { $first: "$totalQuantity" },
        discountPrice: { $first: "$discountPrice" },
        totalPrice: { $first: "$totalPrice" },
        totalPayableAmount: { $first: "$totalPayableAmount" },
        invoiceUrl: { $first: "$invoiceUrl" },
        createdAt: { $first: "$createdAt" },

        orderItems: {
          $push: {
            _id: "$orderItems._id",
            quantity: "$orderItems.quantity",
            price: "$orderItems.price",
            size: "$size",
            product: "$product",
            productColorItem: "$productColorItem",
            coverImages: "$coverImages",
            reviews: "$reviews",
          },
        },
      },
    },

    // =========================
    // SORT LATEST FIRST
    // =========================
    { $sort: { createdAt: -1 } },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, orders, "Orders fetched successfully"));
});

export const getAllOrdersForAdmin = asyncHandler(async (req, res) => {
  const { search, paymentStatus, deliveryStatus, paymentMode, orderStatus } =
    req.query;
  const pipeline = [];

  // 🔹 Join User (for email search)
  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: {
        path: "$user",
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  // 🔍 Dynamic Filters
  const matchStage = {};

  if (search) {
    const searchConditions = [];

    // ✅ Search by orderId string field (if exists)
    searchConditions.push({
      orderId: { $regex: search, $options: "i" },
    });

    // ✅ Search by user email
    searchConditions.push({
      "user.email": { $regex: search, $options: "i" },
    });

    // ✅ Search by Mongo ObjectId (IMPORTANT)
    if (mongoose.Types.ObjectId.isValid(search)) {
      searchConditions.push({
        _id: new mongoose.Types.ObjectId(search),
      });
    }

    matchStage.$or = searchConditions;
  }

  if (orderStatus) {
    matchStage.orderStatus = orderStatus; // ✅ NEW
  }

  if (paymentStatus) {
    matchStage.paymentStatus = paymentStatus;
  }

  if (deliveryStatus) {
    matchStage.deliveryStatus = deliveryStatus;
  }

  if (paymentMode) {
    matchStage.paymentMode = paymentMode;
  }

  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }

  // 📦 Order Items
  pipeline.push({
    $lookup: {
      from: "orderitems",
      localField: "_id",
      foreignField: "orderId",
      as: "orderItems",
      pipeline: [
        {
          $lookup: {
            from: "productpriceandsizeandstocks",
            localField: "sizeId",
            foreignField: "_id",
            as: "sizeandprice",
          },
        },
        {
          $lookup: {
            from: "reviewratings",
            localField: "_id",
            foreignField: "orderItemId",
            as: "reviews",
          },
        },
        {
          $lookup: {
            from: "productcolorwiseitems",
            localField: "productColorItem",
            foreignField: "_id",
            as: "productColorItem",
            pipeline: [
              {
                $lookup: {
                  from: "products",
                  localField: "productId",
                  foreignField: "_id",
                  as: "product",
                },
              },
              {
                $lookup: {
                  from: "productcoverimages",
                  localField: "_id",
                  foreignField: "productColorId",
                  as: "coverImages",
                },
              },
            ],
          },
        },
      ],
    },
  });

  // 📍 Address
  pipeline.push({
    $lookup: {
      from: "addresses",
      localField: "addressId",
      foreignField: "_id",
      as: "address",
    },
  });

  // 📅 Latest first
  pipeline.push({ $sort: { createdAt: -1 } });

  const orders = await Order.aggregate(pipeline);

  return res
    .status(200)
    .json(new ApiResponse(200, orders, "Admin orders fetched"));
});

export const getOrderByIdForAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid order id");
  }

  const pipeline = [];

  // 🎯 Match order by ID
  pipeline.push({
    $match: {
      _id: new mongoose.Types.ObjectId(id),
    },
  });

  // 👤 User
  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: {
        path: "$user",
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  // 📦 Order Items
  pipeline.push({
    $lookup: {
      from: "orderitems",
      localField: "_id",
      foreignField: "orderId",
      as: "orderItems",
      pipeline: [
        {
          $lookup: {
            from: "productpriceandsizeandstocks",
            localField: "sizeId",
            foreignField: "_id",
            as: "sizeandprice",
          },
        },
        {
          $lookup: {
            from: "reviewratings",
            localField: "_id",
            foreignField: "orderItemId",
            as: "reviews",
          },
        },
        {
          $lookup: {
            from: "productcolorwiseitems",
            localField: "productColorItem",
            foreignField: "_id",
            as: "productColorItem",
            pipeline: [
              {
                $lookup: {
                  from: "products",
                  localField: "productId",
                  foreignField: "_id",
                  as: "product",
                },
              },
              {
                $lookup: {
                  from: "productcoverimages",
                  localField: "_id",
                  foreignField: "productColorId",
                  as: "coverImages",
                },
              },
            ],
          },
        },
      ],
    },
  });

  // 📍 Address
  pipeline.push({
    $lookup: {
      from: "addresses",
      localField: "addressId",
      foreignField: "_id",
      as: "address",
    },
  });

  const orders = await Order.aggregate(pipeline);

  if (!orders.length) {
    throw new ApiError(404, "Order not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, orders[0], "Admin order fetched successfully"));
});


export const getOrderById = asyncHandler(async (req, res) => {
  const orders = await Order.aggregate([
    { $match: { user: req.user._id } },
    { $match: { _id: mongoose.Types.ObjectId(req.params.id) } },
    {
      $lookup: {
        from: "addresses",
        localField: "addressId",
        foreignField: "_id",
        as: "address",
      },
    },
  ]);

  return res.status(200).json(new ApiResponse(200, orders, "Orders fetched"));
});

// export const razorpayWebhook = asyncHandler(async (req, res) => {
//   const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

//   const signature = req.headers["x-razorpay-signature"];
//   const body = req.body; // BUFFER (raw)

//   const expectedSignature = crypto
//     .createHmac("sha256", secret)
//     .update(body)
//     .digest("hex");

//   if (expectedSignature !== signature) {
//     return res.status(400).json({ message: "Invalid signature" });
//   }

//   const event = JSON.parse(body.toString());

//   /* ================= REFUND PROCESSED ================= */
//   if (event.event === "refund.processed") {
//     const refund = event.payload.refund.entity;
//     const orderId = refund.notes?.orderId;

//     if (!orderId) return res.json({ status: "ignored" });

//     const order = await Order.findById(orderId);
//     if (!order) return res.json({ status: "order not found" });

//     // ✅ Idempotency
//     if (order.processedRefundIds?.includes(refund.id)) {
//       return res.json({ status: "already processed" });
//     }

//     order.processedRefundIds.push(refund.id);

//     order.refundStatus = "PARTIAL_REFUND";
//     order.paymentStatus = "PARTIALLY_REFUNDED";

//     await order.save();

//     getIO().to("ADMIN").emit("REFUND_SUCCESS", {
//       orderId: order._id.toString(),
//       refundId: refund.id,
//     });
//   }

//   /* ================= REFUND FAILED ================= */
//   if (event.event === "refund.failed") {
//     const refund = event.payload.refund.entity;
//     const orderId = refund.notes?.orderId;

//     if (!orderId) return res.json({ status: "ignored" });

//     const order = await Order.findById(orderId);
//     if (!order) return res.json({ status: "order not found" });

//     order.refundStatus = "FAILED";
//     await order.save();
//   }

//   return res.json({ status: "ok" });
// });

export const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const session = await mongoose.startSession();

  let order;

  try {
    session.startTransaction();

    order = await Order.findOne({
      _id: new mongoose.Types.ObjectId(orderId),
      user: req.user._id,
      orderStatus: "Active",
    }).session(session);

    if (!order) {
      throw new ApiError(404, "Order not found or already cancelled");
    }

    if (
      ["Shipped", "Out for Delivery", "Delivered"].includes(
        order.deliveryStatus
      )
    ) {
      throw new ApiError(400, "Order cannot be cancelled now");
    }

    /* 🔁 Restore stock */
    const orderItems = await OrderItem.find({ orderId }).session(session);

    for (const item of orderItems) {
      await ProductPriceAndSizeAndStock.updateOne(
        { _id: item.sizeId },
        { $inc: { stock: item.quantity } },
        { session }
      );
    }

    /* ❌ Cancel order */
    order.orderStatus = "Cancelled";
    order.deliveryStatus = "Cancelled";
    order.cancelledAt = new Date();

    if (order.paymentMode === "COD") {
      order.paymentStatus = "Cancelled";
    } else if (
      order.paymentMode === "Razorpay" &&
      order.paymentStatus === "Paid"
    ) {
      order.paymentStatus = "Refunded";
    }

    await order.save({ session });
    await session.commitTransaction();
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  // ✅ RESPOND FIRST
  res
    .status(200)
    .json(new ApiResponse(200, null, "Order cancelled successfully"));

  // 🔔 SOCKET + EMAIL (NON-BLOCKING)
  process.nextTick(async () => {
    try {
      const io = getIO();

      const payload = {
        orderId: order._id.toString(),
        orderStatus: order.orderStatus,
        deliveryStatus: order.deliveryStatus,
        paymentStatus: order.paymentStatus,
      };

      // ADMIN
      io.to("ADMIN").emit("ORDER_UPDATED", payload);

      // USER (FIXED ROOM)
      io.to(`USER_${req.user._id.toString()}`).emit("ORDER_UPDATED", payload);

      // EMAIL
      await sendEmail({
        to: req.user.email,
        subject: "Your order has been cancelled",
        html: orderCancelledEmail(order),
      });
    } catch (err) {
      console.error("Post-cancel process failed:", err.message);
    }
  });
});
