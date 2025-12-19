const TreasureChestModel = require("../models/treasureChest.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");

class TreasureChestController {

  checkValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new HttpException(400, "Validation failed", errors.array());
    }
  };

  //Returns user's chest availability status
  getChestStatus = async (req, res, next) => {
    try {
      if (!req.currentUser || !req.currentUser.id) {
        throw new HttpException(401, "Unauthorized");
      }

      const userId = req.currentUser.id;

      // Get user's level and status
      const { level, status } = await TreasureChestModel.getUserLevelAndStatus(userId);

      // Get weekly chest statistics
      const weeklyLimit = await TreasureChestModel.getWeeklyChestLimit(userId);
      const thisWeekCount = await TreasureChestModel.getThisWeekChestCount(userId);
      const availableChests = Math.max(0, weeklyLimit - thisWeekCount);
      const nextResetAt = TreasureChestModel.getNextWeeklyReset();

      // Determine status
      let chestStatus = "available";
      if (availableChests === 0) {
        chestStatus = "no_chest_available";
      }

      res.status(200).json({
        success: true,
        data: {
          available_chests: availableChests,
          status: chestStatus,
          next_reset_at: nextResetAt,
          user_status: status,
          user_level: level,
          weekly_limit: weeklyLimit,
          opened_this_week: thisWeekCount
        }
      });

    } catch (error) {
      next(error);
    }
  };

  //Opens a treasure chest and returns the reward
  openChest = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const userId = req.currentUser.id;
      const ip = req.ip || req.connection?.remoteAddress || null;
      const deviceFingerprint = req.body?.deviceFingerprint || null;

      // Process the chest opening
      const result = await TreasureChestModel.openChest(userId, ip, deviceFingerprint);

      // Format success message based on reward type
      let message = "";
      if (result.reward.type === 'coins') {
        message = `Congratulations! You won ${result.reward.value} coins!`;
      } else if (result.reward.type === 'extra_spin') {
        message = `Congratulations! You won ${result.reward.value} extra spins!`;
      } else if (result.reward.type === 'offer_boost') {
        message = `Congratulations! You got an Offer Boost of ${result.reward.value}% for 24 hours!`;
      } else if (result.reward.type === 'ptc_discount') {
        message = `Congratulations! You got a PTC Discount of ${result.reward.value}%!`;
      } else {
        message = `You got: ${result.reward.label}`;
      }

      res.status(200).json({
        success: true,
        message,
        reward: result.reward
      });

    } catch (error) {
      // Handle specific errors
      if (error.message === "NO_CHEST_AVAILABLE") {
        const weeklyLimit = await TreasureChestModel.getWeeklyChestLimit(req.currentUser.id);
        const thisWeekCount = await TreasureChestModel.getThisWeekChestCount(req.currentUser.id);
        const nextResetAt = TreasureChestModel.getNextWeeklyReset();

        next(new HttpException(403, "Treasure Chest Unavailable", {
          code: 'NO_CHEST_AVAILABLE',
          status: 'no_chest_available',
          message: `You have used all ${weeklyLimit} of your weekly treasure chests (${thisWeekCount}/${weeklyLimit}). Next reset: ${nextResetAt}`,
          thisWeekCount,
          weeklyLimit,
          nextResetAt
        }));
      } else if (error.message === "NO_REWARDS_CONFIGURED") {
        next(new HttpException(500, "Chest configuration error", {
          code: 'NO_REWARDS_CONFIGURED',
          message: "Treasure chest is not configured properly. Please contact support."
        }));
      } else {
        next(error);
      }
    }
  };

  //Returns user's chest opening history
  getChestHistory = async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const limit = parseInt(req.query.limit) || 10;

      const history = await TreasureChestModel.getUserChestHistory(userId, limit);

      res.status(200).json({
        success: true,
        data: history
      });

    } catch (error) {
      next(error);
    }
  };
}

module.exports = new TreasureChestController();
