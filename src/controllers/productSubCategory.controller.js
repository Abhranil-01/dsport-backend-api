import { asyncHandler } from "../utils/asyncHandler.js";
import { ProductSubCategory } from "../models/productSubcategory.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadFileOnCloudinary } from "../utils/uploadFilesOnCloudinary.js";
import { destroyCloudinaryImage } from "../utils/destroyCloudinaryImage.js";
import { ProductImage } from "../models/productImage.model.js";
import { SubCategoryImage } from "../models/subcategoryImage.js";
import { ReviewRating } from "../models/reviewRating.model.js";
import { Product } from "..//models/product.model.js";
import mongoose from "mongoose";
import { subCategoryDeletion } from "./subCategoryDelete.controller.js";
import { getIO } from "../socket.js";

const createSubCategory = asyncHandler(async (req, res) => {
  const { subCategoryName, categoryId } = req.body;
  console.log(subCategoryName, categoryId);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!subCategoryName && !categoryId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json(
          new ApiError(400, null, "Sub Category Name and Category are required")
        );
    }

    // Create category
    const newSubCategory = new ProductSubCategory({
      subCategoryName,
      categoryId,
    });
    const subCategory = await newSubCategory.save({ session });

    if (!subCategory || subCategory.length === 0) {
      await session.abortTransaction();
      session.endSession();
      throw new ApiError("Category could not be created");
    }

    let uploadedImage = null;

    // Handle file or URL-based image
    if (req.file) {
      console.log("Uploading file:", req.file.path);
      uploadedImage = await uploadFileOnCloudinary(req.file.path);
    }

    // Abort if no valid image was uploaded
    if (!uploadedImage) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json(new ApiError(400, null, "Image is required for category"));
    }

    // Save image
    const newImage = new SubCategoryImage({
      subCategoryId: subCategory._id,
      url: uploadedImage.secure_url,
      cloudinaryPublicId: uploadedImage.public_id,
    });
    await newImage.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    // AFTER session.commitTransaction()
    const io = getIO();

    io.emit("SUBCATEGORY_CREATED", {
      categoryId: categoryId.toString(),
      subCategoryId: subCategory._id.toString(),
    });

    return res
      .status(201)
      .json(new ApiResponse(201, subCategory, "Category created successfully"));
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json(new ApiResponse(500, null, error.message));
  }
});
const getSubCategories = asyncHandler(async (req, res) => {
  const { categoryId: categoryParamId } = req.params;
  const { categoryId: categoryQueryId, subCategoryName } = req.query;

  // Determine the categoryId to use
  const categoryId = categoryParamId || categoryQueryId;

  // Build dynamic match condition
  const matchCondition = {};

  if (categoryId) {
    // Make sure it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(categoryId)) {
      matchCondition.categoryId = new mongoose.Types.ObjectId(categoryId);
    } else {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid categoryId provided"));
    }
  }

  if (subCategoryName) {
    console.log(subCategoryName);

    matchCondition.subCategoryName = {
      $regex: subCategoryName,
      $options: "i", // case-insensitive
    };
  }

  // Aggregation pipeline
  const subCategories = await ProductSubCategory.aggregate([
    { $match: matchCondition },
    {
      $lookup: {
        from: "subcategoryimages",
        localField: "_id",
        foreignField: "subCategoryId",
        as: "image", // plural is better
        pipeline: [{ $project: { _id: 1, cloudinaryPublicId: 1, url: 1 } }],
      },
    },
    {
      $lookup: {
        from: "productcategories",
        localField: "categoryId",
        foreignField: "_id",
        as: "category",
        pipeline: [
          {
            $lookup: {
              from: "categoryimages",
              localField: "_id",
              foreignField: "categoryId",
              as: "categoryImage",
          
            },
          },
        
        ],
      },
    },
    {
      $unwind: { path: "$category", preserveNullAndEmptyArrays: true },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { subCategories },
        "Subcategories fetched successfully"
      )
    );
});

const updateSubCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { subCategoryName, categoryId, subCategoryImageId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid subcategory ID");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  let updatedSubCategory;
  let imageToDeleteFromCloudinary = null;

  try {
    /* ================= DELETE OLD IMAGE (DB ONLY) ================= */
    if (subCategoryImageId) {
      const imageDoc = await SubCategoryImage.findOne({
        _id: subCategoryImageId,
        subCategoryId: id,
      }).session(session);

      if (!imageDoc) {
        throw new ApiError(404, "Image not found");
      }

      imageToDeleteFromCloudinary = imageDoc.cloudinaryPublicId;

      await SubCategoryImage.deleteOne({
        _id: subCategoryImageId,
      }).session(session);
    }

    /* ================= ADD NEW IMAGE ================= */
    if (req.file) {
      const uploaded = await uploadFileOnCloudinary(req.file.path);

      if (!uploaded) {
        throw new ApiError(400, "Image upload failed");
      }

      await SubCategoryImage.create(
        [
          {
            subCategoryId: id,
            url: uploaded.secure_url,
            cloudinaryPublicId: uploaded.public_id,
          },
        ],
        { session }
      );
    }

    /* ================= ENSURE IMAGE EXISTS ================= */
    const imageExists = await SubCategoryImage.findOne({
      subCategoryId: id,
    }).session(session);

    if (!imageExists) {
      throw new ApiError(400, "At least one image is required");
    }

    /* ================= UPDATE SUBCATEGORY ================= */
    updatedSubCategory = await ProductSubCategory.findByIdAndUpdate(
      id,
      {
        ...(subCategoryName && { subCategoryName }),
        ...(categoryId && { categoryId }),
      },
      {
        new: true,
        session,
        runValidators: true,
      }
    );

    if (!updatedSubCategory) {
      throw new ApiError(404, "Subcategory not found");
    }

    await session.commitTransaction();
    session.endSession();

    /* ================= DELETE CLOUDINARY IMAGE (AFTER COMMIT) ================= */
    if (imageToDeleteFromCloudinary) {
      await destroyCloudinaryImage({
        publicId: imageToDeleteFromCloudinary,
      });
    }

    /* ================= SOCKET ================= */
    getIO().emit("SUBCATEGORY_UPDATED", {
      categoryId: updatedSubCategory.categoryId.toString(),
      subCategoryId: updatedSubCategory._id.toString(),
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        updatedSubCategory,
        "Subcategory updated successfully"
      )
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});


const getSubCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid SubCategory ID");
  }

  const subCategory = await ProductSubCategory.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(id) },
    },
    {
      $lookup: {
        from: "subcategoryimages",
        localField: "_id",
        foreignField: "subCategoryId",
        as: "image",
        pipeline: [{ $project: { _id: 1, cloudinaryPublicId: 1, url: 1 } }],
      },
    },
    {
      $lookup: {
        from: "productcategories",
        localField: "categoryId",
        foreignField: "_id",
        as: "category",
        pipeline: [
          {
            $lookup: {
              from: "categoryimages",
              localField: "_id",
              foreignField: "categoryId",
              as: "categoryImage",
              pipeline: [
                { $project: { _id: 1, cloudinaryPublicId: 1, url: 1 } },
              ],
            },
          },
          {
            $project: {
              _id: 1,
              categoryName: 1,
              categoryImage: 1,
            },
          },
        ],
      },
    },
  ]);

  if (!subCategory.length) {
    throw new ApiError(404, "Sub Category Not Found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, subCategory[0], "Subcategory fetched successfully")
    );
});

const deleteSubCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 🔥 Get categoryId BEFORE delete
    const subCategory = await ProductSubCategory.findById(id)
      .select("categoryId")
      .session(session);

    if (!subCategory) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Subcategory not found"));
    }

    const { deleteResult, cloudinaryIds } = await subCategoryDeletion(
      [id],
      session
    );

    await session.commitTransaction();
    session.endSession();

    // 🔥 Cloudinary cleanup
    for (const publicId of cloudinaryIds) {
      await destroyCloudinaryImage({ publicId });
    }

    // 🔥 SOCKET EVENT (NOW 100% SAFE)
    getIO().emit("SUBCATEGORY_DELETED", {
      categoryId: subCategory.categoryId.toString(),
      subCategoryId: id,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(200, deleteResult, "Subcategory deleted successfully")
      );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Transaction failed:", error);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
});

export {
  createSubCategory,
  getSubCategories,
  updateSubCategory,
  deleteSubCategory,
  getSubCategoryById,
};
