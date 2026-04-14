const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { upload } = require("../middleware/upload");
const uploadController = require("../controllers/upload.controller");

const router = express.Router();

router.post("/image", requireAuth, upload.single("image"), uploadController.uploadProfileImage);

module.exports = router;
