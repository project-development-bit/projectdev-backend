const { body } = require("express-validator");

//Validation schema for fortune wheel spin request
exports.spinWheelSchema = [
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
    .isLength({ max: 255 })
    .withMessage("Device fingerprint must not exceed 255 characters")
];
