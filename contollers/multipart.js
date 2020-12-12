const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (req.params.user_id) {
      console.log("I am here in active");
      cb(null, "public/active_complaints/");
    } else {
      console.log("I am here in resolved");
      cb(null, "public/resolved_complaints/");
    }
  },
  filename: function (req, file, cb) {
    console.log(req.params.user_id);
    console.log(file.originalname);
    cb(
      null,
      (req.params.user_id ? req.params.user_id : req.params.worker_id) +
        "+" +
        uuidv4() +
        ".jpg"
    );
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype == "image/png" ||
      file.mimetype == "image/jpg" ||
      file.mimetype == "image/jpeg"
    ) {
      console.log("in here");
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error("Only .png, .jpg and .jpeg format allowed!"));
    }
  },
}).single("complaint_image");
const uploadImage = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      throw err;
    } else if (err) {
      // handle other errors
      console.log(err);
      req.errmessage = err;
    }

    // Everything is ok.
    next();
  });
};
module.exports = { uploadImage };

// const multer = require("multer");

// const multerStorage = multer.memoryStorage();

// const multerFilter = (req, file, cb) => {
//   if (
//     file.mimetype == "image/png" ||
//     file.mimetype == "image/jpg" ||
//     file.mimetype == "image/jpeg"
//   ) {
//     cb(null, true);
//   } else {
//     cb(null, false);
//     return cb(new Error("Only .png, .jpg and .jpeg format allowed!"));
//   }
// };

// const upload = multer({
//   storage: multerStorage,
//   fileFilter: multerFilter,
// });

// const uploadFiles = upload.array("complaint_image", 1); // limit to 10 images

// const uploadImages = (req, res, next) => {
//   uploadFiles(req, res, (err) => {
//     if (err instanceof multer.MulterError) {
//       // A Multer error occurred when uploading.
//       if (err.code === "LIMIT_UNEXPECTED_FILE") {
//         // Too many images exceeding the allowed limit
//         // ...
//       }
//     } else if (err) {
//       // handle other errors
//     }

//     // Everything is ok.
//     next();
//   });
// };

// module.exports = { uploadImages };

//***************************************************************************** */
// const multer = require("multer");
// const { v4: uuidv4 } = require("uuid");
// const path = require("path");

// var storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "public/active_complaints/");
//   },
//   filename: function (req, file, cb) {
//     cb(
//       null,
//       req.params.user_id + "-" + uuidv4() + path.extname(file.originalname)
//     );
//   },
// });

// const upload = multer({
//   storage: storage,
//   fileFilter: (req, file, cb) => {
//     if (
//       file.mimetype == "image/png" ||
//       file.mimetype == "image/jpg" ||
//       file.mimetype == "image/jpeg"
//     ) {
//       console.log("in here");
//       cb(null, true);
//     } else {
//       cb(null, false);
//       return cb(new Error("Only .png, .jpg and .jpeg format allowed!"));
//     }
//   },
// }).single("complaint_image");
// const uploadImage = (req, res, next) => {
//   upload(req, res, (err) => {
//     if (err instanceof multer.MulterError) {
//       // A Multer error occurred when uploading.
//       throw err;
//     } else if (err) {
//       // handle other errors
//       console.log(err);
//       req.errmessage = err;
//     }

//     // Everything is ok.
//     next();
//   });
// };
// module.exports = { uploadImage };

//extra

// const multer = require("multer");

// const multerStorage = multer.memoryStorage();

// const multerFilter = (req, file, cb) => {
//   if (
//     file.mimetype == "image/png" ||
//     file.mimetype == "image/jpg" ||
//     file.mimetype == "image/jpeg"
//   ) {
//     cb(null, true);
//   } else {
//     cb(null, false);
//     return cb(new Error("Only .png, .jpg and .jpeg format allowed!"));
//   }
// };

// const upload = multer({
//   storage: multerStorage,
//   fileFilter: multerFilter,
// });

// const uploadFiles = upload.array("complaint_image", 1); // limit to 10 images

// const uploadImages = (req, res, next) => {
//   uploadFiles(req, res, (err) => {
//     if (err instanceof multer.MulterError) {
//       // A Multer error occurred when uploading.
//       if (err.code === "LIMIT_UNEXPECTED_FILE") {
//         // Too many images exceeding the allowed limit
//         // ...
//       }
//     } else if (err) {
//       // handle other errors
//     }

//     // Everything is ok.
//     next();
//   });
// };

// module.exports = { uploadImages };
