const { coinQuery, coinDB } = require("../config/db");

class OfferwallModel {
  offerConversionsTable = "offer_conversions";
  webhookLogsTable = "webhook_logs";
  balancesTable = "balances";
  usersTable = "users";

  saveWebhookLog = async (provider, ip, headers, payload, processingStatus, errorMessage = null) => {
    const sql = `
      INSERT INTO ${this.webhookLogsTable}
      (provider, ip, headers_json, payload_json, processing_status, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const result = await coinQuery(sql, [
      provider,
      ip,
      JSON.stringify(headers),
      JSON.stringify(payload),
      processingStatus,
      errorMessage,
    ]);

    return result.insertId;
  };

  getWebhookLogs = async (filters = {}) => {
    const { provider, processingStatus, limit = 50, offset = 0 } = filters;

    let whereClauses = [];
    let params = [];

    if (provider) {
      whereClauses.push('provider = ?');
      params.push(provider);
    }

    if (processingStatus) {
      whereClauses.push('processing_status = ?');
      params.push(processingStatus);
    }

    const whereClause = whereClauses.length > 0
      ? 'WHERE ' + whereClauses.join(' AND ')
      : '';

    const limitInt = parseInt(limit) || 50;
    const offsetInt = parseInt(offset) || 0;

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total
      FROM ${this.webhookLogsTable}
      ${whereClause}
    `;
    const countResult = await coinQuery(countSql, params);
    const total = countResult[0].total;

    const sql = `
      SELECT id, provider, ip, headers_json, payload_json,
             processing_status, error_message, created_at
      FROM ${this.webhookLogsTable}
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `;
    const results = await coinQuery(sql, params);

    return {
      logs: results,
      pagination: {
        total,
        limit: limitInt,
        offset: offsetInt,
        totalPages: Math.ceil(total / limitInt),
        currentPage: Math.floor(offsetInt / limitInt) + 1
      }
    };
  };

