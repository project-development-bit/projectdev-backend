const { coinQuery } = require("../config/db");

class WalletModel {
  ledgerTable = "ledger_entries";
  balancesTable = "balances";
  appConfigTable = "app_config";
  userProfilesTable = "user_profiles";


  getWalletBalances = async (userId, options = {}) => {
    const {
      asOf = new Date().toISOString(),
      windowDays = 90,
    } = options;

    // Clamp windowDays to maximum of 90
    const clampedWindowDays = Math.min(Math.max(windowDays, 1), 90);

    // Parse and validate asOf timestamp
    const asOfDate = new Date(asOf);
    if (isNaN(asOfDate.getTime())) {
      throw new Error('Invalid asOf timestamp');
    }

    // Calculate window start date (asOf - windowDays)
    const windowStart = new Date(asOfDate);
    windowStart.setDate(windowStart.getDate() - clampedWindowDays);

    // Get coin balance from balances table
    const coinBalance = await this.getCoinBalance(userId);

    // Get exchange rates
    const rates = await this.getExchangeRates();

    // Calculate USD and BTC balances
    let usdBalance = null;
    let btcBalance = null;
    let ratesAvailable = false;

    if (rates.coinToUsd && rates.btcUsdPrice) {
      ratesAvailable = true;
      const usdValue = coinBalance * rates.coinToUsd;
      usdBalance = Number(usdValue.toFixed(4));

      const btcValue = usdValue / rates.btcUsdPrice;
      // Round to 8 decimals and return as number
      btcBalance = Number(btcValue.toFixed(8));
    }

    // Check if interest feature is enabled
    const interestEnabled = await this.isInterestEnabled(userId);

    // Calculate interest earned (within window)
    let interestEarned = null;
    if (interestEnabled) {
      const earned = await this.calculateInterestEarned(
        userId,
        windowStart.toISOString(),
        asOfDate.toISOString()
      );
      interestEarned = earned !== null ? earned : null;
    }

    // Calculate coins today (UTC day boundary)
    const coinsTodayResult = await this.calculateCoinsToday(
      userId,
      asOfDate.toISOString()
    );
    const coinsToday = coinsTodayResult !== null ? coinsTodayResult : null;

    // Calculate coins last 7 days
    const coinsLast7Days = await this.calculateCoinsLastNDays(
      userId,
      7,
      asOfDate.toISOString()
    );

    return {
      coinBalance: Math.floor(coinBalance), // integer coins
      usdBalance,
      btcBalance,
      interestEarned,
      coinsToday,
      coinsLast7Days: Math.floor(coinsLast7Days),
      meta: {
        asOf: asOfDate.toISOString(),
        windowDays: clampedWindowDays,
        cacheTtlSec: 600,
        rates: {
          coinToUsd: rates.coinToUsd,
          btcUsdPrice: rates.btcUsdPrice,
          ratesAvailable,
        },
      },
    };
  };

  //Get COIN balance from balances table
  getCoinBalance = async (userId) => {
    const sql = `
      SELECT available
      FROM ${this.balancesTable}
      WHERE user_id = ? AND currency = 'COIN'
    `;

    const result = await coinQuery(sql, [userId]);

    if (!result || result.length === 0) {
      return 0;
    }

    return parseFloat(result[0].available) || 0;
  };

  //Get exchange rates from app_config table
  getExchangeRates = async () => {
    const sql = `
      SELECT name, value
      FROM ${this.appConfigTable}
      WHERE name IN ('COINS_PER_USD', 'BTC_USD_PRICE')
    `;
 
    try {
      const result = await coinQuery(sql);

      let coinToUsd = null;
      let btcUsdPrice = null;

      result.forEach((row) => {
        if (row.name === 'COINS_PER_USD') {
          const coinsPerUsd = parseFloat(row.value);
          if (coinsPerUsd > 0) {
            coinToUsd = 1 / coinsPerUsd; // Convert to USD per coin
          }
        } else if (row.name === 'BTC_USD_PRICE') {
          btcUsdPrice = parseFloat(row.value);
        }
      });

      return { coinToUsd, btcUsdPrice };
    } catch (error) {
      // Rates service unavailable
      return { coinToUsd: null, btcUsdPrice: null };
    }
  };

