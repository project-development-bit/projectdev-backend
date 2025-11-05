const { coinQuery } = require("../config/db");
const { multipleColumnSet } = require("../utils/common.utils");

class AppSettingsModel {
  tableName = "app_settings";

  //Get all app settings
  find = async (params = {}) => {
    let sql = `SELECT id, config_key, config_data, version, created_at, updated_at FROM ${this.tableName}`;

    if (!Object.keys(params).length) {
      return await coinQuery(sql);
    }

    const { columnSet, values } = multipleColumnSet(params);
    sql += ` WHERE ${columnSet}`;

    return await coinQuery(sql, [...values]);
  };

  //Get a single app setting by config_key or id
  findOne = async (params) => {
    const { columnSet, values } = multipleColumnSet(params);

    const sql = `SELECT id, config_key, config_data, version, created_at, updated_at
                 FROM ${this.tableName}
                 WHERE ${columnSet}`;

    const result = await coinQuery(sql, [...values]);

    // Parse JSON data if exists
    if (result[0] && result[0].config_data) {
      result[0].config_data = typeof result[0].config_data === 'string'
        ? JSON.parse(result[0].config_data)
        : result[0].config_data;
    }

    return result[0];
  };

  //Get app setting by config_key
  findByKey = async (configKey) => {
    const sql = `SELECT id, config_key, config_data, version, created_at, updated_at
                 FROM ${this.tableName}
                 WHERE config_key = ?`;

    const result = await coinQuery(sql, [configKey]);

    // Parse JSON data if exists
    if (result[0] && result[0].config_data) {
      result[0].config_data = typeof result[0].config_data === 'string'
        ? JSON.parse(result[0].config_data)
        : result[0].config_data;
    }

    return result[0];
  };

  //Create a new app setting
  create = async ({ config_key, config_data, version = null }) => {
    const sql = `INSERT INTO ${this.tableName} (config_key, config_data, version)
                 VALUES (?, ?, ?)`;

    // Convert config_data object to JSON string
    const jsonData = JSON.stringify(config_data);

    const result = await coinQuery(sql, [config_key, jsonData, version]);

    if (result && result.insertId) {
      return {
        id: result.insertId,
        config_key,
        config_data,
        version,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return null;
  };

  //Update an app setting by id
  update = async (params, id) => {
    // Handle config_data JSON conversion
    if (params.config_data && typeof params.config_data === 'object') {
      params.config_data = JSON.stringify(params.config_data);
    }

    const { columnSet, values } = multipleColumnSet(params);

    const sql = `UPDATE ${this.tableName} SET ${columnSet} WHERE id = ?`;

    const result = await coinQuery(sql, [...values, id]);

    return result;
  };

  //Delete an app setting by id
  delete = async (id) => {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const result = await coinQuery(sql, [id]);
    const affectedRows = result ? result.affectedRows : 0;

    return affectedRows;
  };


}

module.exports = new AppSettingsModel();
