const EarningsModel = require("../models/earnings.model");
const HttpException = require("../utils/HttpException.utils");

class EarningsController {
  //Get earnings history with filters
  getEarningsHistory = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      // Extract query parameters
      const {
        days = 30,
        page = 1,
        limit = 20,
        category = null, // 'app', 'survey', or null for all
      } = req.query;

      // Validate parameters
      const daysNum = Math.max(1, Math.min(365, parseInt(days) || 30));
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

      const options = {
        days: daysNum,
        page: pageNum,
        limit: limitNum,
        category: category || null,
      };

      const result = await EarningsModel.getEarningsHistory(user.id, options);

      res.status(200).json({
        success: true,
        message: "Earnings history retrieved successfully",
        data: {
          earnings: result.earnings,
          pagination: result.pagination,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  //Get earnings statistics by category
  getEarningsStatistics = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      // Extract query parameters
      const { days = 30 } = req.query;

      // Validate days parameter
      const daysNum = Math.max(1, Math.min(365, parseInt(days) || 30));

      const options = {
        days: daysNum,
      };

      const statistics = await EarningsModel.getEarningsStatistics(
        user.id,
        options
      );

      res.status(200).json({
        success: true,
        message: "Earnings statistics retrieved successfully",
        data: statistics,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new EarningsController();
