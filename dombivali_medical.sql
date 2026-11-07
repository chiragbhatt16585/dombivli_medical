-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Nov 07, 2026 at 02:12 PM
-- Server version: 9.4.0
-- PHP Version: 8.4.11

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `dombivali_medical`
--

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` int UNSIGNED NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `admins`
--

INSERT INTO `admins` (`id`, `name`, `username`, `password_hash`, `is_active`, `last_login_at`, `created_at`, `updated_at`) VALUES
(1, 'Administrator', 'admin', '$2y$12$KWRE4209pmoXtGmK.NtQqey.dLsZRJwf0je.qL85bWvdc/hFDRP.W', 1, '2026-11-07 16:14:43', '2026-11-07 15:56:12', '2026-11-07 16:14:43');

-- --------------------------------------------------------

--
-- Table structure for table `api_tokens`
--

CREATE TABLE `api_tokens` (
  `id` bigint UNSIGNED NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_type` enum('admin','member','registration') COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` int UNSIGNED NOT NULL DEFAULT '0',
  `mobile` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `api_tokens`
--

INSERT INTO `api_tokens` (`id`, `token_hash`, `subject_type`, `subject_id`, `mobile`, `expires_at`, `created_at`) VALUES
(1, 'f66d6ae6f07c8d6c02dd84d49700ef48e07b4ef7ef349e5e29ba3e9918d744d6', 'admin', 1, NULL, '2026-11-14 15:56:25', '2026-11-07 15:56:25'),
(3, '8d02a8f76e1c99112c3ebecfcd4e82f36ac4d155054d76682d0b6ceea65be8a7', 'member', 1, '9876543210', '2026-12-07 15:56:26', '2026-11-07 15:56:26'),
(4, 'd1451e01263453c702a0b4fb98109b5aad4309f28e7792ccc0efab525207bae1', 'admin', 1, NULL, '2026-11-14 15:56:48', '2026-11-07 15:56:48'),
(5, 'c88dda73583695085cd5c3f311203bab886c15797fb549eadf06ac49603150fb', 'admin', 1, NULL, '2026-11-14 15:58:57', '2026-11-07 15:58:57'),
(7, 'ce26771520a105ca83a4feebc1824611d17a35f08891e1e72aa5e180fc948e5e', 'admin', 1, NULL, '2026-11-14 16:03:07', '2026-11-07 16:03:07'),
(8, 'c9708dec0932e50924e369c7acfb5553b2ee2a6acd857831c98652eb87338936', 'admin', 1, NULL, '2026-11-14 16:05:11', '2026-11-07 16:05:11'),
(10, '13e81885a15afbfa12a18ee24dcaa57e9149a189bd8e60a5ba9ad2bc5671b471', 'member', 2, '9811111111', '2026-12-07 16:08:48', '2026-11-07 16:08:48'),
(13, '00a76ff96ce12551a31f4613010cbf131f54e323008ed33939fc11f5d9471e4c', 'admin', 1, NULL, '2026-11-14 16:14:43', '2026-11-07 16:14:43'),
(31, 'b7c573e682a821248e333f10654a31f03def116e35511c78475ba7c6ca46a4b3', 'member', 7, '9930793707', '2026-12-07 19:09:00', '2026-11-07 19:09:00'),
(34, '6b9092e0499ea05e4d90ef8468aa2d9169e39d9f9eab0eb4feb841a486380334', 'member', 8, '8554877878', '2026-12-07 19:23:25', '2026-11-07 19:23:25');

-- --------------------------------------------------------

--
-- Table structure for table `complaints`
--

CREATE TABLE `complaints` (
  `id` int UNSIGNED NOT NULL,
  `member_id` int UNSIGNED NOT NULL,
  `category_id` int UNSIGNED DEFAULT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `photo_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'submitted',
  `admin_reply` text COLLATE utf8mb4_unicode_ci,
  `replied_at` datetime DEFAULT NULL,
  `replied_by` int UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `complaints`
--

