import mongoose, { Schema } from "mongoose";

const addressSchema = new Schema(
  {
    addressName:{ type: String },
    name:{ type: String },
    phone:{ type: String },
    altPhone:{ type: String },
    email:{ type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: Number },
    country: { type: String },
    user:{
      type:Schema.Types.ObjectId,
      ref:"User"
    },
  },
  { timestamps: true }
);

export const Address = mongoose.model("Address", addressSchema);
