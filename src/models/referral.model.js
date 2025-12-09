const { coinQuery } = require("../config/db");
const referralConfig = require("../config/referral.config");

class ReferralModel {
  referralsTable = "referrals";
  usersTable = "users";

  //Check if a referral code already exists in the database
  isReferralCodeExists = async (code) => {
    const sql = `SELECT id FROM ${this.usersTable} WHERE referral_code = ?`;
    const result = await coinQuery(sql, [code]);
    return result.length > 0;
  };

  //Get user by referral code
  getUserByReferralCode = async (referralCode) => {
    const sql = `SELECT id, email, referral_code FROM ${this.usersTable} WHERE referral_code = ?`;
    const result = await coinQuery(sql, [referralCode]);
    return result[0] || null;
  };

  //Create a referral relationship
  createReferralRelationship = async (referrerId, refereeId, revenueSharePct = null) => {
    // Use environment variable or default to 10%
    const sharePercentage = revenueSharePct !== null
      ? revenueSharePct
      : referralConfig.revenueSharePct;

    const sql = `
      INSERT INTO ${this.referralsTable} (referrer_id, referee_id, revenue_share_pct)
      VALUES (?, ?, ?)
    `;

    try {
      const result = await coinQuery(sql, [referrerId, refereeId, sharePercentage]);
      return {
        success: true,
        referralId: result.insertId,
      };
    } catch (error) {
      // Check if it's a duplicate entry error
      if (error.code === "ER_DUP_ENTRY") {
        return {
          success: false,
          error: "User has already been referred by someone else",
        };
      }
      throw error;
    }
  };

  //Update user's referred_by field
  updateUserReferredBy = async (userId, referrerId) => {
    const sql = `UPDATE ${this.usersTable} SET referred_by = ? WHERE id = ?`;
    const result = await coinQuery(sql, [referrerId, userId]);
    return result;
  };

  //Get referral statistics for a user
  getReferralStats = async (userId) => {
    // Get total referrals count
    const countSql = `
      SELECT COUNT(*) as total_referrals
      FROM ${this.referralsTable}
      WHERE referrer_id = ?
    `;

    // Get credited referral earnings from ledger
    const creditedEarningsSql = `
      SELECT
        COALESCE(SUM(amount), 0) as total_earnings
      FROM ledger_entries
      WHERE user_id = ?
        AND ref_type = 'referral'
        AND entry_type = 'credit'
    `;

    // Get count of users active in the last 7 days
    const activeThisWeekSql = `
      SELECT COUNT(DISTINCT r.referee_id) as active_count
      FROM ${this.referralsTable} r
      JOIN ${this.usersTable} u ON u.id = r.referee_id
      WHERE r.referrer_id = ?
        AND u.last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `;

    try {
      const [countResult, creditedEarningsResult, activeThisWeekResult] = await Promise.all([
        coinQuery(countSql, [userId]),
        coinQuery(creditedEarningsSql, [userId]),
        coinQuery(activeThisWeekSql, [userId]),
      ]);

      return {
        referral_percent: referralConfig.revenueSharePct,
        referral_earnings_coins: parseFloat(creditedEarningsResult[0].total_earnings),
        referral_users_count: countResult[0].total_referrals,
        pending_earnings_coins: 0, // TODO: Implement pending earnings tracking
        active_this_week_count: activeThisWeekResult[0].active_count,
      };
    } catch (error) {
      console.error("Error getting referral stats:", error);
      throw error;
    }
  };

  //Get all referrals for a specific referrer
  getReferralsByReferrer = async (referrerId) => {
    const sql = `
      SELECT
        r.*,
        u.email as referee_email
      FROM ${this.referralsTable} r
      JOIN ${this.usersTable} u ON u.id = r.referee_id
      WHERE r.referrer_id = ?
      ORDER BY r.created_at DESC
    `;

    const result = await coinQuery(sql, [referrerId]);
    return result;
  };

