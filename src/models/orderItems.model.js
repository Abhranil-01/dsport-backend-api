import mongoose, { Schema } from "mongoose";

const orderItemsSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    productColorItem: {
      type: Schema.Types.ObjectId,
      ref: "ProductColorWiseItem",
      required: true,
    },

    sizeId: {
      type: Schema.Types.ObjectId,
      ref: "ProductPriceAndSizeAndStock",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
    },

    price: {
      type: Number,
      required: true, // offerPrice × quantity
    },


  },
  { timestamps: true }
);

export const OrderItem = mongoose.model("OrderItem", orderItemsSchema);
