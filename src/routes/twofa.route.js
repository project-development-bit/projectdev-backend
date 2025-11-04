const express = require("express");
const router = express.Router();
const twofaController = require("../controllers/twofa.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");

const {
  validate2FASetup,
  validate2FALogin,
} = require("../middleware/validators/twofaValidator.middleware");

const {
  twoFALoginLimiter,
  twoFASetupLimiter,
} = require("../middleware/rateLimiter.middleware");

// Get 2FA status for current user
router.get(
  "/status",
  auth(),
  awaitHandlerFactory(twofaController.get2FAStatus)
);

// Setup 2FA - Generate QR code and secret
router.post(
  "/setup",
  auth(),
  twoFASetupLimiter,
  awaitHandlerFactory(twofaController.setup2FA)
);

// Verify and enable 2FA
router.post(
  "/verify",
  auth(),
  twoFASetupLimiter,
  validate2FASetup,
  awaitHandlerFactory(twofaController.verify2FA)
);

// Verify 2FA token during login (public endpoint - no auth required)
router.post(
  "/verify-login",
  twoFALoginLimiter,
  validate2FALogin,
  awaitHandlerFactory(twofaController.verifyLogin2FA)
);

// Disable 2FA
router.post(
  "/disable",
  auth(),
  awaitHandlerFactory(twofaController.disable2FA)
);

module.exports = router;
