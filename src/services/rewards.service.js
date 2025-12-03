const { getUserLevelConfig, calculateXpForLevel} = require('../config/rewards.config');

// Find the user's current level based on total XP
const findCurrentLevel = (totalXp, config) => {
  let level = 1;
  let totalamountXp = 0;

  // Find the highest level the user has reached
  while (true) {
    const xpForNextLevel = calculateXpForLevel(level + 1, config);
    const nextTotalAmountXp = totalamountXp + xpForNextLevel;

    if (totalXp < nextTotalAmountXp) {
      break;
    }

    totalamountXp = nextTotalAmountXp;
    level++;
  }

  return {
    level,
    xpCurrentLevel: totalamountXp
  };
};

// Find status and sub-level based on current level
const findStatusAndSubLevel = (level, config) => {
  for (const status of config.statuses) {
    if (level >= status.min_level && (status.max_level === null || level <= status.max_level)) {
      // Find the appropriate sub-level
      let currentSubLevel = status.sub_levels[0];

      for (const subLevel of status.sub_levels) {
        if (level >= subLevel.min_level) {
          currentSubLevel = subLevel;
        } else {
          break;
        }
      }

      return {
        currentStatus: status.id,
        currentSubLevel: currentSubLevel.id,
        subLevelData: currentSubLevel
      };
    }
  }

  // Default to first status if no match found
  const defaultStatus = config.statuses[0];
  return {
    currentStatus: defaultStatus.id,
    currentSubLevel: defaultStatus.sub_levels[0].id,
    subLevelData: defaultStatus.sub_levels[0]
  };
};

// Compute user level state
const computeUserLevelState = (totalXp) => {
  const config = getUserLevelConfig();
  if (!config) {
    throw new Error('User level configuration not available');
  }

  // Find current level
  const { level, xpCurrentLevel } = findCurrentLevel(totalXp, config);

  // Find status and sub-level
  const { currentStatus, currentSubLevel, subLevelData } = findStatusAndSubLevel(level, config);

  // Calculate XP for next level
  const xpNextLevel = xpCurrentLevel + calculateXpForLevel(level + 1, config);
  const xpInLevel = totalXp - xpCurrentLevel;
  const xpNeededInLevel = xpNextLevel - xpCurrentLevel;
  const progressPercent = xpNeededInLevel > 0
    ? Math.round((xpInLevel / xpNeededInLevel) * 100 * 10) / 10 // Round to 1 decimal
    : 100;

  return {
    user_level_state: {
      level,
      current_status: currentStatus,
      current_sub_level: currentSubLevel,
      xp_total: totalXp,
      xp_current_level: xpCurrentLevel,
      xp_next_level: xpNextLevel,
      xp_in_level: xpInLevel,
      xp_needed_in_level: xpNeededInLevel,
      progress_percent: progressPercent
    },
    statuses: config.statuses
  };
};

module.exports = {
  computeUserLevelState
};
