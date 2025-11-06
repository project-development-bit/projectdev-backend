const { body } = require("express-validator");

/**
 * Validation schema for creating a contact us submission
 */
exports.createContactSchema = [
  body("name")
    .exists()
    .withMessage("Name is required")
    .notEmpty()
    .withMessage("Name cannot be empty")
    .isLength({ min: 2, max: 255 })
    .withMessage("Name must be between 2 and 255 characters")
    .trim()
    .escape(),

  body("email")
    .exists()
    .withMessage("Email is required")
    .notEmpty()
    .withMessage("Email cannot be empty")
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage("Email must not exceed 255 characters"),

  body("phone")
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 50 })
    .withMessage("Phone number must not exceed 50 characters")
    .trim()
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage("Phone number contains invalid characters"),

  body("category")
    .exists()
    .withMessage("Category is required")
    .notEmpty()
    .withMessage("Category cannot be empty")
    .isIn(["General Inquiry", "Technical Support", "Billing & Payments", "Feedback", "Bug Report", "Feature Request"])
    .withMessage("Category must be one of: General Inquiry, Technical Support, Billing & Payments, Feedback, Bug Report, Feature Request"),

  body("subject")
    .exists()
    .withMessage("Subject is required")
    .notEmpty()
    .withMessage("Subject cannot be empty")
    .isLength({ min: 5, max: 500 })
    .withMessage("Subject must be between 5 and 500 characters")
    .trim(),

  body("message")
    .exists()
    .withMessage("Message is required")
    .notEmpty()
    .withMessage("Message cannot be empty")
    .isLength({ min: 10, max: 5000 })
    .withMessage("Message must be between 10 and 5000 characters")
    .trim(),

  body("turnstileToken")
    .optional()
    .isString()
    .withMessage("Turnstile token must be a string"),

  // Custom validation to ensure at least required fields are present
  body()
    .custom((value) => {
      const requiredFields = ["name", "email", "category", "subject", "message"];
      const hasAllRequired = requiredFields.every(field => field in value);
      return hasAllRequired;
    })
    .withMessage("Please provide all required fields: name, email, category, subject, message"),
];

/**
 * Validation schema for updating contact status (admin only)
 */
exports.updateContactStatusSchema = [
  body("status")
    .exists()
    .withMessage("Status is required")
    .isIn(["New", "In Progress", "Resolved", "Closed"])
    .withMessage("Status must be one of: New, In Progress, Resolved, Closed"),
];

/**
 * Validation schema for filtering/querying contacts
 */
exports.queryContactSchema = [
  body("category")
    .optional()
    .isIn(["General Inquiry", "Technical Support", "Billing & Payments", "Feedback", "Bug Report", "Feature Request"])
    .withMessage("Invalid category"),

  body("status")
    .optional()
    .isIn(["New", "In Progress", "Resolved", "Closed"])
    .withMessage("Invalid status"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Invalid email format"),

  body("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  body("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];
