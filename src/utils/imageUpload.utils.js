const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const path = require('path');
const s3Config = require('../config/s3.config');

// Initialize S3 client
const s3Client = new S3Client({
  region: s3Config.region,
  credentials: {
    accessKeyId: s3Config.accessKeyId,
    secretAccessKey: s3Config.secretAccessKey,
  },
});

//Generate unique filename for image
const generateUniqueFilename = (identifier, originalExtension) => {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let randomString = '';

  for (let i = 0; i < 16; i++) {
    const randomIndex = crypto.randomInt(0, characters.length);
    randomString += characters[randomIndex];
  }

  const timestamp = Date.now();
  return `${identifier}-${timestamp}-${randomString}${originalExtension}`;
};

//Upload image to S3
const uploadImageToS3 = async (fileBuffer, folder, identifier, mimetype, originalname, bucket = null) => {
  try {
    const bucketName = bucket || s3Config.bucket;

    if (!bucketName) {
      throw new Error('S3 bucket is not configured');
    }

    // Get file extension
    const ext = path.extname(originalname).toLowerCase();

    // Generate unique filename
    const filename = generateUniqueFilename(identifier, ext);
    const key = `${folder}/${identifier}/${filename}`;

    // Upload parameters
    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimetype,
    };

    // Upload to S3
    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    // Return the S3 URL
    const s3Url = `https://${bucketName}.s3.${s3Config.region}.amazonaws.com/${key}`;

    return s3Url;
  } catch (error) {
    console.error('S3 Upload Error:', error);
    throw error;
  }
};

//Delete image from S3
const deleteImageFromS3 = async (imageUrl, bucket = null) => {
  try {
    if (!imageUrl) return;

    const bucketName = bucket || s3Config.bucket;

    if (!bucketName) {
      throw new Error('S3 bucket is not configured');
    }

    // Extract key from URL
    const urlPattern = new RegExp(`https://${bucketName}.s3.[^/]+.amazonaws.com/(.+)`);
    const match = imageUrl.match(urlPattern);

    if (!match || !match[1]) {
      console.warn('Could not extract S3 key from URL:', imageUrl);
      return;
    }

    const key = match[1];

    // Delete from S3
    const deleteParams = {
      Bucket: bucketName,
      Key: key,
    };

    const command = new DeleteObjectCommand(deleteParams);
    await s3Client.send(command);

    console.log('Successfully deleted image from S3:', key);
  } catch (error) {
    console.error('S3 Delete Error:', error);
  }
};

//Validate image file
const validateImageFile = (file, maxSizeBytes, allowedMimeTypes = null) => {
  if (!file) {
    return { valid: false, error: 'No file uploaded' };
  }

  // Check file size
  if (file.size > maxSizeBytes) {
    const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
    return { valid: false, error: `File size exceeds maximum limit of ${maxSizeMB}MB` };
  }

  // Check mime type
  const defaultAllowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const mimeTypes = allowedMimeTypes || defaultAllowedMimeTypes;

  if (!mimeTypes.includes(file.mimetype)) {
    const allowedFormats = mimeTypes.map(mt => mt.split('/')[1].toUpperCase()).join(', ');
    return { valid: false, error: `Invalid file type. Only ${allowedFormats} are allowed` };
  }

  return { valid: true };
};

//Download image from URL
const downloadImageFromUrl = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');

    // Validate it's an image
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error('URL does not point to an image');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get file extension from content type
    let extension = '.jpg'; // default
    if (contentType.includes('png')) extension = '.png';
    else if (contentType.includes('webp')) extension = '.webp';
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = '.jpg';

    return {
      buffer,
      mimetype: contentType,
      extension
    };
  } catch (error) {
    console.error('Download Image Error:', error);
    throw error;
  }
};

module.exports = {
  uploadImageToS3,
  deleteImageFromS3,
  validateImageFile,
  generateUniqueFilename,
  downloadImageFromUrl,
};
