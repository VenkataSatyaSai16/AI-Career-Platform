const { v2: cloudinary } = require("cloudinary");
const { env } = require("./env");

if (env.cloudinaryUrl) {
  cloudinary.config({
    cloudinary_url: env.cloudinaryUrl,
    secure: true
  });
} else {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true
  });
}

module.exports = cloudinary;
