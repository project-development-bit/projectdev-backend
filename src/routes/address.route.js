const express = require("express");
const router = express.Router();
const addressController = require("../controllers/address.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");
const { body } = require("express-validator");

// Validation middleware
const createAddressSchema = [
  body("currency")
    .exists()
    .withMessage("Currency is required")
    .isString()
    .isLength({ min: 2, max: 10 })
    .withMessage("Currency must be between 2 and 10 characters"),
  body("address")
    .exists()
    .withMessage("Address is required")
    .isString()
    .isLength({ min: 10, max: 128 })
    .withMessage("Address must be between 10 and 128 characters")
    .trim(),
  body("label")
    .optional()
    .isString()
    .isLength({ max: 64 })
    .withMessage("Label must not exceed 64 characters")
    .trim(),
];

const updateAddressSchema = [
  body("label")
    .optional()
    .isString()
    .isLength({ max: 64 })
    .withMessage("Label must not exceed 64 characters")
    .trim(),
  body("address")
    .optional()
    .isString()
    .isLength({ min: 10, max: 128 })
    .withMessage("Address must be between 10 and 128 characters")
    .trim(),
];

// Get all addresses for current user
router.get(
  "/",
  auth(),
  awaitHandlerFactory(addressController.getUserAddresses)
); // GET /api/v1/addresses

// Get single address by ID
router.get(
  "/:id",
  auth(),
  awaitHandlerFactory(addressController.getAddressById)
); // GET /api/v1/addresses/:id

// Create new address
router.post(
  "/",
  createAddressSchema,
  auth(),
  awaitHandlerFactory(addressController.createAddress)
); // POST /api/v1/addresses

// Update address
router.patch(
  "/:id",
  updateAddressSchema,
  auth(),
  awaitHandlerFactory(addressController.updateAddress)
); // PATCH /api/v1/addresses/:id

// Delete address
router.delete(
  "/:id",
  auth(),
  awaitHandlerFactory(addressController.deleteAddress)
); // DELETE /api/v1/addresses/:id

module.exports = router;
