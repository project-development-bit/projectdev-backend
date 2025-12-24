const OfferwallModel = require("../models/offerwall.model");
const HttpException = require("../utils/HttpException.utils");
const crypto = require("crypto");
const playtimeService = require("../services/playtime.service");

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
        "signature",
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

      const isValidSignature = this.validatePlaytimeSignature(params);
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

      const conversionTimestamp = params.conversionDatetime || Date.now();
      const providerConversionId = `${params.offer_id}_${params.user_id}_${conversionTimestamp}`;

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

      // Fallback: try to find by user ID 
      if (!user && !isNaN(params.user_id)) {
        user = await OfferwallModel.getUserById(parseInt(params.user_id));
      }

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const payout = parseFloat(params.payout) || 0;
      const coins = payout;
      const xpEarned = Math.floor(coins * 10);

      // Playtime only sends 'event' parameter for event name
      // Reversals/chargebacks are typically indicated by negative payout or specific event names
      const event = params.event?.toLowerCase() || "";
      const isReversed = event === "reversed" ||
                        event === "chargeback" ||
                        event.includes("reversal") ||
                        payout < 0;

      const conversionData = {
        userId: user.id,
        providerId: provider,
        providerConversionId: providerConversionId,
        externalUserId: params.user_id,
        rewardType: "playtime",
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

  validatePlaytimeSignature = (params) => {
    try {

      const secretKey = process.env.PLAYTIME_SECRET_KEY;

      if (!secretKey) {
        console.error("PLAYTIME_SECRET_KEY not configured");
        return false;
      }

      // Temporarily disable signature validation if PLAYTIME_SKIP_SIGNATURE_CHECK=true
      if (process.env.PLAYTIME_SKIP_SIGNATURE_CHECK === 'true') {
        console.warn("⚠️ WARNING: Signature validation is DISABLED - only for testing!");
        return true;
      }

      const receivedSignature = params.signature;
      if (!receivedSignature) {
        console.error("No signature parameter received");
        return false;
      }

      const paramsToSign = { ...params };
      delete paramsToSign.signature;

      // Try common signature algorithms
      const algorithms = ['sha256', 'sha1', 'md5'];
      const algorithm = process.env.PLAYTIME_SIGNATURE_ALGORITHM || 'sha256';

      // Alphabetically sort parameters (common pattern)
      const sortedKeys = Object.keys(paramsToSign).sort();
      const signatureString = sortedKeys
        .map((key) => `${key}=${paramsToSign[key]}`)
        .join("&");

      console.log("Signature validation debug:", {
        algorithm: algorithm,
        signatureString: signatureString,
        receivedSignature: receivedSignature,
      });

      const calculatedSignature = crypto
        .createHmac(algorithm, secretKey)
        .update(signatureString)
        .digest("hex");

      const isValid = calculatedSignature === receivedSignature;

      if (!isValid) {
        console.error("Signature validation failed:", {
          received: receivedSignature,
          calculated: calculatedSignature,
          algorithm: algorithm,
        });
      }

      return isValid;
    } catch (error) {
      console.error("Signature validation error:", error);
      return false;
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
      const requiredParams = ["uid", "tx", "val", "hash"];
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
      const coins = parseFloat(params.val) || 0;
      const usdAmount = parseFloat(params.raw) || 0;
      const xpEarned = Math.floor(coins * 10);

      // Determine reward type based on additional parameters
      let rewardType = "other";
      if (params.callback_type === "survey" || params.type) {
        rewardType = "survey";
      } else if (params.callback_type === "offer" || params.offer_id) {
        rewardType = "offer";
      } else if (params.callback_type === "receipt" || params.receipt_state) {
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

  /**
   * Get offers from Playtime Offerwall API
   * GET /api/v1/offerwall/playtime/offers
   * Query params: page, limit, os, country, sort
   */
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
}

module.exports = new OfferwallController();
