const { coinQuery } = require("../config/db");

class AddressModel {
  tableName = "user_addresses";
  currenciesTable = "currencies";

  //Get all addresses for a user
  getUserAddresses = async (userId) => {
    const sql = `
      SELECT
        ua.id,
        ua.currency,
        c.name as currency_name,
        ua.label,
        ua.address,
        ua.is_whitelisted,
        ua.created_at
      FROM ${this.tableName} ua
      JOIN ${this.currenciesTable} c ON c.code = ua.currency
      WHERE ua.user_id = ?
      ORDER BY ua.created_at DESC
    `;

    const result = await coinQuery(sql, [userId]);

    return result.map((addr) => ({
      id: addr.id,
      currency: addr.currency,
      currencyName: addr.currency_name,
      label: addr.label,
      address: addr.address,
      isWhitelisted: addr.is_whitelisted === 1,
      createdAt: addr.created_at,
    }));
  };

  //Get addresses for a specific currency
  getAddressesByCurrency = async (userId, currency) => {
    const sql = `
      SELECT
        ua.id,
        ua.currency,
        c.name as currency_name,
        ua.label,
        ua.address,
        ua.is_whitelisted,
        ua.created_at
      FROM ${this.tableName} ua
      JOIN ${this.currenciesTable} c ON c.code = ua.currency
      WHERE ua.user_id = ? AND ua.currency = ?
      ORDER BY ua.created_at DESC
    `;

    const result = await coinQuery(sql, [userId, currency]);

    return result.map((addr) => ({
      id: addr.id,
      currency: addr.currency,
      currencyName: addr.currency_name,
      label: addr.label,
      address: addr.address,
      isWhitelisted: addr.is_whitelisted === 1,
      createdAt: addr.created_at,
    }));
  };

  //Get a single address by ID
  getAddressById = async (addressId, userId) => {
    const sql = `
      SELECT
        ua.id,
        ua.user_id,
        ua.currency,
        c.name as currency_name,
        ua.label,
        ua.address,
        ua.is_whitelisted,
        ua.created_at
      FROM ${this.tableName} ua
      JOIN ${this.currenciesTable} c ON c.code = ua.currency
      WHERE ua.id = ? AND ua.user_id = ?
    `;

    const result = await coinQuery(sql, [addressId, userId]);

    if (!result || result.length === 0) {
      return null;
    }

    return {
      id: result[0].id,
      userId: result[0].user_id,
      currency: result[0].currency,
      currencyName: result[0].currency_name,
      label: result[0].label,
      address: result[0].address,
      isWhitelisted: result[0].is_whitelisted === 1,
      createdAt: result[0].created_at,
    };
  };

  //Create a new address
  createAddress = async (addressData) => {
    const { userId, currency, address, label } = addressData;

    const sql = `
      INSERT INTO ${this.tableName}
      (user_id, currency, address, label)
      VALUES (?, ?, ?, ?)
    `;

    try {
      const result = await coinQuery(sql, [userId, currency, address, label || null]);

      return {
        success: true,
        addressId: result.insertId,
      };
    } catch (error) {
      // Check if it's a duplicate entry error
      if (error.code === "ER_DUP_ENTRY") {
        return {
          success: false,
          error: "This address already exists for this currency",
        };
      }
      throw error;
    }
  };

  //Update an address
  updateAddress = async (addressId, userId, updates) => {
    const { label, address } = updates;

    let updateFields = [];
    let values = [];

    if (label !== undefined) {
      updateFields.push('label = ?');
      values.push(label);
    }

    if (address !== undefined) {
      updateFields.push('address = ?');
      values.push(address);
    }

    if (updateFields.length === 0) {
      return { affectedRows: 0, message: 'No fields to update' };
    }

    values.push(addressId, userId);

    const sql = `
      UPDATE ${this.tableName}
      SET ${updateFields.join(', ')}
      WHERE id = ? AND user_id = ?
    `;

    const result = await coinQuery(sql, values);
    return result;
  };

  //Delete an address
  deleteAddress = async (addressId, userId) => {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE id = ? AND user_id = ?
    `;

    const result = await coinQuery(sql, [addressId, userId]);
    const affectedRows = result ? result.affectedRows : 0;
    return affectedRows;
  };

  //Set address as whitelisted (Admin only)
  setWhitelisted = async (addressId, isWhitelisted) => {
    const sql = `
      UPDATE ${this.tableName}
      SET is_whitelisted = ?
      WHERE id = ?
    `;

    const result = await coinQuery(sql, [isWhitelisted ? 1 : 0, addressId]);
    return result;
  };
}

module.exports = new AddressModel();
