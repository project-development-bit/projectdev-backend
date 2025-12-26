-- Treasure Chest Tables Migration

DROP TABLE IF EXISTS `treasure_chest_rewards`;

CREATE TABLE `treasure_chest_rewards` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `reward_type` enum('coins','extra_spin','offer_boost','ptc_discount') NOT NULL DEFAULT 'coins',
  `label` varchar(100) NOT NULL COMMENT 'Display text for the reward',
  `reward_coins` decimal(18,8) DEFAULT 0 COMMENT 'Coin amount to award (if reward_type is coins)',
  `weight` decimal(10,2) NOT NULL COMMENT 'Probability weight for selection',
  `min_status` enum('bronze','silver','gold','diamond','legend') DEFAULT NULL COMMENT 'Minimum user status required (NULL = all users)',
  `max_per_week` int unsigned DEFAULT NULL COMMENT 'Maximum times this reward can be won per week (NULL = unlimited)',
  `cooldown_hours` int unsigned DEFAULT NULL COMMENT 'Cooldown in hours after winning this specific reward (NULL = no reward-specific cooldown)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether this reward is currently active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_active_rewards` (`is_active`),
  KEY `idx_reward_type` (`reward_type`),
  KEY `idx_min_status` (`min_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Treasure chest reward configurations';

-- Table: treasure_chest_logs
-- Records all treasure chest openings with full audit trail
DROP TABLE IF EXISTS `treasure_chest_logs`;

CREATE TABLE `treasure_chest_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `reward_id` int unsigned DEFAULT NULL COMMENT 'FK to treasure_chest_rewards (NULL for failed attempts)',
  `reward_type` enum('coins','extra_spin','offer_boost','ptc_discount') DEFAULT NULL COMMENT 'Type of reward (NULL for failed attempts)',
  `reward_value` decimal(18,8) DEFAULT NULL COMMENT 'Actual value awarded (NULL for failed attempts)',
  `user_status` varchar(20) NOT NULL COMMENT 'User status at time of attempt',
  `user_level` int unsigned NOT NULL COMMENT 'User level at time of attempt',
  `chest_type` ENUM('base', 'bonus') NOT NULL DEFAULT 'base' COMMENT 'Type of chest used: base (weekly) or bonus (from rewards)',
  `status` enum('success','no_chest_available','cooldown','locked','max_reward_limit','spin_limit_exceeded') NOT NULL DEFAULT 'success' COMMENT 'Outcome of chest open attempt',
  `ip` varchar(45) DEFAULT NULL COMMENT 'User IP address',
  `device_fingerprint` varchar(255) DEFAULT NULL COMMENT 'Device fingerprint for fraud detection',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When the attempt was made',
  `last_opened_at` timestamp NULL DEFAULT NULL COMMENT 'Last successful open time (for cooldown tracking)',
  PRIMARY KEY (`id`),
  KEY `idx_user_created` (`user_id`, `created_at`),
  KEY `idx_user_last_opened` (`user_id`, `last_opened_at`),
  KEY `idx_user_reward_created` (`user_id`, `reward_id`, `created_at`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_status_created` (`status`, `created_at`),
  KEY `idx_user_status` (`user_status`),
  KEY `idx_user_chest_type_created` (`user_id`, `chest_type`, `created_at`, `status`);
  KEY `fk_treasure_chest_reward` (`reward_id`),
  CONSTRAINT `fk_treasure_chest_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_treasure_chest_reward` FOREIGN KEY (`reward_id`) REFERENCES `treasure_chest_rewards` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Treasure chest opening attempts (success and failures)';

-- Insert default treasure chest rewards based on specification
INSERT INTO `treasure_chest_rewards` (`reward_type`, `label`, `reward_coins`, `weight`, `min_status`, `max_per_week`, `cooldown_hours`, `is_active`) VALUES
-- Low-tier rewards (84% combined probability)
('coins', '+30 Coins', 30, 39.00, NULL, NULL, NULL, 1),
('coins', '+50 Coins', 50, 30.00, NULL, NULL, NULL, 1),
('coins', '+100 Coins', 100, 15.00, NULL, NULL, NULL, 1),

-- Mid-tier rewards (13% combined probability)
('coins', '+300 Coins', 300, 7.00, NULL, NULL, NULL, 1),
('coins', '+500 Coins', 500, 4.00, NULL, NULL, NULL, 1),
('coins', '+1,000 Coins', 1000, 2.00, NULL, NULL, NULL, 1),

-- High-tier coin rewards (1% combined probability)
('coins', '+5,000 Coins', 5000, 0.70, NULL, NULL, NULL, 1),
('coins', '+20K Coins', 20000, 0.30, 'silver', 1, 24, 1), -- Restricted to Silver+, Max 1/week, 24hr cooldown

-- Special non-coin rewards (2% combined probability)
('extra_spin', '+2 Spins', 0, 0.80, NULL, NULL, NULL, 1),
('offer_boost', 'Offer Boost 8% (24h)', 0, 0.60, NULL, NULL, NULL, 1),
('ptc_discount', 'PTC Discount 3%', 0, 0.60, NULL, NULL, NULL, 1);
