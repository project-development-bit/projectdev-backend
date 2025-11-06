-- Migration: Create contact_us table
DROP TABLE IF EXISTS `contact_us`;

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
  `user_agent` text DEFAULT NULL COMMENT 'Browser user agent',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Contact us submissions';
