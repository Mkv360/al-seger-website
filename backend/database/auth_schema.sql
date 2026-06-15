-- =============================================================================
-- AL-SEGER — Authentication & Authorization Schema
-- Phase 1 — Admin database architecture
-- =============================================================================
-- PURPOSE:
--   Replaces the original simple admins table with a production-grade
--   authentication system including:
--     • Role-based access control (RBAC) with 6 roles
--     • Invitation-based admin onboarding (no self-registration)
--     • Progressive account lockout after failed logins
--     • Server-side JWT blacklisting via admin_sessions
--     • Secure password reset flow with hashed tokens
--     • Immutable audit trail with snapshotted admin identity
--
-- EXECUTION ORDER:
--   1. Run main schema.sql first  (creates applicants, countries, etc.)
--   2. Run this file               (creates / replaces auth tables)
--   3. Run seeders/createSuperAdmin.js via CLI
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE  = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '+00:00';

-- Drop in safe dependency order
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS activity_log;          -- replaces the simpler original
DROP TABLE IF EXISTS admin_sessions;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS admin_invitations;
DROP TABLE IF EXISTS admins;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- TABLE: admins
-- =============================================================================
-- FIELDS:
--   full_name             Full legal name (displayed in UI and audit snapshots)
--   username              Unique slug used only for CLI / direct DB tooling;
--                         frontend login always uses email
--   email                 Primary login credential
--   password_hash         bcrypt hash, minimum cost factor 12
--   role                  Determines permission set (enforced in application)
--   status                Gate for login; must be 'active' to authenticate
--   failed_login_attempts Progressive counter; reset on success
--   locked_until          NULL = not locked; future timestamp = locked
--   must_change_password  Set to 1 on invitation so admin is forced to set
--                         their own password on first login
--   avatar_path           Optional path to uploaded avatar image
--   last_login            Updated on every successful authentication
--   last_login_ip         Stored for security monitoring
--   last_login_user_agent Stored for anomaly detection
--   created_by            FK to the admin who issued the invitation;
--                         NULL only for the bootstrap super_admin
-- =============================================================================