INSERT INTO `complaints` (`id`, `member_id`, `category_id`, `title`, `details`, `photo_path`, `status`, `admin_reply`, `replied_at`, `replied_by`, `created_at`, `updated_at`) VALUES
(1, 1, 2, 'Insulin supply', 'The distributor has not delivered insulin for this week.', 'uploads/complaints/f6084a33fcc9e011e80e7eb532d6d4f8.png', 'resolved', 'We have spoken to the distributor.', '2026-11-07 15:56:26', 1, '2026-11-07 15:56:26', '2026-11-07 16:14:38'),
(2, 1, 1, 'FDA renewal is still pending', 'The Form 20 renewal was submitted two months ago. The shop has not received the renewed licence copy.', NULL, 'submitted', NULL, NULL, NULL, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(3, 1, 2, 'Distributor sent a short supply', 'The last antibiotic order arrived with 40 strips missing. The distributor has not issued a credit note.', NULL, 'in_progress', NULL, NULL, NULL, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(4, 1, 3, 'Company scheme was not paid', 'A quarterly scheme for a cardiac brand was billed, but the company has not released the credit.', NULL, 'under_review', NULL, NULL, NULL, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(5, 1, 4, 'Unlicensed counter near the station', 'A counter near the railway station is selling strips without a visible drug licence.', NULL, 'submitted', NULL, NULL, NULL, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(6, 1, 5, 'AGM notice reached the shop late', 'The annual meeting notice arrived after the meeting date. The shop could not send a representative.', NULL, 'in_progress', NULL, NULL, NULL, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(7, 1, 6, 'No parking for medicine delivery', 'Delivery vans have no place to stop on the main road during morning hours. The ward office has marked a short bay.', NULL, 'resolved', NULL, NULL, NULL, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(8, 1, 2, 'Cold chain break on insulin', 'The morning insulin delivery arrived warm. The cold chain sticker was broken and two boxes cannot be sold.', NULL, 'submitted', NULL, NULL, NULL, '2026-11-07 16:21:56', '2026-11-07 16:21:56'),
(9, 7, 4, 'Hawker Issue', 'Hawker are seating next to shop', NULL, 'resolved', 'I have asked Police team to come today', '2026-11-07 17:25:29', 1, '2026-11-07 17:24:59', '2026-11-07 17:25:29'),
(11, 7, 3, 'I didnt get product early', 'I didnt get product early from Cipla.', NULL, 'submitted', NULL, NULL, NULL, '2026-11-07 19:16:11', '2026-11-07 19:16:11');

-- --------------------------------------------------------

--
-- Table structure for table `complaint_categories`
--

CREATE TABLE `complaint_categories` (
  `id` int UNSIGNED NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `complaint_categories`
--

INSERT INTO `complaint_categories` (`id`, `name`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Government / FDA-related issues', 1, 1, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(2, 'Drug supply and distributor issues', 2, 1, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(3, 'Company-related complaints', 3, 1, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(4, 'Local medical store issues', 4, 1, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(5, 'Association-related issues', 5, 1, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(6, 'Other complaints', 6, 1, '2026-11-07 16:14:38', '2026-11-07 16:14:38');

-- --------------------------------------------------------

--
-- Table structure for table `complaint_statuses`
--

CREATE TABLE `complaint_statuses` (
  `id` int UNSIGNED NOT NULL,
  `code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `complaint_statuses`
--

INSERT INTO `complaint_statuses` (`id`, `code`, `name`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'submitted', 'Submitted', 1, 1, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(2, 'in_progress', 'In Progress', 2, 1, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(3, 'under_review', 'Under Review', 3, 1, '2026-11-07 16:14:38', '2026-11-07 16:14:38'),
(4, 'resolved', 'Resolved', 4, 1, '2026-11-07 16:14:38', '2026-11-07 16:14:38');

-- --------------------------------------------------------

--
-- Table structure for table `flyers`
--

CREATE TABLE `flyers` (
  `id` int UNSIGNED NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `image_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `link_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `starts_on` date DEFAULT NULL,
  `ends_on` date DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_by` int UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `flyers`
--

INSERT INTO `flyers` (`id`, `title`, `image_path`, `link_url`, `starts_on`, `ends_on`, `is_active`, `sort_order`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'Annual general meeting', 'uploads/flyers/d3b6cafd2995eb4df410dcfc749fafa7.png', 'https://example.com/agm', NULL, NULL, 1, 1, 1, '2026-11-07 15:56:26', '2026-11-07 17:21:02');

-- --------------------------------------------------------

--
-- Table structure for table `members`
--

CREATE TABLE `members` (
  `id` int UNSIGNED NOT NULL,
  `owner_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `shop_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `mobile` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `address` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `drug_licence_no` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pharmacist_reg_no` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','approved','rejected','blocked','deactivated') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `partner2_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `partner3_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `residential_address` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `partner2_address` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `partner3_address` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `licence_f20` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `licence_f20c` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `licence_f21` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `licence_f21b` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qualified_person_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `qualified_person_address` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `qualified_person_phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `qualified_person2_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qualified_person2_reg` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qualified_person2_address` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qualified_person2_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `photo_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `members`
--

INSERT INTO `members` (`id`, `owner_name`, `shop_name`, `mobile`, `email`, `address`, `drug_licence_no`, `pharmacist_reg_no`, `status`, `last_login_at`, `created_at`, `updated_at`, `partner2_name`, `partner3_name`, `residential_address`, `partner2_address`, `partner3_address`, `licence_f20`, `licence_f20c`, `licence_f21`, `licence_f21b`, `qualified_person_name`, `qualified_person_address`, `qualified_person_phone`, `qualified_person2_name`, `qualified_person2_reg`, `qualified_person2_address`, `qualified_person2_phone`, `photo_path`) VALUES
(1, 'Ramesh Patil', 'Patil Medical', '9876543210', 'ramesh@example.com', 'Station Road, Dombivali East', 'MH-TZ-20-12345', 'MPC-9981', 'approved', '2026-11-07 16:37:38', '2026-11-07 15:56:26', '2026-11-07 16:47:03', NULL, NULL, '', NULL, NULL, 'MH-TZ-20-12345', NULL, NULL, NULL, '', '', '', NULL, NULL, NULL, NULL, NULL),
(2, 'Suresh Kulkarni', 'Kulkarni Medical', '9811111111', 'suresh@example.com', 'Phadke Road, Dombivali', 'MH-TZ-20-55501', 'MPC-1200', 'pending', '2026-11-07 16:08:48', '2026-11-07 16:08:48', '2026-11-07 16:47:03', NULL, NULL, '', NULL, NULL, 'MH-TZ-20-55501', NULL, NULL, NULL, '', '', '', NULL, NULL, NULL, NULL, NULL),
(3, 'Meena Joshi', 'Joshi Medical', '9822222222', 'meena@example.com', 'Tilak Road, Dombivali West', 'MH-TZ-20-55502', 'MPC-2200', 'pending', '2026-11-07 16:09:22', '2026-11-07 16:09:22', '2026-11-07 16:47:03', NULL, NULL, '', NULL, NULL, 'MH-TZ-20-55502', NULL, NULL, NULL, '', '', '', NULL, NULL, NULL, NULL, NULL),
(7, 'Chirag Bhatt', 'Bhatt Medical', '9930793707', 'chiragbhatt16585@gmail.com', 'B-1202, Swastik Forestaa, Opp - Baghban Kratos Club, Near Fantasia 2 Lane, Pal Gaurav Path Road, Surat', 'MH-DOM-20-2024-00125', 'MMC/PH/2019/09876', 'approved', '2026-11-07 19:09:00', '2026-11-07 17:09:54', '2026-11-07 19:09:00', 'Monali Bhatt', 'Jenis Bhatt', 'B-1202, Swastik Forestaa, Opp - Baghban Kratos Club, Near Fantasia 2 Lane, Pal Gaurav Path Road, Surat', 'B-1202, Swastik Forestaa, Opp - Baghban Kratos Club, Near Fantasia 2 Lane, Pal Gaurav Path Road, Surat', 'C-502, New Suncity Apartments 37 Anand Mahal Ln, Adajan 395009 Surat', 'MH-DOM-20-2024-00125', 'MH-DOM-20C-2024-00045', 'MH-DOM-21-2024-00078', 'MH-DOM-21B-2024-00032', 'Ashish Shah', 'A,504, Gokul Park, Dmart Virar West', '9823039951', NULL, NULL, NULL, NULL, 'uploads/members/bedbba1630af1e232e44abf92ccb98da.png'),
(8, 'Keval Jani', 'Ambica Marketting', '8554877878', 'keval@gmail.com', '71-Nandbaug Society, Behind Manohar Villa Society, Nikol Road, Naroda AHMEDABAD, GUJARAT 382330.', '3434-SDFS-4R444', '09809JLKJLTYT', 'approved', '2026-11-07 19:23:25', '2026-11-07 19:23:25', '2026-11-07 19:28:34', NULL, NULL, '71-Nandbaug Society, Behind Manohar Villa Society, Nikol Road, Naroda AHMEDABAD, GUJARAT 382330.', NULL, NULL, '3434-SDFS-4R444', 'LJL-4343-LKLKL', '324243-IUIUI-90909', '2342-56565-7676', 'Darshna Jani', '71-Nandbaug Society, Behind Manohar Villa Society, Nikol Road, Naroda AHMEDABAD, GUJARAT 382330.', '9016555734', NULL, NULL, NULL, NULL, 'uploads/members/5afbc66393e4b382fbb4ec1343783aee.png');

-- --------------------------------------------------------

--
-- Table structure for table `member_notifications`
--

CREATE TABLE `member_notifications` (
  `id` int UNSIGNED NOT NULL,
  `member_id` int UNSIGNED NOT NULL,
  `complaint_id` int UNSIGNED DEFAULT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `member_notifications`
--

INSERT INTO `member_notifications` (`id`, `member_id`, `complaint_id`, `title`, `body`, `read_at`, `created_at`) VALUES
(1, 1, 1, 'Insulin supply', 'Status is now Resolved.', NULL, '2026-11-07 16:20:35'),
(2, 1, 3, 'Distributor sent a short supply', 'Status is now In Progress.', NULL, '2026-11-07 16:20:35'),
(3, 1, 4, 'Company scheme was not paid', 'Status is now Under Review.', NULL, '2026-11-07 16:20:35'),
(4, 1, 6, 'AGM notice reached the shop late', 'Status is now In Progress.', '2026-11-07 16:27:28', '2026-11-07 16:20:35'),
(5, 1, 7, 'No parking for medicine delivery', 'Status is now Resolved.', NULL, '2026-11-07 16:20:35'),
(6, 7, 9, 'Hawker Issue', 'Status is now Resolved. The association sent a reply.', '2026-11-07 17:25:35', '2026-11-07 17:25:29');

-- --------------------------------------------------------

--
-- Table structure for table `otp_attempts`
--

CREATE TABLE `otp_attempts` (
  `id` bigint UNSIGNED NOT NULL,
  `mobile` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `otp_attempts`
--

INSERT INTO `otp_attempts` (`id`, `mobile`, `created_at`) VALUES
(17, '8554877878', '2026-11-07 19:23:25'),
(11, '9765432177', '2026-11-07 16:53:57'),
(10, '9765432188', '2026-11-07 16:48:14'),
(8, '9765432199', '2026-11-07 16:47:34'),
(9, '9765432199', '2026-11-07 16:47:35'),
(3, '9811111111', '2026-11-07 16:08:48'),
(4, '9822222222', '2026-11-07 16:09:22'),
(1, '9876543210', '2026-11-07 15:56:26'),
(5, '9876543210', '2026-11-07 16:17:24'),
(6, '9876543210', '2026-11-07 16:21:01'),
(7, '9876543210', '2026-11-07 16:37:37'),
(12, '9876543210', '2026-11-07 16:54:04'),
(2, '9876543211', '2026-11-07 15:56:26'),
(13, '9930793707', '2026-11-07 17:10:26'),
(14, '9930793707', '2026-11-07 18:48:57'),
(15, '9930793707', '2026-11-07 18:48:59'),
(16, '9930793707', '2026-11-07 19:09:00');

-- --------------------------------------------------------

--
-- Table structure for table `otp_requests`
--

CREATE TABLE `otp_requests` (
  `id` bigint UNSIGNED NOT NULL,
  `mobile` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('routemobile','local') COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_code` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_body` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `success` tinyint(1) NOT NULL DEFAULT '0',
  `expires_at` datetime NOT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `otp_requests`
--

INSERT INTO `otp_requests` (`id`, `mobile`, `channel`, `otp_hash`, `provider_code`, `provider_body`, `message_id`, `success`, `expires_at`, `consumed_at`, `created_at`) VALUES
(1, '9876543210', 'local', '$2y$12$pa0th.QZDFdCdFV6tLYvK.MJGZE.7tED12mWJNzX0KfOmTci4O/Fq', 'local', 'local', NULL, 1, '2026-11-07 16:01:26', '2026-11-07 15:56:26', '2026-11-07 15:56:26'),
(2, '9876543211', 'local', '$2y$12$Y2ao0SzmLEvZ3uMOb3ynNOdSZufmSncXhKG9m6ww19knLPN6oL88a', 'local', 'local', NULL, 1, '2026-11-07 16:01:26', NULL, '2026-11-07 15:56:26'),
(3, '9988776655', 'local', '$2y$12$dJ9TLWqkuPoFOfCHUPTn4uz2UXrRbIDc0iMK9y208YlZ6w1Bq/kPK', 'local', 'local', NULL, 1, '2026-11-07 16:03:56', NULL, '2026-11-07 15:58:56'),
(4, '9811111111', 'local', '$2y$12$uioBKlwVr4ooqLrWprcq3uJEhLAl6KwzTkro5JuW.4Kg8tn08KnSu', 'local', 'local', NULL, 1, '2026-11-07 16:13:48', '2026-11-07 16:08:48', '2026-11-07 16:08:48'),
(5, '9822222222', 'local', '$2y$12$5XfPjgNnJIqcpEP9z4eGXeaOnBqhBw79LGU.Dbg1UCumfSJtgWzVe', 'local', 'local', NULL, 1, '2026-11-07 16:14:10', '2026-11-07 16:09:22', '2026-11-07 16:09:10'),
(6, '9876543210', 'local', '$2y$12$bz6gRfvNaLoDPSG0VNTWlO.hfE4EYPDS1kFPrnv/fER4UqDHvh3e2', 'local', 'local', NULL, 1, '2026-11-07 16:22:01', '2026-11-07 16:17:24', '2026-11-07 16:17:01'),
(7, '9876543210', 'local', '$2y$12$0KD//okab8nhvJtBQucGDe6OPwUsfwQCBsX3lGZ/gRHf2vJeEs2y2', 'local', 'local', NULL, 1, '2026-11-07 16:25:51', '2026-11-07 16:21:01', '2026-11-07 16:20:51'),
(8, '9876543210', 'local', '$2y$12$4YNslTb2vyjk.UAxdcxqCuSBl7t5.SkbJ1I3RoDu9OL1XYz3QzOMi', 'local', 'local', NULL, 1, '2026-11-07 16:41:39', NULL, '2026-11-07 16:36:39'),
(9, '9876543210', 'local', '$2y$12$XMlHhjzN2MzdVcH/nFfOOOoghIXfGPBYvzn9M.Ubxq0ERwk5b7XFC', 'local', 'local', NULL, 1, '2026-11-07 16:42:25', '2026-11-07 16:37:38', '2026-11-07 16:37:25'),
(10, '9765432199', 'local', '$2y$12$CR3lPU3NykT8sNnckdTQieFlg77r0W2zedD7XF9HaBHkRs7p2H.9O', 'local', 'local', NULL, 1, '2026-11-07 16:52:34', '2026-11-07 16:47:35', '2026-11-07 16:47:34'),
(11, '9765432188', 'local', '$2y$12$g00Rylp0HwmP8f4rl8QW2uvMnmkhx5NZUrHz7TekoI3MFBwDw9CaO', 'local', 'local', NULL, 1, '2026-11-07 16:53:14', '2026-11-07 16:48:14', '2026-11-07 16:48:14'),
(12, '9765432177', 'local', '$2y$12$.9H94M3tGc/p0D4UliC.EuM2kshs41.Jp1cVCcTudYMvqx3IXeF9S', 'local', 'local', NULL, 1, '2026-11-07 16:58:57', '2026-11-07 16:53:57', '2026-11-07 16:53:57'),
(13, '9930793707', 'local', '$2y$12$dtmlFUOQriYC2EJZfwVArO.j4kwd3RtAIsCd7cp1OZhDQTtoNPfv2', 'local', 'local', NULL, 1, '2026-11-07 17:15:18', '2026-11-07 17:10:26', '2026-11-07 17:10:18'),
(14, '9930793707', 'local', '$2y$12$ZK6K.QtK8afY8fWmX3B8revD4xuVXK0hw28e/661kR09F8X4HaTWG', 'local', 'local', NULL, 1, '2026-11-07 18:53:44', '2026-11-07 18:49:00', '2026-11-07 18:48:44'),
(15, '9930793707', 'local', '$2y$12$.HHr0aeRYgoz/5FJdzXdw.4oaMZKhopZamKCfjlPtt/GoDfAT8FOW', 'local', 'local', NULL, 1, '2026-11-07 19:13:50', '2026-11-07 19:09:00', '2026-11-07 19:08:50'),
(16, '8554877878', 'local', '$2y$12$aBhdR4wIDWFWwvofAP85o.WUfImau6QCj7ykvZx.xAcFzOsoTklF.', 'local', 'local', NULL, 1, '2026-11-07 19:28:14', '2026-11-07 19:23:25', '2026-11-07 19:23:14');

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `id` tinyint UNSIGNED NOT NULL,
  `association_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tagline` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `copyright` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `logo_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `support_mobile` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `whatsapp` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `support_email` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `address` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `office_hours` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`id`, `association_name`, `tagline`, `copyright`, `logo_path`, `support_mobile`, `whatsapp`, `support_email`, `address`, `office_hours`, `updated_at`) VALUES
(1, 'Dombivli Medical (Chemist) Welfare Association', 'Affiliated to CATD, MSCDA, AIOCD', '© 2026 Dombivli Medical (Chemist) Welfare Association', 'uploads/branding/dmcwa-logo.png', '9876500000', '9876500000', 'office@example.com', 'Vishwambhar Darshan, A Wing, Block No. 1 & 2, Subhash Road, Vishnu Nagar, Dombivali (West), Dist. Thane', 'Mon–Sat, 10am–6pm', '2026-11-07 16:47:03');

-- --------------------------------------------------------

--
-- Table structure for table `sms_messages`
--

CREATE TABLE `sms_messages` (
  `id` bigint UNSIGNED NOT NULL,
  `mobile` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sender` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` enum('local','routemobile') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('logged','sent','failed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_code` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_message_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sms_messages`
--

INSERT INTO `sms_messages` (`id`, `mobile`, `sender`, `message`, `provider`, `status`, `provider_code`, `provider_message_id`, `created_at`) VALUES
(1, '9988776655', 'LOCAL', 'Your Dombivali Medical Association login OTP is 412611. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 15:58:56'),
(2, '9811111111', 'LOCAL', 'Your Dombivali Medical Association login OTP is 434126. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 16:08:48'),
(3, '9822222222', 'LOCAL', 'Your Dombivali Medical Association login OTP is 479659. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 16:09:10'),
(4, '9876543210', 'LOCAL', 'Your Dombivali Medical Association login OTP is 898624. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 16:17:01'),
(5, '9876543210', 'LOCAL', 'Your Dombivali Medical Association login OTP is 195548. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 16:20:51'),
(6, '9876543210', 'LOCAL', 'Your Dombivali Medical Association login OTP is 187733. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 16:36:39'),
(7, '9876543210', 'LOCAL', 'Your Dombivali Medical Association login OTP is 415996. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 16:37:25'),
(8, '9765432199', 'LOCAL', 'Your Dombivali Medical Association login OTP is 853196. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 16:47:34'),
(9, '9765432188', 'LOCAL', 'Your Dombivali Medical Association login OTP is 974356. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 16:48:14'),
(10, '9765432177', 'LOCAL', 'Your Dombivali Medical Association login OTP is 010389. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 16:53:57'),
(11, '9930793707', 'LOCAL', 'Your Dombivali Medical Association login OTP is 660249. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 17:10:18'),
(12, '9930793707', 'LOCAL', 'Your Dombivali Medical Association login OTP is 113449. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 18:48:44'),
(13, '9930793707', 'LOCAL', 'Your Dombivali Medical Association login OTP is 089934. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 19:08:50'),
(14, '8554877878', 'LOCAL', 'Your Dombivali Medical Association login OTP is 617032. It is valid for 5 minutes. Do not share this OTP.', 'local', 'logged', NULL, NULL, '2026-11-07 19:23:14');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_admins_username` (`username`);

--
-- Indexes for table `api_tokens`
--
ALTER TABLE `api_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tokens_hash` (`token_hash`),
  ADD KEY `idx_tokens_subject` (`subject_type`,`subject_id`),
  ADD KEY `idx_tokens_expires` (`expires_at`);

--
-- Indexes for table `complaints`
--
ALTER TABLE `complaints`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_complaints_member` (`member_id`),
  ADD KEY `idx_complaints_status` (`status`),
  ADD KEY `fk_complaints_admin` (`replied_by`),
  ADD KEY `idx_complaints_category` (`category_id`);

--
-- Indexes for table `complaint_categories`
--
ALTER TABLE `complaint_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_complaint_categories_name` (`name`),
  ADD KEY `idx_complaint_categories_sort` (`is_active`,`sort_order`);

--
-- Indexes for table `complaint_statuses`
--
ALTER TABLE `complaint_statuses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_complaint_statuses_code` (`code`);

--
-- Indexes for table `flyers`
--
ALTER TABLE `flyers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_flyers_active` (`is_active`,`sort_order`),
  ADD KEY `fk_flyers_admin` (`created_by`);

--
-- Indexes for table `members`
--
ALTER TABLE `members`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_members_mobile` (`mobile`),
  ADD UNIQUE KEY `uq_members_licence` (`drug_licence_no`),
  ADD UNIQUE KEY `uq_members_f20` (`licence_f20`),
  ADD UNIQUE KEY `uq_members_f20c` (`licence_f20c`),
  ADD UNIQUE KEY `uq_members_f21` (`licence_f21`),
  ADD UNIQUE KEY `uq_members_f21b` (`licence_f21b`),
  ADD KEY `idx_members_status` (`status`);

--
-- Indexes for table `member_notifications`
--
ALTER TABLE `member_notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notes_member` (`member_id`,`read_at`,`id`),
  ADD KEY `fk_notes_complaint` (`complaint_id`);

--
-- Indexes for table `otp_attempts`
--
ALTER TABLE `otp_attempts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_otp_attempts` (`mobile`,`created_at`);

--
-- Indexes for table `otp_requests`
--
ALTER TABLE `otp_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_otp_mobile_created` (`mobile`,`created_at`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `sms_messages`
--
ALTER TABLE `sms_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sms_created` (`created_at`),
  ADD KEY `idx_sms_mobile` (`mobile`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admins`
--
ALTER TABLE `admins`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `api_tokens`
--
ALTER TABLE `api_tokens`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `complaints`
--
ALTER TABLE `complaints`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `complaint_categories`
--
ALTER TABLE `complaint_categories`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `complaint_statuses`
--
ALTER TABLE `complaint_statuses`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `flyers`
--
ALTER TABLE `flyers`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `members`
--
ALTER TABLE `members`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `member_notifications`
--
ALTER TABLE `member_notifications`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `otp_attempts`
--
ALTER TABLE `otp_attempts`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `otp_requests`
--
ALTER TABLE `otp_requests`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `sms_messages`
--
ALTER TABLE `sms_messages`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `complaints`
--
ALTER TABLE `complaints`
  ADD CONSTRAINT `fk_complaints_admin` FOREIGN KEY (`replied_by`) REFERENCES `admins` (`id`),
  ADD CONSTRAINT `fk_complaints_category` FOREIGN KEY (`category_id`) REFERENCES `complaint_categories` (`id`),
  ADD CONSTRAINT `fk_complaints_member` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`),
  ADD CONSTRAINT `fk_complaints_status` FOREIGN KEY (`status`) REFERENCES `complaint_statuses` (`code`) ON UPDATE CASCADE;

--
-- Constraints for table `flyers`
--
ALTER TABLE `flyers`
  ADD CONSTRAINT `fk_flyers_admin` FOREIGN KEY (`created_by`) REFERENCES `admins` (`id`);

--
-- Constraints for table `member_notifications`
--
ALTER TABLE `member_notifications`
  ADD CONSTRAINT `fk_notes_complaint` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`),
  ADD CONSTRAINT `fk_notes_member` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
