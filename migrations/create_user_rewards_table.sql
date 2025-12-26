-- User Rewards Table Migration

DROP TABLE IF EXISTS `user_rewards`;

CREATE TABLE `user_rewards` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL COMMENT 'FK to users table',
  `reward_type` enum('treasure_chest','extra_spin','offer_boost','ptc_discount') NOT NULL COMMENT 'Type of reward',
  `source_type` enum('fortune_wheel','treasure_chest') NOT NULL COMMENT 'Where the reward came from',
  `source_id` bigint unsigned DEFAULT NULL COMMENT 'FK to fortune_wheel_logs or treasure_chest_logs',
  `quantity` int unsigned NOT NULL DEFAULT 1 COMMENT 'Number of items (for stackable rewards like spins)',
  `reward_data` json DEFAULT NULL COMMENT 'Additional data (boost %, duration, etc)',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT 'When this reward expires (NULL = never)',
  `used_at` timestamp NULL DEFAULT NULL COMMENT 'When this reward was consumed/redeemed',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether reward is still available to use',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When reward was granted',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_active` (`user_id`, `is_active`, `reward_type`),
  KEY `idx_user_type_active` (`user_id`, `reward_type`, `is_active`, `expires_at`),
  KEY `idx_expires` (`expires_at`, `is_active`),
  KEY `idx_source` (`source_type`, `source_id`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `fk_user_rewards_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tracks all non-coin rewards (treasure chests, spins, boosts, discounts)';
