const { coinQuery, getCoinConnection } = require("../config/db");
const { getUserLevelConfig } = require("../config/rewards.config");

class TreasureChestModel {
  rewardsTableName = "treasure_chest_rewards";
  logsTableName = "treasure_chest_logs";
  balancesTableName = "balances";
  ledgerTableName = "ledger_entries";
  usersTableName = "users";

  // Status hierarchy for min_status checking
  STATUS_HIERARCHY = {
    bronze: 1,
    silver: 2,
    gold: 3,
    diamond: 4,
    legend: 5
  };

  //Get user's current XP, level, and status
  getUserLevelAndStatus = async (userId) => {
    const sql = `SELECT xp FROM ${this.usersTableName} WHERE id = ?`;
    const result = await coinQuery(sql, [userId]);

    if (!result || result.length === 0) {
      return { xp: 0, level: 1, status: 'bronze' };
    }

    const userXp = parseFloat(result[0].xp || 0);
    const config = getUserLevelConfig();

    if (!config) {
      return { xp: userXp, level: 1, status: 'bronze' };
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

    // Determine status based on level
    let status = 'bronze';
    for (const statusConfig of config.statuses) {
      if (level >= statusConfig.min_level && (statusConfig.max_level === null || level <= statusConfig.max_level)) {
        status = statusConfig.id;
        break;
      }
    }

    return { xp: userXp, level, status };
  };

  //Get user's weekly chest limit based on their level
  getWeeklyChestLimit = async (userId) => {
    const { level } = await this.getUserLevelAndStatus(userId);
    const config = getUserLevelConfig();

    if (!config || !config.statuses) {
      return 1; 
    }

    // Find the appropriate sub-level configuration
    for (const status of config.statuses) {
      for (const subLevel of status.sub_levels) {
        // Check if user level matches this sub-level
        const nextSubLevel = status.sub_levels[status.sub_levels.indexOf(subLevel) + 1];
        const maxLevel = nextSubLevel ? nextSubLevel.min_level - 1 : status.max_level;

        if (level >= subLevel.min_level && (!maxLevel || level <= maxLevel)) {
          return subLevel.weekly_chest_free || 1;
        }
      }
    }

    // Default to 1 if no matching level found
    return 1;
  };

  //Get all active treasure chest rewards filtered by user status
  getActiveRewardsForUser = async (userStatus) => {
    const sql = `
      SELECT
        id,
        reward_type,
        label,
        reward_coins,
        weight,
        min_status
      FROM ${this.rewardsTableName}
      WHERE is_active = 1
      ORDER BY weight DESC
    `;

    const allRewards = await coinQuery(sql);

    // Filter rewards based on user status
    const userStatusRank = this.STATUS_HIERARCHY[userStatus] || 1;

    return allRewards.filter(reward => {
      if (!reward.min_status) return true; // No restriction
      const minStatusRank = this.STATUS_HIERARCHY[reward.min_status] || 1;
      return userStatusRank >= minStatusRank;
    });
  };

  //Get this week's chest open count (UTC week: Monday 00:00 to Sunday 23:59)
  getThisWeekChestCount = async (userId) => {
    // Get current UTC date
    const now = new Date();

    // Calculate start of week (Monday 00:00 UTC)
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days since last Monday

    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - daysToMonday);
    weekStart.setUTCHours(0, 0, 0, 0);

    const sql = `
      SELECT COUNT(*) as count
      FROM ${this.logsTableName}
      WHERE user_id = ?
        AND created_at >= ?
    `;

    const result = await coinQuery(sql, [userId, weekStart]);
    return parseInt(result[0].count || 0);
  };

  //Get next weekly reset time (next Monday 00:00 UTC)
  getNextWeeklyReset = () => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ...

