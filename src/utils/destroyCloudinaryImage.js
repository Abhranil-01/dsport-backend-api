import { cloudinary } from "./cloudinaryConfig.js";

const destroyCloudinaryImage = async ({publicId}) => {
    try {
        console.log("p",publicId);
        
        const response = await cloudinary.uploader.destroy(publicId);
    

        if (response.result === "ok") {
            console.log("File successfully deleted:", response);
            return { success: true, data: response };
        } else {
            console.error("Failed to delete file:", response);
            return { success: false, message: "Failed to delete image", data: response };
        }
    } catch (error) {
        console.error("Error deleting image:", error);
        return { success: false, error: error.message };
    }
};

export { destroyCloudinaryImage };
