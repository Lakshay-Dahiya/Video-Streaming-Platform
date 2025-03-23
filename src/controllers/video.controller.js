import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/Apiresponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { deleteFromCloudinary } from "../utils/cloudinary.js"
import { video_upOptions,thumbnail_upOptions } from "../constants.js"

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    
    const pipeline = [];
  
    if (query) {
      pipeline.push({
        $search: {
          index: "search-videos",
          text: {
            query: query,
            path: ["title", "description"],
          },
        },
      });
    }
  
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, "Invalid userId");
      }
  
      pipeline.push({
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
        },
      });
    }
  
    pipeline.push({ $match: { isPublished: true } });
  
    if (sortBy && (sortType === "asc" || sortType === "desc")) {
      pipeline.push({
        $sort: {
          [sortBy]: sortType === "asc" ? 1 : -1,
        },
      });
    } else {
      pipeline.push({ $sort: { createdAt: -1 } });
    }
  
    // Lookup owner details
    pipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerDetails",
          pipeline: [
            {
              $project: {
                username: 1,
                "avatar.url": 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$ownerDetails",
      }
    );
  
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const limitInt = parseInt(limit, 10);
  
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitInt });
  
    try {
      const videos = await Video.aggregate(pipeline);
      const totalVideos = await Video.countDocuments({ isPublished: true });
  
      const totalPages = Math.ceil(totalVideos / limitInt);
  
      return res.status(200).json(
        new ApiResponse(200, {
          videos,
          pagination: {
            totalVideos,
            totalPages,
            currentPage: parseInt(page, 10),
            limit: limitInt,
          },
        }, "Videos fetched successfully")
      );
    } catch (error) {
      console.error("Error fetching videos:", error);
      throw new ApiError(500, "An error occurred while fetching videos");
    }
  });

const publishAVideo = asyncHandler(async (req, res) => {
    // get video, upload to cloudinary, create video
    //req.user - user , check if there or not 
    //title , description , check if there not 
    //upload file on multer , check if there not 
    //local path from multer and upload it on cloudinary 
    //find video length etc from cloudinary 
    //if there is anything in is public then also update that 

   try {
     const { title, description } = req.body

     if(!req.files.videoFile || !req.files.thumbnail){
        if(req.files.videoFile){
            fs.unlinkSync(req.files?.videoFile[0]?.path)
        }
        if(req.files.thumbnail){
            fs.unlinkSync(req.files?.thumbnail[0]?.path)
        }
        throw new ApiError(401,"either videoFile or thumbnail is missing");
     }
     const videoFileLocalPath = req.files?.videoFile[0]?.path;
     const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

     if(!title || !description){
        if(videoFileLocalPath){
            fs.unlinkSync(videoFileLocalPath)
        }
        if(thumbnailLocalPath){
            fs.unlinkSync(thumbnailLocalPath)
        }
        throw new ApiError(401,"cannot publish video without title and description");
     }
     
     const ownerId = req.user?._id ;
     if(!ownerId) throw new ApiError(401,"user not loggedin");
 
     const videoFile = await uploadOnCloudinary(videoFileLocalPath);
     const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    
     if(!thumbnail || !videoFile) throw new ApiError(500,"uploading error when uploading either video or thumbnail to cloudinary") ;
     
     const video = await Video.create({
         videoFile:videoFile.secure_url ,
         videoFilePublicId:videoFile.public_id,
         thumbnail:thumbnail.secure_url ,
         thumbnailPublicId:thumbnail.public_id,
         owner:ownerId,
         title,
         description,
         duration:videoFile.duration ,
         isPublished:req.body.isPublic == "false" ? false : true
        
     })
     return res
     .status(201)
     .json(
         new ApiResponse(201,video,"video is published")
     )     
   } catch (error) {
     res
     .status(error?.statusCode||500)
     .json({
        status:error?.statusCode||500,
        message:error?.message||"some error in publishing video"
     })
   }

})
  

