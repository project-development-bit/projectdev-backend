-- Migration: Update countries flag field with FlagsAPI URLs

-- Update flag URLs for all countries using their country code
UPDATE `countries`
SET `flag` = CONCAT('https://flagcdn.com/w80/', LOWER(`code`), '.png')
WHERE `code` IS NOT NULL;
