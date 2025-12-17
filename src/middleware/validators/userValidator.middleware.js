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
    .withMessage("Must be a valid email"),
  body("role")
    .optional()
    .isIn([Role.Admin, Role.SuperUser, Role.NormalUser, Role.Dev])
    .withMessage("Invalid Role type"),
  body("password")
    .exists()
    .withMessage("Password is required")
    .notEmpty()
    .withMessage("Password must not be empty")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^\S+$/)
    .withMessage("Password must not contain spaces")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]/)
    .withMessage("Password must contain at least one special character"),
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
    .exists()
    .withMessage("Password is required")
    .notEmpty()
    .withMessage("Password must not be empty")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^\S+$/)
    .withMessage("Password must not contain spaces")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]/)
    .withMessage("Password must contain at least one special character")
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
    .withMessage("Current email must be a valid email"),
  body("new_email")
    .exists()
    .withMessage("New email is required")
    .isEmail()
    .withMessage("New email must be a valid email"),
  body("repeat_new_email")
    .exists()
    .withMessage("Repeat new email is required")
    .isEmail()
    .withMessage("Repeat new email must be a valid email")
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
    .matches(/^\S+$/)
    .withMessage("Password must not contain spaces")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]/)
    .withMessage("Password must contain at least one special character"),
  body("repeat_new_password")
    .exists()
    .withMessage("Repeat new password is required")
    .notEmpty()
    .withMessage("Repeat new password must not be empty")
    .custom((value, { req }) => value === req.body.new_password)
    .withMessage("Repeat new password must match new password"),
];

exports.validateSecurityPinToggle = [
  body("security_pin")
    .exists()
    .withMessage("Security PIN is required")
    .notEmpty()
    .withMessage("Security PIN must not be empty")
    .isLength({ min: 4, max: 4 })
    .withMessage("Security PIN must be exactly 4 digits")
    .matches(/^\d{4}$/)
    .withMessage("Security PIN must contain only digits"),
  body("enable")
    .exists()
    .withMessage("enable field is required")
    .isBoolean()
    .withMessage("enable must be a boolean (true or false)"),
];

exports.validateVerifyUser = [
  body("email")
    .exists()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email"),
  body("security_code")
    .exists()
    .withMessage("Security code is required")
    .notEmpty()
    .withMessage("Security code must not be empty"),
];

exports.validateVerifyForgotPassword = [
  body("email")
    .exists()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email"),
  body("security_code")
    .exists()
    .withMessage("Security code is required")
    .notEmpty()
    .withMessage("Security code must not be empty"),
];

exports.validateVerifyEmailChange = [
  body("new_email")
    .exists()
    .withMessage("New email is required")
    .isEmail()
    .withMessage("Must be a valid email"),
  body("verification_code")
    .exists()
    .withMessage("Verification code is required")
    .notEmpty()
    .withMessage("Verification code must not be empty"),
];

exports.validateVerifySecurityPin = [
  body("security_pin")
    .exists()
    .withMessage("Security PIN is required")
    .notEmpty()
    .withMessage("Security PIN must not be empty")
    .isLength({ min: 4, max: 4 })
    .withMessage("Security PIN must be exactly 4 digits")
    .matches(/^\d{4}$/)
    .withMessage("Security PIN must contain only digits"),
];

exports.validateVerifyDeleteAccount = [
  body("verification_code")
    .exists()
    .withMessage("Verification code is required")
    .notEmpty()
    .withMessage("Verification code must not be empty"),
];

exports.validateGoogleSignup = [
  body("idToken")
    .exists()
    .withMessage("Firebase ID token is required")
    .notEmpty()
    .withMessage("Firebase ID token must not be empty")
    .isString()
    .withMessage("Firebase ID token must be a string"),
  body("referral_code")
    .optional()
    .isString()
    .withMessage("Referral code must be a string"),
  body("country_code")
    .optional()
    .isString()
    .withMessage("Country code must be a string")
    .isLength({ min: 2, max: 2 })
    .withMessage("Country code must be exactly 2 characters"),
];

exports.validateGoogleSignin = [
  body("idToken")
    .exists()
    .withMessage("Firebase ID token is required")
    .notEmpty()
    .withMessage("Firebase ID token must not be empty")
    .isString()
    .withMessage("Firebase ID token must be a string"),
];
