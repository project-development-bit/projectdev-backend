const { getRewardsConfig } = require("../config/rewards.config");
const { coinPool } = require("../config/db");
const OfferwallModel = require("../models/offerwall.model");
const UserModel = require("../models/user.model");

class OfferwallService {

  calculateXp(coins) {
    const config = getRewardsConfig();
    if (!config || !config.xp_per_coin) {
      console.error("Failed to load rewards config for XP calculation");
      return 0;
    }

    return Math.floor(coins * config.xp_per_coin);
  }

  async processConversion(conversionData) {
    const connection = await coinPool.promise().getConnection();

    try {
      // Start transaction
      await connection.beginTransaction();

      const {
        providerId,
        providerConversionId,
        externalUserId,
        userId,
        rewardType,
        coins,
        usdAmount,
        ip,
        webhookIp,
        userAgent,
        rawPayload,
      } = conversionData;

      // Calculate XP from coins
      const xpEarned = this.calculateXp(coins);

      // 1. Insert conversion record (matching actual database schema)
      const insertConversionSql = `
        INSERT INTO offer_conversions
        (user_id, provider_id, provider_conversion_id, external_user_id,
         reward_type, coins, usd_amount, xp_earned, status, ip, webhook_ip,
         user_agent, raw_payload, credited_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'credited', ?, ?, ?, ?, NOW())
      `;

      const [conversionResult] = await connection.execute(
        insertConversionSql,
        [
          userId,
          providerId,
          providerConversionId,
          externalUserId,
          rewardType || 'other',
          coins,
          usdAmount || null,
          xpEarned,
          ip || null,
          webhookIp || null,
          userAgent || null,
          JSON.stringify(rawPayload),
        ]
      );

      const conversionId = conversionResult.insertId;

      // 2. Update user's balance (COIN currency)
      const updateBalanceSql = `
        INSERT INTO balances (user_id, currency, available, pending)
        VALUES (?, 'COIN', ?, 0)
        ON DUPLICATE KEY UPDATE available = available + ?
      `;

      await connection.execute(updateBalanceSql, [userId, coins, coins]);

      // 3. Update user's XP
      const updateXpSql = `
        UPDATE users
        SET xp = xp + ?
        WHERE id = ?
      `;

      await connection.execute(updateXpSql, [xpEarned, userId]);

      // 4. Get updated user XP to check level
      const [userRows] = await connection.execute(
        "SELECT xp FROM users WHERE id = ?",
        [userId]
      );

      const newTotalXp = userRows[0].xp;

      // 5. Create ledger entry
      const idempotencyKey = `${providerId}:${providerConversionId}`;
      const insertLedgerSql = `
        INSERT INTO ledger_entries
        (user_id, currency, entry_type, amount, ref_type, ref_id, idempotency_key)
        VALUES (?, 'COIN', 'credit', ?, 'offer', ?, ?)
      `;

      await connection.execute(insertLedgerSql, [
        userId,
        coins,
        conversionId.toString(),
        idempotencyKey,
      ]);

      // Commit transaction
      await connection.commit();

      return {
        success: true,
        conversionId,
        coins,
        xpEarned,
        totalXp: newTotalXp,
        leveledUp: false, // Can be enhanced to detect level change
      };
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      console.error("Transaction failed:", error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async processReversal(providerId, providerConversionId) {
    const connection = await coinPool.promise().getConnection();

    try {
      // Start transaction
      await connection.beginTransaction();

      // 1. Get existing conversion
      const [conversionRows] = await connection.execute(
        `SELECT * FROM offer_conversions
         WHERE provider_id = ? AND provider_conversion_id = ?`,
        [providerId, providerConversionId]
      );

      if (conversionRows.length === 0) {
        throw new Error("Conversion not found");
      }

      const conversion = conversionRows[0];

      // Check if already reversed
      if (conversion.status === "reversed") {
        await connection.rollback();
        return {
          success: false,
          error: "Conversion already reversed",
          alreadyReversed: true,
        };
      }

      // Calculate XP that was earned
      const xpEarned = this.calculateXp(parseFloat(conversion.coins));

      // 2. Update conversion status
      const updateConversionSql = `
        UPDATE offer_conversions
        SET status = 'reversed', reversed_at = NOW()
        WHERE provider_id = ? AND provider_conversion_id = ?
      `;

      await connection.execute(updateConversionSql, [
        providerId,
        providerConversionId,
      ]);

      // 3. Deduct coins from balance
      const deductBalanceSql = `
        UPDATE balances
        SET available = GREATEST(0, available - ?)
        WHERE user_id = ? AND currency = 'COIN'
      `;

      await connection.execute(deductBalanceSql, [
        conversion.coins,
        conversion.user_id,
      ]);

      // 4. Deduct XP from user
      const deductXpSql = `
        UPDATE users
        SET xp = GREATEST(0, xp - ?)
        WHERE id = ?
      `;

      await connection.execute(deductXpSql, [
        xpEarned,
        conversion.user_id,
      ]);

      // 5. Create reversal ledger entry
      const idempotencyKey = `reversal:${providerId}:${providerConversionId}`;
      const insertLedgerSql = `
        INSERT INTO ledger_entries
        (user_id, currency, entry_type, amount, ref_type, ref_id, idempotency_key)
        VALUES (?, 'COIN', 'debit', ?, 'offer_reversal', ?, ?)
      `;

      await connection.execute(insertLedgerSql, [
        conversion.user_id,
        conversion.coins,
        conversion.id.toString(),
        idempotencyKey,
      ]);

      // Commit transaction
      await connection.commit();

      return {
        success: true,
        conversionId: conversion.id,
        coinsReversed: parseFloat(conversion.coins),
        xpReversed: xpEarned,
      };
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      console.error("Reversal transaction failed:", error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async findUserByOfferToken(offerToken) {
    try {
      const user = await UserModel.findOne({ offer_token: offerToken }, false);
      return user;
    } catch (error) {
      console.error("Error finding user by offer token:", error);
      return null;
    }
  }

  determineRewardType(provider, offerType, params) {
    // For BitLabs, check activityType
    if (provider === 'bitlabs') {
      const activityType = params.activityType || params.callbackState;
      if (activityType && activityType.toLowerCase().includes('survey')) {
        return 'survey';
      }
      if (activityType && activityType.toLowerCase().includes('offer')) {
        return 'offer';
      }
    }

    // For PlaytimeAds, check if task_id/task_name exists (indicates playtime/level offer)
    if (provider === 'playtimeads') {
      if (params.taskId || params.taskName) {
        return 'playtime'; // Level/playtime milestone completion
      }
    }

    // Map offerType to reward_type enum
    const typeMapping = {
      'survey': 'survey',
      'offer': 'offer',
      'offerwall': 'offer',
      'ptc': 'ptc',
      'playtime': 'playtime',
      'rewards': 'other',
    };

    return typeMapping[offerType] || 'other';
  }

  async handlePostback(provider, offerType, params, headers, clientIp) {
    try {
      // Log webhook first
      await OfferwallModel.logWebhook({
        provider: `${provider}:${offerType}`,
        ip: clientIp,
        headers,
        payload: params,
        processingStatus: "ok",
        errorMessage: null,
      });

      // Check for duplicate conversion
      const duplicate = await OfferwallModel.checkDuplicateConversion(
        provider,
        params.providerConversionId
      );

      if (duplicate) {
        // Log as duplicate
        await OfferwallModel.logWebhook({
          provider: `${provider}:${offerType}`,
          ip: clientIp,
          headers,
          payload: params,
          processingStatus: "duplicate",
          errorMessage: "Duplicate conversion",
        });

        return {
          success: true,
          duplicate: true,
          message: "Conversion already processed",
        };
      }

      // Find user by external ID (offer_token)
      const user = await this.findUserByOfferToken(params.externalUserId);

      if (!user) {
        throw new Error(`User not found with offer_token: ${params.externalUserId}`);
      }

      // Check if this is a reversal/chargeback
      if (params.status === "reversed" || params.isChargeback) {
        const result = await this.processReversal(
          provider,
          params.providerConversionId
        );
        return result;
      }

      // Determine reward type
      const rewardType = this.determineRewardType(provider, offerType, params);

      // Process normal conversion with updated field names
      const conversionData = {
        providerId: provider,
        providerConversionId: params.providerConversionId,
        externalUserId: params.externalUserId,
        userId: user.id,
        rewardType: rewardType,
        coins: params.currencyAmount || 0,
        usdAmount: params.payoutUsd || null,
        ip: params.ip || null,
        webhookIp: clientIp,
        userAgent: headers['user-agent'] || null,
        rawPayload: params,
      };

      const result = await this.processConversion(conversionData);

      return result;
    } catch (error) {
      // Log error
      await OfferwallModel.logWebhook({
        provider: `${provider}:${offerType}`,
        ip: clientIp,
        headers,
        payload: params,
        processingStatus: "error",
        errorMessage: error.message,
      });

      throw error;
    }
  }
}

module.exports = new OfferwallService();
