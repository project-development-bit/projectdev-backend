const express = require("express");
const router = express.Router();
const withdrawalController = require("../controllers/withdrawal.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");
const { body } = require("express-validator");

// Validation middleware for withdrawal request
const createWithdrawalSchema = [
  body("method")
    .exists()
    .withMessage("Method is required")
    .isString()
    .isLength({ min: 2, max: 10 })
    .withMessage("Method must be between 2 and 10 characters")
    .toUpperCase(),
  body("amount_coins")
    .exists()
    .withMessage("Amount is required")
    .isFloat({ min: 0.00000001 })
    .withMessage("Amount must be a positive number"),
  body("payout_address")
    .exists()
    .withMessage("Payout address is required")
    .isString()
    .isLength({ min: 10, max: 128 })
    .withMessage("Payout address must be between 10 and 128 characters")
    .trim(),
];


// Get withdrawal options
router.get(
  "/options",
  auth(),
  awaitHandlerFactory(withdrawalController.getWithdrawalOptions)
); // GET /api/v1/withdrawals/options

// Create withdrawal request (Authenticated users)
router.post(
  "/",
  auth(),
  createWithdrawalSchema,
  awaitHandlerFactory(withdrawalController.createWithdrawal)
); // POST /api/v1/withdrawals

module.exports = router;
