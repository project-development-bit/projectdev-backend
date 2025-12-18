const { coinQuery, getCoinConnection } = require("../config/db");
const { getUserLevelConfig } = require("../config/rewards.config");

class FortuneWheelModel {
  rewardsTableName = "fortune_wheel_rewards";
  logsTableName = "fortune_wheel_logs";
  balancesTableName = "balances";
  ledgerTableName = "ledger_entries";
  usersTableName = "users";

  // Daily coin cap for fortune wheel
  DAILY_COIN_CAP = 30;

  //Get user's current XP and level
  getUserLevel = async (userId) => {
    const sql = `SELECT xp FROM ${this.usersTableName} WHERE id = ?`;
    const result = await coinQuery(sql, [userId]);

    if (!result || result.length === 0) {
      return { xp: 0, level: 1 };
    }

    const userXp = parseFloat(result[0].xp || 0);
    const config = getUserLevelConfig();

    if (!config) {
      return { xp: userXp, level: 1 };
    }

    // Calculate level from XP
    let level = 1;
    const { base_xp_for_level_2, growth_factor_per_level } = config.xp_rules.config;

    let totalXpNeeded = 0;
    while (true) {
      const nextLevel = level + 1;
      const xpForNextLevel = nextLevel === 2
        ? base_xp_for_level_2
        : Math.round(base_xp_for_level_2 * Math.pow(growth_factor_per_level, nextLevel - 2));

      totalXpNeeded += xpForNextLevel;

      if (userXp < totalXpNeeded) {
        break;
      }

      level = nextLevel;
    }

    return { xp: userXp, level };
  };

  //Get user's daily spin limit based on their level
  getDailySpinLimit = async (userId) => {
    const { level } = await this.getUserLevel(userId);
    const config = getUserLevelConfig();

    if (!config || !config.statuses) {
      return 1; // Default to 1 spin if config is missing
    }

    // Find the appropriate sub-level configuration
    for (const status of config.statuses) {
      for (const subLevel of status.sub_levels) {
        // Check if user level matches this sub-level
        const nextSubLevel = status.sub_levels[status.sub_levels.indexOf(subLevel) + 1];
        const maxLevel = nextSubLevel ? nextSubLevel.min_level - 1 : status.max_level;

        if (level >= subLevel.min_level && (!maxLevel || level <= maxLevel)) {
          return subLevel.daily_spin_free || 1;
        }
      }
    }

    // Default to 1 if no matching level found
    return 1;
  };

  //Get all active fortune wheel rewards
  getActiveRewards = async () => {
    const sql = `
      SELECT
        id,
        wheel_index,
        label,
        reward_coins,
        reward_usd,
        reward_type,
        icon_url
      FROM ${this.rewardsTableName}
      WHERE is_active = 1
      ORDER BY wheel_index ASC
    `;

    return await coinQuery(sql);
  };

  //Get all rewards with weights
  getAllRewardsWithWeights = async () => {
    const sql = `
      SELECT
        id,
        wheel_index,
        label,
        reward_coins,
        reward_usd,
        reward_type,
        weight,
        icon_url
      FROM ${this.rewardsTableName}
      WHERE is_active = 1
      ORDER BY wheel_index ASC
    `;

    return await coinQuery(sql);
  };

  //Get today's spin count
  getTodaySpinCount = async (userId) => {
    const today = new Date().toISOString().split('T')[0]; // UTC date

    const sql = `
      SELECT COUNT(*) as count
      FROM ${this.logsTableName}
      WHERE user_id = ?
        AND DATE(created_at) = ?
    `;

    const result = await coinQuery(sql, [userId, today]);
    return parseInt(result[0].count || 0);
  };

  //Check if user has reached daily spin limit
  hasSpunToday = async (userId) => {
    const todaySpinCount = await this.getTodaySpinCount(userId);
    const dailyLimit = await this.getDailySpinLimit(userId);

    return todaySpinCount >= dailyLimit;
  };

  //Get total coins earned from fortune wheel today
  getTodayCoinsEarned = async (userId) => {
    const today = new Date().toISOString().split('T')[0]; // UTC date

    const sql = `
      SELECT COALESCE(SUM(reward_coins), 0) as total
      FROM ${this.logsTableName}
      WHERE user_id = ?
        AND DATE(created_at) = ?
    `;

    const result = await coinQuery(sql, [userId, today]);
    return parseFloat(result[0].total || 0);
  };

