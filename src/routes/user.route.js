const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const auth = require("../middleware/auth.middleware");
const Role = require("../utils/userRoles.utils");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");
const verifyTurnstile = require("../middleware/turnstile.middleware");
const { uploadAvatar } = require('../middleware/avatarUpload.middleware');

const {
  createUserSchema,
  updateUserSchema,
  validateLogin,
  validateEmail,
  validateRegister,
  validateTerms,
  validatePassword,
  validateRefreshToken,
  validateEmailChange,
  validatePasswordChange,
  validateVerifyEmailChange,
  validateSecurityPinToggle,
} = require("../middleware/validators/userValidator.middleware");

const { emailChangeLimiter } = require("../middleware/rateLimiter.middleware");
const { passwordChangeLimiter } = require("../middleware/rateLimiter.middleware");

router.get(
  "/personal_info/:email/:member_id",
  auth(),
  awaitHandlerFactory(userController.getPersonalInfo)
); // localhost:3000/api/v1/users/personal_info/chetva@google.com/BXT-GOO107

router.patch(
  "/accept_terms/:email",
  validateTerms,
  auth(),
  awaitHandlerFactory(userController.acceptTerms)
); // localhost:3000/api/v1/users/accept_terms/chetva@google.com

router.get("/", auth(), awaitHandlerFactory(userController.getAllUsers)); // localhost:3000/api/v1/users

router.get(
  "/username/:username",
  auth(),
  awaitHandlerFactory(userController.getUserByuserName)
); // localhost:3000/api/v1/users/usersname/julia

router.get(
  "/whoami",
  auth(),
  awaitHandlerFactory(userController.getCurrentUser)
); // localhost:3000/api/v1/users/whoami

router.get(
  "/referral-link",
  auth(),
  awaitHandlerFactory(userController.getReferralLink)
); // localhost:3000/api/v1/users/referral-link

router.get(
  "/referral-stats",
  auth(),
  awaitHandlerFactory(userController.getReferralStats)
); // localhost:3000/api/v1/users/referral-stats

router.get(
  "/referred-users",
  auth(),
  awaitHandlerFactory(userController.getReferredUsersList)
); // localhost:3000/api/v1/users/referred-users

router.post(
  "/",
  createUserSchema,
  //verifyRecaptcha({version : 'v3',expectedAction : 'create_user',minScore: 0.5}),
  verifyTurnstile({ expectedAction: 'create_user', includeRemoteIp: true }),
  awaitHandlerFactory(userController.createUser)
); // localhost:3000/api/v1/users

router.patch(
  "/id/:id",
  auth(),
  updateUserSchema,
  awaitHandlerFactory(userController.updateUser)
); // localhost:3000/api/v1/users/id/1 , using patch for partial update
router.delete(
  "/id/:id",
  auth(),
  awaitHandlerFactory(userController.deleteUser)
); // DELETE localhost:3000/api/v1/users/id/1 

router.post(
  "/login",
  validateLogin,
  //verifyRecaptcha({version : 'v3',expectedAction : 'login',minScore: 0.5}),
  verifyTurnstile({ expectedAction: 'login', includeRemoteIp: true }),
  awaitHandlerFactory(userController.userLogin)
); // localhost:3000/api/v1/users/login

router.post(
  "/forgot_password",
  validateEmail,
  verifyTurnstile({ expectedAction: 'forgot_password', includeRemoteIp: true }),
  awaitHandlerFactory(userController.forgotPassword)
); // localhost:3000/api/v1/users/forgot_password

router.get(
  "/verify/:email/:security_code",
  awaitHandlerFactory(userController.verifyUser)
); // localhost:3000/api/v1/users/verify/g.usertest01@gmail.com/1211

router.get(
  "/verify-forgot-password/:email/:security_code",
  awaitHandlerFactory(userController.verifyForgotPasswordCode)
); // localhost:3000/api/v1/users/verify-forgot-password/user@example.com/1234

router.post(
  "/save_password",
  validatePassword,
  awaitHandlerFactory(userController.savePassword)
); // localhost:3000/api/v1/users/save_password

router.post(
  "/resend-code",
  validateEmail,
  awaitHandlerFactory(userController.resendVerificationCode)
); // localhost:3000/api/v1/users/resend-code

router.post(
  "/resend-forgot-password-code",
  validateEmail,
  verifyTurnstile({ expectedAction: 'resend_forgot_password', includeRemoteIp: true }),
  awaitHandlerFactory(userController.resendForgotPasswordCode)
); // localhost:3000/api/v1/users/resend-forgot-password-code

router.post(
  "/refresh-token",
  validateRefreshToken,
  awaitHandlerFactory(userController.refreshToken)
); // POST localhost:3000/api/v1/users/refresh-token

router.get("/id/:id", auth(), awaitHandlerFactory(userController.getUserById)); // localhost:3000/api/v1/users/id/1

// Profile routes (moved from profile.route.js)
router.get(
  "/profile",
  auth(),
  awaitHandlerFactory(userController.getProfile)
); // GET /api/v1/users/profile

router.post(
  "/profile/avatar",
  auth(),
  uploadAvatar,
  awaitHandlerFactory(userController.uploadAvatar)
); // POST /api/v1/users/profile/avatar

router.delete(
  "/profile/avatar",
  auth(),
  awaitHandlerFactory(userController.deleteAvatar)
); // DELETE /api/v1/users/profile/avatar

router.get(
  "/rewards",
  auth(),
  awaitHandlerFactory(userController.getUserRewards)
); // GET /api/v1/users/rewards

router.patch(
  "/email",
  auth(),
  //emailChangeLimiter,
  validateEmailChange,
  awaitHandlerFactory(userController.changeEmail)
); // PATCH /api/v1/users/email

router.get(
  "/verify-email-change/:new_email/:verification_code",
  auth(),
  awaitHandlerFactory(userController.verifyEmailChange)
); // GET /api/v1/users/verify-email-change/:new_email/:verification_code

// Password change route
router.patch(
  "/password",
  auth(),
  passwordChangeLimiter,
  validatePasswordChange,
  awaitHandlerFactory(userController.changePassword)
); // PATCH /api/v1/users/password

router.post(
  "/security-pin",
  auth(),
  validateSecurityPinToggle,
  awaitHandlerFactory(userController.toggleSecurityPin)
); // POST /api/v1/users/security-pin

// Verify and complete account deletion
router.get(
  "/verify-delete-account/:verification_code",
  auth(),
  awaitHandlerFactory(userController.verifyAndDeleteAccount)
); // GET /api/v1/users/verify-delete-account/:verification_code

module.exports = router;
