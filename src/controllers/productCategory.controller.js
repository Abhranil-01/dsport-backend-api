import { asyncHandler } from "../utils/asyncHandler.js";
import { ProductCategory } from "../models/productCategory.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadFileOnCloudinary } from "../utils/uploadFilesOnCloudinary.js";
import mongoose from "mongoose";
import { destroyCloudinaryImage } from "../utils/destroyCloudinaryImage.js";
import { ProductImage } from "../models/productImage.model.js";
import { ProductSubCategory } from "../models/productSubcategory.model.js";
import { SubCategoryImage } from "../models/subcategoryImage.js";
import { ReviewRating } from "../models/reviewRating.model.js";
import { Product } from "../models/product.model.js";
import { CategoryImage } from "../models/categoryImage.model.js";
import { deleteSubCategory } from "./productSubCategory.controller.js";
import { subCategoryDeletion } from "./subCategoryDelete.controller.js";
import { getIO } from "../socket.js";

const createCategory = asyncHandler(async (req, res) => {
  const { categoryName } = req.body;
  console.log("Received:", categoryName);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const categoryExists = await ProductCategory.findOne({
      categoryName,
    }).session(session);

    if (categoryExists) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json(new ApiError(400, null, "Category already exists"));
    }

    // 1️⃣ Create category
    const category = await new ProductCategory({ categoryName }).save({
      session,
    });

    // 2️⃣ Upload image
    if (!req.file) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json(new ApiError(400, null, "Image is required for category"));
    }

    const uploadedImage = await uploadFileOnCloudinary(req.file.path);

    if (!uploadedImage) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json(new ApiError(400, null, "Image upload failed"));
    }

    // 3️⃣ Save image
    await new CategoryImage({
      categoryId: category._id,
      url: uploadedImage.secure_url,
      cloudinaryPublicId: uploadedImage.public_id,
    }).save({ session });

    // ✅ Commit DB changes
    await session.commitTransaction();
    session.endSession();

    // 🔥 Emit real-time event AFTER commit
    const io = getIO();
    io.emit("CATEGORY_CREATED", {
      categoryId: category._id,
      categoryName: category.categoryName,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, category, "Category created successfully"));
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    return res.status(500).json(new ApiResponse(500, null, error.message));
  }
});

const getCategory = asyncHandler(async (req, res) => {
  const { categoryName, draft } = req.query;

  // Construct filter condition
  const matchCondition = {};

  if (categoryName) {
    matchCondition.categoryName = { $regex: new RegExp(categoryName, "i") };
  }

  if (draft !== undefined) {
    matchCondition.draft = draft === "true"; // converts to boolean
  }

  // Get the total count based on filter
  const totalCategories = await ProductCategory.countDocuments(matchCondition);

  // Fetch all categories with images (no pagination)
  const categories = await ProductCategory.aggregate([
    {
      $match: matchCondition, // Apply filtering
    },
    {
      $lookup: {
        from: "categoryimages",
        localField: "_id",
        foreignField: "categoryId",
        as: "image",
        pipeline: [{ $project: { _id: 1, cloudinaryPublicId: 1, url: 1 } }],
      },
    },
    {
      $lookup: {
        from: "productsubcategories",
        localField: "_id",
        foreignField: "categoryId",
        as: "subcategory",
        pipeline: [
          {
            $lookup: {
              from: "subcategoryimages",
              localField: "_id",
              foreignField: "subCategoryId",
              as: "image",
              pipeline: [
                { $project: { _id: 1, cloudinaryPublicId: 1, url: 1 } },
              ],
            },
          },
        ],
      },
    },
  ]);
  console.log("Categories:", categories);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        data: categories,
        totalCategories,
      },
      "Categories fetched successfully"
    )
  );
});

