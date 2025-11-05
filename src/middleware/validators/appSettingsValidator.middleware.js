const { body } = require("express-validator");

exports.createSettingSchema = [
  body("config_key")
    .exists()
    .withMessage("config_key is required")
    .isString()
    .withMessage("config_key must be a string")
    .isLength({ min: 1, max: 64 })
    .withMessage("config_key must be between 1 and 64 characters"),
  body("config_data")
    .exists()
    .withMessage("config_data is required")
    .isObject()
    .withMessage("config_data must be a valid JSON object"),
  body("version")
    .optional()
    .isString()
    .withMessage("version must be a string")
    .isLength({ max: 32 })
    .withMessage("version must be max 32 characters"),
];

exports.updateSettingSchema = [
  body("config_key")
    .optional()
    .isString()
    .withMessage("config_key must be a string")
    .isLength({ min: 1, max: 64 })
    .withMessage("config_key must be between 1 and 64 characters"),
  body("config_data")
    .optional()
    .isObject()
    .withMessage("config_data must be a valid JSON object"),
  body("version")
    .optional()
    .isString()
    .withMessage("version must be a string")
    .isLength({ max: 32 })
    .withMessage("version must be max 32 characters"),
  body()
    .custom((value) => {
      return !!Object.keys(value).length;
    })
    .withMessage("Please provide at least one field to update")
    .custom((value) => {
      const updates = Object.keys(value);
      const allowUpdates = ["config_key", "config_data", "version"];
      return updates.every((update) => allowUpdates.includes(update));
    })
    .withMessage("Invalid update fields!"),
];
