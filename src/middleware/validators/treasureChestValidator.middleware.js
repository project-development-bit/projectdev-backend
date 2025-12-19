const { body } = require("express-validator");

exports.openChestSchema = [
  // body("turnstileToken")
  //   .optional()
  //   .isString()
  //   .withMessage("Turnstile token must be a string"),

  body("deviceFingerprint")
    .optional()
    .isString()
    .withMessage("Device fingerprint must be a string")
    .isLength({ max: 255 })
    .withMessage("Device fingerprint must not exceed 255 characters")
];
