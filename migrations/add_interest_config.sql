-- Add interest configuration to app_config table

INSERT INTO `app_config` (`name`, `value`)
VALUES
  ('INTEREST_RATE', '5'),
  ('MIN_BALANCE_FOR_INTEREST', '35000')
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  `updated_at` = CURRENT_TIMESTAMP;
