-- Migration: Update countries flag field with FlagsAPI URLs

-- Update flag URLs for all countries using their country code
UPDATE `countries`
SET `flag` = CONCAT('https://flagsapi.com/', UPPER(`code`), '/flat/64.png')
WHERE `code` IS NOT NULL;
