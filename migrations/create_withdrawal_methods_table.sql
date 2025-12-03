-- Migration: Create withdrawal_methods table

DROP TABLE IF EXISTS `withdrawal_methods`;

CREATE TABLE `withdrawal_methods` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(10) NOT NULL COMMENT 'Unique code: BTC, DASH, DOGE, LTC',
  `name` varchar(50) NOT NULL COMMENT 'Display name: Bitcoin, Dash, Doge, Litecoin',
  `network` varchar(50) DEFAULT NULL COMMENT 'Network name (e.g., Bitcoin, Dogecoin, Litecoin)',
  `icon_url` varchar(255) DEFAULT NULL COMMENT 'URL to coin icon',
  `min_amount_coins` decimal(20,8) NOT NULL DEFAULT 0.00000000 COMMENT 'Minimum withdrawal amount in coins',
  `fee_coins` decimal(20,8) NOT NULL DEFAULT 0.00000000 COMMENT 'Fixed fee in coins (0 for no fees)',
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether this method is enabled',
  `sort_order` int NOT NULL DEFAULT 0 COMMENT 'Display order for frontend',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_code` (`code`),
  KEY `idx_is_enabled` (`is_enabled`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Withdrawal methods configuration (BTC, DASH, DOGE, LTC)';

-- Insert initial withdrawal methods data 

INSERT INTO `withdrawal_methods` (`code`, `name`, `network`, `icon_url`, `min_amount_coins`, `fee_coins`, `is_enabled`, `sort_order`)
VALUES
  ('BTC', 'Bitcoin', 'Bitcoin', 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/55/55-1764746592733-988pg9d2e6et979m.png', 50000.00000000, 0.00000000, 1, 1),
  ('DASH', 'Dash', 'Dash', 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/55/55-1764746625267-912rlodikktzbxpd.png', 30000.00000000, 0.00000000, 1, 2),
  ('DOGE', 'Doge', 'Dogecoin', 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/55/55-1764746536932-0m7gluw49gkeu2qk.png', 30000.00000000, 0.00000000, 1, 3),
  ('LTC', 'Litecoin', 'Litecoin', 'https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/55/55-1764746651716-324yqazgfvqjcpac.png', 30000.00000000, 0.00000000, 1, 4);
