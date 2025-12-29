import mongoose from "mongoose";
import { ProductSubCategory } from "../models/productSubcategory.model.js";
import { SubCategoryImage } from "../models/subcategoryImage.js";
import { ApiError } from "../utils/ApiError.js";
import { destroyCloudinaryImage } from "../utils/destroyCloudinaryImage.js";
import { productDeletion } from "./prouductDeletion.controller.js";

const subCategoryDeletion = async (ids, session) => {
  try {
    // Step 1: Fetch subcategories with related data
    const subCategories = await ProductSubCategory.aggregate([
      {
        $match: { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } },
      },
      {
        $lookup: {
          from: "subcategoryimages",
          localField: "_id",
          foreignField: "subCategoryId",
          as: "images",
          pipeline: [{ $project: { _id: 1, cloudinaryPublicId: 1 } }],
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "productSubCategory",
          as: "products",
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      { $project: { _id: 1, images: 1, products: 1 } },
    ]).session(session);

    if (!subCategories || subCategories.length === 0) {
      return { deleteResult: null, cloudinaryIds: [] };
    }

    const allImageIds = [];
    const allCloudinaryIds = [];
    const allProductIds = [];

    // Collect related data
    for (const subCat of subCategories) {
      subCat.images.forEach((img) => {
        allImageIds.push(img._id);
        if (img.cloudinaryPublicId) allCloudinaryIds.push(img.cloudinaryPublicId);
      });

      subCat.products.forEach((p) => {
        allProductIds.push(p._id);
      });
    }

    // Step 2: Delete subcategory images (DB only)
    if (allImageIds.length) {
      await SubCategoryImage.deleteMany({ _id: { $in: allImageIds } }).session(session);
    }

    // Step 3: Cascade delete products (DB only)
    let productCloudinaryIds = [];
    if (allProductIds.length) {
      const { cloudinaryPublicIdsToDelete } = await productDeletion(allProductIds, session);
      productCloudinaryIds = cloudinaryPublicIdsToDelete || [];
    }

    // Step 4: Delete subcategories
    const deleteResult = await ProductSubCategory.deleteMany({
      _id: { $in: ids },
    }).session(session);

    if (!deleteResult || deleteResult.deletedCount === 0) {
      throw new ApiError(500, "Error deleting subcategories");
    }

    return {
      deleteResult,
      cloudinaryIds: [...allCloudinaryIds, ...productCloudinaryIds],
    };
  } catch (error) {
    throw error instanceof ApiError
      ? error
      : new ApiError(500, "Subcategory deletion error: " + error.message);
  }
};
export { subCategoryDeletion };
