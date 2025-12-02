const WithdrawalModel = require("../models/withdrawal.model");
const BalanceModel = require("../models/balance.model");
const TransactionModel = require("../models/transaction.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");
const cryptoAddressValidator = require("../utils/cryptoAddress.utils");

class WithdrawalController {
  //Validate request using express-validator
  checkValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new HttpException(
        400,
        "Validation failed. Please check your input fields.",
        "VALIDATION_ERROR",
        errors.array()
      );
    }
  };

  //Get user's withdrawal history
  getUserWithdrawals = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const {
        page = 1,
        limit = 20,
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
        status: status || null,
        currency: currency || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      };

      const result = await WithdrawalModel.getUserWithdrawals(user.id, options);

      res.status(200).json({
        success: true,
        message: "Withdrawal history retrieved successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  //Get single withdrawal by ID
  getWithdrawalById = async (req, res, next) => {
    try {
      const user = req.currentUser;
      const { id } = req.params;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const withdrawal = await WithdrawalModel.getWithdrawalById(id, user.id);

      if (!withdrawal) {
        throw new HttpException(404, "Withdrawal not found", "WITHDRAWAL_NOT_FOUND");
      }

      res.status(200).json({
        success: true,
        message: "Withdrawal retrieved successfully",
        data: withdrawal,
      });
    } catch (error) {
      next(error);
    }
  };



  //Create a coin-based withdrawal request
  createCoinWithdrawal = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const { method, amount_coins, payout_address } = req.body;
      const methodUpper = method.toUpperCase();
      const amountCoins = parseInt(amount_coins);

      // Check if method is supported
      if (!cryptoAddressValidator.isSupportedMethod(methodUpper)) {
        return res.status(400).json({
          success: false,
          message: "Unsupported withdrawal method.",
        });
      }

      // Validate minimum amount for the method
      const minimumAmount = cryptoAddressValidator.getMinimumAmount(methodUpper);
      if (amountCoins < minimumAmount) {
        const methodNames = {
          BTC: "Bitcoin",
          DASH: "Dash",
          DOGE: "Dogecoin",
          LTC: "Litecoin",
        };
        return res.status(400).json({
          success: false,
          message: `Minimum withdrawal for ${methodNames[methodUpper]} is ${minimumAmount.toLocaleString()} coins.`,
        });
      }

      // Check user's COIN balance
      const balance = await BalanceModel.getBalanceByCurrency(user.id, 'COIN');

      if (!balance || balance.available < amountCoins) {
        return res.status(400).json({
          success: false,
          message: "Insufficient balance for this withdrawal.",
        });
      }

      // Determine payout address (from request or user's stored address)
      let payoutAddr = payout_address ? payout_address.trim() : null;

      if (!payoutAddr) {
        // Try to get user's stored address for this currency
        payoutAddr = await WithdrawalModel.getUserPayoutAddress(user.id, methodUpper);
      }

      if (!payoutAddr) {
        return res.status(400).json({
          success: false,
          message: "Payout address is required. Please provide a valid wallet address.",
        });
      }

      // Validate payout address format
      if (!cryptoAddressValidator.validate(methodUpper, payoutAddr)) {
        return res.status(400).json({
          success: false,
          message: `Invalid payout address for ${methodUpper === 'BTC' ? 'Bitcoin' : methodUpper === 'DASH' ? 'Dash' : methodUpper === 'DOGE' ? 'Dogecoin' : 'Litecoin'}.`,
        });
      }

      // Check rate limiting - max pending withdrawals
      const pendingCount = await WithdrawalModel.getPendingWithdrawalCount(user.id);
      if (pendingCount >= 5) {
        return res.status(429).json({
          success: false,
          message: "You have too many pending withdrawals. Please wait for them to be processed.",
        });
      }

      // Check if user account is in good standing
      if (user.is_banned) {
        return res.status(403).json({
          success: false,
          message: "Your account is restricted from making withdrawals.",
        });
      }

      // Create the withdrawal record (status: requested)
      const withdrawal = await WithdrawalModel.createCoinWithdrawal({
        userId: user.id,
        method: methodUpper,
        amountCoins: amountCoins,
        payoutAddress: payoutAddr,
      });

      if (!withdrawal.success) {
        throw new HttpException(500, "Failed to create withdrawal request", "WITHDRAWAL_CREATION_FAILED");
      }

      // Get the created withdrawal to return to user
      const createdWithdrawal = await WithdrawalModel.getWithdrawalById(
        withdrawal.withdrawalId,
        user.id
      );

      // Return success response
      res.status(201).json({
        success: true,
        data: {
          id: createdWithdrawal.id,
          method: createdWithdrawal.currency,
          amount_coins: parseFloat(createdWithdrawal.amount),
          fee_coins: parseFloat(createdWithdrawal.fee),
          status: createdWithdrawal.status,
          created_at: createdWithdrawal.requestedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new WithdrawalController();
