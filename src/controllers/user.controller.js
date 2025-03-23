import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/Apiresponse.js";
import { validate } from "uuid";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";
const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        //access token is given to user , but refresh token is stored in the database
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false}) //save method from mongodb makes the model ensure that all fields such as password are there in it as well. to prevent that use validateBeforeSave-->justs save
        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler( async (req,res)=> {
    // get user details from frontend
    // validation - not empty
    // check if user already exists : username,email check
    // check for images, check for avatar
    // upload them to cloudinary , check for avatar
    // create user object - create entry in db
    // remove password and refresh token field from response (we dont want to give encrypted password and refresh token to user)
    // check for user creation
    // return res 

    const {fullName, email , username , password} = req.body
    //console.log("email: ",email)

    if (
        [fullName , email , username , password].some((field)=>
        field?.trim() === "")
    ) {
        throw new ApiError(400 , "All fields are required!")
    }

    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })
    if (existedUser) {
        throw new ApiError(409,"User with email or username already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path; //taking avatar from multer
    //const coverImageLocalPath = req.files?.coverImage[0]?.path //taking cover Image
    //let coverImageLocalPath
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }
    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400,"Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "" , //check for cover image (not necessarily required)
        email,
        password,
        username : username.toLowerCase()
    })
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser) {
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully")
    )
})

const loginUser = asyncHandler (async (req,res)=>{
    // req body --> data (request body se data le aao)
    // check if the username or email is there or not
    // find the user
    // password check
    // generate access and refresh token
    // send tokens in form of cookies + send response

    const {email,username,password} = req.body
    if (!username && !email) {
        throw new ApiError(400,"username or email is required")
    }

    const user = await User.findOne({
        $or : [{email},{username}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }
    
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const options = {
        httpOnly : true,
        secure : true  //now only server can modify the cookies
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,{
            user : loggedInUser,accessToken,refreshToken
        },"User logged in Successfully")
    )

})

const logoutUser = asyncHandler (async (req,res)=>{
    // 1st step--> clearance of access and refresh token (req.cookie has them)
    // problem - no form submission --> no email,password etc --> no User.findOne(__) 
    // solution : use middleware
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset : {
                refreshToken : 1 //this removes the field from the doc
            }
        },
        {
            new : true
        }
    )

    const options = {
        httpOnly : true,
        secure : true
    }
    return res
    .status(200)
    .clearCookie("accessToken",options)  //name given in both functions should be same (above function)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req,res)=>{
    // to refresh AT , match the incoming refreshToken and the refreshToken in the database
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401,"Unauthorized request")
    }
    // go to jwt website
    // database has a decodedToken in it (encrypted one is passed in the cookies which eventually goes to the user)
    // decodedToken has info like id etc(refresh token has only id)
    try {
            const decodedToken = jwt.verify(
                incomingRefreshToken,
                process.env.REFRESH_TOKEN_SECRET
            )
        
            const user = await User.findById(decodedToken?._id)
            if (!user) {
                throw new ApiError(401,"Unauthorized request")
            }    
            // matching:-
            if (incomingRefreshToken != user?.refreshToken) {
                throw new ApiError(401,"Refresh token is expired or used")
            }
            // generate new refresh token
            const options = {
                httpOnly : true,
                secure : true
            }
        
            const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
            
            return res
            .status(200)
            .cookie("accessToken",accessToken)
            .cookie("refreshToken",newRefreshToken)
            .json(new ApiResponse(200,{accessToken,refreshToken : newRefreshToken},"Access token refreshed"))
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async (req,res)=> {
    return res.status(200) //to get.. he must be logged in--> get him by req.user
    .json(new ApiResponse(200,req.user,"current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async (req,res)=>{
    const {fullName , email} = req.body;
    if (!fullName || !email) {
        throw new ApiError(400,"All fields are required")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                fullName,  //same as fullName : fullName
                email : email
            }
        },
        {new : true}
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200,user,"Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req,res)=>{
    const avatarLocalPath = req.file?.path //through multer middleware
    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar is missing")
    }


    const avatar = await uploadOnCloudinary(avatarLocalPath) //avatar is an object
    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on cloudinary")
    }
    const user = await User.findByIdAndUpdate(req.user?._id,{
        $set : {
            avatar : avatar.url
        }
    },{new : true}).select("-password")

    return res.status(200)
    .json(new ApiResponse(200,user,"Avatar image updated successfully"))    

})

const updateUserCoverImage = asyncHandler(async (req,res)=>{
    const coverImageLocalPath = req.file?.path //through multer middleware
    if (!coverImageLocalPath) {
        throw new ApiError(400,"Cover Image file is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath) //avatar is an object
    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on cloudinary")
    }
    const user = await User.findByIdAndUpdate(req.user?._id,{
        $set : {
            coverImage : coverImage.url
        }
    },{new : true}).select("-password")

    return res.status(200)
    .json(new ApiResponse(200,user,"Cover image updated successfully"))
}) 


const getUserChannelProfile = asyncHandler(async (req,res)=>{
    const {username} = req.params
    if (!username?.trim()) {
        throw new ApiError(400,"username is missing")
    }
    // const user = await User.find({username}) --1 way of below
    // channel is an array (of 1 size) --> [{}]
    const channel = await User.aggregate(
        [
            {
                $match : {
                    username : username?.toLowerCase() //? optional
                }
            },
            {
                $lookup : {
                    from : "subscriptions",
                    localField : "_id",
                    foreignField : "channel",
                    as : "subscribers"
                }
            },
            {
                $lookup : {
                    from : "subscriptions",
                    localField : "_id",
                    foreignField : "subscriber",
                    as : "subscribedTo"
                }
            },
            {
                $addFields : {
                    subscribersCount : {
                        $size : "$subscribers"
                    },
                    channelsSubscribedTo : {
                        $size : "$subscribedTo"
                    },
                    isSubscribed : {
                        $cond : {
                            if: {$in: [req.user?._id,"$subscribers.subscriber"]}, //in can see inside both array and object (subscribers.subscriber ki id === logged in user ki id then the person sending the req is subscribed to the channel he is watching)
                            then : true,
                            else : false
                        }
                    }
                }
            },
            {
                $project : {
                    fullName : 1,
                    username : 1,
                    subscribersCount : 1,
                    channelsSubscribedTo : 1,
                    isSubscribed : 1,
                    avatar : 1,
                    coverImage : 1,
                    email : 1
                }
            }
        ]
    ) 

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"user channel fetched successfully")
    )
})   

const getWatchHistory = asyncHandler(async (req,res)=>{
    const user = await User.aggregate(
        [
           {            
                $match : {
                    _id : new mongoose.Types.ObjectId(req.user._id) //req.user_id gives you a literal string
                }
            },
            {
                $lookup : {
                    from : "videos",
                    localField : "watchHistory",
                    foreignField : "_id",
                    as : "watchHistory" , //now there are many docs inside watchHistory
                    pipeline : [
                        {
                            $lookup : {
                                from : "users",
                                localField : "owner",
                                foreignField : "_id",
                                as : "owner",
                                pipeline : [
                                    {
                                        $project : {
                                            fullName : 1,
                                            username : 1,
                                            avatar : 1
                                        }
                                    },
                                    {
                                        $addFields : {
                                            owner : {
                                                $first : "$owner"
                                            } 
                                        }
                                    }
                                ]                              
                            }
                        }
                    ]
                }
            }
        ]
    )

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].WatchHistory,
            "Watch history fetched successfully"
        )
    )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}

