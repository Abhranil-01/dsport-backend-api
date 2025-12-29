import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Charges } from "./../models/charges.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export const getCharges = asyncHandler(async (req, res) => {
  const ChargesData = await Charges.findOne({
    userId: req.user._id,
  });
  if (!ChargesData) {
    throw new ApiError(404, null, "Charges data not found for the user");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(201, ChargesData, "Charges data retrieved successfully")
    );
});
