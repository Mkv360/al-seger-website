-- =============================================================================
-- AL-SEGER RECRUITMENT MANAGEMENT SYSTEM
-- Database Schema v1.0
-- =============================================================================
-- ERD Summary:
--   admins       1---n   messages         (replied_by)
--   admins       1---n   activity_log
--   admins       1---n   training_materials (created_by)
--   countries    1---n   applicants       (destination_country_id)
--   countries    1---n   applicants       (origin_country_id)
--   applicants   1---n   applicant_documents
--   applicants   0..1--n messages         (applicant_id)
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '+00:00';

DROP TABLE IF EXISTS activity_log;
DROP TABLE IF EXISTS training_materials;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS applicant_documents;
DROP TABLE IF EXISTS applicants;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS countries;
DROP TABLE IF EXISTS admins;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- TABLE: admins
-- Stores system administrators who manage the recruitment platform.
-- =============================================================================
CREATE TABLE admins (
  id              INT             NOT NULL AUTO_INCREMENT,
  name            VARCHAR(120)    NOT NULL,
  email           VARCHAR(180)    NOT NULL,
  password        VARCHAR(255)    NOT NULL  COMMENT 'bcrypt hashed',
  role            ENUM('super_admin','admin','viewer') NOT NULL DEFAULT 'admin',
  avatar          VARCHAR(255)    NULL,
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  last_login      DATETIME        NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_admins_email    (email),
  KEY             idx_admins_role (role),
  KEY             idx_admins_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='System administrators and staff accounts';

-- =============================================================================
-- TABLE: countries
-- Destination and origin countries used in recruitment operations.
-- =============================================================================
CREATE TABLE countries (
  id              INT             NOT NULL AUTO_INCREMENT,
  name            VARCHAR(120)    NOT NULL,
  code            VARCHAR(5)      NOT NULL  COMMENT 'ISO 3166-1 alpha-3',
  flag_emoji      VARCHAR(10)     NULL,
  region          VARCHAR(80)     NULL,
  quota           INT             NOT NULL DEFAULT 0 COMMENT 'Max applicants allowed',
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  notes           TEXT            NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_countries_code  (code),
  KEY             idx_countries_region (region),
  KEY             idx_countries_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Countries available as origin or destination';

-- =============================================================================
-- TABLE: applicants
-- Core entity. Each row represents one recruitment applicant.
-- =============================================================================
CREATE TABLE applicants (
  id                        INT             NOT NULL AUTO_INCREMENT,
  reference_number          VARCHAR(25)     NOT NULL  COMMENT 'e.g. ALG-2024-0001',
  first_name                VARCHAR(100)    NOT NULL,
  last_name                 VARCHAR(100)    NOT NULL,
  email                     VARCHAR(180)    NULL,
  phone                     VARCHAR(25)     NULL,
  date_of_birth             DATE            NULL,
  gender                    ENUM('male','female') NOT NULL,
  nationality               VARCHAR(100)    NULL,
  national_id               VARCHAR(60)     NULL,
  passport_number           VARCHAR(60)     NULL,
  passport_expiry           DATE            NULL,
  destination_country_id    INT             NULL,
  origin_country_id         INT             NULL,
  education                 ENUM(
                              'none','primary','secondary',
                              'diploma','bachelor','master','phd'
                            ) NOT NULL DEFAULT 'none',
  experience_years          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  languages                 VARCHAR(255)    NULL COMMENT 'Comma-separated list',
  skills                    TEXT            NULL,
  address                   TEXT            NULL,
  emergency_contact_name    VARCHAR(120)    NULL,
  emergency_contact_phone   VARCHAR(25)     NULL,
  status                    ENUM(
                              'pending','processing',
                              'interview','approved',
                              'rejected','deployed'
                            ) NOT NULL DEFAULT 'pending',
  admin_notes               TEXT            NULL,
  rejected_reason           TEXT            NULL,
  applied_at                TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at              DATETIME        NULL,
  created_at                TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_applicants_ref      (reference_number),
  KEY             idx_app_status         (status),
  KEY             idx_app_dest_country   (destination_country_id),
  KEY             idx_app_origin_country (origin_country_id),
  KEY             idx_app_gender         (gender),
  KEY             idx_app_applied_at     (applied_at),
  KEY             idx_app_fullname       (first_name, last_name),
  KEY             idx_app_passport       (passport_number),
  FULLTEXT KEY    ft_app_search          (first_name, last_name, email, nationality, national_id),

  CONSTRAINT fk_app_dest_country
    FOREIGN KEY (destination_country_id) REFERENCES countries(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_app_origin_country
    FOREIGN KEY (origin_country_id) REFERENCES countries(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Core applicant records';

-- =============================================================================
-- TABLE: applicant_documents
-- File uploads per applicant: portrait photo, passport scan, ID card.
-- One row per document type per applicant (enforced by UNIQUE constraint).
-- =============================================================================
CREATE TABLE applicant_documents (
  id              INT             NOT NULL AUTO_INCREMENT,
  applicant_id    INT             NOT NULL,
  document_type   ENUM('portrait','passport','idcard') NOT NULL,
  file_path       VARCHAR(500)    NOT NULL,
  file_name       VARCHAR(255)    NULL,
  file_size       INT UNSIGNED    NULL COMMENT 'Bytes',
  mime_type       VARCHAR(100)    NULL,
  uploaded_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_doc_per_type    (applicant_id, document_type),
  KEY             idx_doc_type       (document_type),

  CONSTRAINT fk_doc_applicant
    FOREIGN KEY (applicant_id) REFERENCES applicants(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Document uploads linked to applicants';

-- =============================================================================
-- TABLE: settings
-- Key-value configuration store for system-wide settings.
-- =============================================================================
CREATE TABLE settings (
  id              INT             NOT NULL AUTO_INCREMENT,
  key_name        VARCHAR(120)    NOT NULL,
  value           TEXT            NULL,
  value_type      ENUM('string','number','boolean','json') NOT NULL DEFAULT 'string',
  label           VARCHAR(200)    NULL,
  group_name      VARCHAR(60)     NOT NULL DEFAULT 'general',
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_settings_key    (key_name),
  KEY             idx_settings_group (group_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Application-wide configuration key-value store';

-- =============================================================================
-- TABLE: messages
-- Inbox for inbound messages, optionally linked to an applicant.
-- Supports admin replies.
-- =============================================================================
CREATE TABLE messages (
  id              INT             NOT NULL AUTO_INCREMENT,
  sender_name     VARCHAR(120)    NULL,
  sender_email    VARCHAR(180)    NULL,
  sender_phone    VARCHAR(25)     NULL,
  subject         VARCHAR(300)    NULL,
  body            TEXT            NOT NULL,
  is_read         TINYINT(1)      NOT NULL DEFAULT 0,
  is_replied      TINYINT(1)      NOT NULL DEFAULT 0,
  reply_body      TEXT            NULL,
  replied_by      INT             NULL,
  replied_at      DATETIME        NULL,
  applicant_id    INT             NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY             idx_msg_read       (is_read),
  KEY             idx_msg_replied    (is_replied),
  KEY             idx_msg_applicant  (applicant_id),
  KEY             idx_msg_created    (created_at),

  CONSTRAINT fk_msg_replied_by
    FOREIGN KEY (replied_by) REFERENCES admins(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_msg_applicant
    FOREIGN KEY (applicant_id) REFERENCES applicants(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Inbound messages with optional applicant linkage';

-- =============================================================================
-- TABLE: activity_log
-- Immutable audit trail of admin actions.
-- =============================================================================
CREATE TABLE activity_log (
  id              INT             NOT NULL AUTO_INCREMENT,
  admin_id        INT             NULL,
  action          VARCHAR(100)    NOT NULL COMMENT 'e.g. CREATE_APPLICANT',
  entity_type     VARCHAR(60)     NULL,
  entity_id       INT             NULL,
  details         TEXT            NULL COMMENT 'JSON snapshot or description',
  ip_address      VARCHAR(45)     NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY             idx_log_admin      (admin_id),
  KEY             idx_log_action     (action),
  KEY             idx_log_entity     (entity_type, entity_id),
  KEY             idx_log_created    (created_at),

  CONSTRAINT fk_log_admin
    FOREIGN KEY (admin_id) REFERENCES admins(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Immutable audit trail for all admin actions';

-- =============================================================================
-- TABLE: training_materials
-- Documents, videos, and resources for staff training.
-- =============================================================================
CREATE TABLE training_materials (
  id              INT             NOT NULL AUTO_INCREMENT,
  title           VARCHAR(300)    NOT NULL,
  description     TEXT            NULL,
  category        VARCHAR(100)    NULL,
  file_path       VARCHAR(500)    NULL,
  file_type       VARCHAR(50)     NULL COMMENT 'pdf, video, doc, link',
  external_url    VARCHAR(1000)   NULL,
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  created_by      INT             NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY             idx_tm_category    (category),
  KEY             idx_tm_active      (is_active),

  CONSTRAINT fk_tm_admin
    FOREIGN KEY (created_by) REFERENCES admins(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Training materials and resources for staff';

-- =============================================================================
-- VIEWS
-- =============================================================================

CREATE OR REPLACE VIEW v_applicant_summary AS
  SELECT
    a.id,
    a.reference_number,
    CONCAT(a.first_name, ' ', a.last_name) AS full_name,
    a.email,
    a.phone,
    a.gender,
    a.status,
    a.education,
    a.experience_years,
    a.applied_at,
    dc.name  AS destination_country,
    dc.flag_emoji AS destination_flag,
    oc.name  AS origin_country,
    (SELECT file_path FROM applicant_documents d
     WHERE d.applicant_id = a.id AND d.document_type = 'portrait'
     LIMIT 1) AS portrait_path
  FROM applicants a
  LEFT JOIN countries dc ON a.destination_country_id = dc.id
  LEFT JOIN countries oc ON a.origin_country_id      = oc.id;

CREATE OR REPLACE VIEW v_dashboard_stats AS
  SELECT
    (SELECT COUNT(*) FROM applicants)                                   AS total_applicants,
    (SELECT COUNT(*) FROM applicants WHERE status = 'pending')          AS pending_count,
    (SELECT COUNT(*) FROM applicants WHERE status = 'approved')         AS approved_count,
    (SELECT COUNT(*) FROM applicants WHERE status = 'rejected')         AS rejected_count,
    (SELECT COUNT(*) FROM applicants WHERE status = 'processing')       AS processing_count,
    (SELECT COUNT(*) FROM applicants WHERE status = 'interview')        AS interview_count,
    (SELECT COUNT(*) FROM applicants WHERE status = 'deployed')         AS deployed_count,
    (SELECT COUNT(*) FROM countries  WHERE is_active = 1)               AS active_countries,
    (SELECT COUNT(*) FROM messages   WHERE is_read = 0)                 AS unread_messages,
    (SELECT COUNT(*) FROM applicants
     WHERE applied_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))              AS last_30_days;

-- =============================================================================
-- SEED DATA — ADMINS
-- Default password for all seed admins: Admin@1234
-- (bcrypt hash below corresponds to that password, cost factor 12)
-- =============================================================================
INSERT INTO admins (name, email, password, role) VALUES
  ('Super Admin',    'admin@alseger.com',    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBa5HGHk.Pq02i', 'super_admin'),
  ('Ahmad Mansour',  'ahmad@alseger.com',    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBa5HGHk.Pq02i', 'admin'),
  ('Fatima Al-Zahra','fatima@alseger.com',   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBa5HGHk.Pq02i', 'viewer');

-- =============================================================================
-- SEED DATA — COUNTRIES
-- =============================================================================
INSERT INTO countries (name, code, flag_emoji, region, quota, is_active) VALUES
  ('Saudi Arabia',        'SAU', '🇸🇦', 'Middle East',    500, 1),
  ('United Arab Emirates','UAE', '🇦🇪', 'Middle East',    300, 1),
  ('Kuwait',              'KWT', '🇰🇼', 'Middle East',    200, 1),
  ('Qatar',               'QAT', '🇶🇦', 'Middle East',    150, 1),
  ('Bahrain',             'BHR', '🇧🇭', 'Middle East',    100, 1),
  ('Oman',                'OMN', '🇴🇲', 'Middle East',    120, 1),
  ('Jordan',              'JOR', '🇯🇴', 'Middle East',     80, 1),
  ('Ethiopia',            'ETH', '🇪🇹', 'Africa',         400, 1),
  ('Philippines',         'PHL', '🇵🇭', 'Asia',           350, 1),
  ('Indonesia',           'IDN', '🇮🇩', 'Asia',           300, 1),
  ('India',               'IND', '🇮🇳', 'Asia',           500, 1),
  ('Bangladesh',          'BGD', '🇧🇩', 'Asia',           250, 1),
  ('Nepal',               'NPL', '🇳🇵', 'Asia',           150, 1),
  ('Sri Lanka',           'LKA', '🇱🇰', 'Asia',           100, 1),
  ('Pakistan',            'PAK', '🇵🇰', 'Asia',           300, 1);

-- =============================================================================
-- SEED DATA — SETTINGS
-- =============================================================================
INSERT INTO settings (key_name, value, value_type, label, group_name) VALUES
  ('app_name',              'Al-Seger Recruitment',    'string',  'Application Name',        'general'),
  ('app_tagline',           'Connecting Talent Globally','string','Application Tagline',     'general'),
  ('app_email',             'contact@alseger.com',     'string',  'Contact Email',           'general'),
  ('app_phone',             '+1-555-000-0000',         'string',  'Contact Phone',           'general'),
  ('app_address',           'Riyadh, Saudi Arabia',    'string',  'Office Address',          'general'),
  ('app_logo',              '',                        'string',  'Logo Path',               'general'),
  ('default_quota',         '100',                     'number',  'Default Country Quota',   'general'),
  ('allow_registrations',   'true',                    'boolean', 'Allow New Applicants',    'general'),
  ('max_file_size_mb',      '5',                       'number',  'Max Upload Size (MB)',    'uploads'),
  ('allowed_mime_types',    'image/jpeg,image/png,image/webp,application/pdf','string','Allowed File Types','uploads'),
  ('jwt_expiry_hours',      '24',                      'number',  'Session Expiry (hours)',  'security'),
  ('max_login_attempts',    '5',                       'number',  'Max Login Attempts',      'security'),
  ('smtp_host',             '',                        'string',  'SMTP Host',               'email'),
  ('smtp_port',             '587',                     'number',  'SMTP Port',               'email'),
  ('smtp_user',             '',                        'string',  'SMTP Username',           'email'),
  ('smtp_from',             'noreply@alseger.com',     'string',  'From Address',            'email'),
  ('pagination_limit',      '25',                      'number',  'Records Per Page',        'display'),
  ('date_format',           'YYYY-MM-DD',              'string',  'Date Format',             'display'),
  ('currency',              'USD',                     'string',  'Currency',                'display'),
  ('timezone',              'Asia/Riyadh',             'string',  'Timezone',                'display');

-- =============================================================================
-- SEED DATA — SAMPLE APPLICANTS
-- =============================================================================
INSERT INTO applicants
  (reference_number, first_name, last_name, email, phone, date_of_birth,
   gender, nationality, national_id, passport_number, passport_expiry,
   destination_country_id, origin_country_id,
   education, experience_years, languages, skills, address,
   emergency_contact_name, emergency_contact_phone, status)
VALUES
  ('ALG-2024-0001','Abebe','Girma','abebe.girma@email.com','+251912345678','1995-03-15',
   'male','Ethiopian','ETH123456','EP123456','2028-03-14',
   1,8,'secondary',3,'Amharic,Arabic,English','Driving,Cooking,Cleaning',
   'Addis Ababa, Ethiopia','Yeshi Girma','+251911111111','approved'),

  ('ALG-2024-0002','Fatuma','Hassan','fatuma.h@email.com','+251987654321','1998-07-22',
   'female','Ethiopian','ETH789012','EP789012','2029-07-21',
   2,8,'diploma',2,'Amharic,Arabic','Housekeeping,Childcare,Cooking',
   'Dire Dawa, Ethiopia','Omar Hassan','+251988888888','pending'),

  ('ALG-2024-0003','Maria','Santos','maria.santos@email.com','+639171234567','1993-11-05',
   'female','Filipino','PHL456789','PP456789','2027-11-04',
   1,9,'bachelor',5,'Tagalog,English,Arabic','Nursing,Caregiving',
   'Manila, Philippines','Jose Santos','+639172222222','processing'),

  ('ALG-2024-0004','Ram','Bahadur','ram.bahadur@email.com','+9779801234567','2000-01-18',
   'male','Nepali','NPL321654','NP321654','2030-01-17',
   3,13,'primary',1,'Nepali,Hindi','Driving,Labour',
   'Kathmandu, Nepal','Sita Bahadur','+9779803333333','interview'),

  ('ALG-2024-0005','Priya','Sharma','priya.sharma@email.com','+919876543210','1997-05-30',
   'female','Indian','IND987654','IN987654','2028-05-29',
   4,11,'diploma',4,'Hindi,English,Arabic','Housekeeping,Cooking',
   'Mumbai, India','Rajesh Sharma','+919877777777','rejected'),

  ('ALG-2024-0006','Budi','Santoso','budi.santoso@email.com','+6281234567890','1991-09-12',
   'male','Indonesian','IDN654321','ID654321','2026-09-11',
   5,10,'secondary',6,'Indonesian,English','Security,Labour,Driving',
   'Jakarta, Indonesia','Sari Santoso','+6281299999999','deployed'),

  ('ALG-2024-0007','Amina','Yusuf','amina.yusuf@email.com','+251934567890','2001-02-28',
   'female','Ethiopian','ETH111222','EP111222','2031-02-27',
   6,8,'secondary',0,'Amharic,Arabic','Housekeeping,Childcare',
   'Hawassa, Ethiopia','Yusuf Ali','+251935555555','pending'),

  ('ALG-2024-0008','Dilnoza','Karimova','dilnoza@email.com','+998901234567','1996-06-10',
   'female','Bangladeshi','BGD333444','BG333444','2029-06-09',
   2,12,'diploma',3,'Bengali,English,Arabic','Nursing,Housekeeping',
   'Dhaka, Bangladesh','Karim Ahmed','+998906666666','approved'),

  ('ALG-2024-0009','Sanjay','Kumar','sanjay.kumar@email.com','+919123456789','1989-12-03',
   'male','Indian','IND555666','IN555666','2025-12-02',
   1,11,'bachelor',8,'Hindi,English,Arabic','Engineering,Driving',
   'Delhi, India','Anita Kumar','+919124444444','processing'),

  ('ALG-2024-0010','Miriam','Tekle','miriam.tekle@email.com','+251945678901','1999-04-17',
   'female','Ethiopian','ETH777888','EP777888','2030-04-16',
   7,8,'primary',1,'Amharic,Tigrinya','Cleaning,Cooking',
   'Mekelle, Ethiopia','Tekle Haile','+251946666666','pending');

-- =============================================================================
-- SEED DATA — MESSAGES
-- =============================================================================
INSERT INTO messages (sender_name, sender_email, sender_phone, subject, body, is_read, applicant_id)
VALUES
  ('Abebe Girma',   'abebe.girma@email.com',  '+251912345678',
   'Question about visa processing',
   'Hello, I was approved and wanted to ask about the next steps for my visa processing. How long does it usually take?',
   0, 1),

  ('Fatuma Hassan', 'fatuma.h@email.com',      '+251987654321',
   'Document resubmission',
   'I have resubmitted my passport scan as it was not clear. Please review again.',
   1, 2),

  ('Maria Santos',  'maria.santos@email.com',  '+639171234567',
   'Training inquiry',
   'I would like to know if there are any pre-departure orientation programs available before I leave.',
   0, 3),

  (NULL, 'anonymous@inquiry.com', NULL,
   'General recruitment inquiry',
   'Hello, I am interested in applying for a domestic worker position in Saudi Arabia. What are the requirements?',
   0, NULL);

-- =============================================================================
-- SEED DATA — TRAINING MATERIALS
-- =============================================================================
INSERT INTO training_materials (title, description, category, file_type, external_url, is_active, created_by)
VALUES
  ('Pre-Departure Orientation Guide',
   'Comprehensive guide covering everything workers need to know before departure including rights, duties, and contacts.',
   'Orientation', 'pdf', NULL, 1, 1),

  ('Understanding Your Employment Contract',
   'Explains all clauses in the standard employment contract, in multiple languages.',
   'Legal', 'pdf', NULL, 1, 1),

  ('Cultural Awareness: Working in the Gulf',
   'Video training on cultural norms, dress codes, and workplace etiquette in GCC countries.',
   'Cultural', 'video', 'https://example.com/cultural-awareness', 1, 1),

  ('Health & Safety at Work',
   'Guidelines for maintaining health and safety in domestic and service roles abroad.',
   'Safety', 'pdf', NULL, 1, 2),

  ('Emergency Contacts & Support Resources',
   'List of embassy contacts, crisis hotlines, and support organizations in destination countries.',
   'Support', 'pdf', NULL, 1, 2),

  ('Language Basics: Arabic for Beginners',
   'Essential Arabic phrases for daily communication at the workplace.',
   'Language', 'pdf', NULL, 1, 2);

-- =============================================================================
-- SEED DATA — ACTIVITY LOG
-- =============================================================================
INSERT INTO activity_log (admin_id, action, entity_type, entity_id, details, ip_address)
VALUES
  (1, 'LOGIN',             'admin',     1,  '{"method":"password"}',              '127.0.0.1'),
  (1, 'CREATE_APPLICANT',  'applicant', 1,  '{"ref":"ALG-2024-0001"}',            '127.0.0.1'),
  (1, 'UPDATE_STATUS',     'applicant', 1,  '{"from":"pending","to":"approved"}', '127.0.0.1'),
  (2, 'CREATE_APPLICANT',  'applicant', 2,  '{"ref":"ALG-2024-0002"}',            '127.0.0.1'),
  (2, 'READ_MESSAGE',      'message',   1,  '{"subject":"visa processing"}',      '127.0.0.1'),
  (1, 'UPDATE_SETTING',    'setting',   1,  '{"key":"app_name"}',                 '127.0.0.1');

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================