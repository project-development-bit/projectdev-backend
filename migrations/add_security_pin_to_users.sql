-- Add security_pin column to users table (hashed)
ALTER TABLE `users`
ADD COLUMN `security_pin` VARCHAR(255) DEFAULT NULL COMMENT '4-digit security PIN (hashed)'
AFTER `security_pin_enabled`;