CREATE TABLE admins (
  id                    INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  full_name             VARCHAR(150)      NOT NULL,
  username              VARCHAR(80)       NOT NULL,
  email                 VARCHAR(200)      NOT NULL,
  password_hash         VARCHAR(255)      NOT NULL   COMMENT 'bcrypt, cost 12 minimum',
  role                  ENUM(
                          'super_admin',
                          'admin',
                          'manager',
                          'editor',
                          'support',
                          'viewer'
                        )                 NOT NULL   DEFAULT 'viewer',
  status                ENUM(
                          'active',
                          'inactive',
                          'locked',
                          'pending_verification'
                        )                 NOT NULL   DEFAULT 'pending_verification',
  failed_login_attempts TINYINT UNSIGNED  NOT NULL   DEFAULT 0
                          COMMENT 'Resets to 0 on successful authentication',
  locked_until          DATETIME          NULL
                          COMMENT 'Progressive lockout; NULL = unlocked',
  must_change_password  TINYINT(1)        NOT NULL   DEFAULT 0
                          COMMENT '1 = force new password on next login (invitation flow)',
  avatar_path           VARCHAR(500)      NULL,
  last_login            DATETIME          NULL,
  last_login_ip         VARCHAR(45)       NULL       COMMENT 'IPv4 or IPv6',
  last_login_user_agent VARCHAR(500)      NULL,
  created_by            INT UNSIGNED      NULL
                          COMMENT 'Inviting admin; NULL = bootstrap super_admin',
  created_at            TIMESTAMP         NOT NULL   DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP         NOT NULL   DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY           (id),
  UNIQUE KEY uq_admins_email       (email),
  UNIQUE KEY uq_admins_username    (username),
  KEY        idx_admins_role       (role),
  KEY        idx_admins_status     (status),
  KEY        idx_admins_locked     (locked_until),
  KEY        idx_admins_created_by (created_by),

  CONSTRAINT fk_admins_created_by
    FOREIGN KEY (created_by) REFERENCES admins(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='System administrators — role-based, invitation-only registration';

-- =============================================================================
-- TABLE: admin_invitations
-- =============================================================================
-- Supports the invitation-based onboarding model:
--   • SUPER_ADMIN / ADMIN generates an invitation for a specific email + role
--   • A secure random token is generated, SHA-256 hashed before storage
--   • The raw token is emailed to the invitee
--   • Invitee opens the link, sets their password, activates their account
--   • Invitation can be revoked before acceptance
--   • Token expires after 72 hours (configurable in application layer)
--
-- SECURITY: The raw token is NEVER stored. Only the SHA-256 hash is persisted.
--           If the database is compromised, tokens cannot be reconstructed.
-- =============================================================================

CREATE TABLE admin_invitations (
  id                INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  email             VARCHAR(200)   NOT NULL,
  role              ENUM(
                      'admin',
                      'manager',
                      'editor',
                      'support',
                      'viewer'
                    )              NOT NULL   DEFAULT 'viewer'
                      COMMENT 'super_admin excluded — created only via CLI seeder',
  token_hash        VARCHAR(255)   NOT NULL
                      COMMENT 'SHA-256 of the raw token emailed to the invitee',
  invited_by        INT UNSIGNED   NOT NULL,
  expires_at        DATETIME       NOT NULL,
  accepted_at       DATETIME       NULL,
  accepted_by_id    INT UNSIGNED   NULL
                      COMMENT 'admins.id created when invitation was accepted',
  revoked_at        DATETIME       NULL,
  revoked_by        INT UNSIGNED   NULL,
  created_at        TIMESTAMP      NOT NULL   DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_inv_token         (token_hash),
  KEY        idx_inv_email        (email),
  KEY        idx_inv_invited_by   (invited_by),
  KEY        idx_inv_expires      (expires_at),
  KEY        idx_inv_status       (accepted_at, revoked_at),

  CONSTRAINT fk_inv_invited_by
    FOREIGN KEY (invited_by) REFERENCES admins(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_inv_accepted_by
    FOREIGN KEY (accepted_by_id) REFERENCES admins(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_inv_revoked_by
    FOREIGN KEY (revoked_by) REFERENCES admins(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Invitation tokens for new admin onboarding';

-- =============================================================================
-- TABLE: password_reset_tokens
-- =============================================================================
-- Flow:
--   1.  Admin submits their email on the Forgot Password page
--   2.  Server generates a cryptographically random 64-byte token
--   3.  SHA-256 hash is stored here; raw token is emailed
--   4.  Admin clicks the link (contains raw token)
--   5.  Server hashes the received token, looks it up, verifies expiry
--   6.  On success: admin sets new password, token marked used
--   7.  Old unused tokens for the same admin are deleted on new request
--
-- SECURITY: One valid token per admin at any time. Tokens expire after 60 min.
--           Used tokens are never deleted — kept for audit.
-- =============================================================================

CREATE TABLE password_reset_tokens (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  admin_id     INT UNSIGNED  NOT NULL,
  token_hash   VARCHAR(255)  NOT NULL
                 COMMENT 'SHA-256 of the raw reset token emailed to admin',
  expires_at   DATETIME      NOT NULL,
  used_at      DATETIME      NULL
                 COMMENT 'NULL = not yet used',
  ip_address   VARCHAR(45)   NULL   COMMENT 'IP that requested the reset',
  user_agent   VARCHAR(500)  NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_prt_token   (token_hash),
  KEY        idx_prt_admin  (admin_id),
  KEY        idx_prt_expires(expires_at),

  CONSTRAINT fk_prt_admin
    FOREIGN KEY (admin_id) REFERENCES admins(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Password reset tokens (hashed); expires after 60 minutes';

-- =============================================================================
-- TABLE: admin_sessions
-- =============================================================================
-- JWTs are stateless by design — once issued they are valid until expiry.
-- This table enables server-side invalidation:
--   • On logout:      mark session is_revoked = 1
--   • On auth check:  look up token_hash; reject if is_revoked = 1
--   • Cleanup job:    delete rows where expires_at < NOW() - 7 days
--
-- token_hash = SHA-256(raw_jwt)  — we NEVER store the raw JWT
--
-- PERFORMANCE NOTE:
--   The auth middleware performs one extra DB read per request.
--   For high-traffic deployments, move blacklist to Redis with TTL matching
--   the token expiry. The schema here serves as the ground-truth store.
-- =============================================================================

CREATE TABLE admin_sessions (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  admin_id     INT UNSIGNED  NOT NULL,
  token_hash   VARCHAR(255)  NOT NULL
                 COMMENT 'SHA-256(JWT); used to blacklist specific tokens',
  ip_address   VARCHAR(45)   NULL,
  user_agent   VARCHAR(500)  NULL,
  is_revoked   TINYINT(1)    NOT NULL DEFAULT 0,
  revoked_at   DATETIME      NULL,
  revoked_by   INT UNSIGNED  NULL
                 COMMENT 'admin_id who triggered revocation (super_admin force-logout)',
  expires_at   DATETIME      NOT NULL,
  last_active  DATETIME      NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_sess_token       (token_hash),
  KEY        idx_sess_admin      (admin_id),
  KEY        idx_sess_revoked    (is_revoked),
  KEY        idx_sess_expires    (expires_at),
  KEY        idx_sess_active     (last_active),

  CONSTRAINT fk_sess_admin
    FOREIGN KEY (admin_id) REFERENCES admins(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Server-side JWT tracking and blacklisting per session';

-- =============================================================================
-- TABLE: audit_log
-- =============================================================================
-- Immutable, append-only record of all security and data events.
-- NEVER update or delete rows from this table.
-- The admin_name and admin_email columns are snapshots — they preserve
-- identity even after the admin account is renamed or deleted.
--
-- CATEGORIES:
--   auth        Login, logout, password change, lockout events
--   applicant   CRUD operations on applicant records
--   country     Country management
--   setting     System configuration changes
--   admin       Admin account lifecycle (invite, create, lock, delete)
--   report      Report generation and data exports
--   system      Server events, migrations, scheduled jobs
--
-- SEVERITY:
--   info        Normal operations (view, export)
--   warning     Suspicious but non-critical (failed login, locked account)
--   critical    Security events (brute force, forced logout, mass delete)
-- =============================================================================

CREATE TABLE audit_log (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id     INT UNSIGNED    NULL
                 COMMENT 'NULL for system actions or after admin deletion',
  admin_name   VARCHAR(150)    NULL
                 COMMENT 'Identity snapshot — preserved after deletion',
  admin_email  VARCHAR(200)    NULL
                 COMMENT 'Identity snapshot — preserved after deletion',
  action       VARCHAR(100)    NOT NULL
                 COMMENT 'Verb in SCREAMING_SNAKE_CASE: LOGIN, CREATE_APPLICANT',
  category     ENUM(
                 'auth',
                 'applicant',
                 'country',
                 'setting',
                 'admin',
                 'report',
                 'system'
               )               NOT NULL DEFAULT 'system',
  severity     ENUM(
                 'info',
                 'warning',
                 'critical'
               )               NOT NULL DEFAULT 'info',
  entity_type  VARCHAR(60)     NULL   COMMENT 'e.g. applicant, admin, country',
  entity_id    INT UNSIGNED    NULL,
  old_values   JSON            NULL   COMMENT 'State before change (no passwords)',
  new_values   JSON            NULL   COMMENT 'State after change  (no passwords)',
  description  TEXT            NULL   COMMENT 'Human-readable summary',
  ip_address   VARCHAR(45)     NULL,
  user_agent   VARCHAR(500)    NULL,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_al_admin_id  (admin_id),
  KEY idx_al_action    (action),
  KEY idx_al_category  (category),
  KEY idx_al_severity  (severity),
  KEY idx_al_entity    (entity_type, entity_id),
  KEY idx_al_created   (created_at),

  CONSTRAINT fk_al_admin
    FOREIGN KEY (admin_id) REFERENCES admins(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Immutable audit trail — never UPDATE or DELETE rows';

-- =============================================================================
-- VIEWS
-- =============================================================================

CREATE OR REPLACE VIEW v_admin_list AS
  SELECT
    a.id,
    a.full_name,
    a.username,
    a.email,
    a.role,
    a.status,
    a.failed_login_attempts,
    a.last_login,
    a.last_login_ip,
    a.created_at,
    CASE
      WHEN a.locked_until IS NOT NULL AND a.locked_until > NOW() THEN 1
      ELSE 0
    END                                     AS is_currently_locked,
    a.locked_until,
    creator.full_name                       AS created_by_name,
    creator.email                           AS created_by_email
  FROM   admins a
  LEFT JOIN admins creator ON creator.id = a.created_by
  WHERE  a.status != 'inactive'
  ORDER  BY a.created_at DESC;

CREATE OR REPLACE VIEW v_recent_audit AS
  SELECT
    al.id,
    al.admin_name,
    al.admin_email,
    al.action,
    al.category,
    al.severity,
    al.entity_type,
    al.entity_id,
    al.description,
    al.ip_address,
    al.created_at
  FROM audit_log al
  ORDER BY al.created_at DESC
  LIMIT 500;

CREATE OR REPLACE VIEW v_login_attempts_24h AS
  SELECT
    al.admin_email,
    al.ip_address,
    COUNT(*) AS attempt_count,
    SUM(al.action = 'LOGIN_SUCCESS') AS success_count,
    SUM(al.action = 'LOGIN_FAILED')  AS failure_count,
    MAX(al.created_at)               AS last_attempt
  FROM audit_log al
  WHERE al.category = 'auth'
    AND al.created_at >= NOW() - INTERVAL 24 HOUR
  GROUP BY al.admin_email, al.ip_address
  ORDER BY failure_count DESC;

-- =============================================================================
-- REFERENCE TABLE: role_permissions_reference
-- Documents the intended permission set per role.
-- Enforced in the APPLICATION LAYER (backend/config/permissions.js).
-- This table is read-only documentation / UI reference — do not use it
-- for runtime authorization checks.
-- =============================================================================

CREATE TABLE IF NOT EXISTS role_permissions_reference (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  role        VARCHAR(50)   NOT NULL,
  permission  VARCHAR(100)  NOT NULL,
  granted     TINYINT(1)    NOT NULL DEFAULT 0
                COMMENT '1 = allowed, 0 = denied',
  scope_note  VARCHAR(255)  NULL
                COMMENT 'Qualifications or limitations on the grant',
  PRIMARY KEY (id),
  UNIQUE KEY uq_rpr_role_perm (role, permission),
  KEY        idx_rpr_role     (role),
  KEY        idx_rpr_perm     (permission)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Read-only documentation of role permissions; enforced in app layer';

-- truncate and re-seed to allow safe re-runs
TRUNCATE TABLE role_permissions_reference;

INSERT INTO role_permissions_reference (role, permission, granted, scope_note) VALUES

-- ── SUPER_ADMIN ──────────────────────────────────────────────────────────────
('super_admin','dashboard.view',       1, NULL),
('super_admin','dashboard.stats',      1, NULL),
('super_admin','applicants.view',      1, NULL),
('super_admin','applicants.create',    1, NULL),
('super_admin','applicants.edit',      1, NULL),
('super_admin','applicants.delete',    1, NULL),
('super_admin','applicants.status',    1, NULL),
('super_admin','applicants.export',    1, NULL),
('super_admin','documents.upload',     1, NULL),
('super_admin','documents.delete',     1, NULL),
('super_admin','countries.view',       1, NULL),
('super_admin','countries.manage',     1, NULL),
('super_admin','reports.view',         1, NULL),
('super_admin','reports.export',       1, NULL),
('super_admin','messages.view',        1, NULL),
('super_admin','messages.reply',       1, NULL),
('super_admin','messages.delete',      1, NULL),
('super_admin','training.view',        1, NULL),
('super_admin','training.manage',      1, NULL),
('super_admin','settings.view',        1, NULL),
('super_admin','settings.edit',        1, NULL),
('super_admin','admins.view',          1, NULL),
('super_admin','admins.create',        1, NULL),
('super_admin','admins.edit',          1, NULL),
('super_admin','admins.delete',        1, NULL),
('super_admin','admins.invite',        1, NULL),
('super_admin','admins.lock',          1, NULL),
('super_admin','admins.role_change',   1, NULL),
('super_admin','admins.force_logout',  1, NULL),
('super_admin','audit_log.view',       1, NULL),
('super_admin','sessions.revoke',      1, NULL),

-- ── ADMIN ─────────────────────────────────────────────────────────────────────
('admin','dashboard.view',       1, NULL),
('admin','dashboard.stats',      1, NULL),
('admin','applicants.view',      1, NULL),
('admin','applicants.create',    1, NULL),
('admin','applicants.edit',      1, NULL),
('admin','applicants.delete',    1, NULL),
('admin','applicants.status',    1, NULL),
('admin','applicants.export',    1, NULL),
('admin','documents.upload',     1, NULL),
('admin','documents.delete',     1, NULL),
('admin','countries.view',       1, NULL),
('admin','countries.manage',     1, NULL),
('admin','reports.view',         1, NULL),
('admin','reports.export',       1, NULL),
('admin','messages.view',        1, NULL),
('admin','messages.reply',       1, NULL),
('admin','messages.delete',      0, NULL),
('admin','training.view',        1, NULL),
('admin','training.manage',      1, NULL),
('admin','settings.view',        1, NULL),
('admin','settings.edit',        1, 'General settings only; cannot change JWT expiry or security settings'),
('admin','admins.view',          0, NULL),
('admin','admins.create',        0, NULL),
('admin','admins.edit',          0, NULL),
('admin','admins.delete',        0, NULL),
('admin','admins.invite',        1, 'Can invite support and viewer roles only'),
('admin','admins.lock',          0, NULL),
('admin','admins.role_change',   0, NULL),
('admin','admins.force_logout',  0, NULL),
('admin','audit_log.view',       0, NULL),
('admin','sessions.revoke',      0, NULL),

-- ── MANAGER ───────────────────────────────────────────────────────────────────
('manager','dashboard.view',       1, NULL),
('manager','dashboard.stats',      1, NULL),
('manager','applicants.view',      1, NULL),
('manager','applicants.create',    1, NULL),
('manager','applicants.edit',      1, NULL),
('manager','applicants.delete',    0, NULL),
('manager','applicants.status',    1, NULL),
('manager','applicants.export',    1, NULL),
('manager','documents.upload',     1, NULL),
('manager','documents.delete',     0, NULL),
('manager','countries.view',       1, NULL),
('manager','countries.manage',     0, NULL),
('manager','reports.view',         1, NULL),
('manager','reports.export',       1, NULL),
('manager','messages.view',        1, NULL),
('manager','messages.reply',       1, NULL),
('manager','messages.delete',      0, NULL),
('manager','training.view',        1, NULL),
('manager','training.manage',      1, NULL),
('manager','settings.view',        0, NULL),
('manager','settings.edit',        0, NULL),
('manager','admins.view',          0, NULL),
('manager','admins.invite',        0, NULL),
('manager','audit_log.view',       0, NULL),

-- ── EDITOR ────────────────────────────────────────────────────────────────────
('editor','dashboard.view',       1, NULL),
('editor','dashboard.stats',      1, 'Own submissions only'),
('editor','applicants.view',      1, NULL),
('editor','applicants.create',    1, NULL),
('editor','applicants.edit',      1, 'Cannot edit status or admin notes'),
('editor','applicants.delete',    0, NULL),
('editor','applicants.status',    0, NULL),
('editor','applicants.export',    0, NULL),
('editor','documents.upload',     1, NULL),
('editor','documents.delete',     0, NULL),
('editor','countries.view',       1, NULL),
('editor','countries.manage',     0, NULL),
('editor','reports.view',         0, NULL),
('editor','reports.export',       0, NULL),
('editor','messages.view',        0, NULL),
('editor','messages.reply',       0, NULL),
('editor','messages.delete',      0, NULL),
('editor','training.view',        1, NULL),
('editor','training.manage',      0, NULL),
('editor','settings.view',        0, NULL),
('editor','settings.edit',        0, NULL),
('editor','admins.view',          0, NULL),
('editor','admins.invite',        0, NULL),
('editor','audit_log.view',       0, NULL),

-- ── SUPPORT ───────────────────────────────────────────────────────────────────
('support','dashboard.view',       1, NULL),
('support','dashboard.stats',      1, 'Summary counts only'),
('support','applicants.view',      1, NULL),
('support','applicants.create',    0, NULL),
('support','applicants.edit',      1, 'Contact info and address fields only'),
('support','applicants.delete',    0, NULL),
('support','applicants.status',    0, NULL),
('support','applicants.export',    0, NULL),
('support','documents.upload',     1, NULL),
('support','documents.delete',     0, NULL),
('support','countries.view',       1, NULL),
('support','countries.manage',     0, NULL),
('support','reports.view',         0, NULL),
('support','reports.export',       0, NULL),
('support','messages.view',        1, NULL),
('support','messages.reply',       1, NULL),
('support','messages.delete',      0, NULL),
('support','training.view',        1, NULL),
('support','training.manage',      0, NULL),
('support','settings.view',        0, NULL),
('support','settings.edit',        0, NULL),
('support','admins.view',          0, NULL),
('support','admins.invite',        0, NULL),
('support','audit_log.view',       0, NULL),

-- ── VIEWER ────────────────────────────────────────────────────────────────────
('viewer','dashboard.view',       1, NULL),
('viewer','dashboard.stats',      1, 'Read-only summary'),
('viewer','applicants.view',      1, NULL),
('viewer','applicants.create',    0, NULL),
('viewer','applicants.edit',      0, NULL),
('viewer','applicants.delete',    0, NULL),
('viewer','applicants.status',    0, NULL),
('viewer','applicants.export',    0, NULL),
('viewer','documents.upload',     0, NULL),
('viewer','documents.delete',     0, NULL),
('viewer','countries.view',       1, NULL),
('viewer','countries.manage',     0, NULL),
('viewer','reports.view',         1, 'Basic statistics only'),
('viewer','reports.export',       0, NULL),
('viewer','messages.view',        0, NULL),
('viewer','messages.reply',       0, NULL),
('viewer','messages.delete',      0, NULL),
('viewer','training.view',        1, NULL),
('viewer','training.manage',      0, NULL),
('viewer','settings.view',        0, NULL),
('viewer','settings.edit',        0, NULL),
('viewer','admins.view',          0, NULL),
('viewer','admins.invite',        0, NULL),
('viewer','audit_log.view',       0, NULL);

-- =============================================================================
-- LOCKOUT SCHEDULE (reference — enforced in application layer)
-- =============================================================================
-- Attempt 1–3:  No lockout     (normal tolerance)
-- Attempt 4:    Lock 5 minutes
-- Attempt 5:    Lock 15 minutes
-- Attempt 6:    Lock 30 minutes
-- Attempt 7+:   Lock 60 minutes; alert sent to SUPER_ADMIN
-- Manual unlock by SUPER_ADMIN clears failed_login_attempts and locked_until
-- =============================================================================

-- =============================================================================
-- INDEXES FOR COMMON AUTH QUERIES
-- =============================================================================

-- Login query: WHERE email = ? AND status = 'active'
-- Already covered by uq_admins_email + idx_admins_status

-- Lockout check: WHERE id = ? AND locked_until > NOW()
-- Covered by idx_admins_locked (single row lookup after PK, negligible cost)

-- Session blacklist check: WHERE token_hash = ? AND is_revoked = 0
-- Covered by uq_sess_token (unique lookup) + idx_sess_revoked

-- Password reset: WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
-- Covered by uq_prt_token + idx_prt_expires

-- =============================================================================
-- END OF AUTH SCHEMA
-- =============================================================================