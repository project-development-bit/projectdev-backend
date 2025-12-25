const OfferwallModel = require("../models/offerwall.model");
const HttpException = require("../utils/HttpException.utils");
const crypto = require("crypto");
const playtimeService = require("../services/playtime.service");
const bitlabsService = require("../services/bitlabs.service");
const dotenv = require("dotenv");
dotenv.config();

class OfferwallController {
  handlePlaytimePostback = async (req, res, next) => {
    const provider = "playtime";
    const webhookIp = req.ip || req.connection.remoteAddress;
    let webhookLogId = null;

    try {
      const params = req.query;
      const headers = req.headers;
      console.log(params)

      await OfferwallModel.saveWebhookLog(
        provider,
        webhookIp,
        headers,
        params,
        "ok",
        null
      );

      const requiredParams = [
        "user_id",
        "offer_id",
        "payout",
      ];

      for (const param of requiredParams) {
        if (!params[param]) {
          throw new HttpException(
            400,
            `Missing required parameter: ${param}`,
            "INVALID_PARAMS"
          );
        }
      }

      const providerConversionId = `${params.offer_id}_${params.user_id}_${Date.now()}`;

      const existingConversion = await OfferwallModel.checkDuplicateConversion(
        provider,
        providerConversionId
      );

      if (existingConversion) {
        await OfferwallModel.saveWebhookLog(
          provider,
          webhookIp,
          headers,
          params,
          "duplicate",
          "Duplicate conversion"
        );

        return res.status(200).send("OK");
      }

      // Try to find user by offer_token
      let user = await OfferwallModel.getUserByOfferToken(params.user_id);

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const RATE = parseFloat(process.env.COIN_RATE) || 0.0001;
      const XP_PER_COIN = parseFloat(process.env.XP_PER_COIN) || 0.2;

      const payout = parseFloat(params.payout) || 0;
      const coins = Math.floor(payout / RATE);
      const xpEarned = Math.floor(coins * XP_PER_COIN);

      const isReversed = payout < 0;

      const conversionData = {
        userId: user.id,
        providerId: provider,
        providerConversionId: providerConversionId,
        externalUserId: params.user_id,
        rewardType: "offer",
        coins: coins,
        usdAmount: payout,
        xpEarned: xpEarned,
        status: isReversed ? "reversed" : "pending",
        ip: params.ip || null,
        webhookIp: webhookIp,
        userAgent: headers["user-agent"] || null,
        rawPayload: params,
      };

      const conversionId = await OfferwallModel.createConversion(
        conversionData
      );

      if (isReversed) {
        await OfferwallModel.reverseConversion(
          user.id,
          coins,
          xpEarned,
          conversionId
        );
      } else {
        await OfferwallModel.creditUserBalance(
          user.id,
          coins,
          xpEarned,
          conversionId
        );
      }

      return res.status(200).send("OK");
    } catch (error) {
      if (webhookLogId) {
        await OfferwallModel.saveWebhookLog(
          provider,
          webhookIp,
          req.headers,
          req.query,
          "error",
          error.message
        );
      }

      next(error);
    }
  };


