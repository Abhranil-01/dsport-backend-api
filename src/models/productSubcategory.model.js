import mongoose ,{Schema} from "mongoose";

const productSubCategorySchema = new Schema({
    subCategoryName:{
        type: String,
        required: true,
    },
    categoryId:{
        type: Schema.Types.ObjectId,
        ref: "ProductCategory",
    }
},{timestamps: true});

export const  ProductSubCategory = mongoose.model("ProductSubCategory",productSubCategorySchema);