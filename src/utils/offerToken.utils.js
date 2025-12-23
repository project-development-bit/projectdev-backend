const crypto = require("crypto");
const { coinQuery } = require("../config/db");

const generateOfferToken = async () => {
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const token = crypto.randomBytes(16).toString("hex");

    const sql = `SELECT id FROM users WHERE offer_token = ? LIMIT 1`;
    const result = await coinQuery(sql, [token]);

    if (result.length === 0) {
      return token;
    }
  }

  const timestamp = Date.now();
  const randomPart = crypto.randomBytes(12).toString("hex");
  return `${timestamp}_${randomPart}`;
};

module.exports = {
  generateOfferToken,
};
