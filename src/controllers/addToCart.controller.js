import { asyncHandler } from "../utils/asyncHandler.js";
import { AddToCart } from "../models/addToCart.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { ProductPriceAndSizeAndStock } from "../models/ProductPriceAndSizeAndStock.model.js";

import mongoose from "mongoose";
import { Charges } from "../models/charges.model.js";

async function recalculateCharges(userId, session) {
  const allCartItems = await AddToCart.find({ userId })
    .populate("productPriceAndSizeAndStockId")
    .session(session);

  if (allCartItems.length === 0) {
    await Charges.deleteOne({ userId }).session(session);
    return null;
  }

  let totalQuantity = 0;
  let totalPrice = 0;
  let totalDiscountPrice = 0;

  for (const item of allCartItems) {
    const sizeStock = item.productPriceAndSizeAndStockId;
    const quantity = item.quantity;

    const actualPrice = sizeStock.actualPrice;
    const offerPrice = sizeStock.offerPrice;

    const itemTotalPrice = offerPrice * quantity; // final user-paying price
    const itemDiscount = (actualPrice - offerPrice) * quantity; // discount per quantity

    totalQuantity += quantity;
    totalPrice += itemTotalPrice;
    totalDiscountPrice += itemDiscount;
  }

  const tax = 18;
  const handlingCharge = 0;
  const deliveryCharge = totalPrice > 500 ? 0 : 50;

  const totalPayableAmount =
    totalPrice + tax + handlingCharge + deliveryCharge;

  let charges = await Charges.findOne({ userId }).session(session);

  if (!charges) {
    charges = await Charges.create(
      [
        {
          userId,
          totalQuantity,
          totalPrice,
          tax,
          handlingCharge,
          deliveryCharge,
          discountPrice: totalDiscountPrice,
          totalPayableAmount,
        },
      ],
      { session }
    );
    return charges[0];
  }

  charges.totalQuantity = totalQuantity;
  charges.totalPrice = totalPrice;
  charges.tax = tax;
  charges.handlingCharge = handlingCharge;
  charges.deliveryCharge = deliveryCharge;
  charges.discountPrice = totalDiscountPrice; // 🔥 Updated
  charges.totalPayableAmount = totalPayableAmount;

  await charges.save({ session });
  return charges;
}



const addToCart = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productcolorwiseitemId, quantity, productPriceAndSizeAndStockId } =
      req.body;
    console.log(
      productcolorwiseitemId,
      quantity,
      productPriceAndSizeAndStockId
    );

    if (
      !productcolorwiseitemId ||
      !quantity ||
      !productPriceAndSizeAndStockId
    ) {
      await session.abortTransaction();
      return res
        .status(400)
        .json(new ApiError(400, null, "All fields are required"));
    }

    // Get stock info within transaction
    const sizeAndStock = await ProductPriceAndSizeAndStock.findById(
      new mongoose.Types.ObjectId(productPriceAndSizeAndStockId)
    ).session(session);
    console.log(sizeAndStock);

    if (!sizeAndStock) {
      await session.abortTransaction();
      return res
        .status(404)
        .json(new ApiError(404, null, "Product size and stock not found"));
    }

    // Read cart item inside transaction
    let cartItem = await AddToCart.findOne({
      userId: req.user._id,
      productcolorwiseitemId: new mongoose.Types.ObjectId(
        productcolorwiseitemId
      ),
      productPriceAndSizeAndStockId: new mongoose.Types.ObjectId(
        productPriceAndSizeAndStockId
      ),
    }).session(session);

    // Calculate total requested
    let totalRequested = cartItem ? cartItem.quantity + quantity : quantity;

    // Check stock again inside transaction (prevents race condition)
    if (totalRequested > sizeAndStock.stock) {
      await session.abortTransaction();
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            null,
            `Only ${sizeAndStock.stock} items available in stock`
          )
        );
    }

    // Calculate price
    const updatedTotalPrice = sizeAndStock.offerPrice * totalRequested;

    // Update or Insert
    if (cartItem) {
      cartItem.quantity = totalRequested;
      cartItem.totalPrice = updatedTotalPrice;
      await cartItem.save({ session });
    } else {
      cartItem = await AddToCart.create(
        [
          {
            userId: req.user._id,
            productcolorwiseitemId: new mongoose.Types.ObjectId(
              productcolorwiseitemId
            ),
            productPriceAndSizeAndStockId: new mongoose.Types.ObjectId(
              productPriceAndSizeAndStockId
            ),
            quantity: totalRequested,
            totalPrice: updatedTotalPrice,
          },
        ],
        { session }
      );
      cartItem = cartItem[0];
    }
    // Recalculate charges
    await recalculateCharges(req.user._id, session);
    await session.commitTransaction();
    session.endSession();

    return res
      .status(201)
      .json(new ApiResponse(201, cartItem, "Product added to cart"));
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

