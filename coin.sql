-- MySQL dump 10.13  Distrib 8.0.44, for macos15 (x86_64)
--
-- Host: localhost    Database: gigadb
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `app_config`
--

DROP TABLE IF EXISTS `app_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_config` (
  `name` varchar(64) NOT NULL,
  `value` varchar(255) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_config`
--

LOCK TABLES `app_config` WRITE;
/*!40000 ALTER TABLE `app_config` DISABLE KEYS */;
INSERT INTO `app_config` VALUES ('BTC_USD_PRICE','106975.23','2025-11-13 07:43:35'),('COINS_PER_USD','10000','2025-11-13 07:43:35');
/*!40000 ALTER TABLE `app_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `app_settings`
--

DROP TABLE IF EXISTS `app_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `config_key` varchar(64) NOT NULL COMMENT 'Unique key for the configuration (e.g., "app_config", "theme_settings")',
  `config_data` json NOT NULL COMMENT 'JSON data containing the configuration',
  `version` varchar(32) DEFAULT NULL COMMENT 'Configuration version (e.g., "2025.10.20")',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_config_key` (`config_key`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Application settings and configuration stored as JSON';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_settings`
--

LOCK TABLES `app_settings` WRITE;
/*!40000 ALTER TABLE `app_settings` DISABLE KEYS */;
INSERT INTO `app_settings` VALUES (1,'app_config','{\"fonts\": {\"body\": \"Inter\", \"heading\": \"Orbitron\"}, \"texts\": {\"cta_button\": \"Join\", \"home_title\": \"Start earning rewards!\"}, \"colors\": {\"dark\": {\"box\": {\"first\": \"rgba(0, 19, 30, 0.5)\", \"second\": \"rgba(255, 255, 255, 0.5)\"}, \"body\": \"#00131E\", \"border\": \"#333333\", \"button\": \"#333333\", \"status\": {\"info\": \"#00A0DC\", \"success\": \"#4AC97E\", \"warning\": \"#FFD166\", \"destructive\": \"#D0302F\", \"seriousWarning\": \"#E26F20\"}, \"heading\": {\"first\": \"#FFFFFF\", \"third\": \"#7E7E81\", \"second\": \"#ffcc00\"}, \"primary\": \"#ffcc00\", \"paragraph\": {\"first\": \"#FFFFFF\", \"third\": \"#ffcc00\", \"second\": \"#98989A\"}, \"secondary\": \"#00A0DC\"}, \"light\": {\"box\": {\"first\": \"rgba(0, 19, 30, 0.5)\", \"second\": \"rgba(255, 255, 255, 0.5)\"}, \"body\": \"#00131E\", \"border\": \"#333333\", \"button\": \"#333333\", \"status\": {\"info\": \"#00A0DC\", \"success\": \"#4AC97E\", \"warning\": \"#FFD166\", \"destructive\": \"#D0302F\", \"seriousWarning\": \"#E26F20\"}, \"heading\": {\"first\": \"#FFFFFF\", \"third\": \"#7E7E81\", \"second\": \"#ffcc00\"}, \"primary\": \"#ffcc00\", \"paragraph\": {\"first\": \"#FFFFFF\", \"third\": \"#ffcc00\", \"second\": \"#98989A\"}, \"secondary\": \"#00A0DC\"}}, \"banners\": [{\"link\": \"/offer\", \"image\": \"https://cdn.gigafaucet.com/banner1.png\"}], \"typography\": {\"h1\": {\"usage\": \"Page titles, key section headers\", \"fontSize\": \"40px\", \"fontWeight\": 700}, \"h2\": {\"usage\": \"Section titles or feature highlights\", \"fontSize\": \"32px\", \"fontWeight\": 700}, \"h3\": {\"usage\": \"Sub-sections, card titles\", \"fontSize\": \"20px\", \"fontWeight\": 700}, \"body\": {\"usage\": \"Body copy, descriptions, and details\", \"fontSize\": \"16px\", \"fontWeight\": \"500-700\"}}, \"colorScheme\": \"dark\", \"config_version\": \"2025.10.20\"}','2025.10.20','2025-11-04 13:05:20','2025-11-11 04:50:49');
/*!40000 ALTER TABLE `app_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `balances`
--

DROP TABLE IF EXISTS `balances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `balances` (
  `user_id` bigint unsigned NOT NULL,
  `currency` varchar(10) NOT NULL,
  `available` decimal(20,8) NOT NULL DEFAULT '0.00000000',
  `pending` decimal(20,8) NOT NULL DEFAULT '0.00000000',
  PRIMARY KEY (`user_id`,`currency`),
  KEY `fk_bal_currency` (`currency`),
  CONSTRAINT `fk_bal_currency` FOREIGN KEY (`currency`) REFERENCES `currencies` (`code`),
  CONSTRAINT `fk_bal_user` FOREIGN KEY (`user_id`) REFERENCES `users_old` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `balances`
--

LOCK TABLES `balances` WRITE;
/*!40000 ALTER TABLE `balances` DISABLE KEYS */;
INSERT INTO `balances` VALUES (1,'BTC',0.00000000,0.00000000),(1,'COIN',1500.00000000,0.00000000),(1,'DASH',0.00000000,0.00000000),(1,'DOGE',0.00000000,0.00000000),(1,'LTC',0.00000000,0.00000000),(1,'USDT',0.00000000,0.00000000),(2,'BTC',0.00000000,0.00000000),(2,'COIN',5000.00000000,10000.00000000),(2,'DASH',0.00000000,0.00000000),(2,'DOGE',0.00000000,0.00000000),(2,'LTC',0.00000000,0.00000000),(2,'USDT',0.00000000,0.00000000),(3,'BTC',0.00000000,0.00000000),(3,'COIN',50.00000000,0.00000000),(3,'DASH',0.00000000,0.00000000),(3,'DOGE',0.00000000,0.00000000),(3,'LTC',0.00000000,0.00000000),(3,'USDT',0.00000000,0.00000000),(36,'COIN',2190.00000000,0.00000000);
/*!40000 ALTER TABLE `balances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contact_us`
--

DROP TABLE IF EXISTS `contact_us`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_us` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL COMMENT 'Name of the person contacting',
  `email` varchar(255) NOT NULL COMMENT 'Contact email address',
  `phone` varchar(50) DEFAULT NULL COMMENT 'Optional phone number',
  `category` enum('General Inquiry','Technical Support','Billing & Payments','Feedback','Bug Report','Feature Request') NOT NULL DEFAULT 'General Inquiry' COMMENT 'Category of inquiry',
  `subject` varchar(500) NOT NULL COMMENT 'Subject of the message',
  `message` text NOT NULL COMMENT 'Detailed message content',
  `status` enum('New','In Progress','Resolved','Closed') NOT NULL DEFAULT 'New' COMMENT 'Status of the inquiry',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP address of submitter',
  `user_agent` text COMMENT 'Browser user agent',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Contact us submissions';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contact_us`
--

LOCK TABLES `contact_us` WRITE;
/*!40000 ALTER TABLE `contact_us` DISABLE KEYS */;
INSERT INTO `contact_us` VALUES (2,'Pyae Sone','pyaesone@example.com','+1234567890','General Inquiry','Login Issue','I am unable to log into my account. Please assist.','New','::1','PostmanRuntime/7.49.1','2025-11-06 06:08:55','2025-11-06 06:08:55'),(3,'User','user@example.com','+1234567890','General Inquiry','Login Issue','I am unable to log into my account. Please assist.','New','::1','PostmanRuntime/7.49.1','2025-11-06 06:15:50','2025-11-06 06:15:50'),(4,'User','user@example.com','+1234567890','General Inquiry','Login Issue','I am unable to log into my account. Please assist.','New','::1','PostmanRuntime/7.49.1','2025-11-06 06:20:09','2025-11-06 06:20:09'),(5,'User','user@example.com','+1234567890','General Inquiry','Login Issue','I am unable to log into my account. Please assist.','New','::1','PostmanRuntime/7.49.1','2025-11-06 06:22:42','2025-11-06 06:22:42'),(6,'User','mgpyaesone18@gmail.com','+1234567890','General Inquiry','Login Issue','I am unable to log into my account. Please assist.','New','::1','PostmanRuntime/7.49.1','2025-11-06 06:23:16','2025-11-06 06:23:16'),(7,'Ko Pyae','mgpyaesone18@gmail.com','+1234567890','General Inquiry','Login Issue','I am unable to log into my account. Please assist.','New','::1','PostmanRuntime/7.49.1','2025-11-06 06:31:34','2025-11-06 06:31:34'),(8,'Ko Pyae','mgpyaesone18@gmail.com','+1234567890','General Inquiry','Login Issue','I am unable to log into my account. Please assist.','New','::1','PostmanRuntime/7.49.1','2025-11-06 06:33:05','2025-11-06 06:33:05'),(9,'Ko Pyae','mgpyaesone18@gmail.com','+1234567890','General Inquiry','Login Issue','I am unable to log into my account. Please assist.','New','::1','PostmanRuntime/7.49.1','2025-11-06 06:34:26','2025-11-06 06:34:26'),(10,'Ko Pyae','mgpyaesone18@gmail.com','+1234567890','General Inquiry','Login Issue','I am unable to log into my account. Please assist.','New','::1','PostmanRuntime/7.49.1','2025-11-06 06:38:23','2025-11-06 06:38:23'),(11,'User','bellepanel@gmail.com','+1234567890','General Inquiry','Login Issue','I am unable to log into my account. Please assist.','New','::1','PostmanRuntime/7.50.0','2025-11-07 10:28:57','2025-11-07 10:28:57'),(12,'User','bellepanel@gmail.com','+1234567890','General Inquiry','Login Issue','I am unable to log into my account. Please assist.','New','::1','PostmanRuntime/7.50.0','2025-11-07 10:29:25','2025-11-07 10:29:25');
/*!40000 ALTER TABLE `contact_us` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `countries`
--

DROP TABLE IF EXISTS `countries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `countries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` char(2) NOT NULL,
  `name` varchar(100) NOT NULL,
  `flag` varchar(255) DEFAULT NULL COMMENT 'Country flag image URL',
  `continent` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Whether the country is active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `uq_countries_code` (`code`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `countries`
--

LOCK TABLES `countries` WRITE;
/*!40000 ALTER TABLE `countries` DISABLE KEYS */;
INSERT INTO `countries` VALUES (1,'US','United States',NULL,'North America',1,'2025-10-22 12:00:17','2025-10-22 12:00:17'),(2,'TH','Thailand',NULL,'Asia',1,'2025-10-22 12:00:17','2025-10-22 12:00:17'),(3,'MM','Myanmar',NULL,'Asia',1,'2025-10-22 12:00:17','2025-10-22 12:00:17');
/*!40000 ALTER TABLE `countries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `currencies`
--

DROP TABLE IF EXISTS `currencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `currencies` (
  `code` varchar(10) NOT NULL,
  `name` varchar(32) NOT NULL,
  `decimals` tinyint NOT NULL DEFAULT '8',
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `currencies`
--

LOCK TABLES `currencies` WRITE;
/*!40000 ALTER TABLE `currencies` DISABLE KEYS */;
INSERT INTO `currencies` VALUES ('BTC','Bitcoin',8,1),('COIN','Internal Coin',8,1),('DASH','Dash',8,1),('DOGE','Dogecoin',8,1),('LTC','Litecoin',8,1),('USDT','Tether USD',6,1);
/*!40000 ALTER TABLE `currencies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deposits`
--

DROP TABLE IF EXISTS `deposits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deposits` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `currency` varchar(10) NOT NULL,
  `amount` decimal(20,8) NOT NULL,
  `txid` varchar(128) DEFAULT NULL COMMENT 'Blockchain transaction ID',
  `confirmations` int NOT NULL DEFAULT '0' COMMENT 'Current number of confirmations',
  `required_confirmations` int NOT NULL DEFAULT '3' COMMENT 'Required confirmations to mark as confirmed',
  `status` enum('pending','confirmed','failed') NOT NULL DEFAULT 'pending',
  `deposit_address` varchar(128) DEFAULT NULL COMMENT 'Address where funds were sent',
  `payment_provider` varchar(32) NOT NULL DEFAULT 'manual' COMMENT 'Payment provider (manual, nowpayments, etc)',
  `error_message` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_deposit_user_status` (`user_id`,`status`,`created_at`),
  KEY `idx_deposit_txid` (`txid`),
  KEY `fk_deposit_currency` (`currency`),
  KEY `idx_deposit_status_created` (`status`,`created_at`),
  CONSTRAINT `fk_deposit_currency` FOREIGN KEY (`currency`) REFERENCES `currencies` (`code`),
  CONSTRAINT `fk_deposit_user` FOREIGN KEY (`user_id`) REFERENCES `users_old` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='User deposit transactions';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deposits`
--

LOCK TABLES `deposits` WRITE;
/*!40000 ALTER TABLE `deposits` DISABLE KEYS */;
INSERT INTO `deposits` VALUES (1,36,'COIN',200.00000000,'txid',0,0,'confirmed','manual','manual',NULL,'2025-11-11 07:33:58','2025-11-11 07:33:58','2025-11-11 07:33:58'),(2,36,'COIN',200.00000000,'txid',0,0,'confirmed','manual','manual',NULL,'2025-11-11 07:35:41','2025-11-11 07:35:42','2025-11-11 07:35:41'),(3,36,'COIN',200.00000000,'txid',0,0,'confirmed','manual','manual',NULL,'2025-11-11 07:49:23','2025-11-11 07:49:23','2025-11-11 07:49:23'),(4,36,'COIN',200.00000000,'txid',1,3,'confirmed',NULL,'manual',NULL,'2025-11-11 08:17:26','2025-11-11 01:20:11','2025-11-11 08:20:10'),(5,36,'COIN',2000.00000000,'txid',0,3,'confirmed',NULL,'manual',NULL,'2025-11-13 09:02:01','2025-11-13 02:03:08','2025-11-13 09:03:07');
/*!40000 ALTER TABLE `deposits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `faucet_claims`
--

DROP TABLE IF EXISTS `faucet_claims`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `faucet_claims` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `amount` decimal(20,8) NOT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `device_fingerprint` varchar(64) DEFAULT NULL,
  `claimed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_faucet_user_time` (`user_id`,`claimed_at`),
  CONSTRAINT `fk_faucet_user` FOREIGN KEY (`user_id`) REFERENCES `users_old` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `faucet_claims`
--

LOCK TABLES `faucet_claims` WRITE;
/*!40000 ALTER TABLE `faucet_claims` DISABLE KEYS */;
INSERT INTO `faucet_claims` VALUES (1,3,50.00000000,'203.0.113.5','dev-abc-123','2025-10-02 10:30:38');
/*!40000 ALTER TABLE `faucet_claims` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ledger_entries`
--

DROP TABLE IF EXISTS `ledger_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ledger_entries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `currency` varchar(10) NOT NULL,
  `entry_type` enum('credit','debit') NOT NULL,
  `amount` decimal(20,8) NOT NULL,
  `ref_type` varchar(32) NOT NULL,
  `ref_id` varchar(64) NOT NULL,
  `idempotency_key` varchar(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_ledger_idem` (`idempotency_key`),
  KEY `idx_ledger_user_cur_created` (`user_id`,`currency`,`created_at`),
  KEY `fk_ledger_currency` (`currency`),
  CONSTRAINT `fk_ledger_currency` FOREIGN KEY (`currency`) REFERENCES `currencies` (`code`),
  CONSTRAINT `fk_ledger_user` FOREIGN KEY (`user_id`) REFERENCES `users_old` (`id`),
  CONSTRAINT `ledger_entries_chk_1` CHECK ((`amount` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ledger_entries`
--

LOCK TABLES `ledger_entries` WRITE;
/*!40000 ALTER TABLE `ledger_entries` DISABLE KEYS */;
INSERT INTO `ledger_entries` VALUES (1,2,'COIN','credit',15000.00000000,'offer','1','conv-torox-1001','2025-10-02 10:30:38'),(2,1,'COIN','credit',1500.00000000,'referral','1','ref-2-1','2025-10-02 10:30:38'),(3,2,'COIN','debit',10000.00000000,'withdrawal','1','wd-1','2025-10-02 10:30:38'),(4,3,'COIN','credit',50.00000000,'faucet','1','faucet-1','2025-10-02 10:30:38'),(5,36,'COIN','credit',200.00000000,'deposit','1','deposit-1-36','2025-11-11 07:33:58'),(6,36,'COIN','credit',200.00000000,'deposit','2','deposit-2-36','2025-11-11 07:35:41'),(7,36,'COIN','credit',200.00000000,'deposit','3','deposit-3-36','2025-11-11 07:49:23'),(8,36,'COIN','credit',200.00000000,'deposit','4','deposit-4-36','2025-11-11 08:20:10'),(9,36,'COIN','debit',210.00000000,'withdrawal','2','wd-2-36','2025-11-11 09:05:57'),(10,36,'COIN','credit',2000.00000000,'deposit','5','deposit-5-36','2025-11-13 09:03:07');
/*!40000 ALTER TABLE `ledger_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `executed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `offer_conversions`
--

DROP TABLE IF EXISTS `offer_conversions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `offer_conversions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `provider` varchar(32) NOT NULL,
  `provider_event_id` varchar(128) NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `offer_id` bigint unsigned DEFAULT NULL,
  `payout_usd` decimal(10,4) NOT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'COIN',
  `credited_amount` decimal(20,8) DEFAULT NULL,
  `status` enum('pending','credited','reversed','rejected') NOT NULL DEFAULT 'pending',
  `credited_ledger_entry_id` bigint unsigned DEFAULT NULL,
  `raw_payload` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_provider_event` (`provider`,`provider_event_id`),
  KEY `idx_conv_user_status` (`user_id`,`status`,`created_at`),
  KEY `fk_conv_offer` (`offer_id`),
  KEY `fk_conv_currency` (`currency`),
  KEY `fk_conv_ledger` (`credited_ledger_entry_id`),
  CONSTRAINT `fk_conv_currency` FOREIGN KEY (`currency`) REFERENCES `currencies` (`code`),
  CONSTRAINT `fk_conv_ledger` FOREIGN KEY (`credited_ledger_entry_id`) REFERENCES `ledger_entries` (`id`),
  CONSTRAINT `fk_conv_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`),
  CONSTRAINT `fk_conv_user` FOREIGN KEY (`user_id`) REFERENCES `users_old` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `offer_conversions`
--

LOCK TABLES `offer_conversions` WRITE;
/*!40000 ALTER TABLE `offer_conversions` DISABLE KEYS */;
INSERT INTO `offer_conversions` VALUES (1,'torox','torox-evt-1001',2,1,2.0000,'COIN',15000.00000000,'credited',1,'{\"note\": \"Sample webhook payload from Torox\", \"click_id\": \"abc123\", \"offer_id\": \"app-xyz-001\", \"payout_usd\": 2.0}','2025-10-02 10:30:38','2025-10-02 10:30:38');
/*!40000 ALTER TABLE `offer_conversions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `offers`
--

DROP TABLE IF EXISTS `offers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `offers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `provider` varchar(32) NOT NULL,
  `external_offer_id` varchar(64) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `category` varchar(32) DEFAULT NULL,
  `base_payout_usd` decimal(10,4) DEFAULT NULL,
  `status` enum('active','paused','disabled') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_provider_offer` (`provider`,`external_offer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `offers`
--

LOCK TABLES `offers` WRITE;
/*!40000 ALTER TABLE `offers` DISABLE KEYS */;
INSERT INTO `offers` VALUES (1,'torox','app-xyz-001','Install XYZ App & Reach Level 5','app',2.5000,'active','2025-10-02 10:30:38'),(2,'cpx','survey-101','10-minute Consumer Survey','survey',0.8500,'active','2025-10-02 10:30:38');
/*!40000 ALTER TABLE `offers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `promotions`
--

DROP TABLE IF EXISTS `promotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `promotions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(32) NOT NULL,
  `multiplier` decimal(8,4) NOT NULL DEFAULT '1.0000',
  `start_at` timestamp NULL DEFAULT NULL,
  `end_at` timestamp NULL DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `promotions`
--

LOCK TABLES `promotions` WRITE;
/*!40000 ALTER TABLE `promotions` DISABLE KEYS */;
/*!40000 ALTER TABLE `promotions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `referrals`
--

DROP TABLE IF EXISTS `referrals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `referrals` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `referrer_id` bigint unsigned NOT NULL,
  `referee_id` bigint unsigned NOT NULL,
  `revenue_share_pct` decimal(5,2) NOT NULL DEFAULT '10.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `referee_id` (`referee_id`),
  KEY `fk_ref_referrer` (`referrer_id`),
  CONSTRAINT `fk_ref_referee` FOREIGN KEY (`referee_id`) REFERENCES `users_old` (`id`),
  CONSTRAINT `fk_ref_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `users_old` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `referrals`
--

LOCK TABLES `referrals` WRITE;
/*!40000 ALTER TABLE `referrals` DISABLE KEYS */;
INSERT INTO `referrals` VALUES (1,1,2,10.00,'2025-10-02 10:30:38'),(2,36,42,10.00,'2025-11-10 05:00:09'),(3,36,43,10.00,'2025-11-10 05:00:35');
/*!40000 ALTER TABLE `referrals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `risk_events`
--

DROP TABLE IF EXISTS `risk_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `risk_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `rule` varchar(64) NOT NULL,
  `score_delta` int NOT NULL DEFAULT '0',
  `evidence` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_risk_user` (`user_id`),
  CONSTRAINT `fk_risk_user` FOREIGN KEY (`user_id`) REFERENCES `users_old` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `risk_events`
--

LOCK TABLES `risk_events` WRITE;
/*!40000 ALTER TABLE `risk_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `risk_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_addresses`
--

DROP TABLE IF EXISTS `user_addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_addresses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `currency` varchar(10) NOT NULL,
  `label` varchar(64) DEFAULT NULL,
  `address` varchar(128) NOT NULL,
  `is_whitelisted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_currency_address` (`user_id`,`currency`,`address`),
  KEY `fk_addr_currency` (`currency`),
  CONSTRAINT `fk_addr_currency` FOREIGN KEY (`currency`) REFERENCES `currencies` (`code`),
  CONSTRAINT `fk_addr_user` FOREIGN KEY (`user_id`) REFERENCES `users_old` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_addresses`
--

LOCK TABLES `user_addresses` WRITE;
/*!40000 ALTER TABLE `user_addresses` DISABLE KEYS */;
INSERT INTO `user_addresses` VALUES (1,2,'DOGE','Bob DOGE','D7w9ExampleDogecoinAddress123',1,'2025-10-02 10:30:38');
/*!40000 ALTER TABLE `user_addresses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_profiles`
--

DROP TABLE IF EXISTS `user_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_profiles` (
  `user_id` bigint unsigned NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `avatar_url` varchar(512) DEFAULT NULL COMMENT 'S3 URL for user avatar image',
  `country_id` int DEFAULT NULL COMMENT 'Foreign key reference to countries table',
  `language` char(5) DEFAULT NULL,
  `interest_enable` tinyint(1) NOT NULL DEFAULT '0',
  `risk_score` int NOT NULL DEFAULT '0',
  `show_onboarding` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Whether to show onboarding flow (1 = show, 0 = hide)',
  `notifications_enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Whether notifications are enabled',
  `show_stats_enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Whether to show user statistics',
  `anonymous_in_contests` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether to appear anonymous in contests',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  KEY `idx_risk_score` (`risk_score`),
  KEY `idx_show_onboarding` (`show_onboarding`),
  KEY `idx_avatar_url` (`avatar_url`),
  KEY `idx_country_id` (`country_id`),
  KEY `idx_notifications_enabled` (`notifications_enabled`),
  KEY `idx_show_stats_enabled` (`show_stats_enabled`),
  KEY `idx_anonymous_in_contests` (`anonymous_in_contests`),
  CONSTRAINT `fk_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_profiles_country_id` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_profiles`
--

LOCK TABLES `user_profiles` WRITE;
/*!40000 ALTER TABLE `user_profiles` DISABLE KEYS */;
INSERT INTO `user_profiles` VALUES (1,'User 1',NULL,NULL,'en',0,0,0,1,1,0,'2025-10-02 10:30:38','2025-10-24 08:14:00'),(2,'User 2',NULL,NULL,'en',0,0,0,1,1,0,'2025-10-02 10:30:38','2025-10-24 08:14:00'),(3,'User 3',NULL,NULL,'en',0,0,0,1,1,0,'2025-10-02 10:30:38','2025-10-24 08:14:00'),(4,'User 4',NULL,NULL,NULL,0,0,0,1,1,0,'2025-10-06 16:02:13','2025-10-24 08:14:00'),(6,'User 5',NULL,NULL,NULL,0,0,0,1,1,0,'2025-10-06 16:07:44','2025-10-24 08:14:00'),(8,'User 6',NULL,NULL,NULL,0,0,0,1,1,0,'2025-10-06 16:09:07','2025-10-24 08:14:00'),(9,'User 7',NULL,NULL,NULL,0,0,0,1,1,0,'2025-10-13 06:49:14','2025-10-24 08:14:00'),(11,'User 8',NULL,NULL,NULL,0,0,0,1,1,0,'2025-10-13 06:49:51','2025-10-24 08:14:00'),(13,'User 9',NULL,NULL,NULL,0,0,0,1,1,0,'2025-10-13 06:55:15','2025-10-24 08:14:00'),(15,'User 10',NULL,NULL,NULL,0,0,0,1,1,0,'2025-10-15 11:43:15','2025-10-24 08:14:00'),(28,'John Doe',NULL,NULL,NULL,0,0,0,1,1,0,'2025-10-17 07:28:00','2025-10-24 08:14:00'),(29,'User',NULL,NULL,NULL,0,0,0,1,1,0,'2025-10-28 07:24:49','2025-10-28 07:24:49'),(34,'User!',NULL,NULL,NULL,0,0,0,1,1,0,'2025-10-28 11:07:40','2025-11-06 08:24:39'),(35,'User',NULL,NULL,NULL,0,0,0,1,1,0,'2025-10-29 09:53:35','2025-11-07 07:25:20'),(36,'User','https://gigafaucet-images-s3.s3.ap-southeast-2.amazonaws.com/avatars/36/36-1763367042734-mt9zrqjre60679tf.png',1,'en',1,0,1,1,1,1,'2025-11-07 07:26:21','2025-11-18 09:17:39'),(37,'User 103',NULL,NULL,NULL,0,0,0,1,1,0,'2025-11-07 10:03:49','2025-11-07 10:04:52'),(42,'user111',NULL,NULL,NULL,0,0,0,1,1,0,'2025-11-10 05:00:09','2025-11-10 05:00:09'),(43,'uzer112',NULL,NULL,NULL,0,0,0,1,1,0,'2025-11-10 05:00:35','2025-11-10 05:00:35'),(44,'User 102',NULL,NULL,NULL,0,0,0,1,1,0,'2025-11-11 10:11:52','2025-11-11 10:11:52'),(46,'User 102',NULL,NULL,NULL,0,0,0,1,1,0,'2025-11-11 10:13:55','2025-11-11 10:14:55'),(47,'Admin',NULL,NULL,NULL,0,0,1,1,1,0,'2025-11-12 06:23:04','2025-11-12 06:23:04');
/*!40000 ALTER TABLE `user_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_promotions`
--

DROP TABLE IF EXISTS `user_promotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_promotions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `promotion_id` bigint unsigned NOT NULL,
  `awarded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_promo` (`user_id`,`promotion_id`),
  KEY `fk_up_promo` (`promotion_id`),
  CONSTRAINT `fk_up_promo` FOREIGN KEY (`promotion_id`) REFERENCES `promotions` (`id`),
  CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users_old` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_promotions`
--

LOCK TABLES `user_promotions` WRITE;
/*!40000 ALTER TABLE `user_promotions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_promotions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `token_hash` binary(32) NOT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `device_info` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_token` (`user_id`,`token_hash`),
  CONSTRAINT `fk_sess_user` FOREIGN KEY (`user_id`) REFERENCES `users_old` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_sessions`
--

LOCK TABLES `user_sessions` WRITE;
/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varbinary(255) NOT NULL,
  `role` enum('Dev','Admin','SuperUser','NormalUser') NOT NULL DEFAULT 'NormalUser',
  `refresh_token` varchar(500) DEFAULT NULL,
  `security_code` varchar(16) DEFAULT NULL,
  `twofa_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `twofa_secret` text,
  `security_pin_enabled` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether security PIN is enabled',
  `is_banned` tinyint(1) NOT NULL DEFAULT '0',
  `is_verified` tinyint(1) NOT NULL DEFAULT '0',
  `referral_code` varchar(16) DEFAULT NULL,
  `offer_token` varchar(255) DEFAULT NULL COMMENT 'Token for offer tracking',
  `referred_by` bigint unsigned DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `referral_code` (`referral_code`),
  KEY `idx_email` (`email`),
  KEY `idx_referral_code` (`referral_code`),
  KEY `idx_security_code` (`security_code`),
  KEY `idx_verified_banned` (`is_verified`,`is_banned`),
  KEY `idx_referred_by` (`referred_by`),
  KEY `idx_offer_token` (`offer_token`),
  KEY `idx_security_pin_enabled` (`security_pin_enabled`),
  CONSTRAINT `fk_users_referred_by` FOREIGN KEY (`referred_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'alice@example.com',_binary '=^š\Èe\Ð\à\ìšVú‡9w+\0irWv\ëMþ%Áê±‘Ÿ','Admin',NULL,NULL,0,NULL,0,0,0,'ALICE1',NULL,NULL,NULL,'2025-10-02 10:30:38','2025-10-24 08:14:00'),(2,'bob@example.com',_binary 'ün\\\ë\0a·Ÿ-8aœÇ²ôñ\Ên\r)¾[,§÷\ÙÁ—','Admin',NULL,NULL,0,NULL,0,0,0,'BOB01',NULL,1,NULL,'2025-10-02 10:30:38','2025-10-24 08:14:00'),(3,'carol@example.com',_binary 'H$<\ï\"¸l\Ê\n,­û|«§ª(¹F•+\'1J-EŒwÁ(\âs','Admin',NULL,NULL,0,NULL,0,0,0,'CAROL1',NULL,NULL,NULL,'2025-10-02 10:30:38','2025-10-24 08:14:00'),(4,'user4@gmail.com',_binary '$2b$08$baKz51vQVdkGGGwPxG.hI.Uw2hsY1ifbyzdjc0vHoIFqKoXYb4lYG','NormalUser',NULL,NULL,0,NULL,0,0,0,NULL,NULL,NULL,NULL,'2025-10-06 16:02:13','2025-10-24 08:14:00'),(6,'user5@gmail.com',_binary '$2b$08$3y6Gr5.h75tOtf.fSHPgKu8fEHc0wBDhqS39Ma4JwpVKe9.ss1fhO','SuperUser',NULL,NULL,0,NULL,0,0,0,NULL,NULL,NULL,NULL,'2025-10-06 16:07:44','2025-10-24 08:14:00'),(8,'user6@gmail.com',_binary '$2b$08$XNx4APD9/bNWArBEFDvgDeuhLisXKDFTb0TkZwzLw8ccxbryYufCy','NormalUser',NULL,NULL,0,NULL,0,0,0,NULL,NULL,NULL,NULL,'2025-10-06 16:09:07','2025-10-24 08:14:00'),(9,'user7@gmail.com',_binary '$2b$08$ED.4/sxuYFXmUxYOjzBqdu1CEoQC48r7nbf0blufb3BTD3REOVJQm','NormalUser',NULL,NULL,0,NULL,0,0,0,NULL,NULL,NULL,NULL,'2025-10-13 06:49:14','2025-10-24 08:14:00'),(11,'user8@gmail.com',_binary '$2b$08$gA5nQG5Sbw2dr6tpcIsuA.WJ6EYB/mb6AhxiZlSJe6.qC5hb9bfbK','NormalUser',NULL,NULL,0,NULL,0,0,0,NULL,NULL,NULL,NULL,'2025-10-13 06:49:51','2025-10-24 08:14:00'),(13,'user9@gmail.com',_binary '$2b$08$fXe3r8rHjhGv74jc8iqgcO6pqfIbZxPhZTg6Sdy0VEYtJV1oyJt7.','NormalUser',NULL,NULL,0,NULL,0,0,0,NULL,NULL,NULL,NULL,'2025-10-13 06:55:15','2025-10-24 08:14:00'),(15,'user10@gmail.com',_binary '$2b$08$cCDVcaEvgcMG82AArZkziOzxLEN6S2hd7rsujOh5XXDt.kciFOf2e','NormalUser','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTUsImVtYWlsIjoidXNlcjEwQGdtYWlsLmNvbSIsImlhdCI6MTc2MDYxNTc2NSwiZXhwIjoxNzYxMjIwNTY1fQ.vrV1YNblvZ1ZkbNJpaq0rrzkzXqa3sbe_5StDmWwtPE','1211',0,NULL,0,0,1,NULL,NULL,NULL,NULL,'2025-10-15 11:43:15','2025-10-24 08:14:00'),(28,'laminowner369@gmail.com',_binary '$2b$08$xwbw40M1UmmcJ8jkUeDs5.9xDxXqtHJFHgNfagGTbW2PZrNLoO4ju','NormalUser','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjgsImVtYWlsIjoibGFtaW5vd25lcjM2OUBnbWFpbC5jb20iLCJpYXQiOjE3NjExMjUwMzcsImV4cCI6MTc2MTcyOTgzN30.xPF0oEYEN8Wv9GiF-VtxVerSjGo2_TAmlZfL7h5plzw',NULL,0,NULL,0,0,1,NULL,NULL,NULL,NULL,'2025-10-17 07:28:00','2025-10-24 08:14:00'),(29,'user@gmail.com',_binary '$2b$08$4ieFjY7FvKLBrqYaCDGLsuPCj2t22z3rnTG7VzW2YlxZ5rrVO0E1G','Admin',NULL,'8307',0,NULL,0,0,0,NULL,NULL,NULL,NULL,'2025-10-28 07:24:49','2025-11-12 07:52:25'),(34,'user101@gmail.com',_binary '$2b$08$TUWApaG9BG294IFfdkjehuDp1NDUw0S5wiVg64hxiGEiZDCi9HHOS','Admin','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzQsImVtYWlsIjoidXNlcjEwMUBnbWFpbC5jb20iLCJpYXQiOjE3NjI0MTc0NzksImV4cCI6MTc2MzAyMjI3OX0.EdoiQQ0mNCEt0fEcRcCJ4I5xwiF7qrApL6Jqbc549C0','6730',1,'PEZXCPCUKFJDOPDRHBDA',0,0,1,NULL,NULL,NULL,NULL,'2025-10-28 11:07:40','2025-11-06 08:24:39'),(35,'user1@gmail.com',_binary '$2b$08$QLSaEG/gdQeZcwX0TVbmk.S8ehfW8a.m0SxlCv45q5D5Mr1GfinAu','Admin','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzUsImVtYWlsIjoidXNlcjFAZ21haWwuY29tIiwiaWF0IjoxNzYyNTAwMzIwLCJleHAiOjE3NjMxMDUxMjB9.bSXNU8bANydt0tVWqfhAg-9quJ_X_56_VyydCC3J-GU','5980',0,NULL,0,0,1,NULL,NULL,NULL,NULL,'2025-10-29 09:53:35','2025-11-07 07:25:20'),(36,'user102@gmail.com',_binary '$2b$08$PHqqEMRdD2cV2Ds73dE9mOms5tHL6xC3zYCbNNxBZtkOm6z5z/nbu','Admin','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzYsImVtYWlsIjoidXNlcjEwMkBnbWFpbC5jb20iLCJpYXQiOjE3NjM0NTcyMzEsImV4cCI6MTc2NDA2MjAzMX0.XoTrwdRCPax_D7dWvn9QDIZlz65q761MX8C-pJ4l6aA','6843',0,NULL,1,0,1,'2S2SBDOT',NULL,NULL,NULL,'2025-11-07 07:26:21','2025-11-18 09:17:39'),(37,'bellepanel@gmail.com',_binary '$2b$08$HlhloAsKQBIApscWAs/HeuE48gO4eFAyrtzz3nCndLUsKJvkKYLLW','Admin',NULL,'4629',0,NULL,0,0,0,'ZEYPLZ99',NULL,NULL,NULL,'2025-11-07 10:03:49','2025-11-07 10:04:52'),(42,'user111@gmail.com',_binary '$2b$08$mYM5gytIX64OClNITdt6jONck9bTQS6e1DPeJgdPmoTyYr6MpDiq2','NormalUser',NULL,'7886',0,NULL,0,0,0,'3XCELJ0C',NULL,36,NULL,'2025-11-10 05:00:09','2025-11-10 05:00:09'),(43,'uzer112@gmail.com',_binary '$2b$08$A/gFbZ9BsqunBK0.fPP2MeLQsXErFOlpDcdQYdBH97Ss1SghXFH/y','NormalUser',NULL,'4739',0,NULL,0,0,0,'FQ54YU6B',NULL,36,NULL,'2025-11-10 05:00:35','2025-11-10 05:00:35'),(44,'user103@gmail.com',_binary '$2b$08$SJkHq7bcVRfw.u2r.7MaM.dc7W6z7ri3mQfOG5OB5CuElltC6WMFm','Admin',NULL,'8844',0,NULL,0,0,0,'HB06CATZ',NULL,NULL,NULL,'2025-11-11 10:11:52','2025-11-11 10:11:52'),(46,'mgpyaesone18@gmail.com',_binary '$2b$08$MJZmSCoZuV/ZXqk/ebIjx.qWKYl22JPs7ZCclY4G265pLq5CuV0nK','Admin','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NDYsImVtYWlsIjoibWdweWFlc29uZTE4QGdtYWlsLmNvbSIsImlhdCI6MTc2Mjg1NjA5NSwiZXhwIjoxNzYzNDYwODk1fQ.kJ9fGb7acc83nmUPRwEBxyC9R5AIOyKnZE93Cg5EXYU','2077',0,NULL,0,0,1,'OKB3G00N',NULL,NULL,NULL,'2025-11-11 10:13:55','2025-11-12 08:10:55');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users_old`
--

DROP TABLE IF EXISTS `users_old`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_old` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `email` varchar(255) NOT NULL,
  `password` varbinary(255) NOT NULL,
  `refresh_token` varchar(500) DEFAULT NULL,
  `role` enum('Dev','Admin','SuperUser','NormalUser') NOT NULL DEFAULT 'NormalUser',
  `country` char(2) DEFAULT NULL,
  `language` char(5) DEFAULT NULL,
  `referral_code` varchar(16) DEFAULT NULL,
  `security_code` varchar(16) DEFAULT NULL,
  `referred_by` bigint unsigned DEFAULT NULL,
  `is_banned` tinyint(1) NOT NULL DEFAULT '0',
  `is_verified` tinyint(1) NOT NULL DEFAULT '0',
  `risk_score` int NOT NULL DEFAULT '0',
  `last_login_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `twofa_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `twofa_secret` text,
  `interest_enable` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `referral_code` (`referral_code`),
  KEY `fk_users_referred_by` (`referred_by`),
  KEY `fk_users_country` (`country`),
  CONSTRAINT `fk_users_country` FOREIGN KEY (`country`) REFERENCES `countries` (`code`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users_old`
--

LOCK TABLES `users_old` WRITE;
/*!40000 ALTER TABLE `users_old` DISABLE KEYS */;
INSERT INTO `users_old` VALUES (1,'User 1','alice@example.com',_binary '=^š\Èe\Ð\à\ìšVú‡9w+\0irWv\ëMþ%Áê±‘Ÿ',NULL,'Admin',NULL,'en','ALICE1',NULL,NULL,0,0,0,NULL,'2025-10-02 10:30:38','2025-10-24 08:14:00',0,NULL,0),(2,'User 2','bob@example.com',_binary 'ün\\\ë\0a·Ÿ-8aœÇ²ôñ\Ên\r)¾[,§÷\ÙÁ—',NULL,'Admin',NULL,'en','BOB01',NULL,1,0,0,0,NULL,'2025-10-02 10:30:38','2025-10-24 08:14:00',0,NULL,0),(3,'User 3','carol@example.com',_binary 'H$<\ï\"¸l\Ê\n,­û|«§ª(¹F•+\'1J-EŒwÁ(\âs',NULL,'Admin',NULL,'en','CAROL1',NULL,NULL,0,0,0,NULL,'2025-10-02 10:30:38','2025-10-24 08:14:00',0,NULL,0),(4,'User 4','user4@gmail.com',_binary '$2b$08$baKz51vQVdkGGGwPxG.hI.Uw2hsY1ifbyzdjc0vHoIFqKoXYb4lYG',NULL,'NormalUser',NULL,NULL,NULL,NULL,NULL,0,0,0,NULL,'2025-10-06 16:02:13','2025-10-24 08:14:00',0,NULL,0),(6,'User 5','user5@gmail.com',_binary '$2b$08$3y6Gr5.h75tOtf.fSHPgKu8fEHc0wBDhqS39Ma4JwpVKe9.ss1fhO',NULL,'SuperUser',NULL,NULL,NULL,NULL,NULL,0,0,0,NULL,'2025-10-06 16:07:44','2025-10-24 08:14:00',0,NULL,0),(8,'User 6','user6@gmail.com',_binary '$2b$08$XNx4APD9/bNWArBEFDvgDeuhLisXKDFTb0TkZwzLw8ccxbryYufCy',NULL,'NormalUser',NULL,NULL,NULL,NULL,NULL,0,0,0,NULL,'2025-10-06 16:09:07','2025-10-24 08:14:00',0,NULL,0),(9,'User 7','user7@gmail.com',_binary '$2b$08$ED.4/sxuYFXmUxYOjzBqdu1CEoQC48r7nbf0blufb3BTD3REOVJQm',NULL,'NormalUser',NULL,NULL,NULL,NULL,NULL,0,0,0,NULL,'2025-10-13 06:49:14','2025-10-24 08:14:00',0,NULL,0),(11,'User 8','user8@gmail.com',_binary '$2b$08$gA5nQG5Sbw2dr6tpcIsuA.WJ6EYB/mb6AhxiZlSJe6.qC5hb9bfbK',NULL,'NormalUser',NULL,NULL,NULL,NULL,NULL,0,0,0,NULL,'2025-10-13 06:49:51','2025-10-24 08:14:00',0,NULL,0),(13,'User 9','user9@gmail.com',_binary '$2b$08$fXe3r8rHjhGv74jc8iqgcO6pqfIbZxPhZTg6Sdy0VEYtJV1oyJt7.',NULL,'NormalUser',NULL,NULL,NULL,NULL,NULL,0,0,0,NULL,'2025-10-13 06:55:15','2025-10-24 08:14:00',0,NULL,0),(15,'User 10','user10@gmail.com',_binary '$2b$08$cCDVcaEvgcMG82AArZkziOzxLEN6S2hd7rsujOh5XXDt.kciFOf2e','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTUsImVtYWlsIjoidXNlcjEwQGdtYWlsLmNvbSIsImlhdCI6MTc2MDYxNTc2NSwiZXhwIjoxNzYxMjIwNTY1fQ.vrV1YNblvZ1ZkbNJpaq0rrzkzXqa3sbe_5StDmWwtPE','NormalUser',NULL,NULL,NULL,'1211',NULL,0,1,0,NULL,'2025-10-15 11:43:15','2025-10-24 08:14:00',0,NULL,0),(28,'John Doe','laminowner369@gmail.com',_binary '$2b$08$xwbw40M1UmmcJ8jkUeDs5.9xDxXqtHJFHgNfagGTbW2PZrNLoO4ju','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjgsImVtYWlsIjoibGFtaW5vd25lcjM2OUBnbWFpbC5jb20iLCJpYXQiOjE3NjExMjUwMzcsImV4cCI6MTc2MTcyOTgzN30.xPF0oEYEN8Wv9GiF-VtxVerSjGo2_TAmlZfL7h5plzw','NormalUser',NULL,NULL,NULL,NULL,NULL,0,1,0,NULL,'2025-10-17 07:28:00','2025-10-24 08:14:00',0,NULL,0),(29,'User','user@gmail.com',_binary '$2b$08$4ieFjY7FvKLBrqYaCDGLsuPCj2t22z3rnTG7VzW2YlxZ5rrVO0E1G',NULL,'Admin',NULL,NULL,NULL,'8969',NULL,0,0,0,NULL,'2025-10-28 07:24:49','2025-10-28 07:24:49',0,NULL,0),(34,'User!','user101@gmail.com',_binary '$2b$08$TUWApaG9BG294IFfdkjehuDp1NDUw0S5wiVg64hxiGEiZDCi9HHOS','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzQsImVtYWlsIjoidXNlcjEwMUBnbWFpbC5jb20iLCJpYXQiOjE3NjI0MTc0NzksImV4cCI6MTc2MzAyMjI3OX0.EdoiQQ0mNCEt0fEcRcCJ4I5xwiF7qrApL6Jqbc549C0','Admin',NULL,NULL,NULL,'6730',NULL,0,1,0,NULL,'2025-10-28 11:07:40','2025-11-06 08:24:39',1,'PEZXCPCUKFJDOPDRHBDA',0),(35,'User','user1@gmail.com',_binary '$2b$08$QLSaEG/gdQeZcwX0TVbmk.S8ehfW8a.m0SxlCv45q5D5Mr1GfinAu','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzUsImVtYWlsIjoidXNlcjFAZ21haWwuY29tIiwiaWF0IjoxNzYyNTAwMzIwLCJleHAiOjE3NjMxMDUxMjB9.bSXNU8bANydt0tVWqfhAg-9quJ_X_56_VyydCC3J-GU','Admin',NULL,NULL,NULL,'5980',NULL,0,1,0,NULL,'2025-10-29 09:53:35','2025-11-07 07:25:20',0,NULL,0),(36,'User 102','user102@gmail.com',_binary '$2b$08$Gjgc8Tb8PFBuyQejYUDjsOvyaDl.JnndAxg9A.nO/8rOUTbuHux9W','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzYsImVtYWlsIjoidXNlcjEwMkBnbWFpbC5jb20iLCJpYXQiOjE3NjI5Mjg3MTQsImV4cCI6MTc2MzUzMzUxNH0.zR_6mfLdQa6HcVl6STRWA481M22U6kIxGrqCAjNfFvc','Admin',NULL,NULL,'2S2SBDOT','6843',NULL,0,1,0,NULL,'2025-11-07 07:26:21','2025-11-12 06:25:14',0,NULL,0),(37,'User 103','bellepanel@gmail.com',_binary '$2b$08$HlhloAsKQBIApscWAs/HeuE48gO4eFAyrtzz3nCndLUsKJvkKYLLW',NULL,'Admin',NULL,NULL,'ZEYPLZ99','4629',NULL,0,0,0,NULL,'2025-11-07 10:03:49','2025-11-07 10:04:52',0,NULL,0),(42,'user111','user111@gmail.com',_binary '$2b$08$mYM5gytIX64OClNITdt6jONck9bTQS6e1DPeJgdPmoTyYr6MpDiq2',NULL,'NormalUser',NULL,NULL,'3XCELJ0C','7886',36,0,0,0,NULL,'2025-11-10 05:00:09','2025-11-10 05:00:09',0,NULL,0),(43,'uzer112','uzer112@gmail.com',_binary '$2b$08$A/gFbZ9BsqunBK0.fPP2MeLQsXErFOlpDcdQYdBH97Ss1SghXFH/y',NULL,'NormalUser',NULL,NULL,'FQ54YU6B','4739',36,0,0,0,NULL,'2025-11-10 05:00:35','2025-11-10 05:00:35',0,NULL,0),(44,'User 102','user103@gmail.com',_binary '$2b$08$SJkHq7bcVRfw.u2r.7MaM.dc7W6z7ri3mQfOG5OB5CuElltC6WMFm',NULL,'Admin',NULL,NULL,'HB06CATZ','8844',NULL,0,0,0,NULL,'2025-11-11 10:11:52','2025-11-11 10:11:52',0,NULL,0),(46,'User 102','mgpyaesone18@gmail.com',_binary '$2b$08$MJZmSCoZuV/ZXqk/ebIjx.qWKYl22JPs7ZCclY4G265pLq5CuV0nK','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NDYsImVtYWlsIjoibWdweWFlc29uZTE4QGdtYWlsLmNvbSIsImlhdCI6MTc2Mjg1NjA5NSwiZXhwIjoxNzYzNDYwODk1fQ.kJ9fGb7acc83nmUPRwEBxyC9R5AIOyKnZE93Cg5EXYU','Admin',NULL,NULL,'OKB3G00N','1615',NULL,0,1,0,NULL,'2025-11-11 10:13:55','2025-11-11 10:14:55',0,NULL,0),(47,'','admin100@gmail.com',_binary '$2b$08$x32WON3wmTbQ/PZEmWj82.T60r8MWwP/3p6EeKVftqTNgxY1ukC12',NULL,'Admin',NULL,NULL,'WZ0PMDSO','5446',NULL,0,0,0,NULL,'2025-11-12 06:23:04','2025-11-12 06:23:04',0,NULL,0);
/*!40000 ALTER TABLE `users_old` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `withdrawals`
--

DROP TABLE IF EXISTS `withdrawals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `withdrawals` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `currency` varchar(10) NOT NULL,
  `amount` decimal(20,8) NOT NULL,
  `fee` decimal(20,8) NOT NULL DEFAULT '0.00000000',
  `address` varchar(128) NOT NULL,
  `payout_provider` varchar(32) NOT NULL,
  `status` enum('requested','queued','sent','failed','cancelled') NOT NULL DEFAULT 'requested',
  `txid` varchar(128) DEFAULT NULL,
  `error_code` varchar(64) DEFAULT NULL,
  `error_message` varchar(255) DEFAULT NULL,
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wd_user_status` (`user_id`,`status`,`requested_at`),
  KEY `fk_wd_currency` (`currency`),
  CONSTRAINT `fk_wd_currency` FOREIGN KEY (`currency`) REFERENCES `currencies` (`code`),
  CONSTRAINT `fk_wd_user` FOREIGN KEY (`user_id`) REFERENCES `users_old` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `withdrawals`
--

LOCK TABLES `withdrawals` WRITE;
/*!40000 ALTER TABLE `withdrawals` DISABLE KEYS */;
INSERT INTO `withdrawals` VALUES (1,2,'DOGE',25.00000000,0.00000000,'D7w9ExampleDogecoinAddress123','nowpayments','requested',NULL,NULL,NULL,'2025-10-02 10:30:38',NULL,'2025-10-02 10:30:38'),(2,36,'COIN',200.00000000,10.00000000,'scdfdfsacfds','manual','sent',NULL,NULL,NULL,'2025-11-11 08:45:00','2025-11-11 02:05:58','2025-11-11 09:05:57');
/*!40000 ALTER TABLE `withdrawals` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-19 10:21:02
