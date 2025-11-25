const { coinQuery: query } = require("../config/db");

class UserSessionModel {
  tableName = "user_sessions";

  //Create a new user session record
  create = async (sessionData) => {
    const sql = `INSERT INTO ${this.tableName}
      (user_id, ip, device_fp, user_agent, country) VALUES (?, ?, ?, ?, ?)`;

    const result = await query(sql, [
      sessionData.user_id,
      sessionData.ip,
      sessionData.device_fp,
      sessionData.user_agent || null,
      sessionData.country || null,
    ]);

    return {
      id: result.insertId,
      ...sessionData,
    };
  };

  //Find unique users who logged in with a device fingerprint
  findOtherUsersByDevice = async (deviceFp, excludeUserId, daysBack = 7) => {
    const sql = `SELECT DISTINCT user_id FROM ${this.tableName}
      WHERE device_fp = ?
      AND user_id != ?
      AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;

    const result = await query(sql, [deviceFp, excludeUserId, daysBack]);
    return result.map((row) => row.user_id);
  };

  //Count distinct devices for a user
  countDistinctDevicesForUser = async (userId, daysBack = 7) => {
    const sql = `SELECT COUNT(DISTINCT device_fp) as device_count
      FROM ${this.tableName}
      WHERE user_id = ?
      AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;

    const result = await query(sql, [userId, daysBack]);
    return result[0]?.device_count || 0;
  };

  //Get previous country for a user from their login sessions (excluding current country)
  getPreviousCountry = async (userId, currentCountryCode) => {
    console.log("Getting previous country for user:", userId, "excluding:", currentCountryCode);
    const sql = `SELECT country
      FROM ${this.tableName}
      WHERE user_id = ?
      AND country IS NOT NULL
      AND country != ?
      ORDER BY created_at DESC
      LIMIT 1`;

    const result = await query(sql, [userId, currentCountryCode]);
    console.log("Previous country query result:", result);
    return result[0]?.country || null;
  };

}

module.exports = new UserSessionModel();
