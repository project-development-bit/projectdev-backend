const express = require("express");
const router = express.Router();
const withdrawalController = require("../controllers/withdrawal.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");
const { body } = require("express-validator");

// Validation middleware for withdrawal request
const createWithdrawalSchema = [
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
  body("address")
    .exists()
    .withMessage("Withdrawal address is required")
    .isString()
    .isLength({ min: 10, max: 128 })
    .withMessage("Address must be between 10 and 128 characters")
    .trim(),
  body("fee")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Fee must be a non-negative number"),
  body("payoutProvider")
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage("Payout provider must not exceed 50 characters")
    .trim(),
  body("txid")
    .optional()
    .isString()
    .isLength({ max: 128 })
    .withMessage("Transaction ID must not exceed 128 characters")
    .trim(),
];

// Validation middleware for confirming withdrawal
const confirmWithdrawalSchema = [
  body("status")
    .exists()
    .withMessage("Status is required")
    .isIn(['sent', 'failed'])
    .withMessage("Status must be either 'sent' or 'failed'"),
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

// Create withdrawal request (Authenticated users)
router.post(
  "/",
  auth(),
  createWithdrawalSchema,
  awaitHandlerFactory(withdrawalController.createWithdrawal)
); // POST /api/v1/withdrawals

// Cancel withdrawal
router.delete(
  "/:id",
  auth(),
  awaitHandlerFactory(withdrawalController.cancelWithdrawal)
); // DELETE /api/v1/withdrawals/:id

// Confirm withdrawal - Update status (Admin only)
router.patch(
  "/:id/confirm",
  auth('Admin'),
  confirmWithdrawalSchema,
  awaitHandlerFactory(withdrawalController.confirmWithdrawal)
); // PATCH /api/v1/withdrawals/:id/confirm

module.exports = router;
