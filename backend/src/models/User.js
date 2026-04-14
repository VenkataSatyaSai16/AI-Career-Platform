const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  // Display name from Google profile or friendly label for local accounts.
  name: {
    type: String,
    default: "",
    trim: true
  },
  // Email is unique so the same person can be reused across logins.
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  // Google account id from OAuth provider.
  googleId: {
    type: String,
    default: "",
    trim: true
  },
  googleAccessToken: {
    type: String,
    default: ""
  },
  googleRefreshToken: {
    type: String,
    default: ""
  },
  googleTokenExpiry: {
    type: Date,
    default: null
  },
  // Password is optional so Google-only users can still exist in the same collection.
  password: {
    type: String,
    default: ""
  },
  profileImage: {
    type: String,
    default: ""
  },
  profileImagePublicId: {
    type: String,
    default: ""
  },
  // Stored automatically on first creation.
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
