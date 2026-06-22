'use strict';

const { query } = require('../config/db');

class Application {

  // ═══════════════════════════════════════════════════════════════
  // USER SIDE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Insert one application row.
   *
   * n() is used ONLY for fields the controller might legitimately pass
   * as null (user_id from JWT, optional file paths).
   * Required text/date/select fields are passed through as-is — the
   * controller has already validated they are present and trimmed.
   *
   * Total params: 37 (?) + 2 literals ('pending', NOW()) = 39 values.
   */
  static async create(data) {
    const sql = `
      INSERT INTO applications (
        user_id,

        -- Personal identity
        first_name, middle_name, last_name,
        dob, birth_place, age, height, weight,
        marital_status, religion, nationality,

        -- Application details
        application_number, post_applied, contract_period, monthly_salary, education, country,

        -- Passport
        passport_number, issue_place, passport_issue_date, passport_expiry,

        -- Experience (structured only — no computed combined string)
        experience_period, experience_country,

        -- Languages
        lang_english, lang_arabic, lang_french,

        -- Job skills
        skill_care_elderly, skill_babysitter, skill_cleaning, skill_cooking,

        -- Contact (single name per concept — no phone_or_email / message aliases)
        phone, family_phone, note,

        -- Uploaded files
        portrait_path, passport_path, idcard_path,

        status, created_at
      )
      VALUES (
        ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        'pending', NOW()
      )
    `;

    // ?? null: only on fields that are explicitly optional or come from
    //          an external source (JWT). All required fields are plain.
    const params = [
      data.user_id ?? null,        //  1  from JWT — may legitimately be absent

      data.first_name,             //  2
      data.middle_name,            //  3
      data.last_name,              //  4
      data.dob,                    //  5
      data.birth_place,            //  6
      data.age,                    //  7
      data.height,                 //  8
      data.weight,                 //  9
      data.marital_status,         // 10
      data.religion,               // 11
      data.nationality,            // 12

      data.application_number,     // 13
      data.post_applied,           // 14
      data.contract_period,        // 15
      data.monthly_salary,         // 16
      data.education,              // 17
      data.country,                // 18

      data.passport_number,        // 19
      data.issue_place,            // 20
      data.passport_issue_date,    // 21
      data.passport_expiry,        // 22

      data.experience_period,      // 23
      data.experience_country,     // 24

      data.lang_english,           // 25  always 'Yes'|'No' from controller
      data.lang_arabic,            // 26
      data.lang_french,            // 27

      data.skill_care_elderly,     // 28
      data.skill_babysitter,       // 29
      data.skill_cleaning,         // 30
      data.skill_cooking,          // 31

      data.phone,                  // 32
      data.family_phone,           // 33
      data.note,                   // 34

      data.portrait_path ?? null,  // 35  required upload but null-safe
      data.passport_path ?? null,  // 36  required upload but null-safe
      data.idcard_path   ?? null,  // 37  optional upload
    ];

    return await query(sql, params);
  }

  static async findByUser(userId) {
    return await query(
      `SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
  }

  static async getStats(userId) {
    return await query(
      `SELECT status, COUNT(*) AS count FROM applications WHERE user_id = ? GROUP BY status`,
      [userId]
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN SIDE
  // ═══════════════════════════════════════════════════════════════

  static async findAll() {
    return await query(`SELECT * FROM applications ORDER BY created_at DESC`);
  }

  static async findById(id) {
    const rows = await query(`SELECT * FROM applications WHERE id = ?`, [id]);
    return rows[0] || null;
  }

  static async updateStatus(id, status) {
    await query(`UPDATE applications SET status = ? WHERE id = ?`, [status, id]);
    return this.findById(id);
  }

  static async delete(id) {
    return await query(`DELETE FROM applications WHERE id = ?`, [id]);
  }
  static async updateAssignment(id, fields) {
  const allowed = ['application_number','post_applied','contract_period','monthly_salary','education','country'];
  const keys = Object.keys(fields).filter(k => allowed.includes(k) && fields[k] !== undefined);
  if (!keys.length) return this.findById(id);
  const sql = `UPDATE applications SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
  await query(sql, [...keys.map(k => fields[k]), id]);
  return this.findById(id);
}

static async linkApplicant(applicationId, applicantId) {
  await query(`UPDATE applications SET applicant_id = ? WHERE id = ?`, [applicantId, applicationId]);
}
}

module.exports = Application;