const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const auth = require('../middleware/auth.middleware');
const { uploadAvatar } = require('../middleware/avatarUpload.middleware');
const awaitHandlerFactory = require('../middleware/awaitHandlerFactory.middleware');

router.post(
  '/avatar',
  auth(),
  uploadAvatar,
  awaitHandlerFactory(profileController.uploadAvatar)
);

router.delete(
  '/avatar',
  auth(),
  awaitHandlerFactory(profileController.deleteAvatar)
);

module.exports = router;