    // Calculate days until next Monday
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);

    const nextMonday = new Date(now);
    nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
    nextMonday.setUTCHours(0, 0, 0, 0);

    return nextMonday.toISOString();
  };

  //Check if user has available chests
  hasAvailableChests = async (userId) => {
    const weeklyLimit = await this.getWeeklyChestLimit(userId);
    const thisWeekCount = await this.getThisWeekChestCount(userId);

    return thisWeekCount < weeklyLimit;
  };

  //Weighted random selection
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

    // Fallback to first reward
    return rewards[0];
  };

  //Process opening a treasure chest
  openChest = async (userId, ip = null, deviceFingerprint = null) => {
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

      // 1. Get user level and status
      const { level, status } = await this.getUserLevelAndStatus(userId);

      // 2. Check if user has available chests
      const hasChests = await this.hasAvailableChests(userId);
      if (!hasChests) {
        await new Promise((resolve) => {
          connection.rollback(() => resolve());
        });
        connection.release();
        throw new Error("NO_CHEST_AVAILABLE");
      }

      // 3. Get eligible rewards for user's status
      const eligibleRewards = await this.getActiveRewardsForUser(status);

      if (!eligibleRewards || eligibleRewards.length === 0) {
        throw new Error("NO_REWARDS_CONFIGURED");
      }

      // 4. Select reward using weighted algorithm
      const selectedReward = this.selectRewardByWeight(eligibleRewards);

      // 5. Calculate reward value
      let rewardValue = 0;
      let coinAmount = 0;

      if (selectedReward.reward_type === 'coins') {
        coinAmount = parseFloat(selectedReward.reward_coins || 0);
        rewardValue = coinAmount;
      } else if (selectedReward.reward_type === 'offer_boost') {
        // Get boost % from user config
        const config = getUserLevelConfig();
        const userSubLevel = this.findUserSubLevel(level, config);
        rewardValue = userSubLevel?.offer_boost_percent || 8;
      } else if (selectedReward.reward_type === 'ptc_discount') {
        // Get discount % from user config
        const config = getUserLevelConfig();
        const userSubLevel = this.findUserSubLevel(level, config);
        rewardValue = userSubLevel?.ptc_discount_percent || 3;
      } else if (selectedReward.reward_type === 'extra_spin') {
        rewardValue = 2; // +2 spins
      }

      const now = new Date();

      // 6. Insert chest opening log
      const insertLogSql = `
        INSERT INTO ${this.logsTableName}
        (user_id, reward_id, reward_type, reward_value, user_status, user_level, ip, device_fingerprint, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const logResult = await executeQuery(insertLogSql, [
        userId,
        selectedReward.id,
        selectedReward.reward_type,
        rewardValue,
        status,
        level,
        ip,
        deviceFingerprint,
        now
      ]);

      // 7. Update user balance if coins > 0 (creates balance if doesn't exist)
      if (coinAmount > 0) {
        const updateBalanceSql = `
          INSERT INTO ${this.balancesTableName} (user_id, currency, available, pending)
          VALUES (?, 'COIN', ?, 0)
          ON DUPLICATE KEY UPDATE available = available + ?
        `;

        await executeQuery(updateBalanceSql, [userId, coinAmount, coinAmount]);

        // 8. Create ledger entry
        const ledgerSql = `
          INSERT INTO ${this.ledgerTableName}
          (user_id, currency, entry_type, amount, ref_type, ref_id, created_at)
          VALUES (?, 'COIN', 'credit', ?, 'treasure_chest', ?, ?)
        `;

        await executeQuery(ledgerSql, [
          userId,
          coinAmount,
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
        success: true,
        reward: {
          type: selectedReward.reward_type,
          value: rewardValue,
          label: selectedReward.label
        }
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

  //Find user's current sub-level configuration
  findUserSubLevel = (level, config) => {
    if (!config || !config.statuses) return null;

    for (const status of config.statuses) {
      for (const subLevel of status.sub_levels) {
        const nextSubLevel = status.sub_levels[status.sub_levels.indexOf(subLevel) + 1];
        const maxLevel = nextSubLevel ? nextSubLevel.min_level - 1 : status.max_level;

        if (level >= subLevel.min_level && (!maxLevel || level <= maxLevel)) {
          return subLevel;
        }
      }
    }

    return null;
  };

  //Get user's chest opening history
  getUserChestHistory = async (userId, limit = 10) => {
    const safeLimit = parseInt(limit, 10) || 10;

    const sql = `
      SELECT
        l.id,
        l.reward_type,
        l.reward_value,
        l.user_status,
        l.user_level,
        l.created_at,
        r.label
      FROM ${this.logsTableName} l
      JOIN ${this.rewardsTableName} r ON l.reward_id = r.id
      WHERE l.user_id = ?
      ORDER BY l.created_at DESC
      LIMIT ${safeLimit}
    `;

    return await coinQuery(sql, [userId]);
  };
}

module.exports = new TreasureChestModel();
