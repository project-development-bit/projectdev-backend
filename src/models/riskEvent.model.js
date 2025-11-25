const { coinQuery: query } = require("../config/db");

//Risk Event Types
const RISK_EVENT_TYPES = {
  SAME_DEVICE_MULTI_ACCOUNTS: "SAME_DEVICE_MULTI_ACCOUNTS",
  MULTI_DEVICE_SAME_ACCOUNT: "MULTI_DEVICE_SAME_ACCOUNT",
  COUNTRY_CHANGED: "COUNTRY_CHANGED"
};

//Risk Severity Levels
const RISK_SEVERITY = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

class RiskEventModel {
  tableName = "risk_events";

  //Create a new risk event
  create = async (eventData) => {
    const sql = `INSERT INTO ${this.tableName}
      (user_id, type, severity, ip, device_fp, meta) VALUES (?, ?, ?, ?, ?, ?)`;

    // Convert meta to JSON string if it's an object
    const metaJson = eventData.meta
      ? JSON.stringify(eventData.meta)
      : null;

    const result = await query(sql, [
      eventData.user_id || null,
      eventData.type,
      eventData.severity,
      eventData.ip || null,
      eventData.device_fp || null,
      metaJson,
    ]);

    // Update user's risk_score in user_profiles table if user_id exists
    if (eventData.user_id) {
      await this.updateUserRiskScore(eventData.user_id);
    }

    return {
      id: result.insertId,
      ...eventData,
    };
  };

  //Calculate and update user's risk score based on their risk events
  updateUserRiskScore = async (userId) => {
    try {
      // Calculate risk score based on events in the last 30 days
      const calculateSql = `
        SELECT SUM(severity) as total_risk_score
        FROM ${this.tableName}
        WHERE user_id = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `;

      const scoreResult = await query(calculateSql, [userId]);
      const riskScore = scoreResult[0]?.total_risk_score || 0;

      // Update user_profiles table with the calculated risk score
      const updateSql = `
        UPDATE user_profiles
        SET risk_score = ?
        WHERE user_id = ?
      `;

      await query(updateSql, [riskScore, userId]);

      return riskScore;
    } catch (error) {
      console.error('Failed to update user risk score:', error);
      throw error;
    }
  };

  //Get risk summary for a user
  getUserRiskSummary = async (userId, daysBack = 30) => {
    const sql = `SELECT
      type,
      severity,
      COUNT(*) as count,
      MAX(created_at) as last_occurrence
      FROM ${this.tableName}
      WHERE user_id = ?
      AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY type, severity
      ORDER BY severity DESC, count DESC`;

    const result = await query(sql, [userId, daysBack]);
    return result;
  };

}

module.exports = new RiskEventModel();
module.exports.RISK_EVENT_TYPES = RISK_EVENT_TYPES;
module.exports.RISK_SEVERITY = RISK_SEVERITY;
