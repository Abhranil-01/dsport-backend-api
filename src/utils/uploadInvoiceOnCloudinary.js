
import { cloudinary } from "./cloudinaryConfig.js";

export const uploadInvoiceOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "raw",
      folder: "invoices",
      use_filename: true,
      unique_filename: false,
    });

    return response;
  } catch (error) {
    console.log("Cloudinary upload error:", error);
    return null;
  } 
};
