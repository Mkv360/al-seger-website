/**
 * applicant-view.js
 * Al-Seger Recruitment Management System
 *
 * Loads a single applicant by ID from the backend API and renders the CV page.
 * localStorage is used for the auth token ONLY — never for applicant data.
 *
 * URL format expected: /view.html?id=123
 * API called:          GET /api/applicants/:id
 */

'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   CONFIG
   Change API_BASE to your production URL when deploying.
───────────────────────────────────────────────────────────────────────────── */
const API_BASE = 'http://localhost:5000';


/* ─────────────────────────────────────────────────────────────────────────────
   DOM HELPERS  (unchanged from original — UI must stay the same)
───────────────────────────────────────────────────────────────────────────── */

/** Write plain text into an element; shows "—" when value is empty. */
function txt(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = (val !== null && val !== undefined && val !== '') ? String(val) : '—';
}

/** Replace a document-card container with a real <img>. */
function setImg(wrapId, src) {
  const wrap = document.getElementById(wrapId);
  if (!wrap || !src) return;
  wrap.innerHTML = `<img src="${src}" style="width:100%;height:175px;object-fit:cover;" crossorigin="anonymous">`;
}

/** Toggle a skill box between ✔ (yes) and ✘ (no). */
function skill(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  // Accept: true | 1 | "1" | "Yes" | "yes"
  const yes = val === true || val === 1 || val === '1'
    || (typeof val === 'string' && val.toLowerCase() === 'yes');
  el.textContent  = yes ? '✔' : '✘';
  el.className    = 'sk-box ' + (yes ? 'yes' : 'no');
}

/** Show a full-page error message instead of a broken CV. */
function showError(message) {
  const page = document.querySelector('.cv-page');
  if (!page) return;
  page.innerHTML = `
    <div style="
      padding: 56px 32px;
      text-align: center;
      font-family: 'DM Sans', sans-serif;
    ">
      <div style="font-size: 40px; margin-bottom: 16px;">⚠</div>
      <h2 style="color: #dc2626; font-size: 20px; margin-bottom: 12px;">
        Failed to load applicant
      </h2>
      <p style="color: #6b7280; font-size: 14px;">${message}</p>
      <button
        onclick="history.back()"
        style="
          margin-top: 24px;
          padding: 9px 20px;
          background: #0c2d5a;
          color: #fff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        "
      >← Go Back</button>
    </div>
  `;
}


/* ─────────────────────────────────────────────────────────────────────────────
   API CALL
───────────────────────────────────────────────────────────────────────────── */

/**
 * Fetch one applicant from the backend.
 * The auth token is read from localStorage (token only — not data).
 *
 * @param {number|string} id
 * @returns {Promise<Object>} raw applicant object (with .documents array)
 * @throws {Error} on HTTP error or { success: false } response
 */
