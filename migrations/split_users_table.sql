-- Migration: Split users table into users + user_profiles

-- Step 1: Create new users table (core authentication)
-- ============================================================================
CREATE TABLE users_new (
  -- Core Identity
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARBINARY(255) NOT NULL,

  -- Authentication & Security
  role ENUM('Dev','Admin','SuperUser','NormalUser') NOT NULL DEFAULT 'NormalUser',
  refresh_token VARCHAR(500),
  security_code VARCHAR(16),

  -- 2FA
  twofa_enabled TINYINT(1) NOT NULL DEFAULT 0,
  twofa_secret TEXT,

  -- Account Status
  is_banned TINYINT(1) NOT NULL DEFAULT 0,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,

  -- Referral System
  referral_code VARCHAR(16) UNIQUE,
  referred_by BIGINT UNSIGNED,

  -- Timestamps
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes for performance
  INDEX idx_email (email),
  INDEX idx_referral_code (referral_code),
  INDEX idx_security_code (security_code),
  INDEX idx_verified_banned (is_verified, is_banned),
  INDEX idx_referred_by (referred_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Step 2: Create user_profiles table (extended profile data)
-- ============================================================================
CREATE TABLE user_profiles (
  user_id BIGINT UNSIGNED PRIMARY KEY,

  -- Personal Info
  name VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  country CHAR(2),
  language CHAR(5),

  -- Feature Flags & Metrics
  interest_enable TINYINT(1) NOT NULL DEFAULT 0,
  risk_score INT NOT NULL DEFAULT 0,
  show_onboarding TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Whether to show onboarding flow (1 = show, 0 = hide)',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_country (country),
  INDEX idx_risk_score (risk_score),
  INDEX idx_show_onboarding (show_onboarding)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Step 3: Migrate data from old users table to new structure
-- ============================================================================
-- Migrate to users_new
INSERT INTO users_new (
  id, email, password, role, refresh_token, security_code,
  twofa_enabled, twofa_secret, is_banned, is_verified,
  referral_code, referred_by, last_login_at, created_at, updated_at
)
SELECT
  id, email, password, role, refresh_token, security_code,
  twofa_enabled, twofa_secret, is_banned, is_verified,
  referral_code, referred_by, last_login_at, created_at, updated_at
FROM users;

-- Migrate to user_profiles
INSERT INTO user_profiles (
  user_id, name, country, language, interest_enable, risk_score, show_onboarding, created_at, updated_at
)
SELECT
  id, name, country, language, interest_enable, risk_score, 0, created_at, updated_at
FROM users;
-- Note: show_onboarding set to 0 for existing users (they've already onboarded)

-- Step 4: Verify data integrity
-- ============================================================================
-- Check row counts match
SELECT
  (SELECT COUNT(*) FROM users) as old_count,
  (SELECT COUNT(*) FROM users_new) as new_users_count,
  (SELECT COUNT(*) FROM user_profiles) as profiles_count;

-- Check for missing profiles
SELECT u.id, u.email
FROM users_new u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE up.user_id IS NULL;

-- Step 5: Add foreign key constraints
-- ============================================================================
-- Drop existing constraints if they exist (to avoid duplicate errors)
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;

-- Drop old constraint from users table if it exists
SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND CONSTRAINT_NAME = 'fk_users_referred_by'
  AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @drop_fk = IF(@constraint_exists > 0,
  'ALTER TABLE users DROP FOREIGN KEY fk_users_referred_by',
  'SELECT "Constraint fk_users_referred_by does not exist on users table"'
);
PREPARE stmt FROM @drop_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add self-referencing FK for referred_by on users_new
ALTER TABLE users_new
ADD CONSTRAINT fk_users_referred_by
FOREIGN KEY (referred_by) REFERENCES users_new(id) ON DELETE SET NULL;

-- Add FK from user_profiles to users_new
ALTER TABLE user_profiles
ADD CONSTRAINT fk_profiles_user
FOREIGN KEY (user_id) REFERENCES users_new(id) ON DELETE CASCADE;

-- Add FK for country (only if countries table exists)
SET @countries_table_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'countries'
);

SET @add_country_fk = IF(@countries_table_exists > 0,
  'ALTER TABLE user_profiles ADD CONSTRAINT fk_profiles_country FOREIGN KEY (country) REFERENCES countries(code) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT "Skipping country FK - countries table does not exist"'
);
PREPARE stmt FROM @add_country_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;

-- Step 6: Rename tables to swap old and new
-- ============================================================================
RENAME TABLE users TO users_old;
RENAME TABLE users_new TO users;

-- Step 7: Create a VIEW for backward compatibility (READ operations)
-- ============================================================================
CREATE OR REPLACE VIEW users_full AS
SELECT
  u.id,
  up.name,
  u.email,
  u.password,
  u.refresh_token,
  u.role,
  up.country,
  up.language,
  u.referral_code,
  u.security_code,
  u.referred_by,
  u.is_banned,
  u.is_verified,
  up.risk_score,
  u.last_login_at,
  u.created_at,
  u.updated_at,
  u.twofa_enabled,
  u.twofa_secret,
  up.interest_enable,
  up.show_onboarding
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id;

-- Step 8: Verify the VIEW returns correct data
-- ============================================================================
SELECT COUNT(*) as view_count FROM users_full;

-- Test sample query
SELECT id, email, name, role, is_verified
FROM users_full
LIMIT 5;
