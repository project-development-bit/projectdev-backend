const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const auth = require('../middleware/auth.middleware');
const { uploadAvatar } = require('../middleware/avatarUpload.middleware');
const awaitHandlerFactory = require('../middleware/awaitHandlerFactory.middleware');

// Get user profile
router.get(
  '/',
  auth(),
  awaitHandlerFactory(profileController.getProfile)
); // GET /api/v1/profile

// Upload or update avatar
router.post(
  '/avatar',
  auth(),
  uploadAvatar,
  awaitHandlerFactory(profileController.uploadAvatar)
); // POST /api/v1/profile/avatar

// Delete avatar
router.delete(
  '/avatar',
  auth(),
  awaitHandlerFactory(profileController.deleteAvatar)
); // DELETE /api/v1/profile/avatar

module.exports = router;
