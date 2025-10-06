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
];

exports.updateUserSchema = [
  body("username")
    .optional()
    .isLength({ min: 3 })
    .withMessage("Must be at least 3 chars long"),
  body("first_name")
    .optional()
    .isAlpha()
    .withMessage("Must be only alphabetical chars")
    .isLength({ min: 3 })
    .withMessage("Must be at least 3 chars long"),
  body("last_name")
    .optional()
    .isAlpha()
    .withMessage("Must be only alphabetical chars")
    .isLength({ min: 3 })
    .withMessage("Must be at least 3 chars long"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Must be a valid email")
    .normalizeEmail(),
  body("role")
    .optional()
    .isIn([Role.Admin, Role.SuperUser])
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
  body("age").optional().isNumeric().withMessage("Must be a number"),
  body()
    .custom((value) => {
      return !!Object.keys(value).length;
    })
    .withMessage("Please provide required field to update")
    .custom((value) => {
      const updates = Object.keys(value);
      const allowUpdates = [
        "username",
        "password",
        "confirm_password",
        "email",
        "role",
        "first_name",
        "last_name",
        "age",
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
];

exports.validateForgotPassword = [
  body("email")
    .exists()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email"),
];

exports.validateRegister = [
  body("member_id")
    .exists()
    .withMessage("Member ID is required")
    .isLength({ min: 3 })
    .withMessage("Member ID is required must be at least 3 chars long"),
  body("email")
    .exists()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Email must be a valid email"),
  // .normalizeEmail(),
  body("dob")
    .exists()
    .withMessage("Date of birth is required")
    .notEmpty()
    .withMessage("Date of birth must be filled"),
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
