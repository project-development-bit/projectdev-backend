-- =====================================================
-- Faucet System Database Migration
-- =====================================================

-- Table: faucet_streaks
CREATE TABLE IF NOT EXISTS `faucet_streaks` (
  `user_id` bigint unsigned NOT NULL,
  `current_day` int unsigned NOT NULL DEFAULT 1 COMMENT 'Current streak day (1-30)',
  `total_earned_today` decimal(20,8) NOT NULL DEFAULT 0.00000000 COMMENT 'Total coins earned today from faucet',
  `last_claim_at` timestamp NULL DEFAULT NULL COMMENT 'Last time user claimed faucet',
  `streak_date` date NOT NULL COMMENT 'Date of current streak (UTC)',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  KEY `idx_streak_date` (`streak_date`),
  CONSTRAINT `fk_faucet_streak_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Tracks user faucet streak progress and daily earnings';

-- Table: faucet_daily_history
CREATE TABLE IF NOT EXISTS `faucet_daily_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `date` date NOT NULL COMMENT 'The date (UTC) of this record',
  `streak_day` int unsigned NOT NULL COMMENT 'Which streak day this was',
  `target_amount` decimal(20,8) NOT NULL COMMENT 'Daily target for this day',
  `earned_amount` decimal(20,8) NOT NULL COMMENT 'Total earned on this day',
  `target_reached` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 if target was reached',
  `claims_count` int unsigned NOT NULL DEFAULT 0 COMMENT 'Number of claims made this day',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_date` (`user_id`, `date`),
  KEY `idx_user_streak` (`user_id`, `streak_day`),
  KEY `idx_date` (`date`),
  CONSTRAINT `fk_faucet_history_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Historical record of user faucet daily achievements';

-- Update existing faucet_claims table
ALTER TABLE `faucet_claims`
ADD COLUMN `streak_day` int unsigned NOT NULL DEFAULT 1 COMMENT 'Streak day when this claim was made' AFTER `amount`,
ADD COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `claimed_at`;

-- Add index for better query performance
ALTER TABLE `faucet_claims`
ADD INDEX `idx_user_claimed_at` (`user_id`, `claimed_at`);

-- Insert default streak records for existing users
INSERT INTO `faucet_streaks` (`user_id`, `current_day`, `total_earned_today`, `last_claim_at`, `streak_date`)
SELECT
  fc.user_id,
  1 as current_day,
  0.00000000 as total_earned_today,
  MAX(fc.claimed_at) as last_claim_at,
  CURDATE() as streak_date
FROM `faucet_claims` fc
LEFT JOIN `faucet_streaks` fs ON fc.user_id = fs.user_id
WHERE fs.user_id IS NULL
GROUP BY fc.user_id
ON DUPLICATE KEY UPDATE
  last_claim_at = VALUES(last_claim_at);
