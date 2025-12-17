const FortuneWheelModel = require("../models/fortuneWheel.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");

class FortuneWheelController {
  //Validate express-validator results
  checkValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new HttpException(400, "Validation failed", errors.array());
    }
  };

  //Get all active fortune wheel rewards
  getWheelConfig = async (req, res, next) => {
    try {
      const rewards = await FortuneWheelModel.getActiveRewards();

      res.status(200).json({
        success: true,
        data:rewards,
      });

    } catch (error) {
      next(error);
    }
  };

  getWheelStatus = async (req, res, next) => {
    try {
      if(!req.currentUser || !req.currentUser.id) {
        throw new HttpException(401, "Unauthorized");
      }

      const userId = req.currentUser.id;

      // Get spin statistics
      const todaySpinCount = await FortuneWheelModel.getTodaySpinCount(userId);
      const dailyLimit = await FortuneWheelModel.getDailySpinLimit(userId);
      const remainingSpins = Math.max(0, dailyLimit - todaySpinCount);
      const canSpin = remainingSpins > 0;

      res.status(200).json({
        success: true,
        data: {
          canSpin,
          todaySpins: todaySpinCount,
          dailyLimit,
          remainingSpins
        }
      });

    } catch (error) {
      next(error);
    }
  };

  //Process a daily fortune wheel spin
  spinWheel = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const userId = req.currentUser.id;
      const ip = req.ip || req.connection?.remoteAddress || null;
      const deviceFingerprint = req.body?.deviceFingerprint || null;

      // Process the spin
      const spinResult = await FortuneWheelModel.processSpin(userId, ip, deviceFingerprint);

      // Format success message based on reward type
      let message = "";
      if (spinResult.reward_coins > 0) {
        message = `Congratulations! You won ${spinResult.reward_coins} coins!`;
      } else if (spinResult.reward_usd > 0) {
        message = `Congratulations! You won $${spinResult.reward_usd} cash!`;
      } else {
        message = `You got: ${spinResult.label}`;
      }

      res.status(200).json({
        success: true,
        message,
        data: spinResult
      });

    } catch (error) {
      // Handle specific errors
      if (error.message === "ALREADY_SPUN_TODAY") {
        // Get spin info for better error message
        const todaySpins = await FortuneWheelModel.getTodaySpinCount(req.currentUser.id);
        const dailyLimit = await FortuneWheelModel.getDailySpinLimit(req.currentUser.id);

        next(new HttpException(403, "Daily spin limit reached", {
          code: 'ALREADY_SPUN_TODAY',
          message: `You have used all ${dailyLimit} of your daily spins (${todaySpins}/${dailyLimit}). Come back tomorrow or level up to get more spins!`,
          todaySpins,
          dailyLimit
        }));
      } else if (error.message === "NO_REWARDS_CONFIGURED") {
        next(new HttpException(500, "Wheel configuration error", {
          code: 'NO_REWARDS_CONFIGURED',
          message: "Fortune wheel is not configured properly. Please contact support."
        }));
      } else {
        next(error);
      }
    }
  };


  //Get user's spin history
  getSpinHistory = async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const limit = parseInt(req.query.limit) || 10;

      const history = await FortuneWheelModel.getUserSpinHistory(userId, limit);

      res.status(200).json({
        success: true,
        data: history
      });

    } catch (error) {
      next(error);
    }
  };
}

module.exports = new FortuneWheelController();