  handleBitLabsPostback = async (req, res, next) => {
    const provider = "bitlabs";
    const webhookIp = req.ip || req.connection.remoteAddress;

    try {
      const params = req.query;
      const headers = req.headers;

      // Log incoming webhook
      await OfferwallModel.saveWebhookLog(
        provider,
        webhookIp,
        headers,
        params,
        "ok",
        null
      );

      // Validate required parameters
      const requiredParams = ["uid", "tx", "usd", "hash"];
      for (const param of requiredParams) {
        if (!params[param]) {
          throw new HttpException(
            400,
            `Missing required parameter: ${param}`,
            "INVALID_PARAMS"
          );
        }
      }

      // Validate signature
      const isValidSignature = this.validateBitLabsSignature(params);
      if (!isValidSignature) {
        await OfferwallModel.saveWebhookLog(
          provider,
          webhookIp,
          headers,
          params,
          "invalid_signature",
          "Signature validation failed"
        );

        throw new HttpException(
          403,
          "Invalid signature",
          "INVALID_SIGNATURE"
        );
      }

      // Check for duplicate conversion
      const providerConversionId = params.tx;
      const existingConversion = await OfferwallModel.checkDuplicateConversion(
        provider,
        providerConversionId
      );

      if (existingConversion) {
        await OfferwallModel.saveWebhookLog(
          provider,
          webhookIp,
          headers,
          params,
          "duplicate",
          "Duplicate conversion"
        );

        return res.status(200).send("OK");
      }

      // Find user by offer_token (BitLabs sends this as uid parameter)
      let user = await OfferwallModel.getUserByOfferToken(params.uid);

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      // Parse amounts
      const RATE = parseFloat(process.env.COIN_RATE) || 0.0001;
      const XP_PER_COIN = parseFloat(process.env.XP_PER_COIN) || 0.2;

      const usdAmount = parseFloat(params.usd) || 0;
      const coins = parseFloat(params.coin) || Math.floor(usdAmount / RATE);;
      const xpEarned = Math.floor(coins * XP_PER_COIN);

      // Determine reward type based on additional parameters
      let rewardType = "other";
      if (params.callback_type === "survey") {
        rewardType = "survey";
      } else if (params.callback_type === "offer") {
        rewardType = "offer";
      } else if (params.callback_type === "receipt") {
        rewardType = "other"; // Can add 'receipt' to enum if needed
      }

      // Check for reversals/reconciliation
      const isReversed =
        params.type === "RECONCILIATION" ||
        params.task_state === "RECONCILED" ||
        coins < 0;

      // Prepare conversion data
      const conversionData = {
        userId: user.id,
        providerId: provider,
        providerConversionId: providerConversionId,
        externalUserId: params.uid,
        rewardType: rewardType,
        coins: Math.abs(coins), // Store absolute value
        usdAmount: usdAmount,
        xpEarned: Math.abs(xpEarned),
        status: isReversed ? "reversed" : "pending",
        ip: params.ip || null,
        webhookIp: webhookIp,
        userAgent: headers["user-agent"] || null,
        rawPayload: params,
      };

      // Create conversion record
      const conversionId = await OfferwallModel.createConversion(
        conversionData
      );

      // Credit or reverse balance
      if (isReversed) {
        await OfferwallModel.reverseConversion(
          user.id,
          Math.abs(coins),
          Math.abs(xpEarned),
          conversionId
        );
      } else {
        await OfferwallModel.creditUserBalance(
          user.id,
          coins,
          xpEarned,
          conversionId
        );
      }

      return res.status(200).send("OK");
    } catch (error) {
      await OfferwallModel.saveWebhookLog(
        provider,
        webhookIp,
        req.headers,
        req.query,
        "error",
        error.message
      );

      next(error);
    }
  };

  validateBitLabsSignature = (params) => {
    try {
      const secretKey = process.env.BITLABS_APP_SECRET;

      console.log(secretKey)

      if (!secretKey) {
        console.error("BITLABS_APP_SECRET not configured");
        return false;
      }

      // Skip signature check if enabled (testing only)
      if (process.env.BITLABS_SKIP_SIGNATURE_CHECK === 'true') {
        console.warn("⚠️ WARNING: BitLabs signature validation is DISABLED - only for testing!");
        return true;
      }

      const receivedHash = params.hash;
      if (!receivedHash) {
        console.error("No hash parameter received");
        return false;
      }

      // Remove hash from parameters
      const paramsToSign = { ...params };
      delete paramsToSign.hash;

      // Sort parameters alphabetically and build query string
      const sortedKeys = Object.keys(paramsToSign).sort();
      const signatureString = sortedKeys
        .map((key) => `${key}=${paramsToSign[key]}`)
        .join("&");

      console.log("BitLabs signature validation debug:", {
        signatureString: signatureString,
        receivedHash: receivedHash,
      });

      // BitLabs uses SHA-1 HMAC
      const calculatedHash = crypto
        .createHmac("sha1", secretKey)
        .update(signatureString)
        .digest("hex");

      const isValid = calculatedHash === receivedHash;

      if (!isValid) {
        console.error("BitLabs signature validation failed:", {
          received: receivedHash,
          calculated: calculatedHash,
        });
      }

      return isValid;
    } catch (error) {
      console.error("BitLabs signature validation error:", error);
      return false;
    }
  };

