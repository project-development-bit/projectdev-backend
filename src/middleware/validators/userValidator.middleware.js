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
  body("role")
    .optional()
    .isIn([Role.Admin, Role.SuperUser, Role.NormalUser, Role.Dev])
    .withMessage("Invalid Role type"),
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
  body("country")
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage("Country code must be 2 characters"),
  body("language")
    .optional()
    .isLength({ max: 5 })
    .withMessage("Language code must be max 5 characters"),
  body()
    .custom((value) => {
      return !!Object.keys(value).length;
    })
    .withMessage("Please provide required field to update")
    .custom((value) => {
      const updates = Object.keys(value);
      const allowUpdates = [
        "name",
        "password",
        "confirm_password",
        "email",
        "role",
        "country",
        "language",
      ];
      return updates.every((update) => allowUpdates.includes(update));
    })
    .withMessage("Invalid updates!"),
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