const updateCart = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantity, productPriceAndSizeAndStockId } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ---------------------------------------------
    // 1) Fetch target cart
    // ---------------------------------------------
    let cart = await AddToCart.findById(id).session(session);
    if (!cart) {
      await session.abortTransaction();
      return res
        .status(404)
        .json(new ApiError(404, null, "Cart item not found"));
    }

    // ---------------------------------------------
    // 2) Final values (fallback to existing)
    // ---------------------------------------------
    const finalSizeId =
      productPriceAndSizeAndStockId ?? cart.productPriceAndSizeAndStockId;

    const finalQuantity = quantity ?? cart.quantity;

    if (typeof finalQuantity !== "number" || isNaN(finalQuantity)) {
      await session.abortTransaction();
      return res
        .status(400)
        .json(new ApiError(400, null, "Invalid quantity value"));
    }

    // ---------------------------------------------
    // 3) Fetch price & stock
    // ---------------------------------------------
    const sizeAndStock =
      await ProductPriceAndSizeAndStock.findById(finalSizeId).session(session);

    if (!sizeAndStock) {
      await session.abortTransaction();
      return res
        .status(404)
        .json(new ApiError(404, null, "Product stock not found"));
    }

    // ---------------------------------------------
    // 4) Stock validation
    // ---------------------------------------------
    if (finalQuantity > sizeAndStock.stock) {
      await session.abortTransaction();
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            null,
            `Only ${sizeAndStock.stock} items available in stock`
          )
        );
    }

    // ---------------------------------------------
    // 5) Price validation
    // ---------------------------------------------
    const productPrice = sizeAndStock.offerPrice;

    if (typeof productPrice !== "number" || isNaN(productPrice)) {
      await session.abortTransaction();
      return res
        .status(500)
        .json(new ApiError(500, null, "Invalid product price"));
    }

    // ---------------------------------------------
    // 6) BEFORE updating, check for duplicates
    // Same user + same product + same size, but NOT this cart
    // ---------------------------------------------
    const duplicateCart = await AddToCart.findOne({
      userId: cart.userId,
      productcolorwiseitemId: cart.productcolorwiseitemId,
      productPriceAndSizeAndStockId: finalSizeId,
      _id: { $ne: cart._id },
    }).session(session);

    if (duplicateCart) {
      // Merge quantities
      duplicateCart.quantity = finalQuantity;
      duplicateCart.totalPrice = duplicateCart.quantity * Number(productPrice);

      await duplicateCart.save({ session });

      // Delete old cart
      await AddToCart.deleteOne({ _id: cart._id }).session(session);

      await session.commitTransaction();
      session.endSession();

      return res
        .status(200)
        .json(new ApiResponse(200, duplicateCart, "Cart merged successfully"));
    }

    // ---------------------------------------------
    // 7) Update the cart normally
    // ---------------------------------------------
    cart.quantity = finalQuantity;
    cart.productPriceAndSizeAndStockId = finalSizeId;
    cart.totalPrice = Number(productPrice) * Number(finalQuantity);

    await cart.save({ session });
    // Recalculate charges
    await recalculateCharges(req.user._id, session);
    await session.commitTransaction();
    session.endSession();

    return res
      .status(200)
      .json(new ApiResponse(200, cart, "Cart updated successfully"));
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

const deleteFromCart = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Cart item ID required"));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await AddToCart.deleteOne(
      {
        _id: new mongoose.Types.ObjectId(id),
        userId: req.user._id,
      },
      { session }
    );

    if (result.deletedCount === 0) {
      await session.abortTransaction();
      return res
        .status(404)
        .json(new ApiError(404, null, "Cart item not found"));
    }

    // 🟢 Recalculate Charges after deletion
    const updatedCharges = await recalculateCharges(req.user._id, session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json(
      new ApiResponse(
        200,
        { deleted: result, updatedCharges },
        "Cart item deleted successfully"
      )
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

const getCartItem = asyncHandler(async (req, res) => {
  const cart = await AddToCart.aggregate([
    // Match cart items for logged-in user
    {
      $match: { userId: new mongoose.Types.ObjectId(req.user._id) },
    },

    // Lookup product
    {
      $lookup: {
        from: "productcolorwiseitems",
        localField: "productcolorwiseitemId",
        foreignField: "_id",
        as: "productItems",
        pipeline: [
          {
            $lookup: {
              from: "productcoverimages",
              localField: "_id",
              foreignField: "productColorId",
              as: "coverImages",
              pipeline: [{ $project: { url: 1 } }],
            },
          },
          {
            $lookup: {
              from: "products",
              localField: "productId",
              foreignField: "_id",
              as: "product",
              pipeline: [{ $project: { productName: 1 } }],
            },
          },
        ],
      },
    },

    // Lookup selected size/stock/price entry
    {
      $lookup: {
        from: "productpriceandsizeandstocks",
        localField: "productPriceAndSizeAndStockId",
        foreignField: "_id",
        as: "productSizeAndStock",
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, cart, "Cart fetched successfully"));
});

export { addToCart, deleteFromCart, getCartItem, updateCart };
