-- Migration: Add transaction data to ledger_entries table

SET @test_user_id = 56;

INSERT INTO ledger_entries (user_id, currency, entry_type, amount, ref_type, ref_id, idempotency_key, created_at)
VALUES
  -- Offer earnings (credit transactions)
  (@test_user_id, 'COIN', 'credit', 50000.00000000, 'offer', 'offer_001', CONCAT('txn_offer_001_', @test_user_id), DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (@test_user_id, 'COIN', 'credit', 35000.00000000, 'offer', 'offer_002', CONCAT('txn_offer_002_', @test_user_id), DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (@test_user_id, 'COIN', 'credit', 15000.00000000, 'offer', 'offer_003', CONCAT('txn_offer_003_', @test_user_id), DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (@test_user_id, 'COIN', 'credit', 40000.00000000, 'offer', 'offer_004', CONCAT('txn_offer_004_', @test_user_id), DATE_SUB(NOW(), INTERVAL 5 DAY)),

  -- Referral earnings (credit transactions)
  (@test_user_id, 'COIN', 'credit', 10000.00000000, 'referral', 'ref_001', CONCAT('txn_ref_001_', @test_user_id), DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (@test_user_id, 'COIN', 'credit', 5000.00000000, 'referral', 'ref_002', CONCAT('txn_ref_002_', @test_user_id), DATE_SUB(NOW(), INTERVAL 7 DAY)),
  (@test_user_id, 'COIN', 'credit', 7500.00000000, 'referral', 'ref_003', CONCAT('txn_ref_003_', @test_user_id), DATE_SUB(NOW(), INTERVAL 10 DAY)),

  -- Faucet earnings (credit transactions)
  (@test_user_id, 'COIN', 'credit', 1000.00000000, 'faucet', 'faucet_001', CONCAT('txn_faucet_001_', @test_user_id), DATE_SUB(NOW(), INTERVAL 6 DAY)),
  (@test_user_id, 'COIN', 'credit', 1000.00000000, 'faucet', 'faucet_002', CONCAT('txn_faucet_002_', @test_user_id), DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (@test_user_id, 'COIN', 'credit', 1500.00000000, 'faucet', 'faucet_003', CONCAT('txn_faucet_003_', @test_user_id), DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (@test_user_id, 'COIN', 'credit', 2000.00000000, 'faucet', 'faucet_004', CONCAT('txn_faucet_004_', @test_user_id), DATE_SUB(NOW(), INTERVAL 14 DAY)),

  -- Withdrawal transactions (debit transactions)
  -- Note: These should correspond to actual withdrawal records if you want full data in the API response
  (@test_user_id, 'COIN', 'debit', 50000.00000000, 'withdrawal', '1', CONCAT('txn_withdrawal_001_', @test_user_id), DATE_SUB(NOW(), INTERVAL 9 DAY)),
  (@test_user_id, 'COIN', 'debit', 30000.00000000, 'withdrawal', '2', CONCAT('txn_withdrawal_002_', @test_user_id), DATE_SUB(NOW(), INTERVAL 15 DAY)),

  -- Additional older transactions for pagination testing
  (@test_user_id, 'COIN', 'credit', 25000.00000000, 'offer', 'offer_005', CONCAT('txn_offer_005_', @test_user_id), DATE_SUB(NOW(), INTERVAL 16 DAY)),
  (@test_user_id, 'COIN', 'credit', 12000.00000000, 'offer', 'offer_006', CONCAT('txn_offer_006_', @test_user_id), DATE_SUB(NOW(), INTERVAL 18 DAY)),
  (@test_user_id, 'COIN', 'credit', 8000.00000000, 'referral', 'ref_004', CONCAT('txn_ref_004_', @test_user_id), DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (@test_user_id, 'COIN', 'credit', 1000.00000000, 'faucet', 'faucet_005', CONCAT('txn_faucet_005_', @test_user_id), DATE_SUB(NOW(), INTERVAL 22 DAY)),
  (@test_user_id, 'COIN', 'credit', 45000.00000000, 'offer', 'offer_007', CONCAT('txn_offer_007_', @test_user_id), DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (@test_user_id, 'COIN', 'credit', 6000.00000000, 'referral', 'ref_005', CONCAT('txn_ref_005_', @test_user_id), DATE_SUB(NOW(), INTERVAL 28 DAY)),
  (@test_user_id, 'COIN', 'credit', 1000.00000000, 'faucet', 'faucet_006', CONCAT('txn_faucet_006_', @test_user_id), DATE_SUB(NOW(), INTERVAL 30 DAY));

-- Update the user's balance

INSERT INTO balances (user_id, currency, available, pending)
VALUES (@test_user_id, 'COIN', 185000.00000000, 0.00000000)
ON DUPLICATE KEY UPDATE available = available + 185000.00000000;

