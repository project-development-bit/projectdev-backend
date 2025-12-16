//Faucet System Configuration
const FAUCET_CONFIG = {
  // Cooldown period between claims (in hours)
  CLAIM_INTERVAL_HOURS: 4,

  // Base reward for Day 1 (in coins)
  BASE_REWARD: 12,

  // Reward growth rate per day (10% = 0.10)
  REWARD_GROWTH_RATE: 0.10,

  // Maximum faucet reward cap
  MAX_REWARD: 60,

  // Maximum streak days
  MAX_STREAK_DAYS: 30,

  // Daily target configuration
  BASE_DAILY_TARGET: 300,

  // Daily target growth rate (10% = 0.10)
  TARGET_GROWTH_RATE: 0.10,

  // Maximum daily target cap
  MAX_DAILY_TARGET: 1500,

  // Timezone for daily resets (always UTC)
  TIMEZONE: 'UTC',

  // Daily reset time (hour in 24h format, UTC)
  DAILY_RESET_HOUR: 0,
};

/**
 * Calculate the faucet reward for a specific streak day
 * Formula: Day N Reward = Day (N-1) Reward × (1 + growth_rate)
 */
const calculateDayReward = (day) => {
  if (day < 1) return FAUCET_CONFIG.BASE_REWARD;
  if (day === 1) return FAUCET_CONFIG.BASE_REWARD;

  let reward = FAUCET_CONFIG.BASE_REWARD;

  // Calculate compound growth
  for (let i = 2; i <= day; i++) {
    reward = reward * (1 + FAUCET_CONFIG.REWARD_GROWTH_RATE);
  }

  // Round and cap at maximum
  reward = Math.ceil(reward);
  return Math.min(reward, FAUCET_CONFIG.MAX_REWARD);
};

/**
 * Calculate the daily target for a specific streak day
 * Formula: Day N Target = BaseTarget × (1 + growth_rate)^(N-1)
 */
const calculateDailyTarget = (day) => {
  if (day < 1) return FAUCET_CONFIG.BASE_DAILY_TARGET;

  const target = Math.ceil(
    FAUCET_CONFIG.BASE_DAILY_TARGET *
    Math.pow(1 + FAUCET_CONFIG.TARGET_GROWTH_RATE, day - 1)
  );

  // Apply maximum cap
  return Math.min(target, FAUCET_CONFIG.MAX_DAILY_TARGET);
};

/**
 * Generate an array of rewards for all streak days
 * Used for displaying preview in UI
 */
const generateStreakRewards = (maxDays = FAUCET_CONFIG.MAX_STREAK_DAYS) => {
  const rewards = [];

  for (let day = 1; day <= maxDays; day++) {
    rewards.push({
      day,
      reward: calculateDayReward(day),
      target: calculateDailyTarget(day)
    });
  }

  return rewards;
};

//Get the cooldown duration in milliseconds
const getClaimIntervalMs = () => {
  return FAUCET_CONFIG.CLAIM_INTERVAL_HOURS * 60 * 60 * 1000;
};

//Validate faucet configuration on load
const validateConfig = () => {
  const errors = [];

  if (FAUCET_CONFIG.CLAIM_INTERVAL_HOURS <= 0) {
    errors.push('CLAIM_INTERVAL_HOURS must be greater than 0');
  }

  if (FAUCET_CONFIG.BASE_REWARD <= 0) {
    errors.push('BASE_REWARD must be greater than 0');
  }

  if (FAUCET_CONFIG.REWARD_GROWTH_RATE < 0) {
    errors.push('REWARD_GROWTH_RATE must be non-negative');
  }

  if (FAUCET_CONFIG.MAX_REWARD < FAUCET_CONFIG.BASE_REWARD) {
    errors.push('MAX_REWARD must be greater than or equal to BASE_REWARD');
  }

  if (FAUCET_CONFIG.MAX_STREAK_DAYS <= 0) {
    errors.push('MAX_STREAK_DAYS must be greater than 0');
  }

  if (FAUCET_CONFIG.BASE_DAILY_TARGET <= 0) {
    errors.push('BASE_DAILY_TARGET must be greater than 0');
  }

  if (FAUCET_CONFIG.TARGET_GROWTH_RATE < 0) {
    errors.push('TARGET_GROWTH_RATE must be non-negative');
  }

  if (errors.length > 0) {
    throw new Error(`Faucet configuration errors:\n${errors.join('\n')}`);
  }

  console.log('✓ Faucet configuration validated successfully');
};

// Validate on module load
validateConfig();

module.exports = {
  FAUCET_CONFIG,
  calculateDayReward,
  calculateDailyTarget,
  generateStreakRewards,
  getClaimIntervalMs
};
