const express = require("express");
const router = express.Router();
const contactUsController = require("../controllers/contactUs.controller");
const auth = require("../middleware/auth.middleware");
const Role = require("../utils/userRoles.utils");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");
const verifyTurnstile = require("../middleware/turnstile.middleware");
const rateLimit = require("express-rate-limit");

const {
  createContactSchema,
  updateContactStatusSchema,
} = require("../middleware/validators/contactUsValidator.middleware");

// Rate limiter for contact form submissions
const contactFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Max 3 submissions per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by IP address using the proper helper for IPv6 compatibility
    return `ip:${rateLimit.ipKeyGenerator(req)}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many contact form submissions. Please try again after 15 minutes.",
      code: "TOO_MANY_REQUESTS",
    });
  },
});

// Public route - Create contact submission
// POST /api/v1/contact
router.post(
  "/",
  contactFormLimiter, // Rate limiting to prevent spam
  createContactSchema, // Validation
  verifyTurnstile({ expectedAction: "contact_us", includeRemoteIp: true }), // Bot protection
  awaitHandlerFactory(contactUsController.createContact) // Controller
);

// Admin routes - Protected with authentication and role check

// GET /api/v1/contact - Get all contact submissions with pagination
router.get(
  "/",
  auth(Role.Admin), // Only admins can view submissions
  awaitHandlerFactory(contactUsController.getAllContacts)
);

// GET /api/v1/contact/:id - Get single contact submission by ID
router.get(
  "/:id",
  auth(Role.Admin), // Only admins can view submissions
  awaitHandlerFactory(contactUsController.getContactById)
);

// PATCH /api/v1/contact/:id - Update contact submission status
router.patch(
  "/:id",
  auth(Role.Admin), // Only admins can update status
  updateContactStatusSchema, // Validation
  awaitHandlerFactory(contactUsController.updateContactStatus)
);

// DELETE /api/v1/contact/:id - Delete contact submission
router.delete(
  "/:id",
  auth(Role.Admin), // Only admins can delete submissions
  awaitHandlerFactory(contactUsController.deleteContact)
);

module.exports = router;
