const express = require("express");
const router = express.Router();
const treasureChestController = require("../controllers/treasureChest.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");
const verifyTurnstile = require("../middleware/turnstile.middleware");
const { openChestSchema } = require("../middleware/validators/treasureChestValidator.middleware");
const { createRateLimiter } = require("../middleware/rateLimiter.middleware");

// Rate limiters for treasure chest endpoints
const chestOpenLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 open attempts per 15 minutes
  message: "Too many chest opening attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const chestHistoryLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Max 20 requests per minute
  message: "Too many history requests. Please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
});


router.get(
  "/status",
  auth(),
  awaitHandlerFactory(treasureChestController.getChestStatus)
);


router.post(
  "/open",
  auth(),
  chestOpenLimiter,
  openChestSchema,
  awaitHandlerFactory(treasureChestController.openChest)
);


router.get(
  "/history",
  auth(),
  chestHistoryLimiter,
  awaitHandlerFactory(treasureChestController.getChestHistory)
);

module.exports = router;
