const { coinQuery } = require("../config/db");
const dotenv = require("dotenv");
dotenv.config();

class ReferralModel {
  referralsTable = "referrals";
  usersTable = "users";

  //Get referral configuration from environment
  getConfig = () => {
    return {
      revenueSharePct: parseFloat(process.env.REFERRAL_REVENUE_SHARE_PCT) || 10.0,
      frontendUrl: process.env.FRONTEND_URL || "https://gigafaucet.com",
    };
  };

  //Check if a referral code already exists in the database
  isReferralCodeExists = async (code) => {
    const sql = `SELECT id FROM ${this.usersTable} WHERE referral_code = ?`;
    const result = await coinQuery(sql, [code]);
    return result.length > 0;
  };

  //Get user by referral code
  getUserByReferralCode = async (referralCode) => {
    const sql = `SELECT id, name, email, referral_code FROM ${this.usersTable} WHERE referral_code = ?`;
    const result = await coinQuery(sql, [referralCode]);
    return result[0] || null;
  };

  //Create a referral relationship
  createReferralRelationship = async (referrerId, refereeId, revenueSharePct = null) => {
    // Use environment variable or default to 10%
    const sharePercentage = revenueSharePct !== null
      ? revenueSharePct
      : parseFloat(process.env.REFERRAL_REVENUE_SHARE_PCT) || 10.0;

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

    // Get referral earnings from ledger
    const earningsSql = `
      SELECT
        COALESCE(SUM(amount), 0) as total_earnings
      FROM ledger_entries
      WHERE user_id = ?
        AND ref_type = 'referral'
        AND entry_type = 'credit'
    `;

    // Get list of referred users
    const referredUsersSql = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at,
        r.revenue_share_pct,
        r.created_at as referral_date
      FROM ${this.referralsTable} r
      JOIN ${this.usersTable} u ON u.id = r.referee_id
      WHERE r.referrer_id = ?
      ORDER BY r.created_at DESC
    `;

    try {
      const [countResult, earningsResult, referredUsers] = await Promise.all([
        coinQuery(countSql, [userId]),
        coinQuery(earningsSql, [userId]),
        coinQuery(referredUsersSql, [userId]),
      ]);

      return {
        totalReferrals: countResult[0].total_referrals,
        totalEarnings: parseFloat(earningsResult[0].total_earnings),
        referredUsers: referredUsers.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          joinedAt: user.created_at,
          revenueSharePct: parseFloat(user.revenue_share_pct),
          referralDate: user.referral_date,
        })),
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
        u.name as referee_name,
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
        u.name as referrer_name,
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
}

module.exports = new ReferralModel();
