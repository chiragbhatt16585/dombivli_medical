CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(60) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admins_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_name VARCHAR(120) NOT NULL,
  shop_name VARCHAR(160) NOT NULL DEFAULT '',
  mobile VARCHAR(15) NOT NULL,
  email VARCHAR(160) NOT NULL DEFAULT '',
  address VARCHAR(500) NOT NULL DEFAULT '',
  partner2_name VARCHAR(120) NULL,
  partner3_name VARCHAR(120) NULL,
  residential_address VARCHAR(500) NOT NULL DEFAULT '',
  partner2_address VARCHAR(500) NULL,
  partner3_address VARCHAR(500) NULL,
  licence_f20 VARCHAR(40) NULL,
  licence_f20c VARCHAR(40) NULL,
  licence_f21 VARCHAR(40) NULL,
  licence_f21b VARCHAR(40) NULL,
  drug_licence_no VARCHAR(40) NULL,
  qualified_person_name VARCHAR(120) NOT NULL DEFAULT '',
  pharmacist_reg_no VARCHAR(40) NULL,
  qualified_person_address VARCHAR(500) NOT NULL DEFAULT '',
  qualified_person_phone VARCHAR(20) NOT NULL DEFAULT '',
  qualified_person2_name VARCHAR(120) NULL,
  qualified_person2_reg VARCHAR(40) NULL,
  qualified_person2_address VARCHAR(500) NULL,
  qualified_person2_phone VARCHAR(20) NULL,
  photo_path VARCHAR(255) NULL,
  status ENUM('pending','approved','rejected','blocked','deactivated') NOT NULL DEFAULT 'pending',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_members_mobile (mobile),
  UNIQUE KEY uq_members_licence (drug_licence_no),
  UNIQUE KEY uq_members_f20 (licence_f20),
  UNIQUE KEY uq_members_f20c (licence_f20c),
  UNIQUE KEY uq_members_f21 (licence_f21),
  UNIQUE KEY uq_members_f21b (licence_f21b),
  KEY idx_members_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  subject_type ENUM('admin','member','registration') NOT NULL,
  subject_id INT UNSIGNED NOT NULL DEFAULT 0,
  mobile VARCHAR(15) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tokens_hash (token_hash),
  KEY idx_tokens_subject (subject_type, subject_id),
  KEY idx_tokens_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS otp_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mobile VARCHAR(15) NOT NULL,
  channel ENUM('routemobile','local') NOT NULL,
  otp_hash VARCHAR(255) NULL,
  provider_code VARCHAR(16) NULL,
  provider_body VARCHAR(255) NULL,
  message_id VARCHAR(80) NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_otp_mobile_created (mobile, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sms_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mobile VARCHAR(15) NOT NULL,
  sender VARCHAR(20) NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  provider ENUM('local','routemobile') NOT NULL,
  status ENUM('logged','sent','failed') NOT NULL,
  provider_code VARCHAR(16) NULL,
  provider_message_id VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sms_created (created_at),
  KEY idx_sms_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS otp_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mobile VARCHAR(15) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_otp_attempts (mobile, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS complaint_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_complaint_categories_name (name),
  KEY idx_complaint_categories_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS complaint_statuses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_complaint_statuses_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS complaints (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NULL,
  title VARCHAR(160) NOT NULL,
  details TEXT NOT NULL,
  photo_path VARCHAR(255) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'submitted',
  admin_reply TEXT NULL,
  replied_at DATETIME NULL,
  replied_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_complaints_member (member_id),
  KEY idx_complaints_status (status),
  KEY idx_complaints_category (category_id),
  CONSTRAINT fk_complaints_member FOREIGN KEY (member_id) REFERENCES members (id),
  CONSTRAINT fk_complaints_category FOREIGN KEY (category_id) REFERENCES complaint_categories (id),
  CONSTRAINT fk_complaints_status FOREIGN KEY (status) REFERENCES complaint_statuses (code),
  CONSTRAINT fk_complaints_admin FOREIGN KEY (replied_by) REFERENCES admins (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id INT UNSIGNED NOT NULL,
  complaint_id INT UNSIGNED NULL,
  title VARCHAR(160) NOT NULL,
  body VARCHAR(500) NOT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notes_member (member_id, read_at, id),
  CONSTRAINT fk_notes_member FOREIGN KEY (member_id) REFERENCES members (id),
  CONSTRAINT fk_notes_complaint FOREIGN KEY (complaint_id) REFERENCES complaints (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS flyers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  image_path VARCHAR(255) NOT NULL,
  link_url VARCHAR(500) NULL,
  starts_on DATE NULL,
  ends_on DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_flyers_active (is_active, sort_order),
  CONSTRAINT fk_flyers_admin FOREIGN KEY (created_by) REFERENCES admins (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  id TINYINT UNSIGNED PRIMARY KEY,
  association_name VARCHAR(160) NOT NULL,
  tagline VARCHAR(255) NOT NULL DEFAULT '',
  copyright VARCHAR(255) NOT NULL DEFAULT '',
  logo_path VARCHAR(255) NULL,
  support_mobile VARCHAR(20) NOT NULL DEFAULT '',
  whatsapp VARCHAR(20) NOT NULL DEFAULT '',
  support_email VARCHAR(160) NOT NULL DEFAULT '',
  address VARCHAR(500) NOT NULL DEFAULT '',
  office_hours VARCHAR(255) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
