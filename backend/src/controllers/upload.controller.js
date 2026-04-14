const User = require("../models/User");
const { deleteFile, uploadImage } = require("../utils/cloudinaryUpload");

async function uploadProfileImage(req, res, next) {
  try {
    if (!req.file?.buffer) {
      const error = new Error("Image file is required");
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findById(req.auth.user.id);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    if (user.profileImagePublicId) {
      await deleteFile(user.profileImagePublicId, "image");
    }

    const result = await uploadImage(req.file.buffer, "images/profile");
    user.profileImage = result.secure_url || "";
    user.profileImagePublicId = result.public_id || "";
    await user.save();

    res.status(200).json({
      url: user.profileImage,
      publicId: user.profileImagePublicId
    });
  } catch (error) {
    console.error("Image upload failed", {
      error: error.message
    });
    next(error);
  }
}

module.exports = {
  uploadProfileImage
};
