const express = require("express");
const router = express.Router();
const withdrawalController = require("../controllers/withdrawal.controller");
const auth = require("../middleware/auth.middleware");
const Role = require("../utils/userRoles.utils");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");
const { uploadWithdrawalIcon } = require("../middleware/withdrawalIconUpload.middleware");
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

// Validation middleware for creating withdrawal method (Admin)
const createWithdrawalMethodSchema = [
  body("code")
    .exists()
    .withMessage("Code is required")
    .isString()
    .isLength({ min: 2, max: 10 })
    .withMessage("Code must be between 2 and 10 characters")
    .trim(),
  body("name")
    .exists()
    .withMessage("Name is required")
    .isString()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .trim(),
  body("network")
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage("Network must not exceed 50 characters")
    .trim(),
  body("min_amount_coins")
    .exists()
    .withMessage("Minimum amount is required")
    .isFloat({ min: 0 })
    .withMessage("Minimum amount must be a non-negative number"),
  body("fee_coins")
    .exists()
    .withMessage("Fee is required")
    .isFloat({ min: 0 })
    .withMessage("Fee must be a non-negative number"),
  body("is_enabled")
    .optional()
    .isBoolean()
    .withMessage("is_enabled must be a boolean"),
  body("sort_order")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Sort order must be a non-negative integer"),
];

// Validation middleware for updating withdrawal method (Admin)
const updateWithdrawalMethodSchema = [
  body("code")
    .optional()
    .isString()
    .isLength({ min: 2, max: 10 })
    .withMessage("Code must be between 2 and 10 characters")
    .trim(),
  body("name")
    .optional()
    .isString()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .trim(),
  body("network")
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage("Network must not exceed 50 characters")
    .trim(),
  body("min_amount_coins")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum amount must be a non-negative number"),
  body("fee_coins")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Fee must be a non-negative number"),
  body("is_enabled")
    .optional()
    .isBoolean()
    .withMessage("is_enabled must be a boolean"),
  body("sort_order")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Sort order must be a non-negative integer"),
];


// Get withdrawal options (Public/Authenticated users)
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

// ==================== Admin Routes ====================

// Get withdrawal method by ID (Admin)
router.get(
  "/methods/:id",
  auth(Role.Admin),
  awaitHandlerFactory(withdrawalController.getWithdrawalMethodById)
); // GET /api/v1/withdrawals/methods/:id

// Create withdrawal method (Admin)
router.post(
  "/methods",
  auth(Role.Admin),
  uploadWithdrawalIcon,
  createWithdrawalMethodSchema,
  awaitHandlerFactory(withdrawalController.createWithdrawalMethod)
); // POST /api/v1/withdrawals/methods

// Update withdrawal method (Admin)
router.patch(
  "/methods/:id",
  auth(Role.Admin),
  uploadWithdrawalIcon,
  updateWithdrawalMethodSchema,
  awaitHandlerFactory(withdrawalController.updateWithdrawalMethod)
); // PATCH /api/v1/withdrawals/methods/:id

// Delete withdrawal method (Admin)
router.delete(
  "/methods/:id",
  auth(Role.Admin),
  awaitHandlerFactory(withdrawalController.deleteWithdrawalMethod)
); // DELETE /api/v1/withdrawals/methods/:id

module.exports = router;
