const TreasureChestModel = require("../models/treasureChest.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");
const UserRewardsModel = require("../models/userRewards.model");

class TreasureChestController {

  checkValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new HttpException(400, "Validation failed", errors.array());
    }
  };

  getChestStatus = async (req, res, next) => {
    try {
      if (!req.currentUser || !req.currentUser.id) {
        throw new HttpException(401, "Unauthorized");
      }

      const userId = req.currentUser.id;

      // Get user's level and status
      const { level, status } = await TreasureChestModel.getUserLevelAndStatus(userId);

      // Get weekly chest statistics (base + bonus)
      const weeklyLimit = await TreasureChestModel.getWeeklyChestLimit(userId);
      const thisWeekCount = await TreasureChestModel.getThisWeekChestCount(userId);
      const baseChests = Math.max(0, weeklyLimit - thisWeekCount);
      const nextResetAt = TreasureChestModel.getNextWeeklyReset();

      // Get bonus chests from user_rewards

      const bonusChests = await UserRewardsModel.getActiveRewardCount(userId, 'treasure_chest');
      const totalChests = baseChests + bonusChests;
      
      const cooldownResult = await TreasureChestModel.getCooldownResult(userId);

      let cooldownInfo = {
        active: false,
        remainingHours: 0
      };

      if (cooldownResult && cooldownResult.length > 0 && cooldownResult[0].last_opened_at) {
        const lastOpened = new Date(cooldownResult[0].last_opened_at);
        const now = new Date();
        const hoursSinceLastOpen = (now - lastOpened) / (1000 * 60 * 60);
        const COOLDOWN_HOURS = 24;

        if (hoursSinceLastOpen < COOLDOWN_HOURS) {
          cooldownInfo = {
            active: true,
            remainingHours: Math.ceil(COOLDOWN_HOURS - hoursSinceLastOpen)
          };
        }
      }

      // Determine status
      let chestStatus = "available";
      if (totalChests === 0) {
        chestStatus = "no_chest_available";
      } else if (cooldownInfo.active && bonusChests === 0) {
        chestStatus = "cooldown";
      }

      res.status(200).json({
        success: true,
        data: {
          chests: {
            base: baseChests,
            bonus: bonusChests,
            total: totalChests
          },
          status: chestStatus,
          cooldown: cooldownInfo,
          next_reset_at: nextResetAt,
          user_status: status,
          user_level: level,
          weekly_limit: weeklyLimit,
          opened_this_week: thisWeekCount,
        }
      });

    } catch (error) {
      next(error);
    }
  };

   getSpinBonus = async (req, res, next) => {
     const userId = req.currentUser.id;
    const resp = await TreasureChestModel.getBonusTest(userId);
    res.status(200).json({
          success: true,
          data: resp
        });
   }

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
        reward: result.reward,
        chests_remaining: result.chests_remaining
      });

    } catch (error) {

      if (error.message === "COOLDOWN") {
        return res.status(403).json({
          success: false,
          status: 'cooldown',
          message: `Chest is cooling down. Try again in ${error.remainingHours} hour(s).`,
          remainingHours: error.remainingHours
        });
      }

      // Handle no chests available
      if (error.message === "NO_CHEST_AVAILABLE") {
        const weeklyLimit = await TreasureChestModel.getWeeklyChestLimit(req.currentUser.id);
        const thisWeekCount = await TreasureChestModel.getThisWeekChestCount(req.currentUser.id);
        const nextResetAt = TreasureChestModel.getNextWeeklyReset();

        return res.status(403).json({
          success: false,
          status: 'no_chest_available',
          message: `You have used all ${weeklyLimit} of your weekly treasure chests (${thisWeekCount}/${weeklyLimit}). Next reset: ${nextResetAt}`,
          thisWeekCount,
          weeklyLimit,
          nextResetAt
        });
      }

      // Handle max reward limit reached
      if (error.message === "MAX_REWARD_LIMIT") {
        return res.status(403).json({
          success: false,
          status: 'max_reward_limit',
          message: 'You have reached the weekly limit for this reward. Try again later.'
        });
      }

      // Handle configuration errors
      if (error.message === "NO_REWARDS_CONFIGURED") {
        return res.status(500).json({
          success: false,
          status: 'configuration_error',
          message: "Treasure chest is not configured properly. Please contact support."
        });
      }

      // Handle all other unexpected errors (don't leak internal details)
      console.error('Treasure chest error:', error);
      return res.status(500).json({
        success: false,
        status: 'error',
        message: 'An error occurred while opening the chest. Please try again later.'
      });
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
