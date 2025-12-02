const { coinQuery } = require("../config/db");

class WithdrawalModel {
  withdrawalsTable = "withdrawals";
  balancesTable = "balances";
  currenciesTable = "currencies";
  addressesTable = "user_addresses";

  //Get user's withdrawal history with pagination
  getUserWithdrawals = async (userId, options = {}) => {
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
      whereConditions.push('requested_at >= ?');
      queryParams.push(dateFrom);
    }

    if (dateTo) {
      whereConditions.push('requested_at <= ?');
      queryParams.push(dateTo);
    }

    const whereClause = whereConditions.join(' AND ');

    // Count total
    const countSql = `
      SELECT COUNT(*) as total
      FROM ${this.withdrawalsTable}
      WHERE ${whereClause}
    `;

    // Get data
    const dataSql = `
      SELECT
        id,
        user_id,
        currency,
        amount,
        fee,
        (amount - fee) as net_amount,
        address,
        payout_provider,
        status,
        txid,
        error_code,
        error_message,
        requested_at,
        processed_at,
        updated_at
      FROM ${this.withdrawalsTable}
      WHERE ${whereClause}
      ORDER BY requested_at DESC
      LIMIT ${limitInt} OFFSET ${offset}
    `;

    const [countResult, withdrawals] = await Promise.all([
      coinQuery(countSql, queryParams),
      coinQuery(dataSql, queryParams),
    ]);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limitInt);

    return {
      data: withdrawals.map((w) => ({
        id: w.id,
        userId: w.user_id,
        currency: w.currency,
        amount: parseFloat(w.amount),
        fee: parseFloat(w.fee),
        netAmount: parseFloat(w.net_amount),
        address: w.address,
        payoutProvider: w.payout_provider,
        status: w.status,
        txid: w.txid,
        errorCode: w.error_code,
        errorMessage: w.error_message,
        requestedAt: w.requested_at,
        processedAt: w.processed_at,
        updatedAt: w.updated_at,
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

  //Get single withdrawal by ID
  getWithdrawalById = async (withdrawalId, userId) => {
    const sql = `
      SELECT
        id,
        user_id,
        currency,
        amount,
        fee,
        (amount - fee) as net_amount,
        address,
        payout_provider,
        status,
        txid,
        error_code,
        error_message,
        requested_at,
        processed_at,
        updated_at
      FROM ${this.withdrawalsTable}
      WHERE id = ? AND user_id = ?
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
      netAmount: parseFloat(w.net_amount),
      address: w.address,
      payoutProvider: w.payout_provider,
      status: w.status,
      txid: w.txid,
      errorCode: w.error_code,
      errorMessage: w.error_message,
      requestedAt: w.requested_at,
      processedAt: w.processed_at,
      updatedAt: w.updated_at,
    };
  };

  //Get user's stored payout address for a currency
  getUserPayoutAddress = async (userId, currency) => {
    const sql = `
      SELECT address
      FROM ${this.addressesTable}
      WHERE user_id = ? AND currency = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await coinQuery(sql, [userId, currency]);
    return result.length > 0 ? result[0].address : null;
  };

  //Get count of pending/requested withdrawals for a user
  getPendingWithdrawalCount = async (userId) => {
    const sql = `
      SELECT COUNT(*) as count
      FROM ${this.withdrawalsTable}
      WHERE user_id = ? AND status IN ('requested', 'queued')
    `;

    const result = await coinQuery(sql, [userId]);
    return result[0].count;
  };

  //Create a coin-based withdrawal request
  createCoinWithdrawal = async (withdrawalData) => {
    const {
      userId,
      method,
      amountCoins,
      payoutAddress,
    } = withdrawalData;

    const sql = `
      INSERT INTO ${this.withdrawalsTable}
      (user_id, currency, amount, fee, address, payout_provider, status)
      VALUES (?, ?, ?, 0, ?, 'crypto', 'requested')
    `;

    const result = await coinQuery(sql, [
      userId,
      method,
      amountCoins,
      payoutAddress,
    ]);

    return {
      success: true,
      withdrawalId: result.insertId,
    };
  };
}

module.exports = new WithdrawalModel();
