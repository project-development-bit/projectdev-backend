-- Migration: Add avatar_url column to user_profiles table

ALTER TABLE `user_profiles`
ADD COLUMN `avatar_url` VARCHAR(512) DEFAULT NULL COMMENT 'S3 URL for user avatar image' AFTER `name`;

-- Index for faster avatar (optional, but recommended)
CREATE INDEX `idx_avatar_url` ON `user_profiles` (`avatar_url`);
