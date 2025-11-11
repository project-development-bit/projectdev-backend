const DepositModel = require("../models/deposit.model");
const BalanceModel = require("../models/balance.model");
const TransactionModel = require("../models/transaction.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");

class DepositController {
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

  //Get user's deposit history
  getUserDeposits = async (req, res, next) => {
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

      const result = await DepositModel.getUserDeposits(user.id, options);

      res.status(200).json({
        success: true,
        message: "Deposit history retrieved successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  //Get single deposit by ID
  getDepositById = async (req, res, next) => {
    try {
      const user = req.currentUser;
      const { id } = req.params;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const deposit = await DepositModel.getDepositById(id, user.id);

      if (!deposit) {
        throw new HttpException(404, "Deposit not found", "DEPOSIT_NOT_FOUND");
      }

      res.status(200).json({
        success: true,
        message: "Deposit retrieved successfully",
        data: deposit,
      });
    } catch (error) {
      next(error);
    }
  };

  //Create a deposit request (User)
  createDeposit = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const { currency, amount, txid, depositAddress, paymentProvider } = req.body;
      const currencyUpper = currency.toUpperCase();
      const amountNum = parseFloat(amount);

      // Validate amount
      if (amountNum <= 0) {
        throw new HttpException(
          400,
          "Amount must be greater than 0",
          "INVALID_AMOUNT"
        );
      }

      // Create deposit record with pending status
      const deposit = await DepositModel.createDeposit({
        userId: user.id,
        currency: currencyUpper,
        amount: amountNum,
        txid: txid || null,
        depositAddress: depositAddress || null,
        paymentProvider: paymentProvider || 'manual',
      });

      if (!deposit.success) {
        throw new HttpException(500, "Failed to create deposit", "DEPOSIT_CREATION_FAILED");
      }

      // Get the created deposit
      const createdDeposit = await DepositModel.getDepositById(
        deposit.depositId,
        user.id
      );

      res.status(201).json({
        success: true,
        message: "Deposit request created successfully. Waiting for admin confirmation.",
        data: createdDeposit,
      });
    } catch (error) {
      next(error);
    }
  };

  //Confirm a deposit (Update status)
  confirmDeposit = async (req, res, next) => {
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
          "Only administrators can confirm deposits",
          "INSUFFICIENT_PERMISSIONS"
        );
      }

      const { status } = req.body;

      // Get the deposit (without user_id restriction for admin)
      const depositSql = `SELECT * FROM deposits WHERE id = ?`;
      const { coinQuery } = require("../config/db");
      const depositResult = await coinQuery(depositSql, [id]);

      if (!depositResult || depositResult.length === 0) {
        throw new HttpException(404, "Deposit not found", "DEPOSIT_NOT_FOUND");
      }

      const deposit = depositResult[0];

      // Update deposit status
      await DepositModel.updateDepositStatus(id, {
        status: status || 'confirmed',
        confirmedAt: new Date(),
      });

      // If confirming, add to balance
      if (status === 'confirmed' && deposit.status !== 'confirmed') {
        // Add to user's available balance
        await BalanceModel.addCredit(
          deposit.user_id,
          deposit.currency,
          parseFloat(deposit.amount)
        );

        // Create ledger entry
        const idempotencyKey = `deposit-${id}-${deposit.user_id}`;
        await TransactionModel.createLedgerEntry({
          userId: deposit.user_id,
          currency: deposit.currency,
          entryType: 'credit',
          amount: parseFloat(deposit.amount),
          refType: 'deposit',
          refId: id.toString(),
          idempotencyKey: idempotencyKey,
        });
      }

      // Get the updated deposit
      const updatedDeposit = await DepositModel.getDepositById(id, deposit.user_id);

      res.status(200).json({
        success: true,
        message: "Deposit confirmed successfully",
        data: updatedDeposit,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new DepositController();
