const crypto = require("crypto");
const ReferralModel = require("../models/referral.model");

//Generate a unique referral code
const generateReferralCode = (length = 8) => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, characters.length);
    result += characters[randomIndex];
  }

  return result;
};

//Generate a unique referral code that doesn't exist in the database
const generateUniqueReferralCode = async (maxAttempts = 10) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateReferralCode();
    const exists = await ReferralModel.isReferralCodeExists(code);

    if (!exists) {
      return code;
    }
  }

  // If we still haven't found a unique code, try with a longer code
  const longerCode = generateReferralCode(12);
  return longerCode;
};

module.exports = {
  generateReferralCode,
  generateUniqueReferralCode,
};
