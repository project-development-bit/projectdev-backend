const CountryModel = require("../models/country.model");
const HttpException = require("../utils/HttpException.utils");

class CountryController {
  //Get list of countries
  getCountries = async (req, res, next) => {
    try {
      const { active } = req.query;

      // Build query parameters
      const params = {};

      // If active param is provided, parse it
      if (active !== undefined) {
        // Parse string boolean values
        params.is_active = active === "true" || active === "1";
      } else {
        // Default: only return active countries
        params.is_active = true;
      }

      let countries;
      try {
        countries = await CountryModel.find(params);
      } catch (dbError) {
        // Database connection or query error
        throw new HttpException(500, "Database error occurred while fetching countries");
      }

      res.status(200).json({
        success: true,
        message: "Countries retrieved successfully",
        data: countries,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new CountryController();