  getOfferConversions = async (filters = {}) => {
    const { userId, provider, rewardType, status, limit = 50, offset = 0 } = filters;

    let whereClauses = ['user_id = ?'];
    let params = [userId];

    if (provider) {
      whereClauses.push('provider_id = ?');
      params.push(provider);
    }

    if (rewardType) {
      whereClauses.push('reward_type = ?');
      params.push(rewardType);
    }

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    const whereClause = 'WHERE ' + whereClauses.join(' AND ');

    const limitInt = parseInt(limit) || 50;
    const offsetInt = parseInt(offset) || 0;

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total
      FROM ${this.offerConversionsTable}
      ${whereClause}
    `;
    const countResult = await coinQuery(countSql, params);
    const total = countResult[0].total;

    // Get paginated results
    const sql = `
      SELECT id, provider_id, provider_conversion_id, external_user_id,
             reward_type, coins, usd_amount, xp_earned, status,
             ip, webhook_ip, created_at, credited_at, reversed_at
      FROM ${this.offerConversionsTable}
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `;
    const results = await coinQuery(sql, params);

    return {
      conversions: results,
      pagination: {
        total,
        limit: limitInt,
        offset: offsetInt,
        totalPages: Math.ceil(total / limitInt),
        currentPage: Math.floor(offsetInt / limitInt) + 1
      }
    };
  };

  checkDuplicateConversion = async (providerId, providerConversionId) => {
    const sql = `
      SELECT id, status
      FROM ${this.offerConversionsTable}
      WHERE provider_id = ? AND provider_conversion_id = ?
      LIMIT 1
    `;

    const result = await coinQuery(sql, [providerId, providerConversionId]);
    return result.length > 0 ? result[0] : null;
  };

  getUserByOfferToken = async (offerToken) => {
    const sql = `
      SELECT id, email, offer_token
      FROM ${this.usersTable}
      WHERE offer_token = ?
      LIMIT 1
    `;

    const result = await coinQuery(sql, [offerToken]);
    return result.length > 0 ? result[0] : null;
  };

  getUserById = async (userId) => {
    const sql = `
      SELECT id, email, offer_token
      FROM ${this.usersTable}
      WHERE id = ?
      LIMIT 1
    `;

    const result = await coinQuery(sql, [userId]);
    return result.length > 0 ? result[0] : null;
  };

  createConversion = async (conversionData) => {
    const {
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
      rawPayload,
    } = conversionData;

    const sql = `
      INSERT INTO ${this.offerConversionsTable}
      (user_id, provider_id, provider_conversion_id, external_user_id, reward_type,
       coins, usd_amount, xp_earned, status, ip, webhook_ip, user_agent, raw_payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

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

    return result.insertId;
  };

  creditUserBalance = async (userId, coins, xpEarned, conversionId) => {
    const connection = await this.getConnection();
    const now = new Date();

    try {
      await this.beginTransaction(connection);

      const updateBalanceSql = `
        UPDATE ${this.balancesTable}
        SET available = available + ?
        WHERE user_id = ? AND currency = 'COIN'
      `;
      await this.queryWithConnection(connection, updateBalanceSql, [coins, userId]);

      const ledgerSql = `
        INSERT INTO ledger_entries
        (user_id, currency, entry_type, amount, ref_type, ref_id,  created_at)
        VALUES (?, 'COIN', 'credit', ?, 'offerwall', ?, ?)
      `;

      await this.queryWithConnection(connection,ledgerSql, [userId,coins,conversionId.toString(),now]);

      const updateXpSql = `
        UPDATE ${this.usersTable}
        SET xp = xp + ?,
            updated_at = NOW()
        WHERE id = ?
      `;
      await this.queryWithConnection(connection, updateXpSql, [xpEarned, userId]);

      const updateConversionSql = `
        UPDATE ${this.offerConversionsTable}
        SET status = 'credited',
            credited_at = NOW()
        WHERE id = ?
      `;
      await this.queryWithConnection(connection, updateConversionSql, [conversionId]);

      await this.commitTransaction(connection);
      return true;
    } catch (error) {
      await this.rollbackTransaction(connection);
      throw error;
    } finally {
      connection.release();
    }
  };

  reverseConversion = async (userId, coins, xpEarned, conversionId) => {
    const connection = await this.getConnection();

    try {
      await this.beginTransaction(connection);

      const updateBalanceSql = `
        UPDATE ${this.balancesTable}
        SET available = GREATEST(0, available - ?) 
        WHERE user_id = ? AND currency = 'COIN'
      `;
      await this.queryWithConnection(connection, updateBalanceSql, [coins, userId]);

      const ledgerSql = `
        INSERT INTO ledger_entries
        (user_id, currency, entry_type, amount, ref_type, ref_id,  created_at)
        VALUES (?, 'COIN', 'debit', ?, 'offerwall', ?, ?)
      `;
      await this.queryWithConnection(connection,ledgerSql, [userId,coins,conversionId.toString(),now]);

      const updateXpSql = `
        UPDATE ${this.usersTable}
        SET xp = GREATEST(0, xp - ?),
            updated_at = NOW()
        WHERE id = ?
      `;
      await this.queryWithConnection(connection, updateXpSql, [xpEarned, userId]);

      const updateConversionSql = `
        UPDATE ${this.offerConversionsTable}
        SET status = 'reversed',
            reversed_at = NOW()
        WHERE id = ?
      `;
      await this.queryWithConnection(connection, updateConversionSql, [conversionId]);

      await this.commitTransaction(connection);
      return true;
    } catch (error) {
      await this.rollbackTransaction(connection);
      throw error;
    } finally {
      connection.release();
    }
  };

  getConnection = () => {
    return new Promise((resolve, reject) => {
      coinDB.getConnection((err, connection) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(connection);
      });
    });
  };

  beginTransaction = (connection) => {
    return new Promise((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  };

  commitTransaction = (connection) => {
    return new Promise((resolve, reject) => {
      connection.commit((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  };

  rollbackTransaction = (connection) => {
    return new Promise((resolve, reject) => {
      connection.rollback(() => {
        resolve();
      });
    });
  };

  queryWithConnection = (connection, sql, values) => {
    return new Promise((resolve, reject) => {
      connection.execute(sql, values, (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  };
}

module.exports = new OfferwallModel();
