const { getTiers } = require('../config/rewards.config');

const computeUserRewards = (currentXp, config) => {
  const levels = config.levels;

  // Find current level (highest level where xp_total <= user_xp)
  // For users with 0 XP, they are at level 0 (before level 1)
  let currentLevelData = null;
  let currentLevelIndex = -1;

  for (let i = levels.length - 1; i >= 0; i--) {
    if (levels[i].xp_total <= currentXp) {
      currentLevelData = levels[i];
      currentLevelIndex = i;
      break;
    }
  }

  // If user hasn't reached level 1 yet (xp < 100)
  if (!currentLevelData) {
    currentLevelData = {
      level: 1,
      xp_total: 0,
      tier: 'Bronze',
      tier_rank: 1
    };
    currentLevelIndex = -1;
  }

  // Find next level
  const nextLevelIndex = currentLevelIndex + 1;
  const nextLevelData = nextLevelIndex < levels.length ? levels[nextLevelIndex] : null;
  const nextLevel = nextLevelData ? nextLevelData.level : null;

  // Calculate XP to next level and progress percentage
  let xpToNextLevel = 0;
  let levelProgressPct = 100;

  if (nextLevelData) {
    xpToNextLevel = nextLevelData.xp_total - currentXp;

    // Calculate progress percentage within current level
    const xpAtCurrentLevel = currentLevelData.xp_total;
    const xpAtNextLevel = nextLevelData.xp_total;
    const xpNeededForLevel = xpAtNextLevel - xpAtCurrentLevel;
    const xpInCurrentLevel = currentXp - xpAtCurrentLevel;

    if (xpNeededForLevel > 0) {
      levelProgressPct = (xpInCurrentLevel / xpNeededForLevel) * 100;
      // Clamp between 0 and 100
      levelProgressPct = Math.min(100, Math.max(0, levelProgressPct));
    } else {
      levelProgressPct = 100;
    }
  }

  // Round progress percentage to integer (0-100)
  levelProgressPct = Math.round(levelProgressPct);

  // Get all tiers
  const tiers = getTiers();

  return {
    current_level: currentLevelData.level,
    next_level: nextLevel,
    current_xp: currentXp,
    xp_per_coin: config.xp_per_coin,
    xp_to_next_level: Math.max(0, xpToNextLevel),
    level_progress_pct: levelProgressPct,
    current_tier: currentLevelData.tier,
    current_tier_rank: currentLevelData.tier_rank,
    tiers: tiers,
    levels: levels
  };
};

module.exports = {
  computeUserRewards
};
