import mongoose, { Schema } from "mongoose";


const chargesSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deliveryCharge: {
      type: Number,
      required: true,
      default: 0,
    },
    handlingCharge: {
      type: Number,
      required: true,
      default: 0,
    },
    totalQuantity:{
        type: Number,
        required: true,
        default: 0,
    },
    tax:{
        type: Number,
        required: true,
        default: 0,
    },
    totalPrice:{
        type: Number,
        required: true,
        default: 0,
    },
    discountPrice:{
        type: Number,
        required: true,
        default: 0,
    },
    totalPayableAmount:{
        type: Number,
        required: true,
        default: 0,
    },
  },
  { timestamps: true }
);

export const Charges = mongoose.model("Charges", chargesSchema);
