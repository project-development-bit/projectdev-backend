const { coinQuery } = require("../config/db");

class TwoFAModel {
  tableName = "users";

  findUserById = async (userId) => {
    const sql = `SELECT id, email, twofa_enabled, twofa_secret FROM ${this.tableName} WHERE id = ?`;
    const result = await coinQuery(sql, [userId]);
    return result[0];
  };

  enable2FA = async (userId, secret) => {
    const sql = `UPDATE ${this.tableName} SET twofa_enabled = 1, twofa_secret = ? WHERE id = ?`;
    const result = await coinQuery(sql, [secret, userId]);
    return result;
  };

  disable2FA = async (userId) => {
    const sql = `UPDATE ${this.tableName} SET twofa_enabled = 0, twofa_secret = NULL WHERE id = ?`;
    const result = await coinQuery(sql, [userId]);
    return result;
  };

  get2FASecret = async (userId) => {
    const sql = `SELECT id, email, role, twofa_enabled, twofa_secret FROM ${this.tableName} WHERE id = ? AND twofa_enabled = 1`;
    const result = await coinQuery(sql, [userId]);
    return result[0];
  };

  check2FAStatus = async (userId) => {
    const sql = `SELECT twofa_enabled FROM ${this.tableName} WHERE id = ?`;
    const result = await coinQuery(sql, [userId]);
    return result[0];
  };
}

module.exports = new TwoFAModel();
