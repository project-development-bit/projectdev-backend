const TransactionModel = require("../models/transaction.model");
const HttpException = require("../utils/HttpException.utils");

class TransactionController {

  getTransactionHistory = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const {
        page = 1,
        limit = 20,
        transactionType = null,
        status = null,
        currency = null,
        dateFrom = null,
        dateTo = null,
      } = req.query;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

      const options = {
        page: pageNum,
        limit: limitNum,
        transactionType: transactionType || null,
        status: status || null,
        currency: currency || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      };

      const result = await TransactionModel.getTransactionHistory(user.id, options);

      res.status(200).json({
        success: true,
        message: "Payment history retrieved successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new TransactionController();
