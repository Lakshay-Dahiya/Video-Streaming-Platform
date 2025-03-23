import express from "express";
import cookieParser from "cookie-parser"; //apne server se user ke browser ki cookies access aur accept kr skte hain 
import cors from "cors";

const app = express();

// app.use(cors()) //itna bhi boht hai
app.use(cors({
    origin : process.env.CORS_ORIGIN,
    credentials : true
}))

//bracket ke andr sbme options hain:-
app.use(express.json({limit : "16kb"})) //JSON's limit (form se data aa rha hai)
app.use(express.urlencoded({extended : true , limit : 
    "16kb"})) //extended allows nested objects (extended objects)
app.use(express.static("public"))    //public assets
app.use(cookieParser())

//routes import
import userRouter from "./routes/user.routes.js"
import healthcheckRouter from "./routes/healthcheck.routes.js"
import tweetRouter from "./routes/tweet.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import videoRouter from "./routes/video.routes.js"
import commentRouter from "./routes/comment.routes.js"
import likeRouter from "./routes/like.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"

//routes declaration
//router ko laane ke liye middleware laana pdega (this is the only syntax)
app.use("/api/v1/users",userRouter) // /users is prefix  /api/version btana shi rehta hai
//http://localhost:8000/api/v1/users/register -->user dekhte hi userRouter pe jaayega
app.use("/api/v1/healthcheck", healthcheckRouter)
app.use("/api/v1/tweets", tweetRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/comments", commentRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/playlist", playlistRouter)
app.use("/api/v1/dashboard", dashboardRouter)

export {app}
