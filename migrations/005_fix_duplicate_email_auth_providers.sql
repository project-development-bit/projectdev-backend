-- Migration: Fix duplicate email auth providers and add unique constraint

-- Step 1: Remove duplicate email auth provider entries 
SET SQL_SAFE_UPDATES = 0;

DELETE t1 FROM `user_auth_providers` t1
INNER JOIN `user_auth_providers` t2
WHERE
  t1.`provider` = 'email'
  AND t2.`provider` = 'email'
  AND t1.`provider_email` = t2.`provider_email`
  AND t1.`id` > t2.`id`;

SET SQL_SAFE_UPDATES = 1;

-- Step 2: Add unique constraint on (provider, provider_email, provider_user_id)
ALTER TABLE `user_auth_providers`
ADD UNIQUE KEY `uniq_provider_email_userid` (`provider`, `provider_email`, `provider_user_id`);
