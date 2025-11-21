-- Add xp column to users table
ALTER TABLE `users`
ADD COLUMN `xp` INT NOT NULL DEFAULT 0 COMMENT 'Total XP earned by user for rewards system'
AFTER `offer_token`;

-- Add index for potential queries on XP
ALTER TABLE `users`
ADD INDEX `idx_xp` (`xp`);