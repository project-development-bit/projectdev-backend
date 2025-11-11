const { coinQuery } = require("../config/db");

class TransactionModel {
  ledgerTable = "ledger_entries";
  withdrawalsTable = "withdrawals";
  usersTable = "users";

  //Get transaction history with pagination and filters
  getTransactionHistory = async (userId, options = {}) => {
    const {
      page = 1,
      limit = 20,
      type = 'all',      // all, credit, debit, offer, referral, withdrawal, faucet
      currency = null,
      dateFrom = null,
      dateTo = null,
    } = options;

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const offset = (pageInt - 1) * limitInt;

    let whereConditions = ['le.user_id = ?'];
    let queryParams = [userId];

    // Filter by type
    if (type === 'credit') {
      whereConditions.push("le.entry_type = 'credit'");
    } else if (type === 'debit') {
      whereConditions.push("le.entry_type = 'debit'");
    } else if (type !== 'all') {
      // Specific ref_type (offer, referral, withdrawal, faucet)
      whereConditions.push('le.ref_type = ?');
      queryParams.push(type);
    }

    // Filter by currency
    if (currency) {
      whereConditions.push('le.currency = ?');
      queryParams.push(currency);
    }

    // Date filters
    if (dateFrom) {
      whereConditions.push('le.created_at >= ?');
      queryParams.push(dateFrom);
    }

    if (dateTo) {
      whereConditions.push('le.created_at <= ?');
      queryParams.push(dateTo);
    }

    const whereClause = whereConditions.join(' AND ');

    // Count total
    const countSql = `
      SELECT COUNT(*) as total
      FROM ${this.ledgerTable} le
      WHERE ${whereClause}
    `;

    // Get data with withdrawal details
    const dataSql = `
      SELECT
        le.id,
        le.entry_type,
        le.amount,
        le.currency,
        le.ref_type,
        le.ref_id,
        le.created_at,
        w.status AS withdrawal_status,
        w.txid,
        w.address AS withdrawal_address,
        w.fee AS withdrawal_fee,
        w.payout_provider,
        w.error_message,
        w.requested_at,
        w.processed_at
      FROM ${this.ledgerTable} le
      LEFT JOIN ${this.withdrawalsTable} w
        ON le.ref_type = 'withdrawal'
        AND le.ref_id = CAST(w.id AS CHAR) COLLATE utf8mb4_unicode_ci
      WHERE ${whereClause}
      ORDER BY le.created_at DESC
      LIMIT ${limitInt} OFFSET ${offset}
    `;

    const [countResult, transactions] = await Promise.all([
      coinQuery(countSql, queryParams),
      coinQuery(dataSql, queryParams),
    ]);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limitInt);

    return {
      data: transactions.map((tx) => ({
        id: tx.id,
        entryType: tx.entry_type,
        amount: parseFloat(tx.amount),
        currency: tx.currency,
        refType: tx.ref_type,
        refId: tx.ref_id,
        createdAt: tx.created_at,
        // Withdrawal details (if applicable)
        withdrawalStatus: tx.withdrawal_status || null,
        txid: tx.txid || null,
        withdrawalAddress: tx.withdrawal_address || null,
        withdrawalFee: tx.withdrawal_fee ? parseFloat(tx.withdrawal_fee) : null,
        payoutProvider: tx.payout_provider || null,
        errorMessage: tx.error_message || null,
        requestedAt: tx.requested_at || null,
        processedAt: tx.processed_at || null,
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

  //Get transaction summary/statistics
  getTransactionSummary = async (userId) => {
    const sql = `
      SELECT
        COUNT(*) as total_transactions,
        SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END) as total_credits,
        SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END) as total_debits,
        SUM(CASE WHEN entry_type = 'credit' AND ref_type = 'offer' THEN amount ELSE 0 END) as earnings_from_offers,
        SUM(CASE WHEN entry_type = 'credit' AND ref_type = 'referral' THEN amount ELSE 0 END) as earnings_from_referrals,
        SUM(CASE WHEN entry_type = 'credit' AND ref_type = 'faucet' THEN amount ELSE 0 END) as earnings_from_faucet,
        SUM(CASE WHEN entry_type = 'debit' AND ref_type = 'withdrawal' THEN amount ELSE 0 END) as total_withdrawals
      FROM ${this.ledgerTable}
      WHERE user_id = ? AND currency = 'COIN'
    `;

    const result = await coinQuery(sql, [userId]);

    return {
      totalTransactions: result[0].total_transactions,
      totalCredits: parseFloat(result[0].total_credits) || 0,
      totalDebits: parseFloat(result[0].total_debits) || 0,
      earningsFromOffers: parseFloat(result[0].earnings_from_offers) || 0,
      earningsFromReferrals: parseFloat(result[0].earnings_from_referrals) || 0,
      earningsFromFaucet: parseFloat(result[0].earnings_from_faucet) || 0,
      totalWithdrawals: parseFloat(result[0].total_withdrawals) || 0,
    };
  };

  //Create a new ledger entry
  createLedgerEntry = async (entryData) => {
    const {
      userId,
      currency,
      entryType,
      amount,
      refType,
      refId,
      idempotencyKey,
    } = entryData;

    const sql = `
      INSERT INTO ${this.ledgerTable}
      (user_id, currency, entry_type, amount, ref_type, ref_id, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const result = await coinQuery(sql, [
        userId,
        currency,
        entryType,
        amount,
        refType,
        refId,
        idempotencyKey,
      ]);

      return {
        success: true,
        entryId: result.insertId,
      };
    } catch (error) {
      // Check if it's a duplicate entry error
      if (error.code === "ER_DUP_ENTRY") {
        return {
          success: false,
          error: "Duplicate transaction - idempotency key already exists",
        };
      }
      throw error;
    }
  };
}

module.exports = new TransactionModel();
