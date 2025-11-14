const dotenv = require("dotenv");
dotenv.config();

const s3Config = {
  region: process.env.AWS_REGION || "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  bucket: process.env.AVATAR_S3_BUCKET,
};

module.exports = s3Config;
