const { coinQuery } = require("../config/db");

class TransactionModel {
  ledgerTable = "ledger_entries";
  transactionsTable = "transactions";
  usersTable = "users";

  getTransactionHistory = async (userId, options = {}) => {
    const {
      page = 1,
      limit = 20,
      transactionType = null, // 'deposit' or 'withdrawal'
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

    if (transactionType) {
      whereConditions.push('transaction_type = ?');
      queryParams.push(transactionType);
    }

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
      FROM ${this.transactionsTable}
      WHERE ${whereClause}
    `;

    // Get data
    const dataSql = `
      SELECT
        id,
        user_id,
        transaction_type,
        currency,
        amount,
        fee,
        address,
        txid,
        status,
        payment_provider,
        error_code,
        error_message,
        created_at,
        confirmed_at,
        updated_at
      FROM ${this.transactionsTable}
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitInt} OFFSET ${offset}
    `;

    const [countResult, transactions] = await Promise.all([
      coinQuery(countSql, queryParams),
      coinQuery(dataSql, queryParams),
    ]);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limitInt);

    return {
      data: transactions.map((t) => ({
        id: t.id,
        userId: t.user_id,
        transactionType: t.transaction_type,
        currency: t.currency,
        amount: parseFloat(t.amount),
        fee: parseFloat(t.fee),
        address: t.address,
        txid: t.txid,
        status: t.status,
        paymentProvider: t.payment_provider,
        errorCode: t.error_code,
        errorMessage: t.error_message,
        createdAt: t.created_at,
        confirmedAt: t.confirmed_at,
        updatedAt: t.updated_at,
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

}

module.exports = new TransactionModel();
