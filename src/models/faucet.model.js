const { coinQuery, getCoinConnection } = require("../config/db");
const {
  FAUCET_CONFIG,
  calculateDayReward,
  calculateDailyTarget,
  generateStreakRewards,
  getClaimIntervalMs
} = require("../config/faucet.config");

class FaucetModel {
  claimsTableName = "faucet_claims";
  streaksTableName = "faucet_streaks";
  historyTableName = "faucet_daily_history";

  //Get or create user's faucet streak record
  getUserStreak = async (userId) => {
    const sql = `SELECT * FROM ${this.streaksTableName} WHERE user_id = ?`;
    const result = await coinQuery(sql, [userId]);

    if (result && result.length > 0) {
      return result[0];
    }

    // Create new streak record for user
    return await this.createUserStreak(userId);
  };

  //Create a new streak record for user
  createUserStreak = async (userId) => {
    const today = new Date().toISOString().split('T')[0]; // UTC date

    const sql = `
      INSERT INTO ${this.streaksTableName}
      (user_id, current_day, total_earned_today, streak_date)
      VALUES (?, 1, 0, ?)
    `;

    await coinQuery(sql, [userId, today]);
    return await this.getUserStreak(userId);
  };

  /**
   * Check if user can claim faucet now
   * @param {number} userId
   * @returns {Promise<Object>} {canClaim, nextClaimAt, remainingMs}
   */
  canUserClaim = async (userId) => {
    const streak = await this.getUserStreak(userId);

    if (!streak.last_claim_at) {
      return {
        canClaim: true,
        nextClaimAt: null,
        remainingMs: 0
      };
    }

    const lastClaimTime = new Date(streak.last_claim_at).getTime();
    const now = Date.now();
    const cooldownMs = getClaimIntervalMs();
    const nextClaimTime = lastClaimTime + cooldownMs;
    const remainingMs = Math.max(0, nextClaimTime - now);

    return {
      canClaim: remainingMs === 0,
      nextClaimAt: new Date(nextClaimTime).toISOString(),
      remainingMs
    };
  };

  //Process daily reset and streak progression
  processDailyReset = async (userId) => {
    const streak = await this.getUserStreak(userId);
    const today = new Date().toISOString().split('T')[0]; // UTC date
    const streakDate = new Date(streak.streak_date).toISOString().split('T')[0];

    // If same day, no reset needed
    if (today === streakDate) {
      return streak;
    }

    // Calculate days difference
    const todayDate = new Date(today);
    const lastStreakDate = new Date(streakDate);
    const daysDiff = Math.floor((todayDate - lastStreakDate) / (1000 * 60 * 60 * 24));

    // If more than 1 day passed or target not reached, reset streak
    if (daysDiff > 1) {
      await this.resetStreak(userId, today);
      return await this.getUserStreak(userId);
    }

    // Exactly 1 day passed - check if target was reached yesterday
    const currentTarget = calculateDailyTarget(streak.current_day);
    const targetReached = parseFloat(streak.total_earned_today) >= currentTarget;

    // Save yesterday's record to history
    await this.saveDailyHistory(
      userId,
      streakDate,
      streak.current_day,
      currentTarget,
      parseFloat(streak.total_earned_today),
      targetReached
    );

    if (targetReached) {
      // Progress to next day
      const nextDay = Math.min(streak.current_day + 1, FAUCET_CONFIG.MAX_STREAK_DAYS);
      await this.updateStreak(userId, nextDay, 0, today);
    } else {
      // Reset to day 1
      await this.resetStreak(userId, today);
    }

    return await this.getUserStreak(userId);
  };

  //Save daily achievement to history
  saveDailyHistory = async (userId, date, streakDay, targetAmount, earnedAmount, targetReached) => {
    // Get claims count for that day
    const claimsCountSql = `
      SELECT COUNT(*) as count
      FROM ${this.claimsTableName}
      WHERE user_id = ? AND DATE(claimed_at) = ?
    `;
    const claimsResult = await coinQuery(claimsCountSql, [userId, date]);
    const claimsCount = claimsResult[0]?.count || 0;

    const sql = `
      INSERT INTO ${this.historyTableName}
      (user_id, date, streak_day, target_amount, earned_amount, target_reached, claims_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        earned_amount = VALUES(earned_amount),
        target_reached = VALUES(target_reached),
        claims_count = VALUES(claims_count)
    `;

    await coinQuery(sql, [
      userId,
      date,
      streakDay,
      targetAmount,
      earnedAmount,
      targetReached ? 1 : 0,
      claimsCount
    ]);
  };