const getVideoById = asyncHandler(async (req, res) => {
    try {
        // this is for getting video info and displaying it in card if its not there 
      const { videoId } = req.params
      // get video by id
  
      if(!videoId) throw new ApiError(400,"videoId missing");
      
      const video = await Video.findOne({
          _id: new mongoose.Types.ObjectId(videoId)
      })
     
      // can update this so that owner can only see through id
      if(!video || !video?.isPublished) throw new ApiError(400,`video with this ${videoId} is not available`)
 
      res.status(200)
      .json(new ApiResponse(200,video,"got video from id"))
    } catch (error) {
     res
     .status(error?.statusCode||500)
     .json({
        status:error?.statusCode||500,
        message:error?.message||"some error in getting video by id"
     })
    }
 })
 

 const updateVideo = asyncHandler(async (req, res) => {
    try {
      const { videoId } = req.params
      // update video details like title, description, thumbnail
      if(!videoId) throw new ApiError(400,"videoId missing");
      
      const {title,description} = req.body ;
      const thumbnailLocalPath = req.file?.path;
      if(!title && !description && !thumbnailLocalPath)
      throw new ApiError(400,"either send updated title ,description or thumbnail");
      
      const userId = req.user._id;
      if(!userId) throw new ApiError(400,"user not logged in");
  
      const video = await Video.findById(videoId);
  
      if(!video) throw new ApiError(400,"video with this videoId is missing")
      const ownerId = video?.owner;
      const permission = JSON.stringify(ownerId) == JSON.stringify(userId);
  
      if(!permission) throw new ApiError(400,"login with owner id");
      
      if(thumbnailLocalPath){ 
          var thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
      }
      
      const updatedObj = {};
      if(title) updatedObj.title = title;
      if(description) updatedObj.description = description;
      if(thumbnailLocalPath) {
         updatedObj.thumbnail = thumbnail.secure_url ;
      }
      
  
      const updatedVideo = await Video.findByIdAndUpdate(
          new mongoose.Types.ObjectId(videoId),
          updatedObj,
          {
              new:true
          }
      )
  
      res.status(200)
      .json( 
          new ApiResponse(200,updatedVideo,"video updated successFully")
      ) ;
  
    } catch (error) {
      
     res
     .status(error?.statusCode||500)
     .json({
        status:error?.statusCode||500,
        message:error?.message||"some error in updating the video"
     })
 
    }
 
 })

 const deleteVideo = asyncHandler(async (req, res) => {
  // delete video
 try {
   const { videoId } = req.params
   
   if(!videoId) throw new ApiError(400,"videoId missing");
   
   if(!req.user) throw new ApiError(400,"user not loggedIn");

   const userId = req.user._id;
   const video = await Video.findById(videoId);
   if(!video) throw new ApiError(400,"video with this videoId is missing")
   const ownerId = video?.owner;
   // console.log(new String(userId));
   // console.log(JSON.stringify(ownerId));

   if(JSON.stringify(ownerId) !== JSON.stringify(userId)) throw new ApiError(400,"login with owner id")

   const deleted = await Video.findByIdAndDelete(new mongoose.Types.ObjectId(videoId));
   if(video.thumbnailPublicId){

      deleteFromCloudinary(video.thumbnailPublicId).catch(err=>console.log(err));
   }
   if(video.videoFilePublicId){
    
      deleteFromCloudinary(video.videoFilePublicId,"video").catch(err=>console.log(err));
   }
  // console.log(deleted)

   return res
   .status(200)
   .json(
       new ApiResponse(200,{info:`video : ${video.title} is deleted`},"video deleted successFully")
   )
 } catch (error) {
  res
  .status(error?.statusCode||500)
  .json({
     status:error?.statusCode||500,
     message:error?.message||"some error in deleting a video"
  })
 }
})


export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    // togglePublishStatus
}