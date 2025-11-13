-- Add exchange rate configurations to app_config table

INSERT INTO app_config (name, value, updated_at)
VALUES
  ('COINS_PER_USD', '10000', NOW()),
  ('BTC_USD_PRICE', '106975.23', NOW())
ON DUPLICATE KEY UPDATE
  value = VALUES(value),
  updated_at = NOW();
