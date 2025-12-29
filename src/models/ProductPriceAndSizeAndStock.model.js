import mongoose, { Schema } from "mongoose";

const productPriceAndSizeAndStockSchema = new Schema(
  {
    defaultsize: {
      type: Boolean,
      required: true,
    },
    size: {
      type: String,
    },
    stock: {
      type: Number,
      required: true,
    },
    actualPrice: {
      type: Number,
      required: true,
    },
    offerPercentage: {
      type: Number,
    },
    offerPrice: {
      type: Number,
    },
    productColorId: {
      type: Schema.Types.ObjectId,
      ref: "ProductColorWiseItem",
    },
  },
  { timestamps: true }
);

export const ProductPriceAndSizeAndStock = mongoose.model(
  "ProductPriceAndSizeAndStock",
  productPriceAndSizeAndStockSchema
);
