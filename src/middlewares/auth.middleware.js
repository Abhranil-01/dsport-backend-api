import { asyncHandler } from '../utils/asyncHandler.js';
import jwt from 'jsonwebtoken'
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
export const verifyJWT= asyncHandler(async(req, res, next)=>{
 try {
       const token=req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
   
       if(!token){
           throw new Error(401,"Unauthorized request")
       }
   
       const decoded=jwt.verify(token,process.env.ACCESS_TOKEN_SECRET);
   
       const user= await User.findById(decoded?._id).select(" -refreshtoken");
   
       if(!user){
           throw new ApiError(401,"Invalid Access Token")
       }
   
       req.user=user;
       next();
 } catch (error) {
    throw new ApiError(401,"invalid access token")
}
})