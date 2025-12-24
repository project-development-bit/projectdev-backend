const { coinQuery } = require("../config/db");

class EarningsModel {
  offerConversionsTable = "offer_conversions";
  offersTable = "offers";
  ledgerTable = "ledger_entries";

  //Get earnings history from ledger entries
  getEarningsHistory = async (userId, options = {}) => {
    const {
      days = 30,
      page = 1,
      limit = 20,
      category = null,
    } = options;

    const pageInt = Math.max(1, parseInt(page, 10) || 1);
    const limitInt = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageInt - 1) * limitInt;
    const daysInt = Math.max(1, parseInt(days, 10) || 30);

    let whereConditions = [
      "user_id = ?",
      "entry_type = 'credit'",
      `created_at >= DATE_SUB(NOW(), INTERVAL ${daysInt} DAY)`,
    ];
    let queryParams = [userId];

    // Filter by category (ref_type) if specified
    if (category) {
      whereConditions.push("ref_type = ?");
      queryParams.push(category);
    }

    const whereClause = whereConditions.join(" AND ");

    // Count total
    const countSql = `
      SELECT COUNT(*) as total
      FROM ${this.ledgerTable}
      WHERE ${whereClause}
    `;

    // Get earnings history from ledger entries
    const dataSql = `
      SELECT
        id,
        ref_type,
        amount,
        currency,
        created_at
      FROM ${this.ledgerTable}
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitInt} OFFSET ${offset}
    `;

    const dataQueryParams = [...queryParams];

    const [countResult, earnings] = await Promise.all([
      coinQuery(countSql, queryParams),
      coinQuery(dataSql, dataQueryParams),
    ]);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limitInt);

    return {
      earnings: earnings.map((earning) => {
        // Calculate time ago
        const createdAt = new Date(earning.created_at);
        const now = new Date();
        const diffMs = now - createdAt;
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let timeAgo;
        if (diffMinutes < 1) {
          timeAgo = "just now";
        } else if (diffMinutes < 60) {
          timeAgo = `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
        } else if (diffHours < 24) {
          timeAgo = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
        } else {
          timeAgo = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
        }

        // Generate title based on ref_type
        const titleMap = {
          offer: "Offer Completion",
          referral: "Referral Bonus",
          faucet: "Faucet Claim",
          deposit: "Deposit",
          fortune_wheel: "Fortune Wheel Win",
          treasure_chest: "Treasure Chest Reward",
        };

        return {
          id: earning.id,
          type: earning.ref_type,
          category: earning.ref_type,
          title: titleMap[earning.ref_type] || earning.ref_type,
          amount: Number(earning.amount) || 0,
          currency: earning.currency,
          timeAgo: timeAgo,
          createdAt: earning.created_at,
        };
      }),
      pagination: {
        total: total,
        page: pageInt,
        limit: limitInt,
        totalPages: totalPages,
      },
    };
  };

  //Get earnings statistics by category from ledger entries
  getEarningsStatistics = async (userId, options = {}) => {
    const { days = 30 } = options;
    const daysInt = Math.max(1, parseInt(days, 10) || 30);

    const sql = `
      SELECT
        ref_type as category,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_earned
      FROM ${this.ledgerTable}
      WHERE user_id = ?
        AND entry_type = 'credit'
        AND created_at >= DATE_SUB(NOW(), INTERVAL ${daysInt} DAY)
      GROUP BY ref_type
    `;

    const results = await coinQuery(sql, [userId]);

    // Initialize response with default values for all earning types
    const statistics = {
      offers: {
        count: 0,
        totalEarned: 0,
      },
      referrals: {
        count: 0,
        totalEarned: 0,
      },
      faucets: {
        count: 0,
        totalEarned: 0,
      },
      deposits: {
        count: 0,
        totalEarned: 0,
      },
      fortuneWheels: {
        count: 0,
        totalEarned: 0,
      },
      treasureChests: {
        count: 0,
        totalEarned: 0,
      },
      totalEarned: 0,
      period: `Last ${daysInt} days`,
    };

    // Map database results to response format
    results.forEach((row) => {
      const count = Number(row.count) || 0;
      const totalEarned = Number(row.total_earned) || 0;

      if (row.category === "offer") {
        statistics.offers.count = count;
        statistics.offers.totalEarned = totalEarned;
      } else if (row.category === "referral") {
        statistics.referrals.count = count;
        statistics.referrals.totalEarned = totalEarned;
      } else if (row.category === "faucet") {
        statistics.faucets.count = count;
        statistics.faucets.totalEarned = totalEarned;
      } else if (row.category === "deposit") {
        statistics.deposits.count = count;
        statistics.deposits.totalEarned = totalEarned;
      } else if (row.category === "fortune_wheel") {
        statistics.fortuneWheels.count = count;
        statistics.fortuneWheels.totalEarned = totalEarned;
      } else if (row.category === "treasure_chest") {
        statistics.treasureChests.count = count;
        statistics.treasureChests.totalEarned = totalEarned;
      }

      statistics.totalEarned += totalEarned;
    });

    return statistics;
  };
}

module.exports = new EarningsModel();
