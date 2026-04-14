const mongoose = require("mongoose");
const { env } = require("./env");

async function connectDatabase() {
  mongoose.set("strictQuery", true);

  // Shared Mongoose connection for the whole app, including auth users.
  await mongoose.connect(env.mongoUri, {
    autoIndex: env.nodeEnv !== "production"
  });

  console.log("MongoDB connected");
}

module.exports = connectDatabase;
