-- =============================================================================
-- AL-SEGER PUBLIC USER SYSTEM
-- Users Schema v1.0
-- =============================================================================
-- PURPOSE:
--   Defines the public-facing user account table.
--   This schema is COMPLETELY SEPARATE from auth_schema.sql (admin system).
--   These tables have NO foreign keys to admin tables and vice versa.
--
-- EXECUTION ORDER:
--   1. Run schema.sql first       (core app tables)
--   2. Run auth_schema.sql second  (admin auth tables)
--   3. Run this file third         (public user tables)
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '+00:00';

DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- TABLE: users
-- Public user accounts for the Al-Seger recruitment platform.
-- Completely separate from the admins table in auth_schema.sql.
-- =============================================================================
-- FIELDS:
--   full_name      Full legal name as entered at registration
--   phone_or_email Single login identifier — accepts Ethiopian phone numbers
--                  (09xxxxxxxx, 07xxxxxxxx, +2519xxxxxxxx, +2517xxxxxxxx)
--                  or any valid email address. Stored exactly as provided
--                  after trimming whitespace. Lowercased for emails by the
--                  application layer before insert.
--   gender         Required at registration for profile display purposes
--   password_hash  bcrypt hash, cost factor 12. Plain password is NEVER stored.
--   created_at     Set once at INSERT, never updated
--   updated_at     Automatically updated by MySQL on every UPDATE
-- =============================================================================
CREATE TABLE users (
  id             INT             NOT NULL AUTO_INCREMENT,
  full_name      VARCHAR(150)    NOT NULL,
  phone_or_email VARCHAR(200)    NOT NULL
                   COMMENT 'Ethiopian phone (09/07/+2519/+2517) or email — unique login identifier',
  gender         ENUM('male','female') NOT NULL,
  password_hash  VARCHAR(255)    NOT NULL
                   COMMENT 'bcrypt hash, cost 12 — plain password never stored',
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                   ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_identifier (phone_or_email),
  KEY        idx_users_gender    (gender),
  KEY        idx_users_created   (created_at)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Public user accounts — entirely separate from admin accounts in auth_schema.sql';

-- =============================================================================
-- END OF USERS SCHEMA
-- =============================================================================