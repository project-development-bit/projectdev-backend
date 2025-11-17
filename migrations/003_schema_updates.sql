-- Migration: Schema updates for countries, user_profiles, and users tables

-- Add flag field to countries table
ALTER TABLE countries
ADD COLUMN flag VARCHAR(255) NULL COMMENT 'Country flag image URL' AFTER name;

-- Add country_id column to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN country_id INT NULL COMMENT 'Foreign key reference to countries table' AFTER country;

-- Step 2: Add foreign key constraint for country_id
ALTER TABLE user_profiles
ADD CONSTRAINT fk_user_profiles_country_id
FOREIGN KEY (country_id) REFERENCES countries(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Drop the old foreign key constraint on country field
ALTER TABLE user_profiles
DROP FOREIGN KEY fk_profiles_country;

-- Drop the old country column
ALTER TABLE user_profiles
DROP COLUMN country;

-- Add index on country_id for better query performance
ALTER TABLE user_profiles
ADD INDEX idx_country_id (country_id);

-- Add new fields to users table
ALTER TABLE users
ADD COLUMN offer_token VARCHAR(255) NULL COMMENT 'Token for offer tracking' AFTER referral_code,
ADD COLUMN security_pin_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether security PIN is enabled' AFTER twofa_secret;

-- Add new fields to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN notifications_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Whether notifications are enabled' AFTER show_onboarding,
ADD COLUMN show_stats_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Whether to show user statistics' AFTER notifications_enabled,
ADD COLUMN anonymous_in_contests TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether to appear anonymous in contests' AFTER show_stats_enabled;

-- Add indexes for better query performance on users table
ALTER TABLE users
ADD INDEX idx_offer_token (offer_token),
ADD INDEX idx_security_pin_enabled (security_pin_enabled);

-- Add indexes for better query performance on user_profiles table
ALTER TABLE user_profiles
ADD INDEX idx_notifications_enabled (notifications_enabled),
ADD INDEX idx_show_stats_enabled (show_stats_enabled),
ADD INDEX idx_anonymous_in_contests (anonymous_in_contests);

