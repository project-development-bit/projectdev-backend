const path = require('path');
const fs = require('fs');

//Validate rewards configuration
const validateRewardsConfig = (config) => {
  if (!config || !Array.isArray(config.levels) || config.levels.length === 0) {
    throw new Error("Rewards config: levels array missing/empty");
  }

  if (typeof config.xp_per_coin !== 'number' || config.xp_per_coin <= 0) {
    throw new Error("Rewards config: xp_per_coin must be a positive number");
  }

  // Verify levels are strictly ascending by xp_total
  for (let i = 1; i < config.levels.length; i++) {
    if (config.levels[i].xp_total <= config.levels[i - 1].xp_total) {
      throw new Error(
        `Rewards config: levels must be strictly ascending by xp_total ` +
        `(level ${config.levels[i].level} has xp_total ${config.levels[i].xp_total} ` +
        `<= previous level's ${config.levels[i - 1].xp_total})`
      );
    }
  }

  console.log('✓ Rewards configuration validated successfully');
};

//Get rewards configuration
const getRewardsConfig = () => {
  try {
    const configPath = path.join(__dirname, 'rewards_levels.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    // Validate config on load
    validateRewardsConfig(config);

    return config;
  } catch (error) {
    console.error('Failed to load rewards configuration:', error.message);
    return null;
  }
};

//Get all unique tiers from the configuration
const getTiers = () => {
  const config = getRewardsConfig();
  if (!config || !config.levels) return [];

  // Get unique tiers in order of appearance
  const tiers = [];
  config.levels.forEach(level => {
    if (!tiers.includes(level.tier)) {
      tiers.push(level.tier);
    }
  });
  return tiers;
};

module.exports = {
  getRewardsConfig,
  getTiers
};
