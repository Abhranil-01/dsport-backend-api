import { asyncHandler } from '../utils/asyncHandler.js';
import jwt from 'jsonwebtoken'
import {Admin  } from "../models/admin.model.js";
import { ApiError } from "../utils/ApiError.js";
export const verifyJWTforAdmin = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.adminAccessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) throw new ApiError(401, "Unauthorized");

  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

  const admin = await Admin.findById(decoded._id).select("-password -refreshToken");

  if (!admin) throw new ApiError(401, "Invalid token");

  req.admin = admin;
  next();
});
