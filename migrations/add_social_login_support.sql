-- Migration: Add social login support to users table

-- Step 1: Make password nullable
ALTER TABLE `users`
MODIFY COLUMN `password` VARBINARY(255) NULL DEFAULT NULL;

-- Step 2: Add login_provider field to track authentication method
ALTER TABLE `users`
ADD COLUMN `login_provider` ENUM('email', 'google', 'apple', 'facebook') NOT NULL DEFAULT 'email'
  COMMENT 'Authentication provider used by the user' AFTER `referred_by`;

-- Step 3: Add social_provider_id to store the unique ID from social providers
ALTER TABLE `users`
ADD COLUMN `social_provider_id` VARCHAR(255) NULL DEFAULT NULL
  COMMENT 'Unique ID from social login provider (Firebase UID, Apple ID, etc.)' AFTER `login_provider`;

-- Step 4: Add indexes for performance
ALTER TABLE `users`
ADD INDEX `idx_login_provider` (`login_provider`),
ADD INDEX `idx_social_provider_id` (`social_provider_id`),
ADD UNIQUE INDEX `idx_provider_composite` (`login_provider`, `social_provider_id`);
