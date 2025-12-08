const dotenv = require("dotenv");
dotenv.config();

const referralConfig = {
  revenueSharePct: parseFloat(process.env.REFERRAL_REVENUE_SHARE_PCT) || 15.0,
  frontendUrl: process.env.FRONTEND_URL || "https://gigafaucet.com",
};

module.exports = referralConfig;