async function fetchApplicant(id) {
  const token = localStorage.getItem('token');

  const res = await fetch(`${API_BASE}/api/applicants/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // If the server returns 401/403, redirect to login so the user isn't stuck.
  if (res.status === 401 || res.status === 403) {
    window.location.href = '/login.html';
    return;
  }

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || `Server returned ${res.status}`);
  }

  return json.data;
}


/* ─────────────────────────────────────────────────────────────────────────────
   DATA NORMALISATION
   Maps backend field names → what populate() expects.
   Never fails: every field falls back to null so the UI shows "—".
───────────────────────────────────────────────────────────────────────────── */

/**
 * Extract a document URL from the documents array by its type.
 * Types in the backend: 'portrait' | 'passport' | 'idcard'
 *
 * @param {Array} docs
 * @param {string} type
 * @returns {string|null}
 */
function docUrl(docs, type) {
  if (!Array.isArray(docs)) return null;
  return docs.find(d => d.document_type === type)?.url ?? null;
}

/**
 * Compute age from a date string (YYYY-MM-DD or any Date-parseable format).
 * Returns null if the date is invalid.
 *
 * @param {string} dateStr
 * @returns {number|null}
 */
function computeAge(dateStr) {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  if (isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age > 0 ? age : null;
}

/**
 * Normalise the raw API response into the shape populate() expects.
 *
 * Key mappings:
 *   date_of_birth       → dob          (validator uses date_of_birth; DB may store as dob)
 *   reference_number    → application_number  (controller uses reference_number in logs)
 *   destination_country → country       (joined name, if your model returns it)
 *   documents[]         → id_card / portrait_photo / passport_photo  (flat URLs)
 *
 * @param {Object} d  Raw applicant from API
 * @returns {Object}  Normalised applicant ready for populate()
 */
function normalise(d) {
  // Resolve DOB — DB column may be called either way
  const dob = d.dob || d.date_of_birth || null;

  return {
    // Spread all original fields first so nothing is lost
    ...d,

    // ── Identity ─────────────────────────────────────────────────────────────
    application_number: d.application_number || d.reference_number || null,

    // ── Date of birth + computed age ─────────────────────────────────────────
    dob,
    age: d.age ?? computeAge(dob),

    // ── Destination country ──────────────────────────────────────────────────
    // Your model may JOIN and return destination_country (name string) or
    // country_name. Fall back through the likely column names.
    country:
      d.country                ||
      d.destination_country    ||
      d.country_name           ||
      null,

    // ── Document URLs (extracted from the documents[] array) ─────────────────
    // The controller maps documents → { document_type, url, … }
    portrait:       docUrl(d.documents, 'portrait'),
    portrait_photo: docUrl(d.documents, 'portrait'),
    passport_photo: docUrl(d.documents, 'passport'),
    id_card:        docUrl(d.documents, 'idcard'),
  };
}


/* ─────────────────────────────────────────────────────────────────────────────
   POPULATE UI
   Fills every element in applicant-view.html with real data.
   All element IDs match the HTML exactly — no structural changes.
───────────────────────────────────────────────────────────────────────────── */

function populate(d) {
  // Full name for the name band and browser tab
  const fullName = [d.first_name, d.middle_name, d.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  txt('fullName', fullName);

  const barName = document.getElementById('barName');
  if (barName) barName.textContent = fullName ? `— ${fullName}` : '';

  document.title = fullName ? `CV — ${fullName}` : 'Applicant CV — AL SEGER';

  // ── Header meta ────────────────────────────────────────────────────────────
  txt('appId',    d.application_number);
  txt('position', d.post_applied);
  txt('salary',   d.monthly_salary);
  txt('contract', d.contract_period);

  // ── Personal details ────────────────────────────────────────────────────────
  txt('nationality', d.nationality);
  txt('religion',    d.religion);
  txt('dob',         d.dob);
  txt('birthPlace',  d.birth_place);
  txt('age',         d.age);
  txt('marital',     d.marital_status);
  txt('weight',      d.weight);
  txt('height',      d.height);
  txt('education',   d.education);

  // ── Passport ───────────────────────────────────────────────────────────────
  txt('passport',   d.passport_number);
  txt('issuePlace', d.issue_place);
  txt('issueDate',  d.passport_issue_date);
  txt('expiry',     d.passport_expiry);

  // ── Languages ──────────────────────────────────────────────────────────────
  txt('arabic',  d.arabic);
  txt('english', d.english);
  txt('french',  d.french);

  // ── Experience ─────────────────────────────────────────────────────────────
  txt('expPeriod',  d.experience_period);
  txt('expCountry', d.experience_country);

  // ── Contact & destination ──────────────────────────────────────────────────
  txt('phone',       d.phone);
  txt('familyPhone', d.family_phone);
  txt('broker',      d.broker_name);
  txt('countryDest', d.country);

  // ── Skills ─────────────────────────────────────────────────────────────────
  skill('elderlyBox',    d.care_elderly);
  skill('babysitterBox', d.babysitter);
  skill('cleaningBox',   d.cleaning);
  skill('cookingBox',    d.cooking);

  // ── Note ───────────────────────────────────────────────────────────────────
  const noteEl = document.getElementById('noteText');
  if (noteEl) noteEl.textContent = d.note || '—';

  // ── Portrait photo (top-right in body) ─────────────────────────────────────
  const portraitImg = document.getElementById('portraitImg');
  if (portraitImg && d.portrait) {
    portraitImg.src = d.portrait;
    portraitImg.onerror = () => { portraitImg.style.visibility = 'hidden'; };
  }

  // ── Document cards (bottom section) ────────────────────────────────────────
  setImg('idWrap',       d.id_card);
  setImg('portraitWrap', d.portrait_photo);
  setImg('passportWrap', d.passport_photo);

  // ── Footer generation date ─────────────────────────────────────────────────
  const genDate = document.getElementById('genDate');
  if (genDate) {
    genDate.textContent = 'Generated: ' + new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }
}


/* ─────────────────────────────────────────────────────────────────────────────
   MAIN LOADER
───────────────────────────────────────────────────────────────────────────── */

async function loadApplicant() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');

  if (!id || isNaN(Number(id))) {
    showError(
      'No valid applicant ID in the URL.<br>' +
      '<small>Expected format: <code>/view.html?id=123</code></small>'
    );
    return;
  }

  try {
    const raw  = await fetchApplicant(id);
    const data = normalise(raw);
    populate(data);
  } catch (err) {
    console.error('[applicant-view] load failed:', err);
    showError(err.message || 'An unexpected error occurred.');
  }
}


/* ─────────────────────────────────────────────────────────────────────────────
   ACTION BUTTONS
───────────────────────────────────────────────────────────────────────────── */

/** Save the full CV card as a PNG image. Requires html2canvas (loaded in HTML). */
function downloadImage() {
  const el = document.getElementById('cvContent');
  if (!el) return;

  if (typeof html2canvas === 'undefined') {
    alert('html2canvas library is not loaded. Check your <script> tag in the HTML.');
    return;
  }

  html2canvas(el, {
    scale:           2,
    useCORS:         true,
    backgroundColor: '#fff',
    logging:         false,
  }).then(canvas => {
    const name = document.getElementById('fullName')?.textContent?.trim() || 'applicant';
    const a    = document.createElement('a');
    a.download = `${name.replace(/\s+/g, '-')}.png`;
    a.href     = canvas.toDataURL('image/png');
    a.click();
  }).catch(err => {
    console.error('Image export failed:', err);
    alert('Image export failed. Check browser console for details.');
  });
}

/** Open WhatsApp share with a brief applicant summary. */
function shareWhatsApp() {
  const name = document.getElementById('fullName')?.textContent?.trim() || '';
  const pos  = document.getElementById('position')?.textContent?.trim()  || '';
  const id   = new URLSearchParams(window.location.search).get('id')    || '';

  const text = [
    `*Applicant Profile — AL SEGER*`,
    `Name:     ${name}`,
    `Position: ${pos}`,
    id ? `Ref:      #${id}` : '',
  ].filter(Boolean).join('\n');

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

/**
 * Approve the applicant by calling PATCH /api/applicants/:id/status.
 * Replaces the original placeholder alert().
 */
async function approveApplicant() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');

  if (!id) {
    alert('Cannot approve: applicant ID not found in URL.');
    return;
  }

  if (!confirm('Mark this applicant as Approved?')) return;

  const token = localStorage.getItem('token');

  try {
    const res = await fetch(`${API_BASE}/api/applicants/${id}/status`, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status: 'approved' }),
    });

    const json = await res.json();

    if (json.success) {
      alert(`✔ Applicant approved successfully.`);
    } else {
      alert(`Failed to approve: ${json.message || 'Unknown error'}`);
    }
  } catch (err) {
    console.error('[approveApplicant] error:', err);
    alert(`Network error: ${err.message}`);
  }
}


/* ─────────────────────────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', loadApplicant);