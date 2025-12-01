const { coinQuery } = require("../config/db");

class OfferwallModel {
  conversionsTable = "offer_conversions";
  webhookLogsTable = "webhook_logs";

  /**
   * Log incoming webhook request
   */
  logWebhook = async (logData) => {
    const {
      provider,
      ip,
      headers,
      payload,
      processingStatus,
      errorMessage = null,
    } = logData;

    const sql = `
      INSERT INTO ${this.webhookLogsTable}
      (provider, ip, headers_json, payload_json, processing_status, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    try {
      const result = await coinQuery(sql, [
        provider,
        ip,
        JSON.stringify(headers),
        JSON.stringify(payload),
        processingStatus,
        errorMessage,
      ]);

      return {
        success: true,
        logId: result.insertId,
      };
    } catch (error) {
      console.error("Failed to log webhook:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Check if conversion already exists (idempotency check)
   * Uses unique key: uniq_provider_conversion (provider_id, provider_conversion_id)
   * Matches database schema from 004_recreate_offerwall_tables.sql
   */
  checkDuplicateConversion = async (providerId, providerConversionId) => {
    const sql = `
      SELECT id, status, coins, usd_amount
      FROM ${this.conversionsTable}
      WHERE provider_id = ? AND provider_conversion_id = ?
      LIMIT 1
    `;

    const result = await coinQuery(sql, [providerId, providerConversionId]);
    return result.length > 0 ? result[0] : null;
  };

  /**
   * Create new conversion record
   * Matches database structure from 004_recreate_offerwall_tables.sql:
   * - user_id (bigint) - internal user ID
   * - provider_id (varchar) - provider name like 'ayetstudios', 'bitlabs'
   * - provider_conversion_id (varchar) - transaction_id from provider
   * - external_user_id (varchar) - offer_token we sent to provider
   * - reward_type (enum) - 'survey', 'offer', 'ptc', 'playtime', 'other'
   * - coins (decimal) - coins awarded
   * - usd_amount (decimal) - USD payout amount
   * - xp_earned (int) - XP earned
   * - status (enum) - 'pending', 'credited', 'reversed', 'rejected'
   * - ip, webhook_ip, user_agent - network info
   * - raw_payload (json) - full webhook data
   */
  createConversion = async (conversionData) => {
    const {
      userId,
      providerId,
      providerConversionId,
      externalUserId,
      rewardType = 'other',
      coins,
      usdAmount = null,
      xpEarned = 0,
      status,
      ip = null,
      webhookIp = null,
      userAgent = null,
      rawPayload,
    } = conversionData;

    const sql = `
      INSERT INTO ${this.conversionsTable}
      (user_id, provider_id, provider_conversion_id, external_user_id,
       reward_type, coins, usd_amount, xp_earned, status, ip, webhook_ip,
       user_agent, raw_payload, credited_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    try {
      const result = await coinQuery(sql, [
        userId,
        providerId,
        providerConversionId,
        externalUserId,
        rewardType,
        coins,
        usdAmount,
        xpEarned,
        status,
        ip,
        webhookIp,
        userAgent,
        JSON.stringify(rawPayload),
      ]);

      return {
        success: true,
        conversionId: result.insertId,
      };
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return {
          success: false,
          error: "Duplicate conversion",
          isDuplicate: true,
        };
      }
      throw error;
    }
  };

  /**
   * Update conversion status (for reversals)
   */
  updateConversionStatus = async (
    providerId,
    providerConversionId,
    status
  ) => {
    const sql = `
      UPDATE ${this.conversionsTable}
      SET status = ?, reversed_at = ${status === 'reversed' ? 'NOW()' : 'NULL'}
      WHERE provider_id = ? AND provider_conversion_id = ?
    `;

    const result = await coinQuery(sql, [
      status,
      providerId,
      providerConversionId,
    ]);

    return {
      success: result.affectedRows > 0,
      affectedRows: result.affectedRows,
    };
  };

