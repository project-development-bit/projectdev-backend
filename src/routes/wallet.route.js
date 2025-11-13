const express = require("express");
const router = express.Router();
const walletController = require("../controllers/wallet.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");
const { walletBalancesLimiter } = require("../middleware/rateLimiter.middleware");
const { query } = require("express-validator");

// Validation for query parameters
const getBalancesValidation = [
  query("asOf")
    .optional()
    .isISO8601()
    .withMessage("asOf must be a valid ISO 8601 timestamp"),
  query("windowDays")
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage("windowDays must be an integer between 1 and 90"),
];

router.get(
  "/balances",
  auth(),
  walletBalancesLimiter, // Rate limit: 60 req/min per user
  getBalancesValidation,
  awaitHandlerFactory(walletController.getWalletBalances)
);

module.exports = router;
