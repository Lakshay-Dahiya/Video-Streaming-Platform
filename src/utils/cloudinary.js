//maanke chl rhe hain server pe hai file
//server se local path milega jo cloudinary pe daalenge
import { v2 as cloudinary } from "cloudinary";
import fs from "fs" //no need to import
//if file is successfully uploaded we can remove it (UNLINK IT) method given below


// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View Credentials' below to copy your API secret
})

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        //file has been uploaded successfully
        //console.log("file is uploaded in cloudinary ",response.url);
        fs.unlinkSync(localFilePath)
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath) //remove the locally saved temporary file as the upload operation got failed
        return null;
    }
}

const deleteFromCloudinary = async (fileId) => {
    try {
      if (!fileId) return null;
      //delete the file on cloudinary
      const response = await cloudinary.uploader.destroy(fileId);
      if (response) fs.unlinkSync(localFilePath);
      return response;
    } catch (error) {
      return null;
    }
  };

export {uploadOnCloudinary,deleteFromCloudinary}
