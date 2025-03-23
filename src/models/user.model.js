import mongoose  ,{Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt"

const userSchema = new Schema(
    {
        username : {
            type :  String,
            required : true,
            unique : true,
            lowercase : true,
            trim : true,
            index : true //provide index so that it becomes searchable
        },
        email : {
            type :  String,
            required : true,
            unique : true,
            lowercase : true,
            trim : true,
        },        
        fullName : {
            type :  String,
            required : true,
            trim : true,
            index : true //provide index so that it becomes searchable
        },     
        avatar : {
            type :  String, //cloudinary url
            required : true,
        },         
        coverImage : {
            type :  String, //cloudinary url
        },  
        watchHistory : [{
            type : mongoose.Schema.Types.ObjectId,
            ref : "Video"
        }],
        password : {
            type : String,
            required : [true , 'Password is required']
        },
        refreshToken : {
            type : String
        }     
}, {timestamps : true});

//hooks and jwt:-
// Middleware (also called pre and post hooks) are functions which are passed control during execution of asynchronous functions. Middleware is specified on the schema level and is useful for writing plugins.
//prehook , jab bhi data ja/save ho rha ho usse pehle kuchh krna ho
userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)
    next()
})

// custom built methods by us:- (mongoose add on (already methods mai hote hain methods))
userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password)
}


userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        {
            _id : this._id, //unique id created by database
            email : this.email,       //payload
            username: this.username,
            fullName : this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn : process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        {
            _id : this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn : process.env.REFRESH_TOKEN_EXPIRY
        }
    )    
}

export const User = mongoose.model("User",userSchema)