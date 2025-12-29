import mongoose, { Schema } from "mongoose";

const productColorWiseItemSchema = new Schema(
  {
    productColorName: {
      type: String,
    },
    productDescription: {
      type: String,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    color: {
      type: String,
    },
    gender: {
      type: String,
      enum: ["No", "Men", "Women", "Boys", "Girls"],
      default: "No",
    },
  },
  { timestamps: true }
);

export const ProductColorWiseItem = mongoose.model(
  "ProductColorWiseItem",
  productColorWiseItemSchema
);
