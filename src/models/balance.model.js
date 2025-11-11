const { coinQuery } = require("../config/db");

class BalanceModel {
  balancesTable = "balances";
  currenciesTable = "currencies";

  //Get user's balance for all currencies
  getBalance = async (userId) => {
    const sql = `
      SELECT
        b.currency,
        c.name as currency_name,
        c.decimals,
        b.available,
        b.pending,
        (b.available + b.pending) as total
      FROM ${this.balancesTable} b
      JOIN ${this.currenciesTable} c ON c.code = b.currency
      WHERE b.user_id = ?
      ORDER BY
        CASE
          WHEN b.currency = 'COIN' THEN 1
          ELSE 2
        END,
        b.currency ASC
    `;

    const result = await coinQuery(sql, [userId]);

    return result.map((balance) => ({
      currency: balance.currency,
      currencyName: balance.currency_name,
      decimals: balance.decimals,
      available: parseFloat(balance.available),
      pending: parseFloat(balance.pending),
      total: parseFloat(balance.total),
    }));
  };

  //Get user's balance for a specific currency
  getBalanceByCurrency = async (userId, currency) => {
    const sql = `
      SELECT
        b.currency,
        c.name as currency_name,
        c.decimals,
        b.available,
        b.pending,
        (b.available + b.pending) as total
      FROM ${this.balancesTable} b
      JOIN ${this.currenciesTable} c ON c.code = b.currency
      WHERE b.user_id = ? AND b.currency = ?
    `;

    const result = await coinQuery(sql, [userId, currency]);

    if (!result || result.length === 0) {
      return null;
    }

    return {
      currency: result[0].currency,
      currencyName: result[0].currency_name,
      decimals: result[0].decimals,
      available: parseFloat(result[0].available),
      pending: parseFloat(result[0].pending),
      total: parseFloat(result[0].total),
    };
  };

  //Create initial balance records for a new user
  createUserBalances = async (userId) => {
    // Get all enabled currencies
    const currenciesSql = `SELECT code FROM ${this.currenciesTable} WHERE enabled = 1`;
    const currencies = await coinQuery(currenciesSql);

    // Create balance record for each currency using parameterized queries
    if (currencies.length === 0) {
      return { affectedRows: 0 };
    }

    const values = currencies.map(() => '(?, ?, 0, 0)').join(',');
    const params = currencies.flatMap(c => [userId, c.code]);

    const sql = `
      INSERT INTO ${this.balancesTable} (user_id, currency, available, pending)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE user_id = user_id
    `;

    const result = await coinQuery(sql, params);
    return result;
  };

  //Add credit to user's available balance
  addCredit = async (userId, currency, amount) => {
    const sql = `
      INSERT INTO ${this.balancesTable} (user_id, currency, available, pending)
      VALUES (?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE available = available + ?
    `;

    const result = await coinQuery(sql, [userId, currency, amount, amount]);
    return result;
  };

  //Add to pending balance
  addPending = async (userId, currency, amount) => {
    const sql = `
      UPDATE ${this.balancesTable}
      SET pending = pending + ?
      WHERE user_id = ? AND currency = ?
    `;

    const result = await coinQuery(sql, [amount, userId, currency]);
    return result;
  };

  //Deduct from user's available balance
  deductBalance = async (userId, currency, amount) => {
    // Check if sufficient balance
    const balance = await this.getBalanceByCurrency(userId, currency);

    if (!balance || balance.available < amount) {
      throw new Error('Insufficient balance');
    }

    const sql = `
      UPDATE ${this.balancesTable}
      SET available = available - ?
      WHERE user_id = ? AND currency = ? AND available >= ?
    `;

    const result = await coinQuery(sql, [amount, userId, currency, amount]);

    if (result.affectedRows === 0) {
      throw new Error('Failed to deduct balance - insufficient funds');
    }

    return result;
  };

  //Move amount from pending to available
  movePendingToAvailable = async (userId, currency, amount) => {
    const sql = `
      UPDATE ${this.balancesTable}
      SET
        pending = pending - ?,
        available = available + ?
      WHERE user_id = ? AND currency = ? AND pending >= ?
    `;

    const result = await coinQuery(sql, [amount, amount, userId, currency, amount]);

    if (result.affectedRows === 0) {
      throw new Error('Failed to move pending balance - insufficient pending funds');
    }

    return result;
  };
}

module.exports = new BalanceModel();
