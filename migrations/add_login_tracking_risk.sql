-- Migration: Add Login Device & IP Tracking Fields to users table

-- Add new columns to users table
-- ============================================================================
ALTER TABLE users
ADD COLUMN last_login_ip VARCHAR(45) NULL COMMENT 'Last login IP address (IPv4 or IPv6)' AFTER last_login_at,
ADD COLUMN last_login_device_fp VARCHAR(255) NULL COMMENT 'Last login device fingerprint' AFTER last_login_ip;

ALTER TABLE users
ADD INDEX idx_last_login_ip (last_login_ip),
ADD INDEX idx_last_login_device_fp (last_login_device_fp);

-- Drop existing risk_events table if it exists
-- ============================================================================
DROP TABLE IF EXISTS risk_events;

-- Create risk_events table
-- ============================================================================
CREATE TABLE risk_events (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL COMMENT 'User associated with the risk event',
  type VARCHAR(50) NOT NULL COMMENT 'Type of risk event (e.g., SAME_DEVICE_MULTI_ACCOUNTS, MULTI_DEVICE_SAME_ACCOUNT, COUNTRY_CHANGED)',
  severity TINYINT NOT NULL COMMENT 'Risk severity: 1=low, 2=medium, 3=high',
  ip VARCHAR(45) NULL COMMENT 'IP address associated with the event',
  device_fp VARCHAR(255) NULL COMMENT 'Device fingerprint associated with the event',
  meta JSON NULL COMMENT 'Additional metadata about the event (flexible JSON storage)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When the risk event was detected',

  -- Foreign key constraint (user_id can be NULL for cross-user events)
  CONSTRAINT fk_risk_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,

  -- Indexes for performance
  INDEX idx_user_type (user_id, type),
  INDEX idx_device_type (device_fp, type),
  INDEX idx_severity (severity),
  INDEX idx_created_at (created_at),
  INDEX idx_type (type),
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Risk and fraud detection events';


-- Drop existing user_sessions table if it exists
-- ============================================================================
DROP TABLE IF EXISTS user_sessions;

-- Create user_sessions table
-- ============================================================================
CREATE TABLE user_sessions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL COMMENT 'User who logged in',
  ip VARCHAR(45) NOT NULL COMMENT 'IP address (IPv4 or IPv6)',
  device_fp VARCHAR(255) NOT NULL COMMENT 'Device fingerprint from client',
  user_agent VARCHAR(255) NULL COMMENT 'Browser user agent string',
  country CHAR(2) NULL COMMENT 'Country code (ISO 3166-1 alpha-2)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Login timestamp',

  -- Foreign key constraint
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  -- Indexes for performance
  INDEX idx_user_id (user_id),
  INDEX idx_device_fp (device_fp),
  INDEX idx_ip (ip),
  INDEX idx_user_device (user_id, device_fp),
  INDEX idx_device_user (device_fp, user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='User login session history for tracking and risk detection';
