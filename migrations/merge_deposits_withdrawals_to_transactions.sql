-- Migration: Merge deposits and withdrawals tables into a transactions table

-- Create the new transactions table
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `transaction_type` enum('deposit','withdrawal') NOT NULL COMMENT 'Type of transaction',
  `currency` varchar(10) NOT NULL,
  `amount` decimal(20,8) NOT NULL,
  `fee` decimal(20,8) NOT NULL DEFAULT '0.00000000' COMMENT 'Transaction fee (mainly for withdrawals)',
  `address` varchar(128) DEFAULT NULL COMMENT 'Withdrawal address or deposit address',
  `txid` varchar(128) DEFAULT NULL COMMENT 'Blockchain transaction ID',
  `status` enum('pending','confirmed','failed') NOT NULL DEFAULT 'pending',
  `payment_provider` varchar(32) NOT NULL DEFAULT 'manual' COMMENT 'Payment provider (manual, etc)',
  `error_code` varchar(64) DEFAULT NULL COMMENT 'Error code if transaction failed',
  `error_message` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_at` timestamp NULL DEFAULT NULL COMMENT 'When deposit was confirmed or withdrawal was sent',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), 
  KEY `idx_tx_user_type_status` (`user_id`,`transaction_type`,`status`,`created_at`),
  KEY `idx_tx_txid` (`txid`),
  KEY `idx_tx_type_status` (`transaction_type`,`status`,`created_at`),
  KEY `fk_tx_currency` (`currency`),
  CONSTRAINT `fk_tx_currency` FOREIGN KEY (`currency`) REFERENCES `currencies` (`code`),
  CONSTRAINT `fk_tx_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Unified deposit and withdrawal transactions';


SET @user_id = 1;

-- Insert sample withdrawal transactions
INSERT INTO `transactions` (
  `user_id`,
  `transaction_type`,
  `currency`,
  `amount`,
  `fee`,
  `address`,
  `txid`,
  `status`,
  `payment_provider`,
  `created_at`,
  `confirmed_at`,
  `updated_at`
)
VALUES
  -- Sample confirmed withdrawal
  (
    @user_id,
    'withdrawal',
    'BTC',
    0.02000000,
    0.00050000,
    'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    '2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a',
    'confirmed',
    'manual',
    DATE_SUB(NOW(), INTERVAL 3 DAY),
    DATE_SUB(NOW(), INTERVAL 3 DAY),
    DATE_SUB(NOW(), INTERVAL 3 DAY)
  ),
  -- Sample pending withdrawal
  (
    @user_id,
    'withdrawal',
    'USDT',
    100.00000000,
    2.00000000,
    '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
    NULL,
    'pending',
    'manual',
    NOW(),
    NULL,
    DATE_SUB(NOW(), INTERVAL 3 DAY)
  );

-- Delete old deposits and withdrawals tables
DROP TABLE IF EXISTS `deposits`;

DROP TABLE IF EXISTS `withdrawals`;