-- Add informal_login_email_sent field to user_sessions table

ALTER TABLE `user_sessions`
ADD COLUMN `informal_login_email_sent` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Informal login notification email was sent';

ALTER TABLE `user_sessions`
ADD INDEX `idx_email_sent` (`informal_login_email_sent`);