  //Weighted random selection algorithm
  selectRewardByWeight = (rewards) => {
    // Calculate total weight
    const totalWeight = rewards.reduce((sum, reward) => sum + parseFloat(reward.weight), 0);

    // Generate random number between 0 and totalWeight
    let random = Math.random() * totalWeight;

    // Select reward based on cumulative weight
    for (const reward of rewards) {
      random -= parseFloat(reward.weight);
      if (random <= 0) {
        return reward;
      }
    }

    // Fallback to first reward (should never reach here)
    return rewards[0];
  };

  //Get the lowest coin reward
  getLowestCoinReward = (rewards) => {
    const coinRewards = rewards.filter(r => r.reward_type === 'coins' && parseFloat(r.reward_coins) > 0);

    if (coinRewards.length === 0) {
      // If no coin rewards, return a zero reward
      return rewards.find(r => parseFloat(r.reward_coins) === 0) || rewards[0];
    }

    return coinRewards.reduce((lowest, current) =>
      parseFloat(current.reward_coins) < parseFloat(lowest.reward_coins) ? current : lowest
    );
  };

  //Process a fortune wheel spin
  processSpin = async (userId, ip = null, deviceFingerprint = null) => {
    // Get a dedicated connection for transaction
    const connection = await getCoinConnection();

    // Helper function to execute queries on the connection
    const executeQuery = (sql, values) => {
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

    try {
      // Start transaction
      await new Promise((resolve, reject) => {
        connection.beginTransaction((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // 1. Check if user already spun today
      const hasSpun = await this.hasSpunToday(userId);
      if (hasSpun) {
        await new Promise((resolve) => {
          connection.rollback(() => resolve());
        });
        connection.release();
        throw new Error("ALREADY_SPUN_TODAY");
      }

      // 2. Get today's earnings
      const todayEarnings = await this.getTodayCoinsEarned(userId);

      // 3. Get all rewards with weights
      const allRewards = await this.getAllRewardsWithWeights();

      if (!allRewards || allRewards.length === 0) {
        throw new Error("NO_REWARDS_CONFIGURED");
      }

      // 4. Select reward using weighted algorithm
      let selectedReward = this.selectRewardByWeight(allRewards);

      // 5. Enforce daily coin cap
      const remainingCap = this.DAILY_COIN_CAP - todayEarnings;
      const selectedCoins = parseFloat(selectedReward.reward_coins);

      if (selectedCoins > remainingCap) {
        // Force lowest reward or zero
        if (remainingCap > 0) {
          selectedReward = this.getLowestCoinReward(allRewards);
          // Ensure it doesn't exceed remaining cap
          if (parseFloat(selectedReward.reward_coins) > remainingCap) {
            // Find or create a zero reward
            selectedReward = allRewards.find(r => parseFloat(r.reward_coins) === 0) || selectedReward;
          }
        } else {
          // Cap reached, force zero reward
          selectedReward = allRewards.find(r => parseFloat(r.reward_coins) === 0) || this.getLowestCoinReward(allRewards);
        }
      }

      const finalCoins = Math.min(parseFloat(selectedReward.reward_coins), remainingCap);
      const now = new Date();

      // 6. Insert spin log
      const insertLogSql = `
        INSERT INTO ${this.logsTableName}
        (user_id, reward_id, reward_coins, reward_usd, wheel_index, ip, device_fingerprint, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const logResult = await executeQuery(insertLogSql, [
        userId,
        selectedReward.id,
        finalCoins,
        selectedReward.reward_usd,
        selectedReward.wheel_index,
        ip,
        deviceFingerprint,
        now
      ]);

      // 7. Update user balance if coins > 0
      if (finalCoins > 0) {
        const updateBalanceSql = `
          UPDATE ${this.balancesTableName}
          SET available = available + ?
          WHERE user_id = ? AND currency = 'COIN'
        `;

        await executeQuery(updateBalanceSql, [finalCoins, userId]);

        // 8. Create ledger entry
        const ledgerSql = `
          INSERT INTO ${this.ledgerTableName}
          (user_id, currency, entry_type, amount, ref_type, ref_id, created_at)
          VALUES (?, 'COIN', 'credit', ?, 'fortune_wheel', ?, ?)
        `;

        await executeQuery(ledgerSql, [
          userId,
          finalCoins,
          logResult.insertId.toString(),
          now
        ]);
      }

      // Commit transaction
      await new Promise((resolve, reject) => {
        connection.commit((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Release connection
      connection.release();

      // Return result for frontend
      return {
        wheel_index: selectedReward.wheel_index,
        label: selectedReward.label,
        reward_coins: finalCoins,
        reward_usd: selectedReward.reward_usd,
        reward_type: selectedReward.reward_type,
      };

    } catch (error) {
      // Rollback on error
      await new Promise((resolve) => {
        connection.rollback(() => resolve());
      });
      connection.release();
      throw error;
    }
  };

  //Get user's spin history
  getUserSpinHistory = async (userId, limit = 10) => {
    const safeLimit = parseInt(limit, 10) || 10;

    const sql = `
      SELECT
        l.id,
        l.reward_coins,
        l.reward_usd,
        l.wheel_index,
        l.created_at,
        r.label,
        r.reward_type
      FROM ${this.logsTableName} l
      JOIN ${this.rewardsTableName} r ON l.reward_id = r.id
      WHERE l.user_id = ?
      ORDER BY l.created_at DESC
      LIMIT ${safeLimit}
    `;

    return await coinQuery(sql, [userId]);
  };

    //Process a fortune wheel spin
  testProcessSpin = async (userId, ip = null, deviceFingerprint = null) => {
    // Get a dedicated connection for transaction
    const connection = await getCoinConnection();

    // Helper function to execute queries on the connection
    const executeQuery = (sql, values) => {
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

    try {
      // Start transaction
      await new Promise((resolve, reject) => {
        connection.beginTransaction((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // 1. Check if user already spun today
      // const hasSpun = await this.hasSpunToday(userId);
      // if (hasSpun) {
      //   await new Promise((resolve) => {
      //     connection.rollback(() => resolve());
      //   });
      //   connection.release();
      //   throw new Error("ALREADY_SPUN_TODAY");
      // }

      // 2. Get today's earnings
      const todayEarnings = await this.getTodayCoinsEarned(userId);

      // 3. Get all rewards with weights
      const allRewards = await this.getAllRewardsWithWeights();

      if (!allRewards || allRewards.length === 0) {
        throw new Error("NO_REWARDS_CONFIGURED");
      }

      // 4. Select reward using weighted algorithm
      let selectedReward = this.selectRewardByWeight(allRewards);

      // 5. Enforce daily coin cap
      const remainingCap = this.DAILY_COIN_CAP - todayEarnings;
      const selectedCoins = parseFloat(selectedReward.reward_coins);

      if (selectedCoins > remainingCap) {
        // Force lowest reward or zero
        if (remainingCap > 0) {
          selectedReward = this.getLowestCoinReward(allRewards);
          // Ensure it doesn't exceed remaining cap
          if (parseFloat(selectedReward.reward_coins) > remainingCap) {
            // Find or create a zero reward
            selectedReward = allRewards.find(r => parseFloat(r.reward_coins) === 0) || selectedReward;
          }
        } else {
          // Cap reached, force zero reward
          selectedReward = allRewards.find(r => parseFloat(r.reward_coins) === 0) || this.getLowestCoinReward(allRewards);
        }
      }

      const finalCoins = Math.min(parseFloat(selectedReward.reward_coins), remainingCap);
      const now = new Date();

      // 6. Insert spin log
      const insertLogSql = `
        INSERT INTO ${this.logsTableName}
        (user_id, reward_id, reward_coins, reward_usd, wheel_index, ip, device_fingerprint, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const logResult = await executeQuery(insertLogSql, [
        userId,
        selectedReward.id,
        finalCoins,
        selectedReward.reward_usd,
        selectedReward.wheel_index,
        ip,
        deviceFingerprint,
        now
      ]);

      // 7. Update user balance if coins > 0
      if (finalCoins > 0) {
        const updateBalanceSql = `
          UPDATE ${this.balancesTableName}
          SET available = available + ?
          WHERE user_id = ? AND currency = 'COIN'
        `;

        await executeQuery(updateBalanceSql, [finalCoins, userId]);

        // 8. Create ledger entry
        const ledgerSql = `
          INSERT INTO ${this.ledgerTableName}
          (user_id, currency, entry_type, amount, ref_type, ref_id, created_at)
          VALUES (?, 'COIN', 'credit', ?, 'fortune_wheel', ?, ?)
        `;

        await executeQuery(ledgerSql, [
          userId,
          finalCoins,
          logResult.insertId.toString(),
          now
        ]);
      }

      // Commit transaction
      await new Promise((resolve, reject) => {
        connection.commit((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Release connection
      connection.release();

      // Return result for frontend
      return {
        wheel_index: selectedReward.wheel_index,
        label: selectedReward.label,
        reward_coins: finalCoins,
        reward_usd: selectedReward.reward_usd,
        reward_type: selectedReward.reward_type,
        remaining_daily_cap: Math.max(0, this.DAILY_COIN_CAP - todayEarnings - finalCoins)
      };

    } catch (error) {
      // Rollback on error
      await new Promise((resolve) => {
        connection.rollback(() => resolve());
      });
      connection.release();
      throw error;
    }
  };
}

module.exports = new FortuneWheelModel();
