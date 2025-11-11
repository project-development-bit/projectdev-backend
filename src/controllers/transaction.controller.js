const TransactionModel = require("../models/transaction.model");
const HttpException = require("../utils/HttpException.utils");

class TransactionController {
  //Get user's transaction history with pagination and filters
  getTransactionHistory = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      // Extract query parameters
      const {
        page = 1,
        limit = 20,
        type = 'all',      // all, credit, debit, offer, referral, withdrawal, faucet
        currency = null,
        dateFrom = null,
        dateTo = null,
      } = req.query;

      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

      const options = {
        page: pageNum,
        limit: limitNum,
        type: type || 'all',
        currency: currency || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      };

      const result = await TransactionModel.getTransactionHistory(user.id, options);

      res.status(200).json({
        success: true,
        message: "Transaction history retrieved successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  //Get transaction summary/statistics
  getTransactionSummary = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const summary = await TransactionModel.getTransactionSummary(user.id);

      res.status(200).json({
        success: true,
        message: "Transaction summary retrieved successfully",
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new TransactionController();