  //Get referral relationship by referee ID
  getReferralByReferee = async (refereeId) => {
    const sql = `
      SELECT
        r.*,
        u.email as referrer_email,
        u.referral_code as referrer_code
      FROM ${this.referralsTable} r
      JOIN ${this.usersTable} u ON u.id = r.referrer_id
      WHERE r.referee_id = ?
    `;

    const result = await coinQuery(sql, [refereeId]);
    return result[0] || null;
  };

  //Update revenue share percentage for a referral
  updateRevenueShare = async (referralId, revenueSharePct) => {
    const sql = `
      UPDATE ${this.referralsTable}
      SET revenue_share_pct = ?
      WHERE id = ?
    `;

    const result = await coinQuery(sql, [revenueSharePct, referralId]);
    return result;
  };

  //Get referred users list with filters and pagination
  getReferredUsersList = async (referrerId, options = {}) => {
    const {
      page = 1,
      limit = 10,
      search = '',
      sortBy = 'created_at',
      sortOrder = 'DESC',
      dateFrom = null,
      dateTo = null,
    } = options;

    // Ensure page and limit are integers
    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const offset = (pageInt - 1) * limitInt;

    const validSortBy = ['created_at', 'name', 'revenue_share_pct'];
    const validSortOrder = ['ASC', 'DESC'];

    const sortColumn = validSortBy.includes(sortBy) ? sortBy : 'created_at';
    const order = validSortOrder.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Build WHERE clause
    let whereConditions = ['r.referrer_id = ?'];
    let queryParams = [referrerId];

    // Search filter (name from user_profiles)
    if (search && search.trim() !== '') {
      whereConditions.push('up.name LIKE ?');
      const searchPattern = `%${search.trim()}%`;
      queryParams.push(searchPattern);
    }

    // Date range filter
    if (dateFrom) {
      whereConditions.push('r.created_at >= ?');
      queryParams.push(dateFrom);
    }

    if (dateTo) {
      whereConditions.push('r.created_at <= ?');
      queryParams.push(dateTo);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total
      FROM ${this.referralsTable} r
      JOIN ${this.usersTable} u ON u.id = r.referee_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE ${whereClause}
    `;

    // Get referred users with earnings
    const dataSql = `
      SELECT
        u.id,
        up.name,
        u.created_at as user_created_at,
        u.is_verified,
        r.id as referral_id,
        r.revenue_share_pct,
        r.created_at as referral_date,
        COALESCE(
          (SELECT SUM(le.amount)
           FROM ledger_entries le
           WHERE le.user_id = r.referrer_id
             AND le.ref_type = 'referral'
             AND le.ref_id = CAST(r.referee_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
             AND le.entry_type = 'credit'),
          0
        ) as total_earned_from_referee
      FROM ${this.referralsTable} r
      JOIN ${this.usersTable} u ON u.id = r.referee_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE ${whereClause}
      ORDER BY ${sortColumn === 'created_at' ? 'r.created_at' :
                 sortColumn === 'name' ? 'up.name' :
                 'r.revenue_share_pct'} ${order}
      LIMIT ${limitInt} OFFSET ${offset}
    `;

    try {
      const countParams = [...queryParams];
      const dataParams = [...queryParams];

      const [countResult, referredUsers] = await Promise.all([
        coinQuery(countSql, countParams),
        coinQuery(dataSql, dataParams),
      ]);

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limitInt);

      return {
        data: referredUsers.map((user) => ({
          id: user.id,
          name: user.name || '',
          isVerified: user.is_verified === 1,
          userCreatedAt: user.user_created_at,
          referralId: user.referral_id,
          revenueSharePct: parseFloat(user.revenue_share_pct),
          referralDate: user.referral_date,
          totalEarnedFromReferee: parseFloat(user.total_earned_from_referee),
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
    } catch (error) {
      console.error('Error getting referred users list:', error);
      throw error;
    }
  };
}

module.exports = new ReferralModel();
