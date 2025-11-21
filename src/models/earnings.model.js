const { coinQuery } = require("../config/db");

class EarningsModel {
  offerConversionsTable = "offer_conversions";
  offersTable = "offers";
  ledgerTable = "ledger_entries";

  //Get earnings history with offer details
  getEarningsHistory = async (userId, options = {}) => {
    const {
      days = 30,
      page = 1,
      limit = 20,
      category = null, // 'app', 'survey', or null for all
    } = options;

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const offset = (pageInt - 1) * limitInt;
    const daysInt = parseInt(days, 10);

    let whereConditions = [
      "oc.user_id = ?",
      "oc.status = 'credited'",
      "oc.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)",
    ];
    let queryParams = [userId, daysInt];

    // Filter by category if specified
    if (category) {
      whereConditions.push("o.category = ?");
      queryParams.push(category);
    }

    const whereClause = whereConditions.join(" AND ");

    // Count total
    const countSql = `
      SELECT COUNT(*) as total
      FROM ${this.offerConversionsTable} oc
      LEFT JOIN ${this.offersTable} o ON oc.offer_id = o.id
      WHERE ${whereClause}
    `;

    // Get earnings history with offer details
    const dataSql = `
      SELECT
        oc.id,
        oc.credited_amount as amount,
        oc.currency,
        oc.created_at,
        o.title as offer_title,
        o.category as offer_category,
        o.provider
      FROM ${this.offerConversionsTable} oc
      LEFT JOIN ${this.offersTable} o ON oc.offer_id = o.id
      WHERE ${whereClause}
      ORDER BY oc.created_at DESC
      LIMIT ${limitInt} OFFSET ${offset}
    `;

    const [countResult, earnings] = await Promise.all([
      coinQuery(countSql, queryParams),
      coinQuery(dataSql, queryParams),
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

        return {
          id: earning.id,
          type: "offer",
          category: earning.offer_category || "unknown",
          title: earning.offer_title || "Offer Completion",
          amount: parseFloat(earning.amount),
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

  //Get earnings statistics by category
  getEarningsStatistics = async (userId, options = {}) => {
    const { days = 30 } = options;
    const daysInt = parseInt(days, 10);

    const sql = `
      SELECT
        o.category,
        COUNT(*) as count,
        SUM(oc.credited_amount) as total_earned
      FROM ${this.offerConversionsTable} oc
      LEFT JOIN ${this.offersTable} o ON oc.offer_id = o.id
      WHERE oc.user_id = ?
        AND oc.status = 'credited'
        AND oc.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND o.category IN ('app', 'survey')
      GROUP BY o.category
    `;

    const results = await coinQuery(sql, [userId, daysInt]);

    // Initialize response with default values
    const statistics = {
      surveys: {
        count: 0,
        totalEarned: 0,
      },
      gameApps: {
        count: 0,
        totalEarned: 0,
      },
      totalEarned: 0,
      period: `Last ${daysInt} days`,
    };

    // Map database results to response format
    results.forEach((row) => {
      const count = parseInt(row.count);
      const totalEarned = parseFloat(row.total_earned) || 0;

      if (row.category === "survey") {
        statistics.surveys.count = count;
        statistics.surveys.totalEarned = totalEarned;
      } else if (row.category === "app") {
        statistics.gameApps.count = count;
        statistics.gameApps.totalEarned = totalEarned;
      }

      statistics.totalEarned += totalEarned;
    });

    return statistics;
  };
}

module.exports = new EarningsModel();
