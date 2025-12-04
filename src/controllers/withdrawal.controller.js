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

  //Cancel a withdrawal
  cancelWithdrawal = async (req, res, next) => {
    try {
      const user = req.currentUser;
      const { id } = req.params;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const result = await WithdrawalModel.cancelWithdrawal(id, user.id);

      if (!result.success) {
        throw new HttpException(400, result.error, "CANCELLATION_FAILED");
      }

      // Refund the balance (amount + fee)
      const refundAmount = result.withdrawal.amount + result.withdrawal.fee;

      await BalanceModel.addCredit(
        user.id,
        result.withdrawal.currency,
        refundAmount
      );

      // Create ledger entry for refund
      const idempotencyKey = `wd-refund-${id}-${user.id}`;
      await TransactionModel.createLedgerEntry({
        userId: user.id,
        currency: result.withdrawal.currency,
        entryType: 'credit',
        amount: refundAmount,
        refType: 'withdrawal_refund',
        refId: id.toString(),
        idempotencyKey: idempotencyKey,
      });

      res.status(200).json({
        success: true,
        message: "Withdrawal cancelled successfully. Balance has been refunded (including fee).",
        data: {
          id: id,
          refundedAmount: refundAmount,
          withdrawalAmount: result.withdrawal.amount,
          fee: result.withdrawal.fee,
          currency: result.withdrawal.currency,
        },
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

  //Confirm a withdrawal (Admin only) - Update status
  confirmWithdrawal = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const user = req.currentUser;
      const { id } = req.params;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      // Check if user is admin
      if (user.role !== 'Admin') {
        throw new HttpException(
          403,
          "Only administrators can confirm withdrawals",
          "INSUFFICIENT_PERMISSIONS"
        );
      }

      const { status } = req.body;

      // Get the withdrawal (without user_id restriction for admin)
      const { coinQuery } = require("../config/db");
      const withdrawalSql = `SELECT * FROM withdrawals WHERE id = ?`;
      const withdrawalResult = await coinQuery(withdrawalSql, [id]);

      if (!withdrawalResult || withdrawalResult.length === 0) {
        throw new HttpException(404, "Withdrawal not found", "WITHDRAWAL_NOT_FOUND");
      }

      const withdrawal = withdrawalResult[0];

      // Check if already processed
      if (withdrawal.status !== 'requested') {
        throw new HttpException(
          400,
          `Cannot update withdrawal with status '${withdrawal.status}'`,
          "INVALID_STATUS"
        );
      }

      // Update withdrawal status based on admin decision
      if (status === 'sent') {
        // Approve and send withdrawal
        await WithdrawalModel.updateWithdrawalStatus(id, {
          status: 'sent',
          processedAt: new Date(),
        });

        // Deduct balance from user
        const totalDeduction = parseFloat(withdrawal.amount) + parseFloat(withdrawal.fee);
        await BalanceModel.deductBalance(withdrawal.user_id, withdrawal.currency, totalDeduction);

        // Create ledger entry for withdrawal
        const idempotencyKey = `wd-${id}-${withdrawal.user_id}`;
        await TransactionModel.createLedgerEntry({
          userId: withdrawal.user_id,
          currency: withdrawal.currency,
          entryType: 'debit',
          amount: totalDeduction,
          refType: 'withdrawal',
          refId: id.toString(),
          idempotencyKey: idempotencyKey,
        });
      } else if (status === 'failed') {
        // Reject withdrawal
        await WithdrawalModel.updateWithdrawalStatus(id, {
          status: 'failed',
          errorCode: 'REJECTED_BY_ADMIN',
          errorMessage: 'Rejected by administrator',
          processedAt: new Date(),
        });
        // No balance changes needed as balance wasn't deducted yet
      } else {
        throw new HttpException(
          400,
          "Invalid status. Must be 'sent' or 'failed'",
          "INVALID_STATUS"
        );
      }

      // Get the updated withdrawal
      const updatedWithdrawal = await WithdrawalModel.getWithdrawalById(
        id,
        withdrawal.user_id
      );

      res.status(200).json({
        success: true,
        message: status === 'sent'
          ? "Withdrawal confirmed and sent successfully"
          : "Withdrawal rejected successfully",
        data: updatedWithdrawal,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new WithdrawalController();
