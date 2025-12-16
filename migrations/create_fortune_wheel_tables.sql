-- Fortune Wheel Tables Migration
-- Creates tables for the Fortune Wheel feature

-- Table: fortune_wheel_rewards
-- Stores the configuration for all possible fortune wheel rewards
DROP TABLE IF EXISTS `fortune_wheel_rewards`;

CREATE TABLE `fortune_wheel_rewards` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `wheel_index` tinyint unsigned NOT NULL COMMENT 'Position on the wheel (0-9)',
  `label` varchar(100) NOT NULL COMMENT 'Display text for the reward',
  `reward_coins` decimal(18,8) NOT NULL DEFAULT 0 COMMENT 'Coin amount to award',
  `reward_usd` decimal(10,2) NOT NULL DEFAULT 0 COMMENT 'USD amount to award (if applicable)',
  `reward_type` enum('coins','cash','offer_boost','treasure_chest') NOT NULL DEFAULT 'coins',
  `weight` decimal(10,2) NOT NULL COMMENT 'Probability weight for selection',
  `icon_url` varchar(500) DEFAULT NULL COMMENT 'URL to reward icon image',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether this reward is currently active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_wheel_index` (`wheel_index`),
  KEY `idx_active_rewards` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Fortune wheel reward configurations';

-- Table: fortune_wheel_logs
-- Records all fortune wheel spins (even 0-coin rewards)
DROP TABLE IF EXISTS `fortune_wheel_logs`;

CREATE TABLE `fortune_wheel_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `reward_id` int unsigned NOT NULL COMMENT 'FK to fortune_wheel_rewards',
  `reward_coins` decimal(18,8) NOT NULL DEFAULT 0 COMMENT 'Actual coins awarded',
  `reward_usd` decimal(10,2) NOT NULL DEFAULT 0 COMMENT 'Actual USD awarded (if applicable)',
  `wheel_index` tinyint unsigned NOT NULL COMMENT 'Winning position on wheel',
  `ip` varchar(45) DEFAULT NULL COMMENT 'User IP address',
  `device_fingerprint` varchar(255) DEFAULT NULL COMMENT 'Device fingerprint for fraud detection',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_created` (`user_id`, `created_at`),
  KEY `idx_created_at` (`created_at`),
  KEY `fk_fortune_wheel_reward` (`reward_id`),
  CONSTRAINT `fk_fortune_wheel_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fortune_wheel_reward` FOREIGN KEY (`reward_id`) REFERENCES `fortune_wheel_rewards` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Fortune wheel spin history';

-- Insert default fortune wheel rewards (10 slots)
INSERT INTO `fortune_wheel_rewards` (`wheel_index`, `label`, `reward_coins`, `reward_usd`, `reward_type`, `weight`, `icon_url`, `is_active`) VALUES
(0, '+5 Coins', 5, 0, 'coins', 40.00, 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/56/56-1765879634770-7q0z8eujxyf0va3h.png', 1),
(1, '+10 Coins', 10, 0, 'coins', 30.00, 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/56/56-1765879634770-7q0z8eujxyf0va3h.png', 1),
(2, '+30 Coins', 30, 0, 'coins', 15.00, 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/56/56-1765879634770-7q0z8eujxyf0va3h.png', 1),
(3, '+50 Coins', 50, 0, 'coins', 8.00, 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/56/56-1765879634770-7q0z8eujxyf0va3h.png', 1),
(4, '+100 Coins', 100, 0, 'coins', 4.00, 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/56/56-1765879634770-7q0z8eujxyf0va3h.png', 1),
(5, '+20K Coins', 20000, 0, 'coins', 0.20, 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/56/56-1765879634770-7q0z8eujxyf0va3h.png', 1),
(6, 'Offer Boost', 0, 0, 'offer_boost', 1.50, 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/56/56-1765879776903-okd293drvpsox8ku.png', 1),
(7, 'Treasure Chest', 0, 0, 'treasure_chest', 0.80, 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/56/56-1765879811052-ds5z44ynyme9e3ir.png', 1),
(8, '$100 Cash', 0, 100, 'cash', 0.40, 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/56/56-1765879557312-qj093n84a532x4om.png', 1),
(9, '$500 Cash', 0, 500, 'cash', 0.10, 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/56/56-1765879557312-qj093n84a532x4om.png', 1);