const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { categoryName, categoryImageID } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid category ID");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let newUploadedImage = null;

    // 1️⃣ Upload new image FIRST
    if (req.file) {
      newUploadedImage = await uploadFileOnCloudinary(req.file.path);
      if (!newUploadedImage) {
        throw new ApiError(400, "Image upload failed");
      }
    }

    // 2️⃣ Delete old image AFTER new upload success
    if (categoryImageID && newUploadedImage) {
      const oldImage = await CategoryImage.findById(categoryImageID);
      if (oldImage) {
        await CategoryImage.deleteOne({ _id: categoryImageID }).session(
          session
        );
        await destroyCloudinaryImage({
          publicId: oldImage.cloudinaryPublicId,
        });
      }
    }

    // 3️⃣ Save new image
    if (newUploadedImage) {
      await new CategoryImage({
        categoryId: id,
        url: newUploadedImage.secure_url,
        cloudinaryPublicId: newUploadedImage.public_id,
      }).save({ session });
    }

    // 4️⃣ Update category name
    const category = await ProductCategory.findByIdAndUpdate(
      id,
      { categoryName },
      { new: true, session }
    );

    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    await session.commitTransaction();

    // 🔥 Socket emit AFTER commit
    getIO().emit("CATEGORY_UPDATED", category);

    return res
      .status(200)
      .json(new ApiResponse(200, category, "Category updated successfully"));
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await ProductCategory.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id),
      },
    },
    {
      $lookup: {
        from: "categoryimages",
        localField: "_id",
        foreignField: "categoryId",
        as: "image",
        pipeline: [{ $project: { _id: 1, cloudinaryPublicId: 1, url: 1 } }],
      },
    },
    {
      $lookup: {
        from: "productsubcategories",
        localField: "_id",
        foreignField: "category",
        as: "subcategory",
        pipeline: [
          {
            $lookup: {
              from: "subcategoryimages",
              localField: "_id",
              foreignField: "subCategoryImageId",
              as: "image",
            },
          },
        ],
      },
    },
  ]);

  if (!category) {
    throw new ApiError(404, "Sub Category Not Found");
  }

  return res
    .status(200)
    .json(new ApiResponse(201, category, "Subcategory Fetched Successfully"));
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Step 1: Fetch category with image + subcategories
    const category = await ProductCategory.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(id) },
      },
      {
        $lookup: {
          from: "categoryimages",
          localField: "_id",
          foreignField: "categoryId",
          as: "image",
          pipeline: [{ $project: { _id: 1, cloudinaryPublicId: 1 } }],
        },
      },
      {
        $lookup: {
          from: "productsubcategories",
          localField: "_id",
          foreignField: "categoryId",
          as: "subcategory",
          pipeline: [
            {
              $lookup: {
                from: "subcategoryimages",
                localField: "_id",
                foreignField: "subCategoryId",
                as: "subcategoryImage",
                pipeline: [{ $project: { _id: 1, cloudinaryPublicId: 1 } }],
              },
            },
            { $project: { _id: 1, subcategoryImage: 1 } },
          ],
        },
      },
    ]).session(session);

    if (!category || category.length === 0) {
      throw new ApiError(404, "Category not found");
    }

    const categoryData = category[0];

    // --- collect cloudinary IDs here ---
    let cloudinaryIdsToDelete = [];

    // Step 2: Delete all subcategories of this category (DB only)
    if (categoryData.subcategory.length) {
      const subCategoryIds = categoryData.subcategory.map((s) => s._id);
      const { cloudinaryIds } = await subCategoryDeletion(
        subCategoryIds,
        session
      );
      cloudinaryIdsToDelete.push(...cloudinaryIds);
    }

    // Step 3: Delete category image (DB only)
    if (categoryData.image && categoryData.image.length > 0) {
      const img = categoryData.image[0];
      await CategoryImage.deleteMany({ _id: img._id }).session(session);
      if (img.cloudinaryPublicId) {
        cloudinaryIdsToDelete.push(img.cloudinaryPublicId);
      }
    }

    // Step 4: Delete the category itself
    const categoryDelete = await ProductCategory.deleteOne({ _id: id }).session(
      session
    );
    if (!categoryDelete || categoryDelete.deletedCount === 0) {
      throw new ApiError(500, "Category not deleted");
    }

    // ✅ Commit DB changes
    await session.commitTransaction();
    session.endSession();

    // ✅ After commit: remove images from Cloudinary
    if (cloudinaryIdsToDelete.length) {
      for (const publicId of cloudinaryIdsToDelete) {
        await destroyCloudinaryImage({ publicId });
      }
    }
    const io = getIO();
    io.emit("CATEGORY_DELETED", {
      categoryId: id,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(200, { categoryData }, "Category deleted successfully")
      );
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    console.error("Category deletion failed:", error);

    return res.status(500).json(new ApiResponse(500, null, error.message));
  }
});
const deleteCategoryImage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Find the category and related data
    const categoryImage = await CategoryImage.findById(id);

    if (!categoryImage) {
      throw new ApiError(400, "Category not found");
    }

    // Delete Category Images
    await CategoryImage.deleteMany({ _id: id }).session(session);

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "CategoryImage deleted successfully"));
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new ApiError(500, "Error deleting category: " + error.message);
  }
});
export {
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
  getCategoryById,
  deleteCategoryImage,
};
