import mongoose, { Schema } from "mongoose";

const categoryImageSchema = new Schema(
  {
    url: {
      type: String,

    },
    cloudinaryPublicId:{
      type: String,
 
    },
    categoryId:{
      type:Schema.Types.ObjectId,
      ref:"ProductCategory",
      required:true
    }
  },
  { timestamps: true }
);


export const CategoryImage = mongoose.model("CategoryImage", categoryImageSchema);
