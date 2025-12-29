import mongoose from "mongoose";
import { Product } from "../models/product.model.js";
import { ProductImage } from "../models/productImage.model.js";
import { ProductCoverImage } from "../models/productCoverImage.js";
import { ProductPriceAndSizeAndStock } from "../models/ProductPriceAndSizeAndStock.model.js";
import { ProductColorWiseItem } from "../models/productColorWiseItem.model.js";

const productDeletion = async (ids, session) => {
  // Step 1: Fetch product details for all given IDs
  const productDetails = await Product.aggregate([
    { $match: { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } } },
    {
      $lookup: {
        from: "productcolorwiseitems",
        localField: "_id",
        foreignField: "productId",
        as: "colors",
        pipeline: [
          {
            $lookup: {
              from: "productimages",
              localField: "_id",
              foreignField: "productColorId",
              as: "images",
              pipeline: [{ $project: { _id: 1, cloudinaryPublicId: 1 } }],
            },
          },
          {
            $lookup: {
              from: "productcoverimages",
              localField: "_id",
              foreignField: "productColorId",
              as: "coverImage",
              pipeline: [{ $project: { _id: 1, cloudinaryPublicId: 1 } }],
            },
          },
          {
            $lookup: {
              from: "productpriceandsizeandstocks",
              localField: "_id",
              foreignField: "productColorId",
              as: "sizes",
              pipeline: [{ $project: { _id: 1 } }],
            },
          },
          { $project: { _id: 1, images: 1, coverImage: 1, sizes: 1 } },
        ],
      },
    },
    { $project: { _id: 1, colors: 1 } },
  ]).session(session);

  const allImageIds = [];
  const allCoverIds = [];
  const allSizeIds = [];
  const allColorIds = [];
  const cloudinaryPublicIdsToDelete = [];

  for (const product of productDetails) {
    for (const color of product.colors) {
      allColorIds.push(color._id);

      color.images.forEach((img) => {
        allImageIds.push(img._id);
        if (img.cloudinaryPublicId) cloudinaryPublicIdsToDelete.push(img.cloudinaryPublicId);
      });

      color.coverImage.forEach((img) => {
        allCoverIds.push(img._id);
        if (img.cloudinaryPublicId) cloudinaryPublicIdsToDelete.push(img.cloudinaryPublicId);
      });

      color.sizes.forEach((s) => allSizeIds.push(s._id));
    }
  }

  // Step 2: Delete in bulk
  if (allImageIds.length) {
    await ProductImage.deleteMany({ _id: { $in: allImageIds } }).session(session);
  }
  if (allCoverIds.length) {
    await ProductCoverImage.deleteMany({ _id: { $in: allCoverIds } }).session(session);
  }
  if (allSizeIds.length) {
    await ProductPriceAndSizeAndStock.deleteMany({ _id: { $in: allSizeIds } }).session(session);
  }
  if (allColorIds.length) {
    await ProductColorWiseItem.deleteMany({ _id: { $in: allColorIds } }).session(session);
  }

  await Product.deleteMany({ _id: { $in: ids } }).session(session);

  return { cloudinaryPublicIdsToDelete };
};

export { productDeletion };