  /**
   * Get conversion by ID
   */
  getConversionById = async (conversionId) => {
    const sql = `
      SELECT *
      FROM ${this.conversionsTable}
      WHERE id = ?
      LIMIT 1
    `;

    const result = await coinQuery(sql, [conversionId]);
    return result[0];
  };

  /**
   * Get user conversions history
   */
  getUserConversions = async (userId, options = {}) => {
    const {
      page = 1,
      limit = 20,
      providerId = null,
      status = null,
      rewardType = null,
    } = options;

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const offset = (pageInt - 1) * limitInt;

    let whereConditions = ["user_id = ?"];
    let queryParams = [userId];

    if (providerId) {
      whereConditions.push("provider_id = ?");
      queryParams.push(providerId);
    }

    if (status) {
      whereConditions.push("status = ?");
      queryParams.push(status);
    }

    if (rewardType) {
      whereConditions.push("reward_type = ?");
      queryParams.push(rewardType);
    }

    const whereClause = whereConditions.join(" AND ");

    // Count total
    const countSql = `
      SELECT COUNT(*) as total
      FROM ${this.conversionsTable}
      WHERE ${whereClause}
    `;

    // Get data
    const dataSql = `
      SELECT
        id,
        provider_id,
        provider_conversion_id,
        reward_type,
        coins,
        usd_amount,
        xp_earned,
        status,
        created_at,
        credited_at,
        reversed_at
      FROM ${this.conversionsTable}
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitInt} OFFSET ${offset}
    `;

    const [countResult, conversions] = await Promise.all([
      coinQuery(countSql, queryParams),
      coinQuery(dataSql, queryParams),
    ]);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limitInt);

    return {
      data: conversions.map((conv) => ({
        id: conv.id,
        providerId: conv.provider_id,
        providerConversionId: conv.provider_conversion_id,
        rewardType: conv.reward_type,
        coins: parseFloat(conv.coins),
        usdAmount: conv.usd_amount ? parseFloat(conv.usd_amount) : null,
        xpEarned: conv.xp_earned,
        status: conv.status,
        createdAt: conv.created_at,
        creditedAt: conv.credited_at,
        reversedAt: conv.reversed_at,
      })),
      pagination: {
        currentPage: pageInt,
        limit: limitInt,
        total: total,
        totalPages: totalPages,
        hasNextPage: pageInt < totalPages,
        hasPrevPage: pageInt > 1,
      },
    };
  };

  /**
   * Get conversion statistics for a user
   */
  getUserConversionStats = async (userId) => {
    const sql = `
      SELECT
        COUNT(*) as total_conversions,
        SUM(CASE WHEN status = 'credited' THEN coins ELSE 0 END) as total_coins_earned,
        SUM(CASE WHEN status = 'credited' THEN xp_earned ELSE 0 END) as total_xp_earned,
        SUM(CASE WHEN status = 'reversed' THEN coins ELSE 0 END) as total_coins_reversed,
        COUNT(CASE WHEN status = 'credited' AND reward_type = 'survey' THEN 1 END) as surveys_completed,
        COUNT(CASE WHEN status = 'credited' AND reward_type = 'offer' THEN 1 END) as offers_completed,
        COUNT(CASE WHEN status = 'credited' AND reward_type = 'playtime' THEN 1 END) as playtime_completed,
        COUNT(CASE WHEN status = 'credited' AND reward_type = 'ptc' THEN 1 END) as ptc_completed
      FROM ${this.conversionsTable}
      WHERE user_id = ?
    `;

    const result = await coinQuery(sql, [userId]);

    return {
      totalConversions: result[0].total_conversions,
      totalCoinsEarned: parseFloat(result[0].total_coins_earned) || 0,
      totalXpEarned: result[0].total_xp_earned || 0,
      totalCoinsReversed: parseFloat(result[0].total_coins_reversed) || 0,
      surveysCompleted: result[0].surveys_completed || 0,
      offersCompleted: result[0].offers_completed || 0,
      playtimeCompleted: result[0].playtime_completed || 0,
      ptcCompleted: result[0].ptc_completed || 0,
    };
  };
}

module.exports = new OfferwallModel();
