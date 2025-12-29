import mongoose, { Schema } from "mongoose";

const addToCartSchema = new Schema(
  {
    productcolorwiseitemId: {
      type: Schema.Types.ObjectId,
      ref: "ProductColorWiseItem",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Faster cart queries
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    productPriceAndSizeAndStockId: {
      type: Schema.Types.ObjectId,
      ref: "ProductPriceAndSizeAndStock",
      required: true,
    },
  },
  { timestamps: true }
);

/**
 * 🚀 Prevent duplicate items in cart
 * Each user cannot have the same product + size combo twice.
 */
addToCartSchema.index(
  { userId: 1, productcolorwiseitemId: 1, productPriceAndSizeAndStockId: 1 },
  { unique: true }
);

export const AddToCart = mongoose.model("AddToCart", addToCartSchema);
