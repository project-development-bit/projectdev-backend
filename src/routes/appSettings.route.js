const express = require("express");
const router = express.Router();
const appSettingsController = require("../controllers/appSettings.controller");
const auth = require("../middleware/auth.middleware");
const Role = require("../utils/userRoles.utils");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");

const {
  createSettingSchema,
  updateSettingSchema,
} = require("../middleware/validators/appSettingsValidator.middleware");

// Get all app settings (Admin only)
router.get(
  "/",
  awaitHandlerFactory(appSettingsController.getAllSettings)
); // GET /api/v1/app-settings

// Get app setting by ID 
router.get(
  "/id/:id",
  awaitHandlerFactory(appSettingsController.getSettingById)
); // GET /api/v1/app-settings/id/1

// Create new app setting (Admin only)
router.post(
  "/",
  auth(Role.Admin),
  createSettingSchema,
  awaitHandlerFactory(appSettingsController.createSetting)
); // POST /api/v1/app-settings

// Update app setting by ID (Admin only)
router.patch(
  "/id/:id",
  auth(Role.Admin),
  updateSettingSchema,
  awaitHandlerFactory(appSettingsController.updateSettingById)
); // PATCH /api/v1/app-settings/id/1

// Delete app setting by ID (Admin only)
router.delete(
  "/id/:id",
  auth(Role.Admin),
  awaitHandlerFactory(appSettingsController.deleteSettingById)
); // DELETE /api/v1/app-settings/id/1

module.exports = router;
