const path = require('path');
const fs = require('fs');

//Get rewards configuration
const getRewardsConfig = () => {
  try {
    const configPath = path.join(__dirname, 'rewards_levels.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
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
