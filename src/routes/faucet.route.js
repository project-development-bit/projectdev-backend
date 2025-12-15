const express = require("express");
const router = express.Router();
const faucetController = require("../controllers/faucet.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");
const verifyTurnstile = require("../middleware/turnstile.middleware");
const {
  claimFaucetSchema } = require("../middleware/validators/faucetValidator.middleware");
const { createRateLimiter } = require("../middleware/rateLimiter.middleware");

// Rate limiters for faucet endpoints
const faucetClaimLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 claim attempts per 15 minutes
  message: "Too many claim attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const faucetStatusLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Max 30 requests per minute
  message: "Too many status requests. Please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
});

//Get faucet status for authenticated user
router.get(
  "/status",
  auth(),
  faucetStatusLimiter,
  awaitHandlerFactory(faucetController.getFaucetStatus)
);

//Claim faucet reward
router.post(
  "/claim",
  auth(),
  faucetClaimLimiter,
  claimFaucetSchema,
  verifyTurnstile({
    expectedAction: 'faucet_claim',
    includeRemoteIp: true
  }),
  awaitHandlerFactory(faucetController.claimFaucet)
);

module.exports = router;
