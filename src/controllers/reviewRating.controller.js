import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ReviewRating } from "../models/reviewRating.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { getIO } from "../socket.js";


const createReviewRating = asyncHandler(async (req, res) => {
  const { rating, review, productcolorId, address, orderItemId } = req.body;

  if (!rating || !productcolorId || !address || !orderItemId) {
    throw new ApiError(400, "All fields are required");
  }

  const reviewRating = await ReviewRating.create({
    rating,
    review,
    productcolorId,
    userId: req.user._id,
    address,
    orderItemId,
  });

  // 🔥 SOCKET → ADMIN ONLY (LIKE ORDERS)
  getIO().to("ADMIN").emit("REVIEW_CREATED", {
    review: reviewRating,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, reviewRating, "Review created successfully"));
});



const updateReviewRating = asyncHandler(async (req, res) => {
  const { rating, review } = req.body;

  const reviewRating = await ReviewRating.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        ...(rating !== undefined && { rating }),
        ...(review !== undefined && { review }),
      },
    },
    { new: true }
  );

  if (!reviewRating) {
    throw new ApiError(404, "Review not found");
  }

  // ✅ SOCKET → ADMIN (invalidate exact product)
  getIO().to("ADMIN").emit("REVIEW_UPDATED", {
    productcolorId: reviewRating.productcolorId,
    reviewId: reviewRating._id,
  });

  return res.status(200).json(
    new ApiResponse(200, reviewRating, "Review updated successfully")
  );
});




const getAllReviews = asyncHandler(async (req, res) => {
  const reviews = await ReviewRating.aggregate([
    // PRODUCT COLOR
    {
      $lookup: {
        from: "productcolorwiseitems",
        localField: "productcolorId",
        foreignField: "_id",
        as: "productColor",
      },
    },
    { $unwind: "$productColor" },

    // PRODUCT inside productColor
    {
      $lookup: {
        from: "products",
        localField: "productColor.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },

    // USER
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
        pipeline: [{ $project: { name: 1, email: 1 } }],
      },
    },
    { $unwind: "$user" },

    // ADDRESS
    {
      $lookup: {
        from: "addresses",
        localField: "address",
        foreignField: "_id",
        as: "address",
      },
    },
    { $unwind: "$address" },

    // ORDER ITEM
    {
      $lookup: {
        from: "orderitems",
        localField: "orderItemId",
        foreignField: "_id",
        as: "orderItem",
      },
    },  
    { $unwind: "$orderItem" },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, reviews, "All reviews fetched"));
});


const getReviewByOrderItemAndUser = asyncHandler(async (req, res) => {
  const { orderItemId } = req.body;

  const review = await ReviewRating.aggregate([
    {
      $match: {
        orderItemId: new mongoose.Types.ObjectId(orderItemId),
        userId: req.user._id,
      },
    },

    // PRODUCT COLOR
    {
      $lookup: {
        from: "productcolorwiseitems",
        localField: "productcolorId",
        foreignField: "_id",
        as: "productColor",
      },
    },
    { $unwind: "$productColor" },

    // PRODUCT
    {
      $lookup: {
        from: "products",
        localField: "productColor.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },

    // USER
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
        pipeline: [{ $project: { name: 1, email: 1 } }],
      },
    },
    { $unwind: "$user" },

    // ADDRESS
    {
      $lookup: {
        from: "addresses",
        localField: "address",
        foreignField: "_id",
        as: "address",
      },
    },
    { $unwind: "$address" },

    // ORDER ITEM
    {
      $lookup: {
        from: "orderitems",
        localField: "orderItemId",
        foreignField: "_id",
        as: "orderItem",
      },
    },
    { $unwind: "$orderItem" },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, review[0] || null, "Review fetched"));
});


export {
  createReviewRating,
  updateReviewRating,
  getAllReviews,
  getReviewByOrderItemAndUser,
};
