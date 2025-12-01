-- Migration: Update foreign key references from users_old to users

-- Step 1: Drop existing foreign key constraints that reference users_old
ALTER TABLE `balances` DROP FOREIGN KEY `fk_bal_user`;
ALTER TABLE `deposits` DROP FOREIGN KEY `fk_deposit_user`;
ALTER TABLE `faucet_claims` DROP FOREIGN KEY `fk_faucet_user`;
ALTER TABLE `referrals` DROP FOREIGN KEY `fk_ref_referee`;
ALTER TABLE `referrals` DROP FOREIGN KEY `fk_ref_referrer`;
ALTER TABLE `user_addresses` DROP FOREIGN KEY `fk_addr_user`;
ALTER TABLE `user_promotions` DROP FOREIGN KEY `fk_up_user`;
ALTER TABLE `withdrawals` DROP FOREIGN KEY `fk_wd_user`;

-- Step 2: Add new foreign key constraints that reference users table
ALTER TABLE `balances`
  ADD CONSTRAINT `fk_bal_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `deposits`
  ADD CONSTRAINT `fk_deposit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `faucet_claims`
  ADD CONSTRAINT `fk_faucet_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `referrals`
  ADD CONSTRAINT `fk_ref_referee` FOREIGN KEY (`referee_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_ref_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `users` (`id`);

ALTER TABLE `user_addresses`
  ADD CONSTRAINT `fk_addr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `user_promotions`
  ADD CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `withdrawals`
  ADD CONSTRAINT `fk_wd_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

-- Step 3: Drop the users_old table
DROP TABLE IF EXISTS `users_old`;
