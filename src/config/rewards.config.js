const path = require('path');
const fs = require('fs');

// Validate user level configuration
const validateUserLevelConfig = (config) => {
  // Validate xp_rules
  if (!config.xp_rules || !config.xp_rules.config) {
    throw new Error("User level config: xp_rules.config missing");
  }

  const xpConfig = config.xp_rules.config;
  if (typeof xpConfig.xp_per_coin !== 'number' || xpConfig.xp_per_coin <= 0) {
    throw new Error("User level config: xp_per_coin must be a positive number");
  }

  if (typeof xpConfig.base_xp_for_level_2 !== 'number' || xpConfig.base_xp_for_level_2 <= 0) {
    throw new Error("User level config: base_xp_for_level_2 must be a positive number");
  }

  if (typeof xpConfig.growth_factor_per_level !== 'number' || xpConfig.growth_factor_per_level <= 1) {
    throw new Error("User level config: growth_factor_per_level must be greater than 1");
  }

  // Validate statuses
  if (!config.statuses || !Array.isArray(config.statuses) || config.statuses.length === 0) {
    throw new Error("User level config: statuses array missing/empty");
  }

  // Verify statuses are properly ordered
  for (let i = 0; i < config.statuses.length; i++) {
    const status = config.statuses[i];

    if (!status.id || !status.label || !status.min_level) {
      throw new Error(`User level config: status at index ${i} missing required fields`);
    }

    if (!Array.isArray(status.sub_levels) || status.sub_levels.length === 0) {
      throw new Error(`User level config: status ${status.id} has no sub_levels`);
    }

    // Verify sub_levels are ordered by min_level
    for (let j = 1; j < status.sub_levels.length; j++) {
      if (status.sub_levels[j].min_level <= status.sub_levels[j - 1].min_level) {
        throw new Error(
          `User level config: sub_levels in status ${status.id} must be ordered by min_level`
        );
      }
    }
  }

  console.log('✓ User level configuration validated successfully');
};

// Get user level configuration
const getUserLevelConfig = () => {
  try {
    const configPath = path.join(__dirname, 'user_level_config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    // Validate config on load
    validateUserLevelConfig(config);

    return config;
  } catch (error) {
    console.error('Failed to load user level configuration:', error.message);
    return null;
  }
};

// Calculate XP required for a specific level using the formula
const calculateXpForLevel = (level, config) => {
  if (level === 1) {
    return 0; // Level 1 starts at 0 XP
  }

  const { base_xp_for_level_2, growth_factor_per_level } = config.xp_rules.config;

  if (level === 2) {
    return base_xp_for_level_2;
  }

  // XP needed for level N = round(base_xp_for_level_2 * growth_factor_per_level^(N-2))
  const xpRequired = Math.round(
    base_xp_for_level_2 * Math.pow(growth_factor_per_level, level - 2)
  );

  return xpRequired;
};

// Calculate TotalAmount XP for a specific level
const calculateTotalAmountXpForLevel = (level, config) => {
  let totalXp = 0;
  for (let i = 1; i <= level; i++) {
    totalXp += calculateXpForLevel(i, config);
  }
  return totalXp;
};

module.exports = {
  getUserLevelConfig,
  calculateXpForLevel,
  calculateTotalAmountXpForLevel
};
