import mongoose, { Schema } from "mongoose";

const subcategoryImageSchema = new Schema(
  {
    url: {
      type: String,
    },
    cloudinaryPublicId:{
      type: String
    },
    subCategoryId:{
      type:Schema.Types.ObjectId,
      ref:"ProductSubCategory"
    }
  },
  { timestamps: true }
);


export const SubCategoryImage = mongoose.model("SubCategoryImage", subcategoryImageSchema);