  getPlaytimeOffers = async (req, res, next) => {
    try {
      const { page, limit, os, country, sort } = req.query;

      // Build options object with query parameters
      const options = {};
      if (page) options.page = parseInt(page);
      if (limit) options.limit = parseInt(limit);
      if (os) options.os = os;
      if (country) options.country = country;
      if (sort) options.sort = sort; // 'asc' or 'desc'

      // Fetch offers from Playtime API (with backend pagination & sorting)
      const offersData = await playtimeService.fetchOffers(options);

      // Return the offers to the frontend
      res.status(200).json({
        success: true,
        data: offersData,
      });
    } catch (error) {
      // Pass error to error handling middleware
      next(error);
    }
  };

  getBitLabsSurveys = async (req, res, next) => {
    try {
      const { page, limit, sort } = req.query;

      // Get authenticated user ID
      const userId = req.currentUser.id;

      // Get user's offer_token to use as BitLabs User ID
      const user = await OfferwallModel.getUserById(userId);

      if (!user || !user.offer_token) {
        throw new HttpException(
          400,
          "User does not have an offer token configured",
          "OFFER_TOKEN_NOT_FOUND"
        );
      }

      // Build options object with query parameters
      const options = {};
      if (page) options.page = parseInt(page);
      if (limit) options.limit = parseInt(limit);
      if (sort) options.sort = sort; // 'asc' or 'desc'

      // Fetch surveys from BitLabs API (with backend pagination & sorting)
      const surveysData = await bitlabsService.fetchSurveys(user.offer_token, options);

      // Return the surveys to the frontend
      res.status(200).json({
        success: true,
        data: surveysData,
      });
    } catch (error) {
      // Pass error to error handling middleware
      next(error);
    }
  };

  getWebhookLogs = async (req, res, next) => {
    try {
      const { provider, processingStatus, limit, page } = req.query;

      // Calculate offset from page number
      const itemsPerPage = parseInt(limit) || 50;
      const currentPage = parseInt(page) || 1;
      const offset = (currentPage - 1) * itemsPerPage;

      // Build filter object
      const filters = {
        limit: itemsPerPage,
        offset: offset
      };

      if (provider) {
        filters.provider = provider;
      }

      if (processingStatus) {
        filters.processingStatus = processingStatus;
      }

      // Get webhook logs from database
      const result = await OfferwallModel.getWebhookLogs(filters);

      // Return the logs to the frontend
      res.status(200).json({
        success: true,
        data: result.logs,
        pagination: result.pagination
      });
    } catch (error) {
      // Pass error to error handling middleware
      next(error);
    }
  };

  getOfferConversions = async (req, res, next) => {
    try {
      const { provider, rewardType, status, limit, page } = req.query;

      // Get authenticated user ID from middleware
      const userId = req.currentUser.id;

      // Calculate offset from page number
      const itemsPerPage = parseInt(limit) || 50;
      const currentPage = parseInt(page) || 1;
      const offset = (currentPage - 1) * itemsPerPage;

      // Build filter object with user ID
      const filters = {
        userId: userId,
        limit: itemsPerPage,
        offset: offset
      };

      if (provider) {
        filters.provider = provider;
      }

      if (rewardType) {
        filters.rewardType = rewardType;
      }

      if (status) {
        filters.status = status;
      }

      // Get conversions from database
      const result = await OfferwallModel.getOfferConversions(filters);

      // Return the conversions to the frontend
      res.status(200).json({
        success: true,
        data: result.conversions,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new OfferwallController();
