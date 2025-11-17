const UserModel = require('../models/user.model');
const { uploadImageToS3, deleteImageFromS3, validateImageFile } = require('../utils/imageUpload.utils');
const HttpException = require('../utils/HttpException.utils');

class ProfileController {
  //Get complete user profile with all related data
  getProfile = async (req, res, next) => {
    try {
      const userId = req.currentUser.id;

      const userData = await UserModel.getProfileWithCountry(userId);

      if (!userData) {
        throw new HttpException(404, "User profile not found");
      }

      // Format response
      const profile = {
        account: {
          username: userData.username || '',
          email: userData.email,
          avatar_url: userData.avatar_url || null,
          country: userData.country_id ? {
            id: userData.country_id,
            code: userData.country_code,
            name: userData.country_name,
            flag: userData.country_flag || null
          } : null,
          offer_token: userData.offer_token || null,
          created_at: userData.created_at
        },
        security: {
          twofa_enabled: Boolean(userData.twofa_enabled),
          security_pin_enabled: Boolean(userData.security_pin_enabled)
        },
        settings: {
          language: userData.language || 'en',
          notifications_enabled: Boolean(userData.notifications_enabled),
          show_stats_enabled: Boolean(userData.show_stats_enabled),
          anonymous_in_contests: Boolean(userData.anonymous_in_contests)
        }
      };

      res.status(200).json({
        success: true,
        message: "Profile retrieved successfully",
        data: profile
      });
    } catch (error) {
      next(error);
    }
  };

  //Upload or update user avatar
  uploadAvatar = async (req, res, next) => {
    try {
      const userId = req.currentUser.id;

      // Check if file was uploaded
      if (!req.file) {
        throw new HttpException(400, 'No avatar file uploaded. Please provide an image file.', 'NO_FILE_UPLOADED');
      }

      // Validate file
      const maxSizeBytes = parseInt(process.env.AVATAR_MAX_SIZE_BYTES || 2097152); // Default 2MB
      const validation = validateImageFile(req.file, maxSizeBytes);

      if (!validation.valid) {
        throw new HttpException(400, validation.error, 'INVALID_AVATAR_FILE');
      }

      // Get current user to check for existing avatar
      const currentUser = await UserModel.findOne({ id: userId }, true);

      if (!currentUser) {
        throw new HttpException(404, 'User not found', 'USER_NOT_FOUND');
      }

      const oldAvatarUrl = currentUser.avatar_url;

      // Upload new avatar to S3
      let avatarUrl;
      try {
        avatarUrl = await uploadImageToS3(
          req.file.buffer,
          'avatars',
          userId,
          req.file.mimetype,
          req.file.originalname
        );
      } catch (error) {
        console.error('S3 upload failed:', error);
        throw new HttpException(500, 'Failed to upload avatar. Please try again.', 'S3_UPLOAD_FAILED');
      }

      // Update database with new avatar URL
      try {
        const updateResult = await UserModel.update({ avatar_url: avatarUrl }, userId);

        if (!updateResult || updateResult.affectedRows === 0) {
          // Rollback: delete uploaded S3 file
          await deleteImageFromS3(avatarUrl);
          throw new HttpException(500, 'Failed to update avatar. Please try again.', 'DB_UPDATE_FAILED');
        }
      } catch (error) {
        // Rollback: delete uploaded S3 file
        await deleteImageFromS3(avatarUrl);
        throw error;
      }

      // Delete old avatar from S3 if it exists
      if (oldAvatarUrl) {
        await deleteImageFromS3(oldAvatarUrl);
      }

      // Return success response
      return res.status(200).json({
        success: true,
        avatarUrl: avatarUrl,
      });

    } catch (error) {
      next(error);
    }
  };

  //Delete user's avatar
  deleteAvatar = async (req, res, next) => {
    try {
      const userId = req.currentUser.id;

      // Get current user to check for existing avatar
      const currentUser = await UserModel.findOne({ id: userId }, true);

      if (!currentUser) {
        throw new HttpException(404, 'User not found', 'USER_NOT_FOUND');
      }

      const avatarUrl = currentUser.avatar_url;

      if (!avatarUrl) {
        return res.status(200).json({
          success: true,
          message: 'No avatar to delete',
        });
      }

      // Delete from S3
      await deleteImageFromS3(avatarUrl);

      // Update database to remove avatar URL
      await UserModel.update({ avatar_url: null }, userId);

      return res.status(200).json({
        success: true,
        message: 'Avatar deleted successfully',
      });

    } catch (error) {
      next(error);
    }
  };
}

module.exports = new ProfileController();
