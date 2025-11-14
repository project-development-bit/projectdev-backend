const multer = require('multer');
const HttpException = require('../utils/HttpException.utils');

// Configure multer to use memory storage (for S3 upload)
const storage = multer.memoryStorage();

// File filter for avatar uploads
const avatarFileFilter = (req, file, cb) => {
  // Check mime type
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new HttpException(400, 'Invalid file type. Only PNG, JPG, JPEG, and WEBP images are allowed', 'INVALID_FILE_TYPE'),
      false
    );
  }
};

// Multer upload configuration
const avatarUpload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.AVATAR_MAX_SIZE_BYTES || 2097152), // Default 2MB
  },
  fileFilter: avatarFileFilter,
});

// Middleware to handle multer errors
const handleAvatarUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxSizeMB = (parseInt(process.env.AVATAR_MAX_SIZE_BYTES || 2097152) / (1024 * 1024)).toFixed(2);
      return res.status(400).json({
        success: false,
        message: `File size exceeds maximum limit of ${maxSizeMB}MB`,
        code: 'FILE_SIZE_EXCEEDED',
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error',
      code: 'UPLOAD_ERROR',
    });
  }

  if (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to upload avatar. Please try again.',
      code: err.code || 'UPLOAD_ERROR',
    });
  }

  next();
};

// Export single file upload middleware with error handling
const uploadAvatar = [
  avatarUpload.single('avatar'),
  handleAvatarUploadError,
];

module.exports = {
  uploadAvatar,
  handleAvatarUploadError,
};
