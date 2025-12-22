const { coinQuery } = require("../config/db");

class WithdrawalModel {
  transactionsTable = "transactions";
  withdrawalMethodsTable = "withdrawal_methods";

  //Get single withdrawal by ID
  getWithdrawalById = async (withdrawalId, userId) => {
    const sql = `
      SELECT
        id,
        user_id,
        currency,
        amount,
        fee,
        address,
        payment_provider,
        status,
        txid,
        error_code,
        error_message,
        created_at,
        confirmed_at,
        updated_at
      FROM ${this.transactionsTable}
      WHERE id = ? AND user_id = ? AND transaction_type = 'withdrawal'
    `;

    const result = await coinQuery(sql, [withdrawalId, userId]);

    if (!result || result.length === 0) {
      return null;
    }

    const w = result[0];
    return {
      id: w.id,
      userId: w.user_id,
      currency: w.currency,
      amount: parseFloat(w.amount),
      fee: parseFloat(w.fee),
      address: w.address,
      payoutProvider: w.payment_provider,
      status: w.status,
      txid: w.txid,
      errorCode: w.error_code,
      errorMessage: w.error_message,
      createdAt: w.created_at,
      confirmedAt: w.confirmed_at,
      updatedAt: w.updated_at,
    };
  };

  //Create a withdrawal request
  createWithdrawal = async (withdrawalData) => {
    const {
      userId,
      currency,
      amount,
      fee,
      address,
      payoutProvider = 'manual',
      txid = null,
    } = withdrawalData;

    const sql = `
      INSERT INTO ${this.transactionsTable}
      (user_id, transaction_type, currency, amount, fee, address, payment_provider, txid, status)
      VALUES (?, 'withdrawal', ?, ?, ?, ?, ?, ?, 'pending')
    `;

    const result = await coinQuery(sql, [
      userId,
      currency,
      amount,
      fee,
      address,
      payoutProvider,
      txid,
    ]);

    return {
      success: true,
      withdrawalId: result.insertId,
    };
  };


  getWithdrawalOptions = async (enabledOnly = true) => {
    let sql = `
      SELECT
        code,
        name,
        network,
        icon_url,
        min_amount_coins,
        fee_coins,
        is_enabled
      FROM ${this.withdrawalMethodsTable}
    `;

    if (enabledOnly) {
      sql += ` WHERE is_enabled = 1`;
    }

    sql += ` ORDER BY sort_order ASC, code ASC`;

    const result = await coinQuery(sql);

    return (result || []).map(method => ({
      code: method.code,
      name: method.name,
      icon_url: method.icon_url || null,
      min_amount_coins: parseFloat(method.min_amount_coins),
      fee_coins: parseFloat(method.fee_coins),
      is_available: method.is_enabled === 1,
      network: method.network || null,
    }));
  };

  //Get withdrawal method by ID
  getWithdrawalMethodById = async (id) => {
    const sql = `
      SELECT
        id,
        code,
        name,
        network,
        icon_url,
        min_amount_coins,
        fee_coins,
        is_enabled,
        sort_order,
        created_at,
        updated_at
      FROM ${this.withdrawalMethodsTable}
      WHERE id = ?
    `;

    const result = await coinQuery(sql, [id]);

    if (!result || result.length === 0) {
      return null;
    }

    const method = result[0];
    return {
      id: method.id,
      code: method.code,
      name: method.name,
      network: method.network || null,
      icon_url: method.icon_url || null,
      min_amount_coins: parseFloat(method.min_amount_coins),
      fee_coins: parseFloat(method.fee_coins),
      is_enabled: method.is_enabled === 1,
      sort_order: method.sort_order,
      created_at: method.created_at,
      updated_at: method.updated_at,
    };
  };

  //Check if withdrawal method code already exists
  codeExists = async (code, excludeId = null) => {
    let sql = `SELECT id FROM ${this.withdrawalMethodsTable} WHERE code = ?`;
    const params = [code];

    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }

    const result = await coinQuery(sql, params);
    return result && result.length > 0;
  };

  //Create withdrawal method
  createWithdrawalMethod = async (data) => {
    const {
      code,
      name,
      network,
      icon_url,
      min_amount_coins,
      fee_coins,
      is_enabled,
      sort_order,
    } = data;

    const sql = `
      INSERT INTO ${this.withdrawalMethodsTable}
      (code, name, network, icon_url, min_amount_coins, fee_coins, is_enabled, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await coinQuery(sql, [
      code,
      name,
      network || null,
      icon_url || null,
      min_amount_coins,
      fee_coins,
      is_enabled ? 1 : 0,
      sort_order || 0,
    ]);

    return {
      success: true,
      insertId: result.insertId,
    };
  };

  //Update withdrawal method
  updateWithdrawalMethod = async (id, data) => {
    const {
      code,
      name,
      network,
      icon_url,
      min_amount_coins,
      fee_coins,
      is_enabled,
      sort_order,
    } = data;

    const sql = `
      UPDATE ${this.withdrawalMethodsTable}
      SET
        code = ?,
        name = ?,
        network = ?,
        icon_url = ?,
        min_amount_coins = ?,
        fee_coins = ?,
        is_enabled = ?,
        sort_order = ?
      WHERE id = ?
    `;

    const result = await coinQuery(sql, [
      code,
      name,
      network || null,
      icon_url || null,
      min_amount_coins,
      fee_coins,
      is_enabled ? 1 : 0,
      sort_order || 0,
      id,
    ]);

    return {
      success: true,
      affectedRows: result.affectedRows,
    };
  };

  //Delete withdrawal method
  deleteWithdrawalMethod = async (id) => {
    const sql = `DELETE FROM ${this.withdrawalMethodsTable} WHERE id = ?`;
    const result = await coinQuery(sql, [id]);

    return {
      success: true,
      affectedRows: result.affectedRows,
    };
  };
}

module.exports = new WithdrawalModel();
