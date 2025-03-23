import multer from "multer";

//we are using disk storage:-
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./public/temp") //we want to keep files in this route
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname)
    }
  })
  
export const upload = multer({ storage,})