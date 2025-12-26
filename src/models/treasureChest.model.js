const { coinQuery, getCoinConnection } = require("../config/db");
const { getUserLevelConfig } = require("../config/rewards.config");
const UserRewardsModel = require("./userRewards.model");

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
  getUserLevelAndStatus = async (userId, connection = null) => {
    let sql = `SELECT xp FROM ${this.usersTableName} WHERE id = ?`;

    // Add FOR UPDATE if within transaction
    if (connection) {
      sql += ' FOR UPDATE';
    }

    let result;
    if (connection) {
      result = await new Promise((resolve, reject) => {
        connection.execute(sql, [userId], (error, rows) => {
          if (error) reject(error);
          else resolve(rows);
        });
      });
    } else {
      result = await coinQuery(sql, [userId]);
    }

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
        min_status,
        max_per_week,
        cooldown_hours
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

  getCooldownResult = async (userId)=>{
    const cooldownSql = `
        SELECT last_opened_at
        FROM treasure_chest_logs
        WHERE user_id = ?
          AND chest_type = 'base'
          AND last_opened_at IS NOT NULL
        ORDER BY last_opened_at DESC
        LIMIT 1
      `;
      return await coinQuery(cooldownSql, [userId]);
  }

  getThisWeekChestCount = async (userId, connection = null) => {
    // Get current UTC date
    const now = new Date();

    // Calculate start of week (Sunday 00:00 UTC)
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysToSunday = dayOfWeek; // Days since last Sunday

    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - daysToSunday);
    weekStart.setUTCHours(0, 0, 0, 0);

    let sql = `
      SELECT COUNT(*) as count
      FROM ${this.logsTableName}
      WHERE user_id = ?
        AND chest_type = 'base'
        AND status = 'success'
        AND created_at >= ?
    `;

    // Add FOR UPDATE if within transaction
    if (connection) {
      sql += ' FOR UPDATE';
    }

    let result;
    if (connection) {
      result = await new Promise((resolve, reject) => {
        connection.execute(sql, [userId, weekStart], (error, rows) => {
          if (error) reject(error);
          else resolve(rows);
        });
      });
    } else {
      result = await coinQuery(sql, [userId, weekStart]);
    }

    return parseInt(result[0].count || 0);
  };

  //Get next weekly reset time (next Sunday 00:00 UTC)
  getNextWeeklyReset = () => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Calculate days until next Sunday
    const daysUntilSunday = dayOfWeek === 0 ? 7 : (7 - dayOfWeek);

    const nextSunday = new Date(now);
    nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
    nextSunday.setUTCHours(0, 0, 0, 0);

    return nextSunday.toISOString();
  };

  //Check if user has available chests
  hasAvailableChests = async (userId, connection = null) => {
    const weeklyLimit = await this.getWeeklyChestLimit(userId);
    const thisWeekCount = await this.getThisWeekChestCount(userId, connection);

    return thisWeekCount < weeklyLimit;
  };

  checkGlobalCooldown = async (userId, connection) => {
    const COOLDOWN_HOURS = 24;

    const sql = `
      SELECT last_opened_at
      FROM ${this.logsTableName}
      WHERE user_id = ?
        AND chest_type = 'base'
        AND last_opened_at IS NOT NULL
      ORDER BY last_opened_at DESC
      LIMIT 1
      FOR UPDATE
    `;

    const result = await new Promise((resolve, reject) => {
      connection.execute(sql, [userId], (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });

    if (result && result.length > 0 && result[0].last_opened_at) {
      const lastOpened = new Date(result[0].last_opened_at);
      const now = new Date();
      const hoursSinceLastOpen = (now - lastOpened) / (1000 * 60 * 60);

      if (hoursSinceLastOpen < COOLDOWN_HOURS) {
        const remainingHours = Math.ceil(COOLDOWN_HOURS - hoursSinceLastOpen);
        return {
          allowed: false,
          remainingHours
        };
      }
    }

    return { allowed: true };
  };

  checkRewardMaxPerWeek = async (userId, rewardId, maxPerWeek, connection) => {
    if (!maxPerWeek) return { allowed: true }; // No limit

    // Calculate week start (Sunday 00:00 UTC)
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysToSunday = dayOfWeek; // Days since last Sunday
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - daysToSunday);
    weekStart.setUTCHours(0, 0, 0, 0);

    const sql = `
      SELECT COUNT(*) as count
      FROM ${this.logsTableName}
      WHERE user_id = ?
        AND reward_id = ?
        AND status = 'success'
        AND created_at >= ?
      FOR UPDATE
    `;

    const result = await new Promise((resolve, reject) => {
      connection.execute(sql, [userId, rewardId, weekStart], (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });

    const winCount = parseInt(result[0].count || 0);

    if (winCount >= maxPerWeek) {
      return {
        allowed: false,
        currentCount: winCount,
        maxAllowed: maxPerWeek
      };
    }

    return { allowed: true };
  };

  //Check reward-specific cooldown
  checkRewardCooldown = async (userId, rewardId, cooldownHours, connection) => {
    if (!cooldownHours) return { allowed: true }; // No cooldown

    const sql = `
      SELECT created_at
      FROM ${this.logsTableName}
      WHERE user_id = ?
        AND reward_id = ?
        AND status = 'success'
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `;

    const result = await new Promise((resolve, reject) => {
      connection.execute(sql, [userId, rewardId], (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });

    if (result && result.length > 0) {
      const lastWon = new Date(result[0].created_at);
      const now = new Date();
      const hoursSinceLastWin = (now - lastWon) / (1000 * 60 * 60);

      if (hoursSinceLastWin < cooldownHours) {
        const remainingHours = Math.ceil(cooldownHours - hoursSinceLastWin);
        return {
          allowed: false,
          remainingHours
        };
      }
    }

    return { allowed: true };
  };

  //FIX Issue 6: Log failed attempt
  logFailedAttempt = async (userId, failureReason, level, status, ip, deviceFingerprint, connection) => {
    const now = new Date();

    const sql = `
      INSERT INTO ${this.logsTableName}
      (user_id, reward_id, reward_type, reward_value, user_status, user_level, chest_type, status, ip, device_fingerprint, created_at)
      VALUES (?, NULL, NULL, NULL, ?, ?, 'base', ?, ?, ?, ?)
    `;

    await new Promise((resolve, reject) => {
      connection.execute(sql, [userId, status, level, failureReason, ip, deviceFingerprint, now], (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
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


    getBonusTest = async (userId,) => {
      const connection = await getCoinConnection();
      await UserRewardsModel.grantReward({
               userId,
               rewardType: 'treasure_chest',
               sourceType: 'fortune_wheel',
               sourceId: null,
               quantity: 1,
               rewardData: null,
               expiresAt: null, // Chests don't expire
             }, connection);
    }

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

      // Get user level and status
      const { level, status } = await this.getUserLevelAndStatus(userId, connection);

      // Get available chests (base + bonus)
      const weeklyLimit = await this.getWeeklyChestLimit(userId);
      const thisWeekBaseCount = await this.getThisWeekChestCount(userId, connection);
      const baseChests = Math.max(0, weeklyLimit - thisWeekBaseCount);
      const bonusChests = await UserRewardsModel.getActiveRewardCount(userId, 'treasure_chest');
      const totalChests = baseChests + bonusChests;

      // Check if user has available chests
      if (totalChests <= 0) {
        await this.logFailedAttempt(userId, 'no_chest_available', level, status, ip, deviceFingerprint, connection);
        // Commit the failure log
        await new Promise((resolve, reject) => {
          connection.commit((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        connection.release();
        throw new Error("NO_CHEST_AVAILABLE");
      }

      // Determine which type of chest will be used (bonus first, then base)
      const willUseBonusChest = bonusChests > 0;

      if (!willUseBonusChest) {
        const cooldownCheck = await this.checkGlobalCooldown(userId, connection);
        if (!cooldownCheck.allowed) {
          await this.logFailedAttempt(userId, 'cooldown', level, status, ip, deviceFingerprint, connection);
          await new Promise((resolve, reject) => {
            connection.commit((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          connection.release();
          const error = new Error("COOLDOWN");
          error.remainingHours = cooldownCheck.remainingHours;
          throw error;
        }
      }

      // Consume a chest BEFORE processing reward (prefer bonus chests first)
      let usedBonusChest = false;
      if (bonusChests > 0) {
        // Consume bonus chest from user_rewards
        await UserRewardsModel.consumeRewardsByType(userId, 'treasure_chest', 1, connection);
        usedBonusChest = true;
      }
      // If using base chest, it's automatically consumed by the log entry (weekly limit check)

      // Get eligible rewards for user's status
      const eligibleRewards = await this.getActiveRewardsForUser(status);

      if (!eligibleRewards || eligibleRewards.length === 0) {
        await new Promise((resolve) => connection.rollback(() => resolve()));
        connection.release();
        throw new Error("NO_REWARDS_CONFIGURED");
      }

      // Track all tried reward IDs
      const triedRewardIds = new Set();
      let selectedReward = this.selectRewardByWeight(eligibleRewards);
      let attemptCount = 0;
      const MAX_ATTEMPTS = eligibleRewards.length;

      // Check max_per_week and reward cooldown, re-select if needed
      while (attemptCount < MAX_ATTEMPTS) {
        // Check max_per_week limit
        const maxPerWeekCheck = await this.checkRewardMaxPerWeek(
          userId,
          selectedReward.id,
          selectedReward.max_per_week,
          connection
        );

        // Check reward-specific cooldown
        const rewardCooldownCheck = await this.checkRewardCooldown(
          userId,
          selectedReward.id,
          selectedReward.cooldown_hours,
          connection
        );

        // If reward passes both validations, use it
        if (maxPerWeekCheck.allowed && rewardCooldownCheck.allowed) {
          break; // Valid reward found!
        }

        // Reward failed validation - mark as tried
        triedRewardIds.add(selectedReward.id);

        // Get rewards that haven't been tried yet
        const untriedRewards = eligibleRewards.filter(r => !triedRewardIds.has(r.id));

        if (untriedRewards.length === 0) {
          if (!maxPerWeekCheck.allowed) {
            await this.logFailedAttempt(userId, 'max_reward_limit', level, status, ip, deviceFingerprint, connection);
            await new Promise((resolve, reject) => {
              connection.commit((err) => {
                if (err) reject(err);
                else resolve();
              });
            });
            connection.release();
            throw new Error("MAX_REWARD_LIMIT");
          } else {
            await this.logFailedAttempt(userId, 'cooldown', level, status, ip, deviceFingerprint, connection);
            await new Promise((resolve, reject) => {
              connection.commit((err) => {
                if (err) reject(err);
                else resolve();
              });
            });
            connection.release();
            const error = new Error("COOLDOWN");
            error.remainingHours = rewardCooldownCheck.remainingHours;
            throw error;
          }
        }
        selectedReward = this.selectRewardByWeight(untriedRewards);
        attemptCount++;
      }

      // Calculate reward value and grant non-coin rewards
      let rewardValue = 0;
      let coinAmount = 0;

      if (selectedReward.reward_type === 'coins') {
        coinAmount = parseFloat(selectedReward.reward_coins || 0);
        rewardValue = coinAmount;

      } else if (selectedReward.reward_type === 'offer_boost') {
        // Get boost % from user config
        const config = getUserLevelConfig();
        const userSubLevel = this.findUserSubLevel(level, config);
        const boostPercent = userSubLevel?.offer_boost_percent || 8;
        rewardValue = boostPercent;

        // GRANT THE BOOST via user_rewards table
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiry

        await UserRewardsModel.grantReward({
          userId,
          rewardType: 'offer_boost',
          sourceType: 'treasure_chest',
          sourceId: null, // Will be updated after log insertion if needed
          quantity: 1,
          rewardData: {
            percentage: boostPercent,
            duration_hours: 24
          },
          expiresAt
        }, connection);

      } else if (selectedReward.reward_type === 'ptc_discount') {
        // Get discount % from user config
        const config = getUserLevelConfig();
        const userSubLevel = this.findUserSubLevel(level, config);
        const discountPercent = userSubLevel?.ptc_discount_percent || 3;
        rewardValue = discountPercent;

        // GRANT THE DISCOUNT via user_rewards table
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        await UserRewardsModel.grantReward({
          userId,
          rewardType: 'ptc_discount',
          sourceType: 'treasure_chest',
          sourceId: null,
          quantity: 1,
          rewardData: {
            percentage: discountPercent,
            duration_days: 7
          },
          expiresAt
        }, connection);

      } else if (selectedReward.reward_type === 'extra_spin') {
        // Grant bonus spins to Fortune Wheel
        rewardValue = 2; // +2 spins

        // GRANT THE SPINS via user_rewards table
        await UserRewardsModel.grantReward({
          userId,
          rewardType: 'extra_spin',
          sourceType: 'treasure_chest',
          sourceId: null,
          quantity: 2, // 2 spins
          rewardData: { spins: 2 },
          expiresAt: null // Spins don't expire
        }, connection);
      }

      const now = new Date();

      const chestType = usedBonusChest ? 'bonus' : 'base';
      const lastOpenedAt = usedBonusChest ? null : now; // NULL for bonus, current time for base

      const insertLogSql = `
        INSERT INTO ${this.logsTableName}
        (user_id, reward_id, reward_type, reward_value, user_status, user_level, chest_type, status, ip, device_fingerprint, created_at, last_opened_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?, ?, ?, ?)
      `;

      const logResult = await executeQuery(insertLogSql, [
        userId,
        selectedReward.id,
        selectedReward.reward_type,
        rewardValue,
        status,
        level,
        chestType,
        ip,
        deviceFingerprint,
        now,
        lastOpenedAt // NULL for bonus chests, current time for base chests
      ]);

      // Update user balance if coins > 0 (creates balance if doesn't exist)
      if (coinAmount > 0) {
        const updateBalanceSql = `
          INSERT INTO ${this.balancesTableName} (user_id, currency, available, pending)
          VALUES (?, 'COIN', ?, 0)
          ON DUPLICATE KEY UPDATE available = available + ?
        `;

        await executeQuery(updateBalanceSql, [userId, coinAmount, coinAmount]);

        // Create ledger entry
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

      // Calculate remaining chests based on which type was consumed
      const remainingChests = {
        base: usedBonusChest ? baseChests : Math.max(0, baseChests - 1),
        bonus: usedBonusChest ? Math.max(0, bonusChests - 1) : bonusChests,
        total: Math.max(0, totalChests - 1)
      };

      // Return result for frontend
      return {
        success: true,
        reward: {
          type: selectedReward.reward_type,
          value: rewardValue,
          label: selectedReward.label
        },
        chests_remaining: remainingChests
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
