import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req,res,next)=>{
    //we added accessToken and refreshToken in response from logInUser controller
    //cookies may not be available in case user is using mobile application (where he sends custom headers)
    //res mai bheji thi cookies req m bhi kr pa rhe
    //no need to set req.cookies.. here,. we already gave req the access to cookies through middleware app.use(cookieParser())
    try {
        if (req.query.guest === "true") {
            req.user = null; // Set req.user to null for guest users
            return next();
        }
                
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")   
        if (!token) {
            throw new ApiError(401,"Unauthorized request")
        }
        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id).select(
            "-password -refreshToken"
        )
        if (!user) {
            throw new ApiError(401,"Invalid Access Token")
        }
    
        req.user = user;
        next()
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid Access Token")
    }
})