const OfferwallService = require("../services/offerwall.service");
const OfferwallModel = require("../models/offerwall.model");
const HttpException = require("../utils/HttpException.utils");
const { getProvider, isIpAllowed } = require("../config/offerwall.config");

class OfferwallController {

  handlePostback = async (req, res, next) => {
    try {
      const { provider, type } = req.params;
      const offerType = type || "offer"; // Default to 'offerwall' for backward compatibility
      const clientIp = req.ip || req.connection.remoteAddress;
      const headers = req.headers;

      // Get provider configuration
      let providerConfig;
      try {
        providerConfig = getProvider(provider);
      } catch (error) {
        throw new HttpException(400, error.message, "INVALID_PROVIDER");
      }

      // Validate type is supported by provider
      if (providerConfig.types && !providerConfig.types.includes(offerType)) {
        throw new HttpException(
          400,
          `Provider ${provider} does not support type: ${offerType}`,
          "INVALID_TYPE"
        );
      }

      // Combine GET and POST parameters
      const params = { ...req.query, ...req.body };

      console.log(`[${provider}:${offerType}] Postback received from ${clientIp}`, params);

      // IP allowlist check (if configured)
      if (!isIpAllowed(provider, clientIp)) {
        console.warn(`[${provider}] IP not allowed: ${clientIp}`);

        // Still log the attempt
        await OfferwallModel.logWebhook({
          provider,
          ip: clientIp,
          headers,
          payload: params,
          processingStatus: "invalid_signature",
          errorMessage: "IP not allowed",
        });

        // Return success to avoid retries
        return res.status(200).send(providerConfig.getResponse(true));
      }

      // Signature validation (if required)
      if (providerConfig.requireSignature) {
        const secretKey = process.env[`OFFERWALL_${provider.toUpperCase()}_SECRET`];

        if (!secretKey) {
          console.error(`[${provider}] Secret key not configured`);
          throw new HttpException(
            500,
            "Provider secret key not configured",
            "CONFIG_ERROR"
          );
        }

        // Pass req object for providers that need headers (e.g., AdGem POST method)
        const isValidSignature = providerConfig.validateSignature(
          params,
          secretKey,
          req
        );

        if (!isValidSignature) {
          console.warn(`[${provider}] Invalid signature from ${clientIp}`);
          // Log invalid signature
          await OfferwallModel.logWebhook({
            provider,
            ip: clientIp,
            headers,
            payload: params,
            processingStatus: "invalid_signature",
            errorMessage: "Invalid signature",
          });

          // Return success anyway to avoid retries
          return res.status(200).send(providerConfig.getResponse(true));
        }
      }

      // Parse provider-specific parameters
      const parsedParams = providerConfig.parseParams(params);

      // Validate required parameters
      if (
        !parsedParams.externalUserId ||
        !parsedParams.providerConversionId
      ) {
        throw new HttpException(
          400,
          "Missing required parameters: externalUserId and providerConversionId",
          "MISSING_PARAMS"
        );
      }

      // Process the postback
      const result = await OfferwallService.handlePostback(
        provider,
        offerType,
        parsedParams,
        headers,
        clientIp
      );

      console.log(`[${provider}:${offerType}] Postback processed successfully:`, result);

      // Return provider-specific response
      return res.status(200).send(providerConfig.getResponse(true));
    } catch (error) {
      console.error("Postback processing error:", error);

      // Log error but still return 200 to avoid retries
      const { provider } = req.params;
      const clientIp = req.ip || req.connection.remoteAddress;

      try {
        await OfferwallModel.logWebhook({
          provider: provider || "unknown",
          ip: clientIp,
          headers: req.headers,
          payload: { ...req.query, ...req.body },
          processingStatus: "error",
          errorMessage: error.message,
        });
      } catch (logError) {
        console.error("Failed to log error:", logError);
      }

      // Always return 200 to prevent provider retries
      try {
        const providerConfig = getProvider(provider);
        return res.status(200).send(providerConfig.getResponse(true));
      } catch {
        return res.status(200).send("OK");
      }
    }
  };

  getUserConversions = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const {
        page = 1,
        limit = 20,
        provider = null,
        status = null,
        rewardType = null,
      } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: Math.min(100, parseInt(limit) || 20),
        providerId: provider,
        status,
        rewardType,
      };

      const result = await OfferwallModel.getUserConversions(user.id, options);

      res.status(200).json({
        success: true,
        message: "Conversion history retrieved successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  getUserConversionStats = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const stats = await OfferwallModel.getUserConversionStats(user.id);

      res.status(200).json({
        success: true,
        message: "Conversion statistics retrieved successfully",
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  getConversionById = async (req, res, next) => {
    try {
      const user = req.currentUser;
      const { id } = req.params;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const conversion = await OfferwallModel.getConversionById(id);

      if (!conversion) {
        throw new HttpException(
          404,
          "Conversion not found",
          "CONVERSION_NOT_FOUND"
        );
      }

      // Ensure user owns this conversion
      if (conversion.user_id !== user.id) {
        throw new HttpException(
          403,
          "Access denied",
          "FORBIDDEN"
        );
      }

      res.status(200).json({
        success: true,
        message: "Conversion retrieved successfully",
        data: {
          id: conversion.id,
          providerId: conversion.provider_id,
          providerConversionId: conversion.provider_conversion_id,
          rewardType: conversion.reward_type,
          coins: parseFloat(conversion.coins),
          usdAmount: conversion.usd_amount
            ? parseFloat(conversion.usd_amount)
            : null,
          xpEarned: conversion.xp_earned,
          status: conversion.status,
          createdAt: conversion.created_at,
          creditedAt: conversion.credited_at,
          reversedAt: conversion.reversed_at,
        },
      });
    } catch (error) {
      next(error);
    }
  };

}

module.exports = new OfferwallController();
