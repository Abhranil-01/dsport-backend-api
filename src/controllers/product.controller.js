import { asyncHandler } from "../utils/asyncHandler.js";
import { Product } from "../models/product.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadFileOnCloudinary } from "../utils/uploadFilesOnCloudinary.js";
import { uploadURLOnCloudinary } from "../utils/uploadURLOnCloudinary.js";
import { ProductImage } from "../models/productImage.model.js";
import { ProductPriceAndSizeAndStock } from "../models/ProductPriceAndSizeAndStock.model.js";

import { destroyCloudinaryImage } from "../utils/destroyCloudinaryImage.js";
import mongoose from "mongoose";
import { ProductColorWiseItem } from "../models/productColorWiseItem.model.js";
import qs from "qs";
import { ProductCoverImage } from "../models/productCoverImage.js";
import { productDeletion } from "./prouductDeletion.controller.js";
import { getIO } from "../socket.js";
const createProduct = asyncHandler(async (req, res) => {
  const parsedBody = qs.parse(req.body);
  const { productName, productSubCategory } = parsedBody;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const product = new Product({ productName, productSubCategory });
    await product.save({ session });

    const coverImagesByColorIndex = {};
    const productImagesByColorIndex = {};

    req.files.forEach((file) => {
      const coverMatch = file.fieldname.match(/^colors\[(\d+)]\[coverImage]$/);
      const productMatch = file.fieldname.match(
        /^colors\[(\d+)]\[productImages]$/
      );

      if (coverMatch) coverImagesByColorIndex[coverMatch[1]] = file;

      if (productMatch) {
        const index = productMatch[1];
        productImagesByColorIndex[index] ||= [];
        productImagesByColorIndex[index].push(file);
      }
    });

    for (let i = 0; i < parsedBody.colors.length; i++) {
      const colorData = parsedBody.colors[i];
      const colorIndex = String(i);

      if (!colorData.color) {
        throw new ApiError(400, null, "Color name is required");
      }

      const productColor = await new ProductColorWiseItem({
        productColorName: colorData.productColorName,
        productDescription: colorData.productDescription,
        productId: product._id,
        color: colorData.color,
        gender: colorData.gender,
        // ✅ manual color text
      }).save({ session });

      const coverFile = coverImagesByColorIndex[colorIndex];
      if (!coverFile) {
        throw new ApiError(400, null, "Cover image is required");
      }

      const coverUpload = await uploadFileOnCloudinary(coverFile.path);
      await new ProductCoverImage({
        url: coverUpload.secure_url,
        cloudinaryPublicId: coverUpload.public_id,
        productColorId: productColor._id,
      }).save({ session });

      for (const file of productImagesByColorIndex[colorIndex] || []) {
        const result = await uploadFileOnCloudinary(file.path);
        await new ProductImage({
          url: result.secure_url,
          cloudinaryPublicId: result.public_id,
          productColorId: productColor._id,
        }).save({ session });
      }

      for (const sizeData of colorData.sizes) {
        const actualPrice = Number(sizeData.actualPrice) || 0;
        const offerPercentage = Number(sizeData.offerPercentage) || 0;

        const discountedPrice =
          actualPrice - (actualPrice * offerPercentage) / 100;

        await new ProductPriceAndSizeAndStock({
          defaultsize: sizeData.defaultsize,
          size: sizeData.size,
          stock: sizeData.stock,
          actualPrice,
          offerPercentage,
          offerPrice: Math.floor(discountedPrice), // ✅ FINAL rounded price
          productColorId: productColor._id,
        }).save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    const io = getIO();
    io.emit("PRODUCT_CREATED", {
      productId: product._id.toString(),
      subcategoryId: product.productSubCategory.toString(),
    });

    return res
      .status(201)
      .json(new ApiResponse(201, product, "Product created successfully"));
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json(new ApiResponse(500, null, error.message));
  }
});

const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log(id);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  const product = await Product.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(id) },
    },
    {
      $lookup: {
        from: "productsubcategories",
        localField: "productSubCategory",
        foreignField: "_id",
        as: "subcategory",
        pipeline: [
          {
            $lookup: {
              from: "productcategories",
              localField: "categoryId",
              foreignField: "_id",
              as: "category",
              pipeline: [{ $project: { _id: 1, categoryName: 1 } }],
            },
          },
          {
            $project: { _id: 1, subCategoryName: 1, category: 1 },
          },
        ],
      },
    },
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
            },
          },
          {
            $lookup: {
              from: "productcoverimages",
              localField: "_id",
              foreignField: "productColorId",
              as: "coverImage",
            },
          },
          {
            $lookup: {
              from: "productpriceandsizeandstocks",
              localField: "_id",
              foreignField: "productColorId",
              as: "sizes",
            },
          },
          {
            $project: {
              productColorName: 1,
              productDescription: 1,
              color: 1,
              coverImage: 1,
              images: 1,
              sizes: 1,
              gender: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        _id: 1,
        productName: 1,
        productSubCategory: 1,
        subcategory: 1,
        colors: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  if (!product || product.length === 0) {
    return res.status(404).json(new ApiError(404, "Product not found"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, product[0], "Product fetched successfully"));
});

const getAllProducts = asyncHandler(async (req, res) => {
  try {
    const {
      search = "",
      categoryId,
      subcategoryId,
      minPrice,
      maxPrice,
      color,
      size,
    } = req.query;

    // -------------------------------
    // BASE MATCH (Product level)
    // -------------------------------
    const matchStage = {};

    // Subcategory filter
    if (subcategoryId && mongoose.Types.ObjectId.isValid(subcategoryId)) {
      matchStage.productSubCategory = new mongoose.Types.ObjectId(
        subcategoryId
      );
    }

    // Search by product name
    if (search) {
      matchStage.productName = { $regex: search, $options: "i" };
    }

    // -------------------------------
    // AGGREGATION PIPELINE
    // -------------------------------
    const aggregationPipeline = [
      { $match: matchStage },

      // --------------------------------
      // SubCategory + Category lookup
      // --------------------------------
      {
        $lookup: {
          from: "productsubcategories",
          localField: "productSubCategory",
          foreignField: "_id",
          as: "subcategory",
          pipeline: [
            {
              $lookup: {
                from: "productcategories",
                localField: "categoryId",
                foreignField: "_id",
                as: "category",
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      categoryName: 1,
                    },
                  },
                ],
              },
            },
            {
              $project: {
                _id: 1,
                subCategoryName: 1,
                category: 1,
              },
            },
          ],
        },
      },

      // --------------------------------
      // Filter by Category (after lookup)
      // --------------------------------
      ...(categoryId && mongoose.Types.ObjectId.isValid(categoryId)
        ? [
            {
              $match: {
                "subcategory.category._id": new mongoose.Types.ObjectId(
                  categoryId
                ),
              },
            },
          ]
        : []),

      // --------------------------------
      // Color-wise Items Lookup
      // --------------------------------
      {
        $lookup: {
          from: "productcolorwiseitems",
          localField: "_id",
          foreignField: "productId",
          as: "colors",
          pipeline: [
            // Sizes
            {
              $lookup: {
                from: "productpriceandsizeandstocks",
                localField: "_id",
                foreignField: "productColorId",
                as: "sizes",
              },
            },

            // Images
            {
              $lookup: {
                from: "productimages",
                localField: "_id",
                foreignField: "productColorId",
                as: "images",
              },
            },

            // --------------------------------
            // Color / Size / Price filters
            // --------------------------------
            {
              $match: {
                ...(color
                  ? { choseColor: { $regex: color, $options: "i" } }
                  : {}),

                ...(size
                  ? { "sizes.size": { $regex: size, $options: "i" } }
                  : {}),

                ...(minPrice || maxPrice
                  ? {
                      "sizes.offerPrice": {
                        ...(minPrice ? { $gte: parseFloat(minPrice) } : {}),
                        ...(maxPrice ? { $lte: parseFloat(maxPrice) } : {}),
                      },
                    }
                  : {}),
              },
            },

            {
              $project: {
                choseColor: 1,
                coverImage: 1,
                images: 1,
                sizes: 1,
              },
            },
          ],
        },
      },

      // --------------------------------
      // Remove products with no variants
      // --------------------------------
      {
        $match: {
          "colors.0": { $exists: true },
        },
      },
    ];

    // -------------------------------
    // EXECUTE QUERY
    // -------------------------------
    const products = await Product.aggregate(aggregationPipeline);

    res.status(200).json({
      success: true,
      totalProducts: products.length,
      products,
    });
  } catch (error) {
    console.error("❌ Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});


const getcolorWiseItems = asyncHandler(async (req, res) => {
  try {
    /* ================= PARAMS ================= */

    const { subcategoryId: subParamId } = req.params;

    const {
      page = 1,
      limit = 100,
      search = "",
      subcategoryId: subQueryId,
      minPrice,
      maxPrice,
      color,
      size,
      gender,
      rating,
      noRating,
      sortBy,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const subcategoryId = subParamId || subQueryId;

    /* ================= PARSE FILTERS ================= */

    const colors = color ? color.split(",") : [];
    const sizes = size ? size.split(",") : [];
    const genders = gender ? gender.split(",") : [];

    const ratingValues = rating
      ? rating
          .split(",")
          .map(Number)
          .filter((r) => !isNaN(r) && r > 0)
      : [];

    const includeNoRating = noRating === "true";
    const minSelectedRating =
      ratingValues.length > 0 ? Math.min(...ratingValues) : null;

    const hasPriceFilter = minPrice !== undefined || maxPrice !== undefined;

    /* ================= SORT ================= */

    let sortStage = { _id: -1 };

    if (sortBy === "rating_desc") sortStage = { averageRating: -1 };
    if (sortBy === "rating_asc") sortStage = { averageRating: 1 };
    if (sortBy === "reviews_desc") sortStage = { totalReviews: -1 };
    if (sortBy === "reviews_asc") sortStage = { totalReviews: 1 };
    if (sortBy === "price_asc") sortStage = { "defaultSize.offerPrice": 1 };
    if (sortBy === "price_desc") sortStage = { "defaultSize.offerPrice": -1 };

    /* =========================================================
       COLOR ITEM PIPELINE (ALL SIZES KEPT)
    ========================================================= */

  const colorItemPipeline = [
  /* ---------- ALL SIZES ---------- */
  {
    $lookup: {
      from: "productpriceandsizeandstocks",
      localField: "_id",
      foreignField: "productColorId",
      as: "sizes",
    },
  },

  /* ---------- DEFAULT SIZE (SAFE) ---------- */
  {
    $addFields: {
      defaultSize: {
        $let: {
          vars: {
            defaultArr: {
              $filter: {
                input: "$sizes",
                as: "s",
                cond: { $eq: ["$$s.defaultsize", true] },
              },
            },
          },
          in: {
            $cond: [
              { $gt: [{ $size: "$$defaultArr" }, 0] },
              { $arrayElemAt: ["$$defaultArr", 0] }, // ✅ real default
              { $arrayElemAt: ["$sizes", 0] },       // ✅ fallback
            ],
          },
        },
      },
    },
  },

  /* ---------- IMAGES ---------- */
  {
    $lookup: {
      from: "productcoverimages",
      localField: "_id",
      foreignField: "productColorId",
      as: "coverImage",
    },
  },
  {
    $lookup: {
      from: "productimages",
      localField: "_id",
      foreignField: "productColorId",
      as: "images",
    },
  },

  /* ---------- REVIEWS ---------- */
  {
    $lookup: {
      from: "reviewratings",
      localField: "_id",
      foreignField: "productcolorId",
      as: "reviews",
    },
  },

  /* ---------- RATING CALC ---------- */
  {
    $addFields: {
      totalReviews: { $size: "$reviews" },
      averageRating: {
        $cond: [
          { $gt: [{ $size: "$reviews" }, 0] },
          { $avg: "$reviews.rating" },
          0,
        ],
      },
    },
  },

  /* ---------- RATING FILTER ---------- */
  ...(minSelectedRating !== null || includeNoRating
    ? [
        {
          $match: {
            $or: [
              ...(minSelectedRating !== null
                ? [
                    {
                      $and: [
                        { totalReviews: { $gt: 0 } },
                        { averageRating: { $gte: minSelectedRating } },
                      ],
                    },
                  ]
                : []),
              ...(includeNoRating ? [{ totalReviews: { $eq: 0 } }] : []),
            ],
          },
        },
      ]
    : []),

  /* ---------- PRICE FILTER (NOW WORKS) ---------- */
...(hasPriceFilter
  ? [
      {
        $match: {
          "defaultSize.offerPrice": {
            ...(minPrice !== undefined
              ? { $gte: Number(minPrice) }
              : {}),
            ...(maxPrice !== undefined
              ? { $lte: Number(maxPrice) }
              : {}),
          },
        },
      },
    ]
  : []),


  /* ---------- SIZE FILTER (ANY SIZE) ---------- */
  ...(sizes.length ? [{ $match: { "sizes.size": { $in: sizes } } }] : []),

  /* ---------- COLOR FILTER ---------- */
  ...(colors.length ? [{ $match: { color: { $in: colors } } }] : []),

  /* ---------- GENDER FILTER ---------- */
  ...(genders.length ? [{ $match: { gender: { $in: genders } } }] : []),

  { $sort: sortStage },

  /* ---------- FINAL SHAPE ---------- */
  {
    $project: {
      _id: 1,
      productId: 1,
      productColorName: 1,
      productName: 1,
      productSubCategory: 1,
      categoryId: 1,
      color: 1,
      gender: 1,
      coverImage: 1,
      images: 1,
      sizes: 1,        // ✅ ALL SIZES
      defaultSize: 1,  // ✅ SAFE DEFAULT
      averageRating: 1,
      totalReviews: 1,
    },
  },
];


    /* =========================================================
       MAIN PRODUCT PIPELINE
    ========================================================= */

    const pipeline = [
      {
        $match: {
          ...(subcategoryId
            ? {
                productSubCategory: new mongoose.Types.ObjectId(subcategoryId),
              }
            : {}),
        },
      },

      {
        $lookup: {
          from: "productsubcategories",
          localField: "productSubCategory",
          foreignField: "_id",
          as: "subCategory",
        },
      },
      { $unwind: "$subCategory" },

      {
        $lookup: {
          from: "productcolorwiseitems",
          localField: "_id",
          foreignField: "productId",
          as: "colorItems",
          pipeline: colorItemPipeline,
        },
      },

      { $unwind: "$colorItems" },

      {
        $addFields: {
          "colorItems.productName": "$productName",
          "colorItems.subCategoryId": "$productSubCategory",
          "colorItems.categoryId": "$subCategory.categoryId",
        },
      },

      { $replaceRoot: { newRoot: "$colorItems" } },

      { $skip: skip },
      { $limit: Number(limit) },
    ];

    const colorItems = await Product.aggregate(pipeline);

    /* ================= COUNT ================= */

    const countPipeline = [...pipeline.slice(0, -2), { $count: "total" }];
    const countResult = await Product.aggregate(countPipeline);

    /* ================= RESPONSE ================= */

    res.status(200).json({
      colorItems,
      totalColorItems: countResult[0]?.total || 0,
      totalPages: Math.ceil((countResult[0]?.total || 0) / Number(limit)),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error("ColorWise Filter Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


const getSingleProductColorWise = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params; // productColorId

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid colorId" });
    }

    const pipeline = [
      {
        $match: { _id: new mongoose.Types.ObjectId(id) }, // your productColor ID
      },
      // PRODUCT DETAILS
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $lookup: {
          from: "productcoverimages",
          localField: "_id",
          foreignField: "productColorId",
          as: "coverImage",
        },
      },
      {
        $lookup: {
          from: "productimages",
          localField: "_id",
          foreignField: "productColorId",
          as: "images",
        },
      },
      {
        $lookup: {
          from: "productpriceandsizeandstocks",
          localField: "_id",
          foreignField: "productColorId",
          as: "sizes",
        },
      },

      // REVIEWS
      {
        $lookup: {
          from: "reviewratings",
          localField: "_id",
          foreignField: "productcolorId",
          as: "reviews",
        },
      },

      // LOOKUP ADDRESS DETAILS FOR REVIEWS
      {
        $lookup: {
          from: "addresses",
          localField: "reviews.address",
          foreignField: "_id",
          as: "addresses",
        },
      },

      // MERGE ADDRESS INTO REVIEWS & KEEP ONLY NEEDED FIELDS
      {
        $addFields: {
          reviews: {
            $map: {
              input: "$reviews",
              as: "r",
              in: {
                rating: "$$r.rating",
                review: "$$r.review",
                addressName: {
                  $let: {
                    vars: {
                      addr: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$addresses",
                              as: "a",
                              cond: { $eq: ["$$a._id", "$$r.address"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: "$$addr.name",
                  },
                },
                city: {
                  $let: {
                    vars: {
                      addr: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$addresses",
                              as: "a",
                              cond: { $eq: ["$$a._id", "$$r.address"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: "$$addr.city",
                  },
                },
              },
            },
          },
        },
      },

      // PICK DEFAULT SIZE
      {
        $addFields: {
          defaultSizeObj: {
            $first: {
              $filter: {
                input: "$sizes",
                as: "s",
                cond: { $eq: ["$$s.defaultsize", true] },
              },
            },
          },
        },
      },

      // IF NO DEFAULT SIZE → PICK FIRST
      {
        $addFields: {
          selectedSize: {
            $ifNull: ["$defaultSizeObj", { $arrayElemAt: ["$sizes", 0] }],
          },
        },
      },

      // PICK SINGLE COVER IMAGE
      {
        $addFields: {
          coverImage: { $arrayElemAt: ["$coverImage", 0] },
        },
      },

      // FLATTEN PRODUCT DETAILS
      {
        $addFields: {
          product: { $arrayElemAt: ["$product", 0] },
        },
      },

      // PROJECT FINAL FIELDS
      {
        $project: {
          productColorName: 1,
          productDescription: 1,
          color: 1,
          productId: "$product._id",
          productName: "$product.productName",
          coverImage: 1,
          images: 1,
          sizes: 1,
          selectedSize: 1,
          reviews: 1, // only rating, review, addressName & city
        },
      },
    ];

    const result = await ProductColorWiseItem.aggregate(pipeline);

    if (!result.length) {
      return res.status(404).json({ message: "Color item not found" });
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

const updateProduct = asyncHandler(async (req, res) => {
  let session;
  const cloudinaryPublicIdsToDelete = [];

  try {
    const parsedBody = req.body;
    const { productName, productSubCategory } = parsedBody;
    const { id } = req.params;

    session = await mongoose.startSession();
    session.startTransaction();

    const product = await Product.findById(id).session(session);
    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json(new ApiError(404, null, "Product not found"));
    }

    /* ---------------- PRODUCT UPDATE ---------------- */
    if (productName) product.productName = productName;
    if (productSubCategory) product.productSubCategory = productSubCategory;

    await product.save({ session, validateBeforeSave: false });

    /* ---------------- FILE GROUPING ---------------- */
    const coverImagesByColorIndex = {};
    const productImagesByColorIndex = {};

    (req.files || []).forEach((file) => {
      const coverMatch = file.fieldname.match(/^colors\[(\d+)]\[coverImage]$/);
      const productMatch = file.fieldname.match(
        /^colors\[(\d+)]\[productImages]$/
      );

      if (coverMatch) coverImagesByColorIndex[coverMatch[1]] = file;
      if (productMatch) {
        productImagesByColorIndex[productMatch[1]] ||= [];
        productImagesByColorIndex[productMatch[1]].push(file);
      }
    });

    /* ---------------- NORMALIZE COLORS ---------------- */
    const colorsRaw = parsedBody.colors;
    const colors = Array.isArray(colorsRaw)
      ? colorsRaw
      : colorsRaw
        ? [colorsRaw]
        : [];

    /* ---------------- DELETE COLOR VARIANTS ---------------- */
    const deletedColorIdsRaw = parsedBody.deletecolorwiseitem;
    const deletedColorIds = Array.isArray(deletedColorIdsRaw)
      ? deletedColorIdsRaw
      : deletedColorIdsRaw
        ? [deletedColorIdsRaw]
        : [];

    for (const delId of deletedColorIds) {
      const covers = await ProductCoverImage.find({
        productColorId: delId,
      }).session(session);

      covers.forEach((img) => {
        if (img.cloudinaryPublicId)
          cloudinaryPublicIdsToDelete.push(img.cloudinaryPublicId);
      });

      await ProductCoverImage.deleteMany({ productColorId: delId }).session(
        session
      );

      const images = await ProductImage.find({
        productColorId: delId,
      }).session(session);

      images.forEach((img) => {
        if (img.cloudinaryPublicId)
          cloudinaryPublicIdsToDelete.push(img.cloudinaryPublicId);
      });

      await ProductImage.deleteMany({ productColorId: delId }).session(session);

      await ProductPriceAndSizeAndStock.deleteMany({
        productColorId: delId,
      }).session(session);

      await ProductColorWiseItem.deleteOne({ _id: delId }).session(session);
    }

    /* ---------------- CREATE / UPDATE COLORS ---------------- */
    for (let i = 0; i < colors.length; i++) {
      const colorData = colors[i];
      const colorIndex = String(i);

      if (!colorData.color || !colorData.color.trim()) {
        throw new ApiError(400, null, "Color name is required");
      }

      const normalizedColor = colorData.color.trim(); // ✅ MANUAL TEXT

      let productColor;

      if (colorData.id) {
        productColor = await ProductColorWiseItem.findByIdAndUpdate(
          colorData.id,
          {
            productColorName: colorData.productColorName,
            productDescription: colorData.productDescription,
            color: normalizedColor, // ✅ TEXT
            gender: colorData.gender,
          },
          { new: true, session, validateBeforeSave: false }
        );
      } else {
        productColor = new ProductColorWiseItem({
          productColorName: colorData.productColorName,
          productDescription: colorData.productDescription,
          color: normalizedColor, // ✅ TEXT COLOR
          gender: colorData.gender,
          productId: product._id,
        });
        await productColor.save({ session });
      }

      /* -------- COVER IMAGE DELETE -------- */
      if (colorData.coverImageIdToDelete) {
        const cover = await ProductCoverImage.findById(
          colorData.coverImageIdToDelete
        ).session(session);

        if (cover?.cloudinaryPublicId) {
          cloudinaryPublicIdsToDelete.push(cover.cloudinaryPublicId);
        }

        await ProductCoverImage.deleteOne({
          _id: colorData.coverImageIdToDelete,
        }).session(session);
      }

      /* -------- COVER IMAGE UPLOAD -------- */
      if (coverImagesByColorIndex[colorIndex]) {
        const result = await uploadFileOnCloudinary(
          coverImagesByColorIndex[colorIndex].path
        );

        await ProductCoverImage.create(
          [
            {
              url: result.secure_url,
              cloudinaryPublicId: result.public_id,
              productColorId: productColor._id,
            },
          ],
          { session }
        );
      }

      /* -------- PRODUCT IMAGES DELETE -------- */
      if (Array.isArray(colorData.deleteProductImageIds)) {
        for (const imgId of colorData.deleteProductImageIds) {
          const img = await ProductImage.findById(imgId).session(session);
          if (img?.cloudinaryPublicId)
            cloudinaryPublicIdsToDelete.push(img.cloudinaryPublicId);

          await ProductImage.deleteOne({ _id: imgId }).session(session);
        }
      }

      /* -------- PRODUCT IMAGES UPLOAD -------- */
      if (productImagesByColorIndex[colorIndex]) {
        for (const file of productImagesByColorIndex[colorIndex]) {
          const result = await uploadFileOnCloudinary(file.path);
          await ProductImage.create(
            [
              {
                url: result.secure_url,
                cloudinaryPublicId: result.public_id,
                productColorId: productColor._id,
              },
            ],
            { session }
          );
        }
      }

      /* ---------------- SIZES ---------------- */
      const sizesRaw = colorData.sizes;
      const sizes = Array.isArray(sizesRaw)
        ? sizesRaw
        : sizesRaw
          ? [sizesRaw]
          : [];

      for (const sizeData of sizes) {
        const actualPrice = Number(sizeData.actualPrice) || 0;
        const offerPercentage =
          Number(sizeData.offerPercent ?? sizeData.offerPercentage) || 0;

        const discounted = actualPrice - (actualPrice * offerPercentage) / 100;

        const offerPrice =
          actualPrice && offerPercentage
            ? Math.floor(discounted) // ✅ rounded here
            : actualPrice;

        const defaultsize =
          sizeData.defaultsize === true || sizeData.defaultsize === "true";

        if (defaultsize === true) {
          await ProductPriceAndSizeAndStock.updateMany(
            { productColorId: productColor._id },
            { defaultsize: false },
            { session }
          );
        }

        if (sizeData.id) {
          await ProductPriceAndSizeAndStock.findByIdAndUpdate(
            sizeData.id,
            {
              defaultsize,
              size: sizeData.size,
              stock: Number(sizeData.stock) || 0,
              actualPrice,
              offerPercentage,
              offerPrice, // ✅ integer stored
            },
            { session, validateBeforeSave: false }
          );
        } else {
          await ProductPriceAndSizeAndStock.create(
            [
              {
                defaultsize,
                size: sizeData.size,
                stock: Number(sizeData.stock) || 0,
                actualPrice,
                offerPercentage,
                offerPrice, // ✅ integer stored
                productColorId: productColor._id,
              },
            ],
            { session }
          );
        }
      }

      if (Array.isArray(colorData.deleteProductSizeIds)) {
        await ProductPriceAndSizeAndStock.deleteMany({
          _id: { $in: colorData.deleteProductSizeIds },
        }).session(session);
      }
    }

    /* ---------------- COMMIT ---------------- */
    await session.commitTransaction();
    session.endSession();

    for (const publicId of cloudinaryPublicIdsToDelete) {
      try {
        await destroyCloudinaryImage({ publicId });
      } catch (err) {
        console.warn("Cloudinary delete failed:", err.message);
      }
    }

    getIO().emit("PRODUCT_UPDATED", {
      productId: id,
      subcategoryId: product.productSubCategory.toString(),
    });

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Product updated successfully"));
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    session?.endSession();

    return res.status(500).json(new ApiError(500, null, error.message));
  }
});

const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { cloudinaryPublicIdsToDelete } = await productDeletion(
      [id],
      session
    );

    await session.commitTransaction();
    session.endSession();

    for (const publicId of cloudinaryPublicIdsToDelete) {
      try {
        await destroyCloudinaryImage({ publicId });
      } catch (err) {
        console.warn("Cloudinary delete failed:", err.message);
      }
    }

    // 🔥 SOCKET EMIT
    const io = getIO();
    io.emit("PRODUCT_DELETED", {
      productId: id,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          null,
          "Product and all associated data deleted successfully"
        )
      );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, "Failed to delete product: " + error.message)
      );
  }
});

export {
  createProduct,
  getProductById,
  getAllProducts,
  updateProduct,
  deleteProduct,
  getcolorWiseItems,
  getSingleProductColorWise,
};
