-- Migration: Recreate offer_conversions and webhook_logs tables
-- Purpose: Update schema to match offerwall postback requirements

-- ============================================================================
-- Step 1: Drop existing offer_conversions table
-- ============================================================================

DROP TABLE IF EXISTS `offer_conversions`;

-- ============================================================================
-- Step 2: Create webhook_logs table for debugging
-- ============================================================================

CREATE TABLE `webhook_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `provider` VARCHAR(32) NOT NULL COMMENT 'Offerwall provider name (torox, adgate, cpx, etc)',
  `ip` VARCHAR(45) NOT NULL COMMENT 'IP address of webhook request (IPv4 or IPv6)',
  `headers_json` JSON NULL COMMENT 'Full HTTP headers dump',
  `payload_json` JSON NOT NULL COMMENT 'Full request payload',
  `processing_status` ENUM('ok', 'duplicate', 'invalid_signature', 'error') NOT NULL DEFAULT 'ok' COMMENT 'Processing result status',
  `error_message` VARCHAR(500) NULL COMMENT 'Error details if processing failed',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_provider` (`provider`),
  INDEX `idx_processing_status` (`processing_status`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_provider_status` (`provider`, `processing_status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Webhook request logs for all offerwall postback calls';

-- ============================================================================
-- Step 3: Create new offer_conversions table
-- ============================================================================

CREATE TABLE `offer_conversions` (
  -- Identity
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Internal user ID',
  `provider_id` VARCHAR(32) NOT NULL COMMENT 'Provider identifier (timewall, adgate, cpx, bitlabs, etc)',
  `provider_conversion_id` VARCHAR(128) NOT NULL COMMENT 'Unique transaction ID from provider',
  `external_user_id` VARCHAR(64) NULL COMMENT 'User identifier we passed to provider (offer_token)',

  -- Offer Details
  `reward_type` ENUM('survey', 'offer', 'ptc', 'playtime', 'other') NOT NULL DEFAULT 'other' COMMENT 'Type of reward completed',

  -- Financial
  `coins` DECIMAL(20,8) NOT NULL COMMENT 'Number of coins awarded',
  `usd_amount` DECIMAL(10,4) NULL COMMENT 'Raw USD amount from provider (if provided)',
  `xp_earned` INT NOT NULL DEFAULT 0 COMMENT 'XP earned (coins * xp_per_coin)',

  -- Status
  `status` ENUM('pending', 'credited', 'reversed', 'rejected') NOT NULL DEFAULT 'pending' COMMENT 'Conversion status',

  -- Network Info
  `ip` VARCHAR(45) NULL COMMENT 'User IP sent by provider',
  `webhook_ip` VARCHAR(45) NULL COMMENT 'Server IP that hit our webhook',
  `user_agent` VARCHAR(255) NULL COMMENT 'Request user agent',

  -- Metadata
  `raw_payload` JSON NULL COMMENT 'Full webhook payload snapshot',

  -- Timestamps
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When conversion was received',
  `credited_at` TIMESTAMP NULL COMMENT 'When coins were credited to user',
  `reversed_at` TIMESTAMP NULL COMMENT 'When conversion was reversed/charged back',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- Unique constraint for idempotency
  UNIQUE KEY `uniq_provider_conversion` (`provider_id`, `provider_conversion_id`),

  -- Indexes for queries
  INDEX `idx_user_status_created` (`user_id`, `status`, `created_at`),
  INDEX `idx_provider_status` (`provider_id`, `status`),
  INDEX `idx_status_created` (`status`, `created_at`),
  INDEX `idx_external_user_id` (`external_user_id`),

  -- Foreign Keys
  CONSTRAINT `fk_offer_conv_user`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Offerwall conversion tracking with idempotency support';

-- ============================================================================
-- Step 4: Verification queries (optional - for manual verification)
-- ============================================================================

-- Check table structures
-- SHOW CREATE TABLE webhook_logs;
-- SHOW CREATE TABLE offer_conversions;

-- Check indexes
-- SHOW INDEX FROM webhook_logs;
-- SHOW INDEX FROM offer_conversions;