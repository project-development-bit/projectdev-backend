const { body, query } = require("express-validator");

//Validation schema for faucet claim request
exports.claimFaucetSchema = [
  body("turnstileToken")
    .exists()
    .withMessage("Turnstile token is required")
    .notEmpty()
    .withMessage("Turnstile token cannot be empty")
    .isString()
    .withMessage("Turnstile token must be a string"),

  body("deviceFingerprint")
    .optional()
    .isString()
    .withMessage("Device fingerprint must be a string")
    .isLength({ max: 64 })
    .withMessage("Device fingerprint must not exceed 64 characters")
];

