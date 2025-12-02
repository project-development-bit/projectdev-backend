-- Create password_history table 

CREATE TABLE IF NOT EXISTS `password_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL COMMENT 'User who changed password',
  `password_hash` varbinary(255) NOT NULL COMMENT 'Historical password hash',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When the password was set',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_user_created` (`user_id`, `created_at`),
  CONSTRAINT `fk_password_history_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Stores password history to prevent password reuse';

-- Add index for efficient lookups
CREATE INDEX `idx_password_history_user_id` ON `password_history` (`user_id`, `created_at` DESC);