  //Check if interest feature is enabled for user
  isInterestEnabled = async (userId) => {
    const sql = `
      SELECT interest_enable
      FROM ${this.userProfilesTable}
      WHERE user_id = ?
    `;

    const result = await coinQuery(sql, [userId]);

    if (!result || result.length === 0) {
      return false;
    }

    return result[0].interest_enable === 1;
  };

  //Calculate interest earned within window
  calculateInterestEarned = async (userId, windowStart, asOf) => {
    const sql = `
      SELECT SUM(amount) as total_interest
      FROM ${this.ledgerTable}
      WHERE user_id = ?
        AND currency = 'COIN'
        AND entry_type = 'credit'
        AND ref_type = 'interest'
        AND created_at >= ?
        AND created_at <= ?
    `;

    const result = await coinQuery(sql, [userId, windowStart, asOf]);

    if (!result || result.length === 0 || !result[0].total_interest) {
      return null;
    }

    return Math.floor(parseFloat(result[0].total_interest));
  };

  //Calculate coins earned today
  calculateCoinsToday = async (userId, asOf) => {
    const asOfDate = new Date(asOf);

    // Get UTC day boundaries
    const startOfDay = new Date(Date.UTC(
      asOfDate.getUTCFullYear(),
      asOfDate.getUTCMonth(),
      asOfDate.getUTCDate(),
      0, 0, 0, 0
    ));

    const endOfDay = new Date(Date.UTC(
      asOfDate.getUTCFullYear(),
      asOfDate.getUTCMonth(),
      asOfDate.getUTCDate(),
      23, 59, 59, 999
    ));

    const sql = `
      SELECT SUM(amount) as total_coins
      FROM ${this.ledgerTable}
      WHERE user_id = ?
        AND currency = 'COIN'
        AND entry_type = 'credit'
        AND created_at >= ?
        AND created_at <= ?
    `;

    const result = await coinQuery(sql, [
      userId,
      startOfDay.toISOString(),
      endOfDay.toISOString(),
    ]);

    if (!result || result.length === 0 || !result[0].total_coins) {
      return null;
    }

    return Math.floor(parseFloat(result[0].total_coins));
  };

  //Calculate coins earned in last N days (including today)
  calculateCoinsLastNDays = async (userId, days, asOf) => {
    const asOfDate = new Date(asOf);

    // Calculate N days ago
    const startDate = new Date(asOfDate);
    startDate.setDate(startDate.getDate() - (days - 1)); // -6 for 7 days including today

    // Start of first day (UTC)
    const startOfPeriod = new Date(Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
      0, 0, 0, 0
    ));

    // End of current day (UTC)
    const endOfPeriod = new Date(Date.UTC(
      asOfDate.getUTCFullYear(),
      asOfDate.getUTCMonth(),
      asOfDate.getUTCDate(),
      23, 59, 59, 999
    ));

    const sql = `
      SELECT SUM(amount) as total_coins
      FROM ${this.ledgerTable}
      WHERE user_id = ?
        AND currency = 'COIN'
        AND entry_type = 'credit'
        AND created_at >= ?
        AND created_at <= ?
    `;

    const result = await coinQuery(sql, [
      userId,
      startOfPeriod.toISOString(),
      endOfPeriod.toISOString(),
    ]);

    if (!result || result.length === 0 || !result[0].total_coins) {
      return 0;
    }

    return parseFloat(result[0].total_coins) || 0;
  };

  //Round number to specified decimal places
  roundToDecimals = (value, decimals) => {
    const multiplier = Math.pow(10, decimals);
    const rounded = Math.round(value * multiplier) / multiplier;
    // Convert to fixed decimals to avoid scientific notation
    return parseFloat(rounded.toFixed(decimals));
  };
}

module.exports = new WalletModel();
