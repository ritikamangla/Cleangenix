const path = require("path");
const sharp = require("sharp");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

const resizeImages = async (req, res, next) => {
  if (!req.files) return next();

  req.body.images = [];
  await Promise.all(
    req.files.map(async (file) => {
      const newFilename =
        req.params.user_id + "-" + uuidv4() + path.extname(file.originalname);

      await sharp(file.buffer)
        .rotate(90)
        .toFile(`public/active_complaints/${newFilename}`);

      req.body.images.push({
        filename: newFilename,
        path: `public/active_complaints/${newFilename}`,
      });
    })
  );

  next();
};

module.exports = { resizeImages };

// const sharp = require("sharp");
// const resizeImage = async (req, res, next) => {
//   try {
//     if (!req.file) return next();
//     console.log(req.file.filename);
//     await sharp(req.file.path).rotate().toFile(req.file.filename);

//     next();
//   } catch (err) {
//     throw err;
//   }
// };

// module.exports = { resizeImage };
