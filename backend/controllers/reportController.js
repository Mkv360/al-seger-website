/**
 * controllers/reportController.js
 * Recruitment metrics, dashboard stats, and data export.
 */

'use strict';

const Applicant = require('../models/Applicant');
const { query, queryOne } = require('../config/db');

// ── GET /api/reports/summary ──────────────────────────────────────────────────
async function summary(req, res, next) {
  try {
    const [stats, recent, unread] = await Promise.all([
      queryOne(`SELECT * FROM v_dashboard_stats`),
      query(
        `SELECT vs.id, vs.reference_number, vs.full_name, vs.status,
                vs.destination_country, vs.destination_flag, vs.applied_at
         FROM v_applicant_summary vs
         ORDER BY vs.applied_at DESC LIMIT 10`
      ),
      queryOne(`SELECT COUNT(*) AS count FROM messages WHERE is_read = 0`),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        stats,
        recent_applicants: recent,
        unread_messages: unread?.count || 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/reports/by-country ───────────────────────────────────────────────
async function byCountry(req, res, next) {
  try {
    const data = await Applicant.getCountryBreakdown();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/reports/by-status ────────────────────────────────────────────────
async function byStatus(req, res, next) {
  try {
    const data = await Applicant.getStatusCounts();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/reports/by-period ────────────────────────────────────────────────
async function byPeriod(req, res, next) {
  try {
    const months = Math.min(parseInt(req.query.months || '12', 10), 60);
    const data   = await Applicant.getMonthlyStats(months);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/reports/gender ───────────────────────────────────────────────────
async function byGender(req, res, next) {
  try {
    const data = await query(
      `SELECT gender, COUNT(*) AS count FROM applicants GROUP BY gender`
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/reports/education ────────────────────────────────────────────────
async function byEducation(req, res, next) {
  try {
    const data = await query(
      `SELECT education, COUNT(*) AS count FROM applicants GROUP BY education ORDER BY count DESC`
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/reports/export ───────────────────────────────────────────────────
async function exportCsv(req, res, next) {
  try {
    const { status, country, from_date, to_date } = req.query;

    const conditions = [];
    const params     = [];

    if (status)    { conditions.push('a.status = ?');                    params.push(status);    }
    if (country)   { conditions.push('a.destination_country_id = ?');    params.push(country);   }
    if (from_date) { conditions.push('DATE(a.applied_at) >= ?');         params.push(from_date); }
    if (to_date)   { conditions.push('DATE(a.applied_at) <= ?');         params.push(to_date);   }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query(
      `SELECT
         a.reference_number, a.first_name, a.last_name, a.email, a.phone,
         a.date_of_birth, a.gender, a.nationality, a.passport_number,
         a.education, a.experience_years, a.languages,
         a.status, a.applied_at, a.processed_at,
         dc.name AS destination_country,
         oc.name AS origin_country
       FROM applicants a
       LEFT JOIN countries dc ON a.destination_country_id = dc.id
       LEFT JOIN countries oc ON a.origin_country_id = oc.id
       ${where}
       ORDER BY a.applied_at DESC`,
      params
    );

    const headers = [
      'Reference', 'First Name', 'Last Name', 'Email', 'Phone',
      'Date of Birth', 'Gender', 'Nationality', 'Passport No.',
      'Education', 'Exp. Years', 'Languages',
      'Status', 'Applied At', 'Processed At',
      'Destination Country', 'Origin Country',
    ];

    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str}"`
        : str;
    };

    const csvRows = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.reference_number, r.first_name, r.last_name, r.email, r.phone,
          r.date_of_birth, r.gender, r.nationality, r.passport_number,
          r.education, r.experience_years, r.languages,
          r.status, r.applied_at, r.processed_at,
          r.destination_country, r.origin_country,
        ]
          .map(escape)
          .join(',')
      ),
    ];

    const filename = `alseger-export-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csvRows.join('\r\n')); // BOM for Excel UTF-8
  } catch (err) {
    next(err);
  }
}

// ── GET /api/reports/activity ─────────────────────────────────────────────────
async function activityLog(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      query(
        `SELECT al.id, al.action, al.entity_type, al.entity_id,
                al.details, al.ip_address, al.created_at,
                adm.name AS admin_name
         FROM activity_log al
         LEFT JOIN admins adm ON al.admin_id = adm.id
         ORDER BY al.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      ),
      queryOne(`SELECT COUNT(*) AS total FROM activity_log`),
    ]);

    return res.status(200).json({
      success: true,
      data:  rows,
      total: total?.total || 0,
      page, limit,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { summary, byCountry, byStatus, byPeriod, byGender, byEducation, exportCsv, activityLog };