const OfferwallModel = require("../models/offerwall.model");
const HttpException = require("../utils/HttpException.utils");
const crypto = require("crypto");

class OfferwallController {
  handlePlaytimePostback = async (req, res, next) => {
    const provider = "playtime";
    const webhookIp = req.ip || req.connection.remoteAddress;
    let webhookLogId = null;

    try {
      const params = req.query;
      const headers = req.headers;

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
}

module.exports = new OfferwallController();
