const AppSettingsModel = require("../models/appSettings.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");
const fs = require("fs");
const path = require("path");

/******************************************************************************
 *                              App Settings Controller
 ******************************************************************************/
class AppSettingsController {
  //Get all app settings
  getAllSettings = async (req, res, next) => {
    try {
      const settingsList = await AppSettingsModel.find();

      if (!settingsList.length) {
        throw new HttpException(404, "No app settings found");
      }

      // Parse JSON data for all results
      const parsedSettings = settingsList.map(setting => ({
        ...setting,
        config_data: typeof setting.config_data === 'string'
          ? JSON.parse(setting.config_data)
          : setting.config_data
      }));

      res.status(200).json({
        success: true,
        message: "App settings retrieved successfully.",
        data: parsedSettings,
      });
    } catch (error) {
      next(error);
    }
  };


  //Get app setting by ID
  getSettingById = async (req, res, next) => {
    try {
      const setting = await AppSettingsModel.findOne({ id: req.params.id });

      if (!setting) {
        throw new HttpException(404, "App setting not found");
      }

      res.status(200).json({
        success: true,
        message: "App setting retrieved successfully.",
        data: setting,
      });
    } catch (error) {
      next(error);
    }
  };


  //Create a new app setting
  createSetting = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const { config_key, config_data, version } = req.body;

      // Validate that config_data is an object
      if (typeof config_data !== 'object' || Array.isArray(config_data)) {
        throw new HttpException(400, "config_data must be a valid JSON object");
      }

      const settingData = await AppSettingsModel.create({
        config_key,
        config_data,
        version,
      });

      if (!settingData) {
        throw new HttpException(500, "Something went wrong while creating app setting");
      }

      res.status(201).json({
        success: true,
        message: "App setting created successfully.",
        data: settingData,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update app setting by ID
   * @route PATCH /api/v1/app-settings/id/:id
   */
  updateSettingById = async (req, res, next) => {
    try {
      this.checkValidation(req);

      // Validate config_data if provided
      if (req.body.config_data && (typeof req.body.config_data !== 'object' || Array.isArray(req.body.config_data))) {
        throw new HttpException(400, "config_data must be a valid JSON object");
      }

      const result = await AppSettingsModel.update(req.body, req.params.id);

      if (!result) {
        throw new HttpException(500, "Something went wrong");
      }

      const { affectedRows, changedRows } = result;

      if (!affectedRows) {
        throw new HttpException(404, "App setting not found");
      }

      const message = affectedRows && changedRows
        ? "App setting updated successfully"
        : "No changes made";

      res.status(200).json({
        success: true,
        message: message,
      });
    } catch (error) {
      next(error);
    }
  };

  //Delete app setting by ID
  deleteSettingById = async (req, res, next) => {
    try {
      const result = await AppSettingsModel.delete(req.params.id);

      if (!result) {
        throw new HttpException(404, "App setting not found");
      }

      res.status(200).json({
        success: true,
        message: "App setting deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  };

  // Get translation JSON file by language code
  getLocale = async (req, res, next) => {
    try {
      const { lang } = req.params;

      // Validate language code (alphanumeric and hyphens only, max 10 chars)
      const langRegex = /^[a-zA-Z0-9-]{2,10}\.json$/;
      if (!langRegex.test(lang)) {
        throw new HttpException(400, "Invalid language code format");
      }

      // Construct the file path
      const localeFilePath = path.join(
        __dirname,
        "../../translation/output",
        `${lang}`
      );

      // Check if file exists
      if (!fs.existsSync(localeFilePath)) {
        throw new HttpException(404, `Translation file for language '${lang}' not found`);
      }

      // Read and parse the file
      const fileContent = fs.readFileSync(localeFilePath, "utf8");
      const translations = JSON.parse(fileContent);

      res.status(200).json(translations);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return next(new HttpException(500, "Invalid translation file format"));
      }

      next(error);
    }
  };

  /**
   * Validation helper
   */
  checkValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new HttpException(
        400,
        "Validation failed. Please check your input fields.",
        errors
      );
    }
  };
}

/******************************************************************************
 *                               Export
 ******************************************************************************/
module.exports = new AppSettingsController();
