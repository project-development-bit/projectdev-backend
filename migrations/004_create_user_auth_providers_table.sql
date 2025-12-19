-- Migration: Create user_auth_providers table for multi-provider authentication support

-- Step 1: Create the user_auth_providers table
CREATE TABLE IF NOT EXISTS `user_auth_providers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Reference to the users table',
  `provider` ENUM('email', 'google', 'apple', 'facebook') NOT NULL COMMENT 'Authentication provider',
  `provider_user_id` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Unique ID from the provider (e.g., Google sub, Apple ID). NULL for email auth',
  `provider_email` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Email from the provider (may differ from user.email)',
  `linked_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When this provider was linked to the account',
  `last_used_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Last time this provider was used to login',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_provider_userid` (`provider`, `provider_user_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_provider` (`provider`),
  KEY `idx_provider_email` (`provider_email`),
  CONSTRAINT `fk_auth_providers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Stores multiple authentication providers per user account';

-- Step 2: Remove unused fields from users table
ALTER TABLE `users`
DROP INDEX IF EXISTS `idx_provider_composite`,
DROP INDEX IF EXISTS `idx_login_provider`,
DROP INDEX IF EXISTS `idx_social_provider_id`,
DROP COLUMN IF EXISTS `login_provider`,
DROP COLUMN IF EXISTS `social_provider_id`;

-- Step 3: Migrate existing users to have an 'email' auth provider entry
INSERT INTO `user_auth_providers` (`user_id`, `provider`, `provider_user_id`, `provider_email`, `linked_at`)
SELECT
  id,
  'email',
  NULL,
  email,
  created_at
FROM `users`
WHERE `password` IS NOT NULL;
