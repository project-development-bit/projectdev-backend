const BalanceModel = require("../models/balance.model");
const HttpException = require("../utils/HttpException.utils");

class BalanceController {
  //Get user's balance for all currencies
  getBalance = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const balances = await BalanceModel.getBalance(user.id);

      res.status(200).json({
        success: true,
        message: "Balance retrieved successfully",
        data: {
          balances: balances,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  //Get user's balance for a specific currency
  getBalanceByCurrency = async (req, res, next) => {
    try {
      const user = req.currentUser;
      const { currency } = req.params;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      if (!currency) {
        throw new HttpException(400, "Currency is required", "CURRENCY_REQUIRED");
      }

      const balance = await BalanceModel.getBalanceByCurrency(user.id, currency.toUpperCase());

      if (!balance) {
        throw new HttpException(404, `Balance not found for currency ${currency}`, "BALANCE_NOT_FOUND");
      }

      res.status(200).json({
        success: true,
        message: "Balance retrieved successfully",
        data: balance,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new BalanceController();
