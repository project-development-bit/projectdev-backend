const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const auth = require("../middleware/auth.middleware");
const Role = require("../utils/userRoles.utils");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");
const verifyTurnstile = require("../middleware/turnstile.middleware");

const {
  createUserSchema,
  updateUserSchema,
  validateLogin,
  validateEmail,
  validateRegister,
  validateTerms,
  validatePassword,
  validateRefreshToken,
} = require("../middleware/validators/userValidator.middleware");

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
  auth(Role.Admin),
  awaitHandlerFactory(userController.deleteUser)
); // localhost:3000/api/v1/users/id/1

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
  "/refresh-token",
  validateRefreshToken,
  awaitHandlerFactory(userController.refreshToken)
); // POST localhost:3000/api/v1/users/refresh-token

router.get("/id/:id", auth(), awaitHandlerFactory(userController.getUserById)); // localhost:3000/api/v1/users/id/1

module.exports = router;
