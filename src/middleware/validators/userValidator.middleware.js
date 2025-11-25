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
    .isInt({ min: 0, max: 1 })
    .withMessage("interest_enable must be 0 or 1"),
  // body("recaptchaToken")
  //   .exists()
  //   .withMessage("reCAPTCHA token is required")
  //   .notEmpty()
  //   .withMessage("reCAPTCHA token must not be empty"),
  body("device_fingerprint")
    .optional()
    .isString()
    .withMessage("Device fingerprint must be a string")
    .isLength({ min: 1, max: 255 })
    .withMessage("Device fingerprint must be between 1-255 characters"),
  body("user_agent")
    .optional()
    .isString()
    .withMessage("User agent must be a string")
    .isLength({ max: 255 })
    .withMessage("User agent must not exceed 255 characters"),
  body("country_code")
    .optional()
    .isString()
    .withMessage("Country code must be a string")
    .isLength({ min: 2, max: 2 })
    .withMessage("Country code must be exactly 2 characters (ISO 3166-1 alpha-2)")
    .matches(/^[A-Z]{2}$/i)
    .withMessage("Country code must contain only letters")
    .toUpperCase(),  
];

exports.updateUserSchema = [
  body("name")
    .optional()
    .isLength({ min: 3 })
    .withMessage("Must be at least 3 chars long"),
  body("country_id")
    .optional()
    .isInt()
    .withMessage("Country ID must be an integer"),
  body("language")
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage("Language code must be between 2-5 characters")
    .matches(/^[a-zA-Z]{2,5}$/)
    .withMessage("Language code must contain only letters "),
  body("notifications_enabled")
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage("notifications_enabled must be 0 or 1"),
  body("show_stats_enabled")
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage("show_stats_enabled must be 0 or 1"),
  body("anonymous_in_contests")
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage("anonymous_in_contests must be 0 or 1"),
  body("security_pin_enabled")
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage("security_pin_enabled must be 0 or 1"),
  body("interest_enable")
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage("interest_enable must be 0 or 1"),
  body("show_onboarding")
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage("show_onboarding must be 0 or 1"),
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
  body("device_fingerprint")
    .optional()
    .isString()
    .withMessage("Device fingerprint must be a string")
    .isLength({ min: 1, max: 255 })
    .withMessage("Device fingerprint must be between 1-255 characters"),
  body("user_agent")
    .optional()
    .isString()
    .withMessage("User agent must be a string")
    .isLength({ max: 255 })
    .withMessage("User agent must not exceed 255 characters"),
  body("country_code")
    .optional()
    .isString()
    .withMessage("Country code must be a string")
    .isLength({ min: 2, max: 2 })
    .withMessage("Country code must be exactly 2 characters (ISO 3166-1 alpha-2)")
    .matches(/^[A-Z]{2}$/i)
    .withMessage("Country code must contain only letters")
    .toUpperCase(),
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
    .withMessage("Refresh token must not be empty"),
];

exports.validateEmailChange = [
  body("current_email")
    .exists()
    .withMessage("Current email is required")
    .isEmail()
    .withMessage("Current email must be a valid email")
    .normalizeEmail(),
  body("new_email")
    .exists()
    .withMessage("New email is required")
    .isEmail()
    .withMessage("New email must be a valid email")
    .normalizeEmail(),
  body("repeat_new_email")
    .exists()
    .withMessage("Repeat new email is required")
    .isEmail()
    .withMessage("Repeat new email must be a valid email")
    .normalizeEmail()
    .custom((value, { req }) => value === req.body.new_email)
    .withMessage("Repeat new email must match new email"),
];

exports.validatePasswordChange = [
  body("current_password")
    .exists()
    .withMessage("Current password is required")
    .notEmpty()
    .withMessage("Current password must not be empty"),
  body("new_password")
    .exists()
    .withMessage("New password is required")
    .notEmpty()
    .withMessage("New password must not be empty")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number"),
  body("repeat_new_password")
    .exists()
    .withMessage("Repeat new password is required")
    .notEmpty()
    .withMessage("Repeat new password must not be empty")
    .custom((value, { req }) => value === req.body.new_password)
    .withMessage("Repeat new password must match new password"),
];
