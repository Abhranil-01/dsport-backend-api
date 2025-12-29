import mongoose, { Schema } from "mongoose";

const productImageSchema = new Schema(
  {
    url: {
      type: String,
      required: true
    },
    cloudinaryPublicId:{
      type: String
    },
    productColorId: {
      type: Schema.Types.ObjectId,
      ref: "ProductColorWiseItem",
    }
  },
  { timestamps: true }
);


export const ProductImage = mongoose.model("ProductImage", productImageSchema);
