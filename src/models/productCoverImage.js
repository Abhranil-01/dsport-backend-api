import mongoose, { Schema } from "mongoose";

const productCoverImageSchema = new Schema(
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


export const ProductCoverImage = mongoose.model("ProductCoverImage", productCoverImageSchema);
