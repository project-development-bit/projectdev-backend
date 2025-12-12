const { coinQuery } = require("../config/db");

class CountryModel {
  tableName = "countries";

  //Find countries with optional filters
  find = async (params = {}) => {
    let sql = `SELECT id, code, name, flag FROM ${this.tableName}`;
    const values = [];

    // Build WHERE clause
    const conditions = [];

    if (params.is_active !== undefined) {
      conditions.push("is_active = ?");
      values.push(params.is_active ? 1 : 0);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    // Order by name ascending
    sql += " ORDER BY name ASC";

    return await coinQuery(sql, values);
  };

  //Get country by country code
  findByCode = async (code) => {
    const sql = `SELECT id, code, name, flag FROM ${this.tableName} WHERE code = ? AND is_active = 1`;
    const result = await coinQuery(sql, [code.toUpperCase()]);
    return result[0];
  };

}

module.exports = new CountryModel();
