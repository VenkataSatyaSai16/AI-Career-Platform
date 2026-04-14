const streamifier = require("streamifier");
const cloudinary = require("../config/cloudinary");

function uploadImage(fileBuffer, folder = "images") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image"
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
}

function uploadPDF(fileBuffer, userId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `resumes/${userId}`,
        resource_type: "raw",
        format: "pdf"
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
}

function deleteFile(publicId, resourceType = "image") {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType
  });
}

module.exports = {
  deleteFile,
  uploadImage,
  uploadPDF
};
