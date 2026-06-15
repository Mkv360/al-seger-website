/**
 * config/permissions.js
 *
 * RBAC — Single source of truth for role-based access control.
 *
 * This file is the only place permissions are defined.
 * Both the middleware (authorize.js) and the frontend (auth.js) derive
 * their access rules from this structure.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ROLES (in descending privilege):
 *
 *   super_admin  —  Unrestricted. Manages all admins, can read the audit log,
 *                   force-revoke sessions, and change any security setting.
 *                   Created exclusively via CLI seeder; not invitable.
 *
 *   admin        —  Full applicant and country lifecycle management.
 *                   Can invite support/viewer roles. Cannot see admin list
 *                   or audit log. Limited settings access.
 *
 *   manager      —  Approves/rejects applicants, exports reports, manages
 *                   messages and training. Cannot delete or manage admins.
 *
 *   editor       —  Creates and edits applicant records and uploads documents.
 *                   Cannot change status, export, access reports or messages.
 *
 *   support      —  Read applicants, update contact info, manage messages.
 *                   No creation, deletion, or reporting access.
 *
 *   viewer       —  Read-only across applicants, countries, and training.
 *                   Basic dashboard stats. No write access anywhere.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Role constants ─────────────────────────────────────────────────────────────

const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN:       'admin',
  MANAGER:     'manager',
  EDITOR:      'editor',
  SUPPORT:     'support',
  VIEWER:      'viewer',
});

// Ordered from highest to lowest privilege (used for role comparisons)
const ROLE_HIERARCHY = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.EDITOR,
  ROLES.SUPPORT,
  ROLES.VIEWER,
];

// ── Permission constants ───────────────────────────────────────────────────────
// Format: DOMAIN.ACTION
// Use these constants everywhere — never raw strings — to avoid typos.

const P = Object.freeze({
  // Dashboard
  DASHBOARD_VIEW:          'dashboard.view',
  DASHBOARD_STATS:         'dashboard.stats',

  // Applicants
  APPLICANTS_VIEW:         'applicants.view',
  APPLICANTS_CREATE:       'applicants.create',
  APPLICANTS_EDIT:         'applicants.edit',
  APPLICANTS_DELETE:       'applicants.delete',
  APPLICANTS_STATUS:       'applicants.status',
  APPLICANTS_EXPORT:       'applicants.export',

  // Documents
  DOCUMENTS_UPLOAD:        'documents.upload',
  DOCUMENTS_DELETE:        'documents.delete',

  // Countries
  COUNTRIES_VIEW:          'countries.view',
  COUNTRIES_MANAGE:        'countries.manage',

  // Reports
  REPORTS_VIEW:            'reports.view',
  REPORTS_EXPORT:          'reports.export',

  // Messages
  MESSAGES_VIEW:           'messages.view',
  MESSAGES_REPLY:          'messages.reply',
  MESSAGES_DELETE:         'messages.delete',

  // Training materials
  TRAINING_VIEW:           'training.view',
  TRAINING_MANAGE:         'training.manage',

  // System settings
  SETTINGS_VIEW:           'settings.view',
  SETTINGS_EDIT:           'settings.edit',

  // Admin management (super_admin + limited admin)
  ADMINS_VIEW:             'admins.view',
  ADMINS_CREATE:           'admins.create',
  ADMINS_EDIT:             'admins.edit',
  ADMINS_DELETE:           'admins.delete',
  ADMINS_INVITE:           'admins.invite',
  ADMINS_LOCK:             'admins.lock',
  ADMINS_ROLE_CHANGE:      'admins.role_change',
  ADMINS_FORCE_LOGOUT:     'admins.force_logout',

  // Security
  AUDIT_LOG_VIEW:          'audit_log.view',
  SESSIONS_REVOKE:         'sessions.revoke',
});

// ── Role → Permission map ──────────────────────────────────────────────────────

const ROLE_PERMISSIONS = Object.freeze({

  [ROLES.SUPER_ADMIN]: Object.values(P), // All permissions

  [ROLES.ADMIN]: [
    P.DASHBOARD_VIEW,    P.DASHBOARD_STATS,
    P.APPLICANTS_VIEW,   P.APPLICANTS_CREATE, P.APPLICANTS_EDIT,
    P.APPLICANTS_DELETE, P.APPLICANTS_STATUS, P.APPLICANTS_EXPORT,
    P.DOCUMENTS_UPLOAD,  P.DOCUMENTS_DELETE,
    P.COUNTRIES_VIEW,    P.COUNTRIES_MANAGE,
    P.REPORTS_VIEW,      P.REPORTS_EXPORT,
    P.MESSAGES_VIEW,     P.MESSAGES_REPLY,
    P.TRAINING_VIEW,     P.TRAINING_MANAGE,
    P.SETTINGS_VIEW,     P.SETTINGS_EDIT,
    P.ADMINS_INVITE,     // Can only invite support/viewer (enforced in controller)
  ],

  [ROLES.MANAGER]: [
    P.DASHBOARD_VIEW,    P.DASHBOARD_STATS,
    P.APPLICANTS_VIEW,   P.APPLICANTS_CREATE, P.APPLICANTS_EDIT,
    P.APPLICANTS_STATUS, P.APPLICANTS_EXPORT,
    P.DOCUMENTS_UPLOAD,
    P.COUNTRIES_VIEW,
    P.REPORTS_VIEW,      P.REPORTS_EXPORT,
    P.MESSAGES_VIEW,     P.MESSAGES_REPLY,
    P.TRAINING_VIEW,     P.TRAINING_MANAGE,
  ],

  [ROLES.EDITOR]: [
    P.DASHBOARD_VIEW,    P.DASHBOARD_STATS,
    P.APPLICANTS_VIEW,   P.APPLICANTS_CREATE, P.APPLICANTS_EDIT,
    P.DOCUMENTS_UPLOAD,
    P.COUNTRIES_VIEW,
    P.TRAINING_VIEW,
  ],

  [ROLES.SUPPORT]: [
    P.DASHBOARD_VIEW,    P.DASHBOARD_STATS,
    P.APPLICANTS_VIEW,   P.APPLICANTS_EDIT,  // Edit limited to contact fields
    P.DOCUMENTS_UPLOAD,
    P.COUNTRIES_VIEW,
    P.MESSAGES_VIEW,     P.MESSAGES_REPLY,
    P.TRAINING_VIEW,
  ],

  [ROLES.VIEWER]: [
    P.DASHBOARD_VIEW,    P.DASHBOARD_STATS,
    P.APPLICANTS_VIEW,
    P.COUNTRIES_VIEW,
    P.REPORTS_VIEW,      // Basic stats only
    P.TRAINING_VIEW,
  ],

});

// ── Page access map ───────────────────────────────────────────────────────────
// Maps frontend page paths to the permission required to access them.
// Used by the auth.js client to guard page loads and hide sidebar links.

const PAGE_PERMISSIONS = Object.freeze({
  'dashboard.html':       P.DASHBOARD_VIEW,
  'applicants.html':      P.APPLICANTS_VIEW,
  'applicant-view.html':  P.APPLICANTS_VIEW,
  'countries.html':       P.COUNTRIES_VIEW,
  'reports.html':         P.REPORTS_VIEW,
  'messages.html':        P.MESSAGES_VIEW,
  'training.html':        P.TRAINING_VIEW,
  'settings.html':        P.SETTINGS_VIEW,
  'admins.html':          P.ADMINS_VIEW,
  'audit-log.html':       P.AUDIT_LOG_VIEW,
});

// ── Roles that can be INVITED (not bootstrap) ──────────────────────────────────
// super_admin can only be created via CLI seeder.
// admin can invite support/viewer; super_admin can invite any.

const INVITABLE_ROLES_BY_ROLE = Object.freeze({
  [ROLES.SUPER_ADMIN]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.EDITOR, ROLES.SUPPORT, ROLES.VIEWER],
  [ROLES.ADMIN]:       [ROLES.SUPPORT, ROLES.VIEWER],
  [ROLES.MANAGER]:     [],
  [ROLES.EDITOR]:      [],
  [ROLES.SUPPORT]:     [],
  [ROLES.VIEWER]:      [],
});

// ── Helper functions ───────────────────────────────────────────────────────────

/**
 * Returns true if the given role has the given permission.
 * @param {string} role       - One of the ROLES values
 * @param {string} permission - One of the P values
 */
