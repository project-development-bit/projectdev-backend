const WithdrawalModel = require("../models/withdrawal.model");
const BalanceModel = require("../models/balance.model");
const TransactionModel = require("../models/transaction.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");
const {
  uploadImageToS3,
  deleteImageFromS3,
  validateImageFile,
} = require("../utils/imageUpload.utils");

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


  //Get withdrawal method by ID (Admin)
  getWithdrawalMethodById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const method = await WithdrawalModel.getWithdrawalMethodById(id);

      if (!method) {
        throw new HttpException(
          404,
          "Withdrawal method not found",
          "METHOD_NOT_FOUND"
        );
      }

      res.status(200).json({
        success: true,
        data: method,
      });
    } catch (error) {
      next(error);
    }
  };

  //Create withdrawal method (Admin)
  createWithdrawalMethod = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const {
        code,
        name,
        network,
        min_amount_coins,
        fee_coins,
        is_enabled,
        sort_order,
      } = req.body;

      // Validate code uniqueness
      const codeExists = await WithdrawalModel.codeExists(code);
      if (codeExists) {
        throw new HttpException(
          409,
          `Withdrawal method with code '${code}' already exists`,
          "CODE_ALREADY_EXISTS"
        );
      }

      // Handle icon upload if provided
      let iconUrl = null;
      if (req.file) {
        // Validate file
        const maxSizeBytes = parseInt(
          process.env.WITHDRAWAL_ICON_MAX_SIZE_BYTES || 2097152
        ); // Default 2MB
        const validation = validateImageFile(req.file, maxSizeBytes);

        if (!validation.valid) {
          throw new HttpException(
            400,
            validation.error,
            "INVALID_ICON_FILE"
          );
        }

        // Upload to S3
        try {
          iconUrl = await uploadImageToS3(
            req.file.buffer,
            "avatar",
            code.toLowerCase(),
            req.file.mimetype,
            req.file.originalname
          );
        } catch (error) {
          console.error("S3 upload failed:", error);
          throw new HttpException(
            500,
            "Failed to upload icon. Please try again.",
            "S3_UPLOAD_FAILED"
          );
        }
      }

      // Create withdrawal method
      const result = await WithdrawalModel.createWithdrawalMethod({
        code: code.toUpperCase(),
        name,
        network,
        icon_url: iconUrl,
        min_amount_coins: parseFloat(min_amount_coins),
        fee_coins: parseFloat(fee_coins),
        is_enabled: is_enabled === true || is_enabled === "true",
        sort_order: sort_order ? parseInt(sort_order) : 0,
      });

      // Get the created method
      const createdMethod = await WithdrawalModel.getWithdrawalMethodById(
        result.insertId
      );

      res.status(201).json({
        success: true,
        message: "Withdrawal method created successfully",
        data: createdMethod,
      });
    } catch (error) {
      next(error);
    }
  };

  //Update withdrawal method (Admin)
  updateWithdrawalMethod = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const { id } = req.params;
      const {
        code,
        name,
        network,
        min_amount_coins,
        fee_coins,
        is_enabled,
        sort_order,
      } = req.body;

      // Check if method exists
      const existingMethod = await WithdrawalModel.getWithdrawalMethodById(id);
      if (!existingMethod) {
        throw new HttpException(
          404,
          "Withdrawal method not found",
          "METHOD_NOT_FOUND"
        );
      }

      // Validate code uniqueness (excluding current method)
      if (code && code !== existingMethod.code) {
        const codeExists = await WithdrawalModel.codeExists(code, id);
        if (codeExists) {
          throw new HttpException(
            409,
            `Withdrawal method with code '${code}' already exists`,
            "CODE_ALREADY_EXISTS"
          );
        }
      }

      // Handle icon upload if provided
      let iconUrl = existingMethod.icon_url;
      if (req.file) {
        // Validate file
        const maxSizeBytes = parseInt(
          process.env.WITHDRAWAL_ICON_MAX_SIZE_BYTES || 2097152
        ); // Default 2MB
        const validation = validateImageFile(req.file, maxSizeBytes);

        if (!validation.valid) {
          throw new HttpException(
            400,
            validation.error,
            "INVALID_ICON_FILE"
          );
        }

        const oldIconUrl = existingMethod.icon_url;

        // Upload new icon to S3
        try {
          iconUrl = await uploadImageToS3(
            req.file.buffer,
            "avatar",
            (code || existingMethod.code).toLowerCase(),
            req.file.mimetype,
            req.file.originalname
          );
        } catch (error) {
          console.error("S3 upload failed:", error);
          throw new HttpException(
            500,
            "Failed to upload icon. Please try again.",
            "S3_UPLOAD_FAILED"
          );
        }

        // Update database with new icon URL
        try {
          await WithdrawalModel.updateWithdrawalMethod(id, {
            code: (code || existingMethod.code).toUpperCase(),
            name: name || existingMethod.name,
            network: network !== undefined ? network : existingMethod.network,
            icon_url: iconUrl,
            min_amount_coins:
              min_amount_coins !== undefined
                ? parseFloat(min_amount_coins)
                : existingMethod.min_amount_coins,
            fee_coins:
              fee_coins !== undefined
                ? parseFloat(fee_coins)
                : existingMethod.fee_coins,
            is_enabled:
              is_enabled !== undefined
                ? is_enabled === true || is_enabled === "true"
                : existingMethod.is_enabled,
            sort_order:
              sort_order !== undefined
                ? parseInt(sort_order)
                : existingMethod.sort_order,
          });

          // Delete old icon from S3 if it exists
          if (oldIconUrl && oldIconUrl !== iconUrl) {
            await deleteImageFromS3(oldIconUrl);
          }
        } catch (error) {
          // Rollback: delete uploaded S3 file
          await deleteImageFromS3(iconUrl);
          throw error;
        }
      } else {
        // Update without icon change
        await WithdrawalModel.updateWithdrawalMethod(id, {
          code: (code || existingMethod.code).toUpperCase(),
          name: name || existingMethod.name,
          network: network !== undefined ? network : existingMethod.network,
          icon_url: iconUrl,
          min_amount_coins:
            min_amount_coins !== undefined
              ? parseFloat(min_amount_coins)
              : existingMethod.min_amount_coins,
          fee_coins:
            fee_coins !== undefined
              ? parseFloat(fee_coins)
              : existingMethod.fee_coins,
          is_enabled:
            is_enabled !== undefined
              ? is_enabled === true || is_enabled === "true"
              : existingMethod.is_enabled,
          sort_order:
            sort_order !== undefined
              ? parseInt(sort_order)
              : existingMethod.sort_order,
        });
      }

      // Get the updated method
      const updatedMethod = await WithdrawalModel.getWithdrawalMethodById(id);

      res.status(200).json({
        success: true,
        message: "Withdrawal method updated successfully",
        data: updatedMethod,
      });
    } catch (error) {
      next(error);
    }
  };

  //Delete withdrawal method (Admin)
  deleteWithdrawalMethod = async (req, res, next) => {
    try {
      const { id } = req.params;

      // Check if method exists
      const existingMethod = await WithdrawalModel.getWithdrawalMethodById(id);
      if (!existingMethod) {
        throw new HttpException(
          404,
          "Withdrawal method not found",
          "METHOD_NOT_FOUND"
        );
      }

      // Delete from database
      await WithdrawalModel.deleteWithdrawalMethod(id);

      // Delete icon from S3 if it exists
      if (existingMethod.icon_url) {
        await deleteImageFromS3(existingMethod.icon_url);
      }

      res.status(200).json({
        success: true,
        message: "Withdrawal method deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

}

module.exports = new WithdrawalController();
