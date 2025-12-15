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

    try {
      await this.beginTransaction(connection);

      const updateBalanceSql = `
        UPDATE ${this.balancesTable}
        SET available = available + ?,
            updated_at = NOW()
        WHERE user_id = ? AND currency = 'COIN'
      `;
      await this.queryWithConnection(connection, updateBalanceSql, [coins, userId]);

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
        SET available = GREATEST(0, available - ?),
            updated_at = NOW()
        WHERE user_id = ? AND currency = 'COIN'
      `;
      await this.queryWithConnection(connection, updateBalanceSql, [coins, userId]);

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
