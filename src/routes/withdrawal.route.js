const express = require("express");
const router = express.Router();
const withdrawalController = require("../controllers/withdrawal.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");
const { body } = require("express-validator");

// Validation middleware 
const createCoinWithdrawalSchema = [
  body("method")
    .exists()
    .withMessage("Withdrawal method is required")
    .isString()
    .isIn(["BTC", "DASH", "DOGE", "LTC"])
    .withMessage("Method must be one of: BTC, DASH, DOGE, LTC")
    .toUpperCase(),
  body("amount_coins")
    .exists()
    .withMessage("Amount in coins is required")
    .isInt({ min: 1 })
    .withMessage("Amount must be a positive integer"),
  body("payout_address")
    .optional()
    .isString()
    .isLength({ min: 26, max: 128 })
    .withMessage("Payout address must be between 26 and 128 characters")
    .trim(),
];


// Get user's withdrawal history
router.get(
  "/",
  auth(),
  awaitHandlerFactory(withdrawalController.getUserWithdrawals)
); // GET /api/v1/withdrawals

// Get single withdrawal by ID
router.get(
  "/:id",
  auth(),
  awaitHandlerFactory(withdrawalController.getWithdrawalById)
); // GET /api/v1/withdrawals/:id

// Create withdrawal request
router.post(
  "/",
  auth(),
  createCoinWithdrawalSchema,
  awaitHandlerFactory(withdrawalController.createCoinWithdrawal)
); // POST /api/v1/withdrawals

module.exports = router;
