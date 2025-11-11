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

  //Create a withdrawal request
  createWithdrawal = async (withdrawalData) => {
    const {
      userId,
      currency,
      amount,
      fee,
      address,
      payoutProvider = 'nowpayments',
      txid = null,
    } = withdrawalData;

    const sql = `
      INSERT INTO ${this.withdrawalsTable}
      (user_id, currency, amount, fee, address, payout_provider, txid, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'requested')
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

  //Update withdrawal status
  updateWithdrawalStatus = async (withdrawalId, updates) => {
    const {
      status,
      txid = null,
      errorCode = null,
      errorMessage = null,
      processedAt = null,
    } = updates;

    let updateFields = ['status = ?'];
    let values = [status];

    if (txid !== null) {
      updateFields.push('txid = ?');
      values.push(txid);
    }

    if (errorCode !== null) {
      updateFields.push('error_code = ?');
      values.push(errorCode);
    }

    if (errorMessage !== null) {
      updateFields.push('error_message = ?');
      values.push(errorMessage);
    }

    if (processedAt !== null) {
      updateFields.push('processed_at = ?');
      values.push(processedAt);
    } else if (status === 'sent' || status === 'failed') {
      updateFields.push('processed_at = NOW()');
    }

    values.push(withdrawalId);

    const sql = `
      UPDATE ${this.withdrawalsTable}
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    const result = await coinQuery(sql, values);
    return result;
  };

  //Cancel withdrawal (only if status is 'requested')
  cancelWithdrawal = async (withdrawalId, userId) => {
    // Check current status
    const withdrawal = await this.getWithdrawalById(withdrawalId, userId);

    if (!withdrawal) {
      return {
        success: false,
        error: 'Withdrawal not found',
      };
    }

    if (withdrawal.status !== 'requested') {
      return {
        success: false,
        error: `Cannot cancel withdrawal with status '${withdrawal.status}'`,
      };
    }

    const sql = `
      UPDATE ${this.withdrawalsTable}
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ? AND user_id = ? AND status = 'requested'
    `;

    const result = await coinQuery(sql, [withdrawalId, userId]);

    if (result.affectedRows === 0) {
      return {
        success: false,
        error: 'Failed to cancel withdrawal',
      };
    }

    return {
      success: true,
      withdrawal: withdrawal,
    };
  };

  //Verify user's address exists
  verifyUserAddress = async (userId, currency, address) => {
    const sql = `
      SELECT id
      FROM ${this.addressesTable}
      WHERE user_id = ? AND currency = ? AND address = ?
    `;

    const result = await coinQuery(sql, [userId, currency, address]);
    return result.length > 0;
  };
}

module.exports = new WithdrawalModel();
