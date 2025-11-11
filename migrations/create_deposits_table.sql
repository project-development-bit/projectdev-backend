-- Migration: Create deposits table
-- Description: Adds deposits table to track user deposit transactions

CREATE TABLE IF NOT EXISTS `deposits` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `currency` varchar(10) NOT NULL,
  `amount` decimal(20,8) NOT NULL,
  `txid` varchar(128) DEFAULT NULL COMMENT 'Blockchain transaction ID',
  `status` enum('pending','confirmed','failed') NOT NULL DEFAULT 'pending',
  `deposit_address` varchar(128) DEFAULT NULL COMMENT 'Address where funds were sent',
  `payment_provider` varchar(32) NOT NULL DEFAULT 'manual' COMMENT 'Payment provider (manual, nowpayments, etc)',
  `error_message` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_deposit_user_status` (`user_id`,`status`,`created_at`),
  KEY `idx_deposit_txid` (`txid`),
  KEY `fk_deposit_currency` (`currency`),
  CONSTRAINT `fk_deposit_currency` FOREIGN KEY (`currency`) REFERENCES `currencies` (`code`),
  CONSTRAINT `fk_deposit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='User deposit transactions';

-- Add index for better query performance
CREATE INDEX `idx_deposit_status_created` ON `deposits` (`status`, `created_at`);
