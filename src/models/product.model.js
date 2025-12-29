import mongoose, { Schema } from "mongoose";

const productSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    productSubCategory: {
      type: Schema.Types.ObjectId,
      ref: "ProductSubCategory",
    },
  
  },
  { timestamps: true }
);

export const Product = mongoose.model("Product", productSchema);
