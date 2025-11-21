-- Migration: Add test earnings data for a specific user

-- Set the user ID you want to add test data for
-- IMPORTANT: User must exist in users table (check with: SELECT id FROM users WHERE id = ?;)
SET @test_user_id = 47;  -- Change this to the user ID you want to test with

-- Insert test offers 
INSERT IGNORE INTO offers (provider, external_offer_id, title, category, base_payout_usd, status)
VALUES
  ('torox', 'test-app-001', 'Install Shopping App & Make First Purchase', 'app', 5.0000, 'active'),
  ('torox', 'test-app-002', 'Download Gaming App & Reach Level 10', 'app', 3.5000, 'active'),
  ('torox', 'test-app-003', 'Install Fitness App & Track 7 Days', 'app', 4.0000, 'active'),
  ('cpx', 'test-survey-001', '15-minute Consumer Behavior Survey', 'survey', 1.5000, 'active'),
  ('cpx', 'test-survey-002', '10-minute Product Feedback Survey', 'survey', 1.0000, 'active'),
  ('cpx', 'test-survey-003', '20-minute Market Research Survey', 'survey', 2.0000, 'active');

-- Insert test offer conversions for the specified user
INSERT INTO offer_conversions
  (provider, provider_event_id, user_id, offer_id, payout_usd, currency, credited_amount, status, credited_ledger_entry_id, created_at, updated_at)
VALUES
  -- Recent earnings (last 7 days)
  ('torox', CONCAT('test-evt-', @test_user_id, '-001'), @test_user_id, (SELECT id FROM offers WHERE external_offer_id = 'test-app-001' LIMIT 1),
   5.0000, 'COIN', 50000.00000000, 'credited', NULL,
   DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),

  ('cpx', CONCAT('test-evt-', @test_user_id, '-002'), @test_user_id, (SELECT id FROM offers WHERE external_offer_id = 'test-survey-001' LIMIT 1),
   1.5000, 'COIN', 15000.00000000, 'credited', NULL,
   DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),

  ('torox', CONCAT('test-evt-', @test_user_id, '-003'), @test_user_id, (SELECT id FROM offers WHERE external_offer_id = 'test-app-002' LIMIT 1),
   3.5000, 'COIN', 35000.00000000, 'credited', NULL,
   DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),

  -- Earnings from 2-3 weeks ago
  ('cpx', CONCAT('test-evt-', @test_user_id, '-004'), @test_user_id, (SELECT id FROM offers WHERE external_offer_id = 'test-survey-002' LIMIT 1),
   1.0000, 'COIN', 10000.00000000, 'credited', NULL,
   DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_SUB(NOW(), INTERVAL 15 DAY)),

  ('torox', CONCAT('test-evt-', @test_user_id, '-005'), @test_user_id, (SELECT id FROM offers WHERE external_offer_id = 'test-app-003' LIMIT 1),
   4.0000, 'COIN', 40000.00000000, 'credited', NULL,
   DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_SUB(NOW(), INTERVAL 18 DAY)),

  ('cpx', CONCAT('test-evt-', @test_user_id, '-006'), @test_user_id, (SELECT id FROM offers WHERE external_offer_id = 'test-survey-003' LIMIT 1),
   2.0000, 'COIN', 20000.00000000, 'credited', NULL,
   DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY)),

  -- Older earnings (25-28 days ago)
  ('cpx', CONCAT('test-evt-', @test_user_id, '-007'), @test_user_id, (SELECT id FROM offers WHERE external_offer_id = 'test-survey-001' LIMIT 1),
   1.5000, 'COIN', 15000.00000000, 'credited', NULL,
   DATE_SUB(NOW(), INTERVAL 25 DAY), DATE_SUB(NOW(), INTERVAL 25 DAY)),

  ('torox', CONCAT('test-evt-', @test_user_id, '-008'), @test_user_id, (SELECT id FROM offers WHERE external_offer_id = 'test-app-001' LIMIT 1),
   5.0000, 'COIN', 50000.00000000, 'credited', NULL,
   DATE_SUB(NOW(), INTERVAL 28 DAY), DATE_SUB(NOW(), INTERVAL 28 DAY));

-- Create or update balance for the user
INSERT INTO balances (user_id, currency, available, pending)
VALUES (@test_user_id, 'COIN', 235000.00000000, 0.00000000)
ON DUPLICATE KEY UPDATE available = available + 235000.00000000;
