import mongoose, { Schema } from "mongoose";

const orderSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /* Pricing */
    totalQuantity: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    discountPrice: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    handlingCharge: { type: Number, default: 0 },
    totalPayableAmount: { type: Number, default: 0 },

    addressId: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },

    /* Payment */
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded","Cancelled"],
      default: "Pending",
    },

    paymentMode: {
      type: String,
      enum: ["Razorpay", "COD"],
      default: "Razorpay",
    },

    /* 🧠 Order lifecycle */
    orderStatus: {
      type: String,
      enum: ["Active", "Cancelled", "Completed"],
      default: "Active",
      index: true,
    },

    /* 🚚 Delivery lifecycle */
    deliveryStatus: {
      type: String,
      enum: [
        "Pending",
        "Processing",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
      ],
      default: "Pending",
      index: true,
    },

    /* Cancellation & Refund */
    cancelledAt: Date,

    invoiceStatus: {
  type: String,
  enum: ["PENDING", "READY", "FAILED"],
  default: "PENDING",
},
    invoiceUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
