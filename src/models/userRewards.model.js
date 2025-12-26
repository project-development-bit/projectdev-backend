const { coinQuery, getCoinConnection } = require("../config/db");
const { getUserLevelConfig } = require("../config/rewards.config");

class UserRewardsModel {
  tableName = "user_rewards";

  /**
   * Grant a reward to a user
   * @param {Object} params - Reward parameters
   * @param {number} params.userId - User ID
   * @param {string} params.rewardType - 'treasure_chest', 'extra_spin', 'offer_boost', 'ptc_discount'
   * @param {string} params.sourceType - 'fortune_wheel', 'treasure_chest', 'admin', 'promotion'
   * @param {number|null} params.sourceId - FK to source log (fortune_wheel_logs or treasure_chest_logs)
   * @param {number} params.quantity - Number of items (default 1)
   * @param {Object|null} params.rewardData - Additional JSON data
   * @param {Date|null} params.expiresAt - Expiration date (optional)
   * @param {Object|null} connection - Database connection (for transactions)
   * @returns {Promise<Object>} Insert result
   */
  grantReward = async ({
    userId,
    rewardType,
    sourceType,
    sourceId = null,
    quantity = 1,
    rewardData = null,
    expiresAt = null
  }, connection = null) => {
    const now = new Date();

    const sql = `
      INSERT INTO ${this.tableName}
      (user_id, reward_type, source_type, source_id, quantity, reward_data, expires_at, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `;

    const values = [
      userId,
      rewardType,
      sourceType,
      sourceId,
      quantity,
      rewardData ? JSON.stringify(rewardData) : null,
      expiresAt,
      now,
      now
    ];

    if (connection) {
      return new Promise((resolve, reject) => {
        connection.execute(sql, values, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });
    } else {
      return await coinQuery(sql, values);
    }
  };

  /**
   * Get active rewards for a user
   * @param {number} userId - User ID
   * @param {string|null} rewardType - Filter by reward type (optional)
   * @returns {Promise<Array>} List of active rewards
   */
  getActiveRewards = async (userId, rewardType = null) => {
    const now = new Date();

    let sql = `
      SELECT
        id,
        user_id,
        reward_type,
        source_type,
        source_id,
        quantity,
        reward_data,
        expires_at,
        created_at
      FROM ${this.tableName}
      WHERE user_id = ?
        AND is_active = 1
        AND (expires_at IS NULL OR expires_at > ?)
    `;

    const values = [userId, now];

    if (rewardType) {
      sql += ` AND reward_type = ?`;
      values.push(rewardType);
    }

    sql += ` ORDER BY created_at ASC`;

    const results = await coinQuery(sql, values);

    // Parse reward_data JSON
    return results.map(row => ({
      ...row,
      reward_data: row.reward_data ? JSON.parse(row.reward_data) : null
    }));
  };

  /**
   * Get count of active rewards by type
   * @param {number} userId - User ID
   * @param {string} rewardType - Reward type
   * @returns {Promise<number>} Count of active rewards
   */
  getActiveRewardCount = async (userId, rewardType) => {
    const now = new Date();

    const sql = `
      SELECT COALESCE(SUM(quantity), 0) as total
      FROM ${this.tableName}
      WHERE user_id = ?
        AND reward_type = ?
        AND is_active = 1
        AND (expires_at IS NULL OR expires_at > ?)
    `;

    const result = await coinQuery(sql, [userId, rewardType, now]);
    return parseInt(result[0].total || 0);
  };

  /**
   * Consume/use a reward
   * @param {number} rewardId - Reward ID to consume
   * @param {Object|null} connection - Database connection (for transactions)
   * @returns {Promise<Object>} Update result
   */
  consumeReward = async (rewardId, connection = null) => {
    const now = new Date();

    const sql = `
      UPDATE ${this.tableName}
      SET is_active = 0, used_at = ?, updated_at = ?
      WHERE id = ? AND is_active = 1
    `;

    if (connection) {
      return new Promise((resolve, reject) => {
        connection.execute(sql, [now, now, rewardId], (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });
    } else {
      return await coinQuery(sql, [now, now, rewardId]);
    }
  };

  /**
   * Consume multiple rewards (e.g., when using spins)
   * @param {number} userId - User ID
   * @param {string} rewardType - Reward type
   * @param {number} quantity - Number to consume
   * @param {Object|null} connection - Database connection (for transactions)
   * @returns {Promise<Array>} IDs of consumed rewards
   */
  consumeRewardsByType = async (userId, rewardType, quantity, connection = null) => {
    const now = new Date();

    // First, get the rewards to consume (FIFO - oldest first)
    const selectSql = `
      SELECT id, quantity
      FROM ${this.tableName}
      WHERE user_id = ?
        AND reward_type = ?
        AND is_active = 1
        AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY created_at ASC
      ${connection ? 'FOR UPDATE' : ''}
    `;

    let rewards;
    if (connection) {
      rewards = await new Promise((resolve, reject) => {
        connection.execute(selectSql, [userId, rewardType, now], (error, rows) => {
          if (error) reject(error);
          else resolve(rows);
        });
      });
    } else {
      rewards = await coinQuery(selectSql, [userId, rewardType, now]);
    }

    let remainingToConsume = quantity;
    const consumedIds = [];

    for (const reward of rewards) {
      if (remainingToConsume <= 0) break;

      if (reward.quantity <= remainingToConsume) {
        // Consume entire reward
        consumedIds.push(reward.id);
        remainingToConsume -= reward.quantity;

        // Mark as consumed
        const updateSql = `
          UPDATE ${this.tableName}
          SET is_active = 0, used_at = ?, updated_at = ?
          WHERE id = ?
        `;

        if (connection) {
          await new Promise((resolve, reject) => {
            connection.execute(updateSql, [now, now, reward.id], (error, result) => {
              if (error) reject(error);
              else resolve(result);
            });
          });
        } else {
          await coinQuery(updateSql, [now, now, reward.id]);
        }
      } else {
        // Partially consume this reward (reduce quantity)
        const newQuantity = reward.quantity - remainingToConsume;
        consumedIds.push(reward.id);

        const updateSql = `
          UPDATE ${this.tableName}
          SET quantity = ?, updated_at = ?
          WHERE id = ?
        `;

        if (connection) {
          await new Promise((resolve, reject) => {
            connection.execute(updateSql, [newQuantity, now, reward.id], (error, result) => {
              if (error) reject(error);
              else resolve(result);
            });
          });
        } else {
          await coinQuery(updateSql, [newQuantity, now, reward.id]);
        }

        remainingToConsume = 0;
      }
    }

    return consumedIds;
  };

  /**
   * Check if user has an active offer boost
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Active boost or null
   */
  getActiveOfferBoost = async (userId) => {
    const now = new Date();

    const sql = `
      SELECT
        id,
        reward_data,
        created_at,
        expires_at
      FROM ${this.tableName}
      WHERE user_id = ?
        AND reward_type = 'offer_boost'
        AND is_active = 1
        AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const results = await coinQuery(sql, [userId, now]);

    if (results.length === 0) return null;

    const boost = results[0];
    const rewardData = boost.reward_data ? JSON.parse(boost.reward_data) : {};

    return {
      id: boost.id,
      percentage: rewardData.percentage || 0,
      expiresAt: boost.expires_at,
      createdAt: boost.created_at
    };
  };

  /**
   * Check if user has an active PTC discount
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Active discount or null
   */
  getActivePtcDiscount = async (userId) => {
    const now = new Date();

    const sql = `
      SELECT
        id,
        reward_data,
        created_at,
        expires_at
      FROM ${this.tableName}
      WHERE user_id = ?
        AND reward_type = 'ptc_discount'
        AND is_active = 1
        AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const results = await coinQuery(sql, [userId, now]);

    if (results.length === 0) return null;

    const discount = results[0];
    const rewardData = discount.reward_data ? JSON.parse(discount.reward_data) : {};

    return {
      id: discount.id,
      percentage: rewardData.percentage || 0,
      expiresAt: discount.expires_at,
      createdAt: discount.created_at
    };
  };

  /**
   * Clean up expired rewards (run as scheduled job)
   * @returns {Promise<number>} Number of expired rewards deactivated
   */
  deactivateExpiredRewards = async () => {
    const now = new Date();

    const sql = `
      UPDATE ${this.tableName}
      SET is_active = 0, updated_at = ?
      WHERE is_active = 1
        AND expires_at IS NOT NULL
        AND expires_at <= ?
    `;

    const result = await coinQuery(sql, [now, now]);
    return result.affectedRows;
  };
}

module.exports = new UserRewardsModel();
