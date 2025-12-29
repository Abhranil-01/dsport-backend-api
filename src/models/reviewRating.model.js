import mongoose,{Schema} from 'mongoose';

const reviewRatingSchema = new Schema({
    rating:{
       type:Number
    },
   review:{
    type:String
   },
   productcolorId:{
      type:Schema.Types.ObjectId,
      ref:'ProductColorWiseItem'
   },
   userId:{ 
      type:Schema.Types.ObjectId,
      ref:'User'
   },
   address:{
      type:Schema.Types.ObjectId,
      ref:"Address"
   },
   orderItemId:{
      type:Schema.Types.ObjectId,
      ref:"OrderItem"
   }

},{timestamps: true});

export const ReviewRating=mongoose.model('ReviewRating',reviewRatingSchema);