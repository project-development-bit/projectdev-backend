const { coinQuery } = require("../config/db");

class CountryModel {
  tableName = "countries";

  //Find countries with optional filters
  find = async (params = {}) => {
    let sql = `SELECT code, name, flag FROM ${this.tableName}`;
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

  //Check if a country code exists and is active
  isValidCountryCode = async (countryCode) => {
    if (!countryCode) {
      return false;
    }

    const sql = `SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE code = ? AND is_active = 1`;

    const result = await coinQuery(sql, [countryCode.toUpperCase()]);
    return result[0]?.count > 0;
  };

}

module.exports = new CountryModel();
