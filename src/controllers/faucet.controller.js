const FaucetModel = require("../models/faucet.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");

class FaucetController {
  //Validate express-validator results
  checkValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new HttpException(400, "Validation failed", errors.array());
    }
  };

  //Get faucet status for authenticated user
  getFaucetStatus = async (req, res, next) => {
    try {
      const userId = req.currentUser.id;

      const status = await FaucetModel.getFaucetStatus(userId);

      res.status(200).json({
        success: true,
        data: status
      });

    } catch (error) {
      next(error);
    }
  };

  //Claim faucet reward
  claimFaucet = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const userId = req.currentUser.id;
      const ip = req.ip || req.connection?.remoteAddress || null;
      const deviceFingerprint = req.body.deviceFingerprint || null;

      // Check if user can claim
      const { canClaim, nextClaimAt, remainingMs } = await FaucetModel.canUserClaim(userId);

      if (!canClaim) {
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

        throw new HttpException(
          429,
          `Cooldown active. Please wait ${hours}h ${minutes}m ${seconds}s`,
          {
            code: 'FAUCET_COOLDOWN_ACTIVE',
            nextClaimAt,
            remainingMs,
            timeRemaining: { hours, minutes, seconds }
          }
        );
      }

      // Process the claim
      const claimResult = await FaucetModel.processClaim(userId, ip, deviceFingerprint);

      res.status(200).json({
        success: true,
        message: `Successfully claimed ${claimResult.coinsAwarded} coins!`,
        data: claimResult
      });

    } catch (error) {
      if (error.message === "COOLDOWN_NOT_EXPIRED") {
        next(new HttpException(429, "Faucet cooldown has not expired yet", {
          code: 'FAUCET_COOLDOWN_ACTIVE'
        }));
      } else {
        next(error);
      }
    }
  };

}
module.exports = new FaucetController();
