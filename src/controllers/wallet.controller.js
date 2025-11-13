const WalletModel = require("../models/wallet.model");
const HttpException = require("../utils/HttpException.utils");

class WalletController {
  //Get wallet balances
  getWalletBalances = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      // Extract query parameters
      const { asOf, windowDays } = req.query;

      // Parse and validate windowDays
      let parsedWindowDays = 90; // default
      if (windowDays) {
        parsedWindowDays = parseInt(windowDays, 10);
        if (isNaN(parsedWindowDays)) {
          throw new HttpException(
            400,
            "Invalid windowDays parameter. Must be an integer.",
            "INVALID_WINDOW_DAYS"
          );
        }
      }

      // Validate asOf if provided
      let parsedAsOf = undefined;
      if (asOf) {
        parsedAsOf = asOf;
        const asOfDate = new Date(asOf);
        if (isNaN(asOfDate.getTime())) {
          throw new HttpException(
            400,
            "Invalid asOf parameter. Must be ISO 8601 format (UTC+0).",
            "INVALID_AS_OF"
          );
        }
      }

      // Get wallet balances
      const walletData = await WalletModel.getWalletBalances(user.id, {
        asOf: parsedAsOf,
        windowDays: parsedWindowDays,
      });

      res.status(200).json(walletData);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new WalletController();
