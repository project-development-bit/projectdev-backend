const WithdrawalModel = require("../models/withdrawal.model");
const BalanceModel = require("../models/balance.model");
const TransactionModel = require("../models/transaction.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");

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


  //Create a withdrawal request (User)
  createWithdrawal = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const { method, amount_coins, payout_address } = req.body;
      const currencyUpper = method.toUpperCase();
      const amountNum = parseFloat(amount_coins);

      // Validate amount
      if (amountNum <= 0) {
        throw new HttpException(
          400,
          "Amount must be greater than 0",
          "INVALID_AMOUNT"
        );
      }

      const withdrawalOptions = await WithdrawalModel.getWithdrawalOptions(true);
      const withdrawalMethod = withdrawalOptions.find(
        (m) => m.code.toUpperCase() === currencyUpper
      );

      if (!withdrawalMethod) {
        throw new HttpException(
          400,
          `Withdrawal not available for currency: ${currencyUpper}`,
          "CURRENCY_NOT_SUPPORTED"
        );
      }

      // Validate minimum amount
      if (amountNum < withdrawalMethod.min_amount_coins) {
        throw new HttpException(
          400,
          `Minimum withdrawal amount is ${withdrawalMethod.min_amount_coins} ${currencyUpper}`,
          "AMOUNT_BELOW_MINIMUM"
        );
      }

      const feeNum = withdrawalMethod.fee_coins;

      // Create withdrawal record with requested status
      const withdrawal = await WithdrawalModel.createWithdrawal({
        userId: user.id,
        currency: currencyUpper,
        amount: amountNum,
        fee: feeNum,
        address: payout_address.trim(),
        payoutProvider: 'manual',
        txid: null,
      });

      if (!withdrawal.success) {
        throw new HttpException(500, "Failed to create withdrawal request", "WITHDRAWAL_CREATION_FAILED");
      }

      // Get the created withdrawal
      const createdWithdrawal = await WithdrawalModel.getWithdrawalById(
        withdrawal.withdrawalId,
        user.id
      );

      res.status(201).json({
        success: true,
        message: "Withdrawal request created successfully. Waiting for admin approval.",
        data: createdWithdrawal,
      });
    } catch (error) {
      next(error);
    }
  };


  getWithdrawalOptions = async (req, res, next) => {
    try {
      const options = await WithdrawalModel.getWithdrawalOptions(true);
      res.status(200).json({
        success: true,
        data: options,
      });
    } catch (error) {
      next(error);
    }
  };

}

module.exports = new WithdrawalController();