  //Update user's streak
  updateStreak = async (userId, currentDay, totalEarnedToday, streakDate) => {
    const sql = `
      UPDATE ${this.streaksTableName}
      SET current_day = ?,
          total_earned_today = ?,
          streak_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;

    await coinQuery(sql, [currentDay, totalEarnedToday, streakDate, userId]);
  };

  //Reset user's streak to Day 1
  resetStreak = async (userId, today) => {
    const sql = `
      UPDATE ${this.streaksTableName}
      SET current_day = 1,
          total_earned_today = 0,
          streak_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;

    await coinQuery(sql, [today, userId]);
  };

  //Record a faucet claim
  processClaim = async (userId, ip = null, deviceFingerprint = null) => {
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

      // 1. Process daily reset if needed
      await this.processDailyReset(userId);

      // 2. Check if user can claim
      const { canClaim } = await this.canUserClaim(userId);
      if (!canClaim) {
        await new Promise((resolve) => {
          connection.rollback(() => resolve());
        });
        connection.release();
        throw new Error("COOLDOWN_NOT_EXPIRED");
      }

      // 3. Get current streak
      const streak = await this.getUserStreak(userId);
      const rewardAmount = calculateDayReward(streak.current_day);
      const now = new Date();

      // 4. Insert claim record
      const insertClaimSql = `
        INSERT INTO ${this.claimsTableName}
        (user_id, amount, streak_day, ip, device_fingerprint, claimed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      const claimResult = await executeQuery(insertClaimSql, [
        userId,
        rewardAmount,
        streak.current_day,
        ip,
        deviceFingerprint,
        now
      ]);

      // 5. Update streak record
      const newTotalEarned = parseFloat(streak.total_earned_today) + rewardAmount;
      const updateStreakSql = `
        UPDATE ${this.streaksTableName}
        SET total_earned_today = ?,
            last_claim_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `;

      await executeQuery(updateStreakSql, [newTotalEarned, now, userId]);

      // 6. Credit coins to user balance
      const updateBalanceSql = `
        UPDATE balances
        SET available = available + ?
        WHERE user_id = ? AND currency = 'COIN'
      `;

      await executeQuery(updateBalanceSql, [rewardAmount, userId]);

      // 7. Create ledger entry
      const ledgerSql = `
        INSERT INTO ledger_entries
        (user_id, currency, entry_type, amount, ref_type, ref_id,  created_at)
        VALUES (?, 'COIN', 'credit', ?, 'faucet', ?, ?)
      `;

      await executeQuery(ledgerSql, [
        userId,
        rewardAmount,
        claimResult.insertId.toString(),
        now
      ]);

      // Commit transaction
      await new Promise((resolve, reject) => {
        connection.commit((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Release connection
      connection.release();

      // Return claim result
      return {
        claimId: claimResult.insertId,
        coinsAwarded: rewardAmount,
        streakDay: streak.current_day,
        totalEarnedToday: newTotalEarned,
        dailyTarget: calculateDailyTarget(streak.current_day),
        nextClaimAt: new Date(now.getTime() + getClaimIntervalMs()).toISOString()
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

  //Get public faucet status
  getPublicFaucetStatus = async () => {
    // Calculate time until daily reset (midnight UTC)
    const now = new Date();
    const tomorrow = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      FAUCET_CONFIG.DAILY_RESET_HOUR,
      0,
      0,
      0
    ));
    const msUntilReset = tomorrow.getTime() - now.getTime();
    const hoursUntilReset = Math.floor(msUntilReset / (1000 * 60 * 60));
    const minutesUntilReset = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));
    const secondsUntilReset = Math.floor((msUntilReset % (1000 * 60)) / 1000);

    const allStreakRewards = generateStreakRewards(FAUCET_CONFIG.MAX_STREAK_DAYS);

    return {
      reward_per_claim: FAUCET_CONFIG.BASE_REWARD,
      interval_hours: FAUCET_CONFIG.CLAIM_INTERVAL_HOURS,
      next_faucet_at: null,
      can_claim_now: true,
      time_remaining: null,
      base_daily_target: FAUCET_CONFIG.BASE_DAILY_TARGET,
      max_daily_target: FAUCET_CONFIG.MAX_DAILY_TARGET,
      target_growth_rate: FAUCET_CONFIG.TARGET_GROWTH_RATE,
      daily_reset: {
        reset_time_utc: `${FAUCET_CONFIG.DAILY_RESET_HOUR.toString().padStart(2, '0')}:00:00 UTC`,
        next_reset_at: tomorrow.toISOString(),
        time_until_reset: {
          hours: hoursUntilReset,
          minutes: minutesUntilReset,
          seconds: secondsUntilReset,
          total_seconds: Math.floor(msUntilReset / 1000)
        }
      },
      streak: {
        current_day: 1,
        max_days: FAUCET_CONFIG.MAX_STREAK_DAYS,
        progress_percent: 0,
        daily_target: 300,
        earned_today: 0,
        remaining: 300,
        days: allStreakRewards
      }
    };
  };

  //Get faucet status for user
  getFaucetStatus = async (userId) => {
    // Process daily reset first
    await this.processDailyReset(userId);

    // Get updated streak
    const streak = await this.getUserStreak(userId);

    // Get claim status
    const { canClaim, nextClaimAt, remainingMs } = await this.canUserClaim(userId);

    // Calculate current values
    const currentReward = calculateDayReward(streak.current_day);
    const currentTarget = calculateDailyTarget(streak.current_day);
    const earnedToday = parseFloat(streak.total_earned_today);
    const remaining = Math.max(0, currentTarget - earnedToday);
    const progressPercent = Math.min(100, Math.floor((earnedToday / currentTarget) * 100));

    // Generate preview of next few days
    const allDays = generateStreakRewards(FAUCET_CONFIG.MAX_STREAK_DAYS);
    const previewDays = allDays.slice(
      Math.max(0, streak.current_day - 1),
      Math.min(allDays.length, streak.current_day + 4)
    );

    // Calculate time remaining for next claim
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

    // Calculate time until daily reset (midnight UTC)
    const now = new Date();
    const tomorrow = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      FAUCET_CONFIG.DAILY_RESET_HOUR,
      0,
      0,
      0
    ));
    const msUntilReset = tomorrow.getTime() - now.getTime();
    const hoursUntilReset = Math.floor(msUntilReset / (1000 * 60 * 60));
    const minutesUntilReset = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));
    const secondsUntilReset = Math.floor((msUntilReset % (1000 * 60)) / 1000);

    return {
      reward_per_claim: currentReward,
      interval_hours: FAUCET_CONFIG.CLAIM_INTERVAL_HOURS,
      next_faucet_at: nextClaimAt,
      can_claim_now: canClaim,
      time_remaining: {
        hours,
        minutes,
        seconds,
        total_seconds: Math.floor(remainingMs / 1000)
      },
      daily_reset: {
        reset_time_utc: `${FAUCET_CONFIG.DAILY_RESET_HOUR.toString().padStart(2, '0')}:00:00 UTC`,
        next_reset_at: tomorrow.toISOString(),
        time_until_reset: {
          hours: hoursUntilReset,
          minutes: minutesUntilReset,
          seconds: secondsUntilReset,
          total_seconds: Math.floor(msUntilReset / 1000)
        }
      },
      streak: {
        current_day: streak.current_day,
        max_days: FAUCET_CONFIG.MAX_STREAK_DAYS,
        progress_percent: progressPercent,
        daily_target: currentTarget,
        earned_today: earnedToday,
        remaining: remaining,
        days: previewDays
      }
    };
  };

  //Get user's claim history
  // getClaimHistory = async (userId, limit = 10) => {
  //   const sql = `
  //     SELECT id, amount, streak_day, claimed_at
  //     FROM ${this.claimsTableName}
  //     WHERE user_id = ?
  //     ORDER BY claimed_at DESC
  //     LIMIT ?
  //   `;

  //   return await coinQuery(sql, [userId, limit]);
  // };

  //Get user's daily history
  // getDailyHistory = async (userId, limit = 30) => {
  //   const sql = `
  //     SELECT date, streak_day, target_amount, earned_amount, target_reached, claims_count
  //     FROM ${this.historyTableName}
  //     WHERE user_id = ?
  //     ORDER BY date DESC
  //     LIMIT ?
  //   `;

  //   return await coinQuery(sql, [userId, limit]);
  // };
}

module.exports = new FaucetModel();
