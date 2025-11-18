-- Migration: Add is_active column to countries table

ALTER TABLE `countries`
ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Whether the country is active' AFTER `continent`;

-- Index for filtering active countries
CREATE INDEX `idx_is_active` ON `countries` (`is_active`);