function hasPermission(role, permission) {
  if (!role || !permission) return false;
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

/**
 * Returns all permissions for a role.
 * @param {string} role
 * @returns {string[]}
 */
function getPermissions(role) {
  return [...(ROLE_PERMISSIONS[role] || [])];
}

/**
 * Returns true if roleA has higher privilege than roleB.
 */
function isHigherRole(roleA, roleB) {
  return ROLE_HIERARCHY.indexOf(roleA) < ROLE_HIERARCHY.indexOf(roleB);
}

/**
 * Returns roles that the given actor can assign to others.
 */
function getInvitableRoles(actorRole) {
  return INVITABLE_ROLES_BY_ROLE[actorRole] || [];
}

/**
 * Returns the page permission requirement for a given page filename.
 * @param {string} pageName  e.g. 'applicants.html'
 */
function getPagePermission(pageName) {
  return PAGE_PERMISSIONS[pageName] || null;
}

/**
 * Returns a serialisable permissions object for embedding in the JWT payload
 * or sending to the frontend. Avoids re-querying the DB per request.
 * @param {string} role
 */
function buildPermissionsPayload(role) {
  const perms = getPermissions(role);
  return perms.reduce((acc, p) => {
    acc[p] = true;
    return acc;
  }, {});
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  P,
  ROLE_PERMISSIONS,
  PAGE_PERMISSIONS,
  INVITABLE_ROLES_BY_ROLE,
  hasPermission,
  getPermissions,
  isHigherRole,
  getInvitableRoles,
  getPagePermission,
  buildPermissionsPayload,
};