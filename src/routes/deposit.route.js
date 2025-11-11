const express = require("express");
const router = express.Router();
const depositController = require("../controllers/deposit.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");
const { body } = require("express-validator");

// Validation middleware for user deposit creation
const createDepositSchema = [
  body("currency")
    .exists()
    .withMessage("Currency is required")
    .isString()
    .isLength({ min: 2, max: 10 })
    .withMessage("Currency must be between 2 and 10 characters")
    .toUpperCase(),
  body("amount")
    .exists()
    .withMessage("Amount is required")
    .isFloat({ min: 0.00000001 })
    .withMessage("Amount must be a positive number"),
  body("txid")
    .optional()
    .isString()
    .isLength({ max: 128 })
    .withMessage("Transaction ID must not exceed 128 characters")
    .trim(),
  body("depositAddress")
    .optional()
    .isString()
    .isLength({ max: 128 })
    .withMessage("Deposit address must not exceed 128 characters")
    .trim(),
  body("paymentProvider")
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage("Payment provider must not exceed 50 characters")
    .trim(),
];

// Validation middleware for confirming deposits
const confirmDepositSchema = [
  body("status")
    .optional()
    .isIn(['pending', 'confirmed', 'failed'])
    .withMessage("Status must be one of: pending, confirmed, failed"),
];

// Get user's deposit history
router.get(
  "/",
  auth(),
  awaitHandlerFactory(depositController.getUserDeposits)
); // GET /api/v1/deposits

// Get single deposit by ID
router.get(
  "/:id",
  auth(),
  awaitHandlerFactory(depositController.getDepositById)
); // GET /api/v1/deposits/:id

// Create deposit request (Authenticated users)
router.post(
  "/",
  auth(),
  createDepositSchema,
  awaitHandlerFactory(depositController.createDeposit)
); // POST /api/v1/deposits

// Confirm deposit (Admin only)
router.patch(
  "/:id/confirm",
  auth('Admin'),
  confirmDepositSchema,
  awaitHandlerFactory(depositController.confirmDeposit)
); // PATCH /api/v1/deposits/:id/confirm

module.exports = router;
