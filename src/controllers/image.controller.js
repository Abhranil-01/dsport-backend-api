import { asyncHandler } from "../utils/asyncHandler.js";
import { Image } from "../models/image.model.js";
import { uploadFileOnCloudinary } from "../utils/uploadFilesOnCloudinary.js";
import { uploadURLOnCloudinary } from "../utils/uploadURLOnCloudinary.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const saveImage = asyncHandler(async (req, res) => {
  const { url } = req.body;
  const imageFromFile = req.file;
  let imagePath;


  if (url) {
    const response = uploadURLOnCloudinary(url);
    imagePath = Image.create({
      url: response.secure_url,
    });
 
  } else if (imageFromFile) {
    
    const response =await uploadFileOnCloudinary(imageFromFile.path);
    imagePath =await Image.create({
      url: response.secure_url,
    });

  }
  else{
    throw new ApiError("No image provided");
  }
  return res.status(201).json(new ApiResponse(200,imagePath,"Image successfully uploaded"))
});

const getImage = asyncHandler(async (req, res) => {
    const image = await Image.find();
    return res.status(200).json(new ApiResponse(200,image,"Image successfully fetched"))
})
 const deleteImage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const image = await Image.findById(id);

    await image.remove(); // Triggers the middleware
    await image.deleteOne();
    return res.status(200).json(new ApiResponse(200,image,"Image successfully deleted"))
  });

  const updateImage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { url } = req.body;
    const image = await Image.findByIdAndUpdate(id, { url },{new:true});
  });
export {saveImage,deleteImage,getImage}
