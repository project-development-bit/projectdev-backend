-- Migration: Create app_settings table to store application configurations

DROP TABLE IF EXISTS `app_settings`;

CREATE TABLE `app_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `config_key` varchar(64) NOT NULL COMMENT 'Unique key for the configuration (e.g., "app_config", "theme_settings")',
  `config_data` json NOT NULL COMMENT 'JSON data containing the configuration',
  `version` varchar(32) DEFAULT NULL COMMENT 'Configuration version (e.g., "2025.10.20")',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Application settings and configuration stored as JSON';

-- Insert default configuration
INSERT INTO `app_settings` (`config_key`, `config_data`, `version`)
VALUES (
  'app_config',
  JSON_OBJECT(
    'config_version', '2025.10.20',
    'theme', JSON_OBJECT(
      'primaryColor', '#FF0066',
      'accentColor', '#00BFFF'
    ),
    'texts', JSON_OBJECT(
      'home_title', 'Start earning rewards!',
      'cta_button', 'Join Now'
    ),
    'banners', JSON_ARRAY(
      JSON_OBJECT(
        'image', 'https://cdn.gigafaucet.com/banner1.png',
        'link', '/offer'
      )
    )
  ),
  '2025.10.20'
);
