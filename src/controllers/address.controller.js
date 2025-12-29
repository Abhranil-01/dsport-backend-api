import { asyncHandler } from "../utils/asyncHandler.js";
import { Address } from "../models/address.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import mongoose from "mongoose";


// -----------------------------------------------
// CREATE ADDRESS
// -----------------------------------------------
const createAddress = asyncHandler(async (req, res) => {
  const { address, city, state, pincode, addressName,name,phone,altPhone,email } = req.body;

  if (!address || !city || !state || !pincode || !addressName || !name || !phone || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const newAddress = await Address.create({
    address,
    city,
    state,
    pincode,
    addressName,
    name,
    phone,
    altPhone,
    email,
    user: req.user._id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, newAddress, "Address created successfully"));
});

// -----------------------------------------------
// GET ALL USER ADDRESSES
// -----------------------------------------------
const getAllAddress = asyncHandler(async (req, res) => {
  const addresses = await Address.find({ user: req.user._id });

  return res
    .status(200)
    .json(new ApiResponse(200, addresses, "Addresses fetched successfully"));
});

// -----------------------------------------------
// GET ADDRESS BY ID (OWNER PROTECTED)
// -----------------------------------------------
const getAddressById = asyncHandler(async (req, res) => {
  const addressId = req.params.id;
console.log(addressId,"hjvgdugewufgewf");

  const address = await Address.findOne({
    _id: new mongoose.Types.ObjectId(addressId),
    user: req.user._id,
  });

  if (!address) throw new ApiError(404, "Address not found");

  return res
    .status(200)
    .json(new ApiResponse(200, address, "Address fetched successfully"));
});

// -----------------------------------------------
// UPDATE ADDRESS (OWNER PROTECTED)
// -----------------------------------------------
const updateAddress = asyncHandler(async (req, res) => {
  const { address, city, state, pincode, country, addressName,name,phone,altPhone,email } = req.body;

  const updatedAddress = await Address.findOneAndUpdate(
    {
      _id: req.params.id,
      user: req.user._id, // IMPORTANT: Ownership check
    },
    {
      $set: {
        ...(address && { address }),
        ...(city && { city }),
        ...(state && { state }),
        ...(pincode && { pincode }),
        ...(country && { country }),
        ...(addressName && { addressName }),
        ...(name && { name }),
        ...(phone && { phone }),
        ...(altPhone && { altPhone }),
        ...(email && { email }),
      },
    },
    { new: true }
  );

  if (!updatedAddress) throw new ApiError(404, "Address not found");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedAddress, "Address updated successfully"));
});

const deleteAddress = asyncHandler(async (req, res) => {
  const addressId = req.params.id;
  const deletedAddress = await Address.findOneAndDelete({
    _id: addressId,
    user: req.user._id, // Ensure the user owns the address
  });

  if (!deletedAddress) throw new ApiError(404, "Address not found");

  return res
    .status(200)
    .json(new ApiResponse(200, deletedAddress, "Address deleted successfully"));
});

export {
  createAddress,
  updateAddress,
  getAllAddress,
  getAddressById,
  deleteAddress
};
