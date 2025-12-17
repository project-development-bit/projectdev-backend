const express = require("express");
const router = express.Router();
const fortuneWheelController = require("../controllers/fortuneWheel.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");
const verifyTurnstile = require("../middleware/turnstile.middleware");
const { spinWheelSchema } = require("../middleware/validators/fortuneWheelValidator.middleware");
const { createRateLimiter } = require("../middleware/rateLimiter.middleware");

// Rate limiters for fortune wheel endpoints
const wheelSpinLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 spin attempts per 15 minutes
  message: "Too many spin attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const wheelHistoryLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Max 20 requests per minute
  message: "Too many history requests. Please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
});

//Get wheel configuration
router.get(
  "/rewards",
  awaitHandlerFactory(fortuneWheelController.getWheelConfig)
);

router.get(
  "/rewards/status",
  auth(),
  awaitHandlerFactory(fortuneWheelController.getWheelStatus)
);

//Spin the fortune wheel (daily limit)
router.post(
  "/spin",
  auth(),
  wheelSpinLimiter,
  spinWheelSchema,
  verifyTurnstile({
    expectedAction: 'fortune_wheel_spin',
    includeRemoteIp: true
  }),
  awaitHandlerFactory(fortuneWheelController.spinWheel)
);



//Get user's spin history
router.get(
  "/history",
  auth(),
  wheelHistoryLimiter,
  awaitHandlerFactory(fortuneWheelController.getSpinHistory)
);

module.exports = router;
