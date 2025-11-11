const { coinQuery } = require("../config/db");

class DepositModel {
  depositsTable = "deposits";
  balancesTable = "balances";
  currenciesTable = "currencies";

  //Get user's deposit history with pagination
  getUserDeposits = async (userId, options = {}) => {
    const {
      page = 1,
      limit = 20,
      status = null,
      currency = null,
      dateFrom = null,
      dateTo = null,
    } = options;

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const offset = (pageInt - 1) * limitInt;

    let whereConditions = ['user_id = ?'];
    let queryParams = [userId];

    if (status) {
      whereConditions.push('status = ?');
      queryParams.push(status);
    }

    if (currency) {
      whereConditions.push('currency = ?');
      queryParams.push(currency);
    }

    if (dateFrom) {
      whereConditions.push('created_at >= ?');
      queryParams.push(dateFrom);
    }

    if (dateTo) {
      whereConditions.push('created_at <= ?');
      queryParams.push(dateTo);
    }

    const whereClause = whereConditions.join(' AND ');

    // Count total
    const countSql = `
      SELECT COUNT(*) as total
      FROM ${this.depositsTable}
      WHERE ${whereClause}
    `;

    // Get data
    const dataSql = `
      SELECT
        id,
        user_id,
        currency,
        amount,
        txid,
        status,
        deposit_address,
        payment_provider,
        error_message,
        created_at,
        confirmed_at,
        updated_at
      FROM ${this.depositsTable}
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitInt} OFFSET ${offset}
    `;

    const [countResult, deposits] = await Promise.all([
      coinQuery(countSql, queryParams),
      coinQuery(dataSql, queryParams),
    ]);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limitInt);

    return {
      data: deposits.map((d) => ({
        id: d.id,
        userId: d.user_id,
        currency: d.currency,
        amount: parseFloat(d.amount),
        txid: d.txid,
        status: d.status,
        depositAddress: d.deposit_address,
        paymentProvider: d.payment_provider,
        errorMessage: d.error_message,
        createdAt: d.created_at,
        confirmedAt: d.confirmed_at,
        updatedAt: d.updated_at,
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
  };

  //Get single deposit by ID
  getDepositById = async (depositId, userId) => {
    const sql = `
      SELECT
        id,
        user_id,
        currency,
        amount,
        txid,
        status,
        deposit_address,
        payment_provider,
        error_message,
        created_at,
        confirmed_at,
        updated_at
      FROM ${this.depositsTable}
      WHERE id = ? AND user_id = ?
    `;

    const result = await coinQuery(sql, [depositId, userId]);

    if (!result || result.length === 0) {
      return null;
    }

    const d = result[0];
    return {
      id: d.id,
      userId: d.user_id,
      currency: d.currency,
      amount: parseFloat(d.amount),
      txid: d.txid,
      status: d.status,
      depositAddress: d.deposit_address,
      paymentProvider: d.payment_provider,
      errorMessage: d.error_message,
      createdAt: d.created_at,
      confirmedAt: d.confirmed_at,
      updatedAt: d.updated_at,
    };
  };

  //Create a deposit record
  createDeposit = async (depositData) => {
    const {
      userId,
      currency,
      amount,
      txid = null,
      depositAddress,
      paymentProvider = 'manual',
    } = depositData;

    const sql = `
      INSERT INTO ${this.depositsTable}
      (user_id, currency, amount, txid, deposit_address, payment_provider, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;

    const result = await coinQuery(sql, [
      userId,
      currency,
      amount,
      txid,
      depositAddress,
      paymentProvider,
    ]);

    return {
      success: true,
      depositId: result.insertId,
    };
  };

  //Update deposit status
  updateDepositStatus = async (depositId, updates) => {
    const {
      status,
      txid = null,
      errorMessage = null,
      confirmedAt = null,
    } = updates;

    let updateFields = ['status = ?'];
    let values = [status];

    if (txid !== null) {
      updateFields.push('txid = ?');
      values.push(txid);
    }

    if (errorMessage !== null) {
      updateFields.push('error_message = ?');
      values.push(errorMessage);
    }

    if (confirmedAt !== null) {
      updateFields.push('confirmed_at = ?');
      values.push(confirmedAt);
    } else if (status === 'confirmed') {
      updateFields.push('confirmed_at = NOW()');
    }

    values.push(depositId);

    const sql = `
      UPDATE ${this.depositsTable}
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    const result = await coinQuery(sql, values);
    return result;
  };

  //Get deposit by transaction ID
  getDepositByTxid = async (txid) => {
    const sql = `
      SELECT
        id,
        user_id,
        currency,
        amount,
        txid,
        status,
        deposit_address,
        payment_provider,
        error_message,
        created_at,
        confirmed_at,
        updated_at
      FROM ${this.depositsTable}
      WHERE txid = ?
    `;

    const result = await coinQuery(sql, [txid]);

    if (!result || result.length === 0) {
      return null;
    }

    const d = result[0];
    return {
      id: d.id,
      userId: d.user_id,
      currency: d.currency,
      amount: parseFloat(d.amount),
      txid: d.txid,
      status: d.status,
      depositAddress: d.deposit_address,
      paymentProvider: d.payment_provider,
      errorMessage: d.error_message,
      createdAt: d.created_at,
      confirmedAt: d.confirmed_at,
      updatedAt: d.updated_at,
    };
  };
}

module.exports = new DepositModel();
