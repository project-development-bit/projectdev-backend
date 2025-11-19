const { body } = require("express-validator");
const Role = require("../../utils/userRoles.utils");

exports.createUserSchema = [
  body("name")
    .exists()
    .withMessage("Name is required")
    .isLength({ min: 3 })
    .withMessage("Must be at least 3 chars long"),
  body("email")
    .exists()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email")
    .normalizeEmail(),
  body("role")
    .optional()
    .isIn([Role.Admin, Role.SuperUser, Role.NormalUser, Role.Dev])
    .withMessage("Invalid Role type"),
  body("password")
    .exists()
    .withMessage("Password is required")
    .notEmpty()
    .isLength({ min: 6 })
    .withMessage("Password must contain at least 6 characters")
    .isLength({ max: 10 })
    .withMessage("Password can contain max 10 characters"),
  body("confirm_password")
    .exists()
    .custom((value, { req }) => value === req.body.password)
    .withMessage(
      "confirm_password field must have the same value as the password field"
    ),
  body("interest_enable")
    .optional()
    .isBoolean()
    .withMessage("interest_enable must be a boolean (true/false)")
    .toBoolean(),
  // body("recaptchaToken")
  //   .exists()
  //   .withMessage("reCAPTCHA token is required")
  //   .notEmpty()
  //   .withMessage("reCAPTCHA token must not be empty"),
];

exports.updateUserSchema = [
  body("name")
    .optional()
    .isLength({ min: 3 })
    .withMessage("Must be at least 3 chars long"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Must be a valid email")
    .normalizeEmail(),
  body("password")
    .optional()
    .notEmpty()
    .isLength({ min: 6 })
    .withMessage("Password must contain at least 6 characters")
    .isLength({ max: 10 })
    .withMessage("Password can contain max 10 characters")
    .custom((value, { req }) => !!req.body.confirm_password)
    .withMessage("Please confirm your password"),
  body("confirm_password")
    .optional()
    .custom((value, { req }) => value === req.body.password)
    .withMessage(
      "confirm_password field must have the same value as the password field"
    ),
  body("country_id")
    .optional()
    .isInt()
    .withMessage("Country ID must be an integer"),
  body("language")
    .optional()
    .isLength({ max: 5 })
    .withMessage("Language code must be max 5 characters"),
  body("interest_enable")
    .optional()
    .isBoolean()
    .withMessage("interest_enable must be a boolean (true/false)")
    .toBoolean(),
  body("show_onboarding")
    .optional()
    .isBoolean()
    .withMessage("show_onboarding must be a boolean (true/false)")
    .toBoolean(),
  body("notifications_enabled")
    .optional()
    .isBoolean()
    .withMessage("notifications_enabled must be a boolean (true/false)")
    .toBoolean(),
  body("show_stats_enabled")
    .optional()
    .isBoolean()
    .withMessage("show_stats_enabled must be a boolean (true/false)")
    .toBoolean(),
  body("anonymous_in_contests")
    .optional()
    .isBoolean()
    .withMessage("anonymous_in_contests must be a boolean (true/false)")
    .toBoolean(),
  body("security_pin_enabled")
    .optional()
    .isBoolean()
    .withMessage("security_pin_enabled must be a boolean (true/false)")
    .toBoolean(),
];

exports.validateLogin = [
  body("email")
    .exists()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email"),
  // .normalizeEmail(),
  body("password")
    .exists()
    .withMessage("Password is required")
    .notEmpty()
    .withMessage("Password must be filled"),
  // body("recaptchaToken")
  //   .exists()
  //   .withMessage("reCAPTCHA token is required")
  //   .notEmpty()
  //   .withMessage("reCAPTCHA token must not be empty"),
];

exports.validateEmail = [
  body("email")
    .exists()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email"),
  // body("recaptchaToken")
  //   .exists()
  //   .withMessage("reCAPTCHA token is required")
  //   .notEmpty()
  //   .withMessage("reCAPTCHA token must not be empty"),
];

exports.validatePassword = [
  body("email")
    .exists()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must contain at least 6 characters")
    .custom((value, { req }) => !!req.body.confirm_password)
    .withMessage("Confirm password is required"),
  body("confirm_password")
    .custom((value, { req }) => value === req.body.password)
    .withMessage(
      "Confirm Password field must have the same value as the password field"
    ),
];

exports.validateTerms = [
  body("accept_terms_and_conditions")
    .exists()
    .withMessage("terms and conditions is required")
    .isNumeric()
    .withMessage("Must be a number")
    .isLength({ max: 1 })
    .withMessage("Must be not greater tha 1 chars long"),
];

exports.validateRefreshToken = [
  body("refreshToken")
    .exists()
    .withMessage("Refresh token is required")
    .isString()
    .withMessage("Refresh token must be a string")
    .notEmpty()
    .withMessage("Refresh token must not be empty")
];