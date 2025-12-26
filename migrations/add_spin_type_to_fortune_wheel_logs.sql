-- Migration: Add spin_type column to fortune_wheel_logs

ALTER TABLE `fortune_wheel_logs`
ADD COLUMN `spin_type` ENUM('base', 'bonus') NOT NULL DEFAULT 'base'
COMMENT 'Type of spin used: base (daily) or bonus (from rewards)'
AFTER `wheel_index`;

-- Add index for counting base spins by date
ALTER TABLE `fortune_wheel_logs`
ADD KEY `idx_user_spin_type_created` (`user_id`, `spin_type`, `created_at`);

-- Update existing records to 'base'
UPDATE `fortune_wheel_logs`
SET `spin_type` = 'base'
WHERE `spin_type` IS NULL;
