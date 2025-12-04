const { body } = require("express-validator");

exports.validate2FASetup = [
  body("token")
    .exists()
    .withMessage("Token is required")
    .notEmpty()
    .withMessage("Token cannot be empty")
    .isLength({ min: 6, max: 6 })
    .withMessage("Token must be 6 digits")
    .isNumeric()
    .withMessage("Token must contain only numbers"),
  body("secret")
    .exists()
    .withMessage("Secret is required")
    .notEmpty()
    .withMessage("Secret cannot be empty")
    .isString()
    .withMessage("Secret must be a string"),
];

exports.validate2FALogin = [
  body("userId")
    .exists()
    .withMessage("User ID is required")
    .notEmpty()
    .withMessage("User ID cannot be empty")
    .isInt()
    .withMessage("User ID must be an integer"),
  body("token")
    .exists()
    .withMessage("Token is required")
    .notEmpty()
    .withMessage("Token cannot be empty")
    .isLength({ min: 6, max: 6 })
    .withMessage("Token must be 6 digits")
    .isNumeric()
    .withMessage("Token must contain only numbers"),
];

exports.validate2FADisable = [
  body("token")
    .exists()
    .withMessage("Token is required")
    .notEmpty()
    .withMessage("Token cannot be empty")
    .isLength({ min: 6, max: 6 })
    .withMessage("Token must be 6 digits")
    .isNumeric()
    .withMessage("Token must contain only numbers"),
];
