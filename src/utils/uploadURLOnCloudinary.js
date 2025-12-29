import { cloudinary } from "./cloudinaryConfig.js";
const uploadURLOnCloudinary = async (url) => {
    try {
      if (!url) return null;
      //upload the file on the cloudinary
      const response = await cloudinary.uploader.upload(url, {
        resource_type: "auto",
      });
  
      //file has been successfully uploaded
      console.log("file successfully uploaded", response);

      return response;
    } catch (error) {
      // remove the locally saved temporary file as the upload operation got failed
      console.log(error);
      
      return null;
    }
  };

  export { uploadURLOnCloudinary}