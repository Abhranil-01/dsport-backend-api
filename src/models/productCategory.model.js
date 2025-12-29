import mongoose,{Schema} from 'mongoose';

const productCategorySchema = new Schema({
    categoryName:{
        type: String,
        required: true,
    },
    draft:{
        type: Boolean,
        default: false,
    },
},{timestamps: true});

export const ProductCategory = mongoose.model('ProductCategory',productCategorySchema);