<!-- ═══════════════════════════════════════════════════════
     SCRIPTS
════════════════════════════════════════════════════════ -->
<script>
/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
function txt(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = (val !== undefined && val !== null && String(val).trim() !== '')
    ? String(val)
    : '—';
}

function setImg(wrapId, src, alt) {
  const wrap = document.getElementById(wrapId);
  if (!wrap || !src || src.length < 20) return;
  wrap.innerHTML = '';
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt || '';
  img.style.cssText = 'width:100%;height:175px;object-fit:cover;display:block;';
  img.onerror = function() { this.style.visibility = 'hidden'; };
  wrap.appendChild(img);
}

function skill(boxId, val) {
  const el = document.getElementById(boxId);
  if (!el) return;
  const yes = val === 'Yes' || val === 'yes' || val === true || val === 1;
  el.textContent = yes ? '✔' : '✘';
  el.className = 'sk-box ' + (yes ? 'yes' : 'no');
}

function showToast(msg, icon = 'fa-spinner fa-spin') {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.querySelector('i').className = 'fas ' + icon;
  t.classList.add('show');
}

function hideToast() {
  document.getElementById('toast').classList.remove('show');
}

/* ─────────────────────────────────────────────────────────
   LOAD APPLICANT DATA
   Priority: URL ?id= param → 'viewApplicant' key → last in list
───────────────────────────────────────────────────────── */
async function loadApplicant() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    console.error("No applicant ID in URL");
    populate(DEMO);
    return;
  }

  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`http://localhost:5000/api/applicants/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(data.message || "Failed to load applicant");
      populate(DEMO);
      return;
    }

    // adjust depending on your API structure
    const applicant = data.data || data.applicant || data;

    populate(applicant);

  } catch (err) {
    console.error("Error loading applicant:", err);
    populate(DEMO);
  }
}
/* ─────────────────────────────────────────────────────────
   POPULATE ALL FIELDS
───────────────────────────────────────────────────────── */
function populate(d) {
  // Full name
  const fullName = [d.first_name, d.middle_name, d.last_name]
    .filter(Boolean).join(' ').toUpperCase() || d.full_name || '—';
  txt('fullName', fullName);
  document.getElementById('barName').textContent = '— ' + fullName;

  // Header meta
  const appNo = d.application_number ? 'NO-' + d.application_number : (d.appId || null);
  txt('appId',    appNo);
  txt('position', d.post_applied);
  txt('salary',   d.monthly_salary);
  txt('contract', d.contract_period);

  // Personal
  txt('nationality', d.nationality);
  txt('religion',    d.religion);
  txt('dob',         d.dob);
  txt('birthPlace',  d.birth_place);
  txt('age',         d.age);
  txt('marital',     d.marital_status);
  txt('weight',      d.weight);
  txt('height',      d.height);
  txt('education',   d.education);

  // Passport
  txt('passport',   d.passport_number);
  txt('issuePlace', d.issue_place);
  txt('issueDate',  d.passport_issue_date);
  txt('expiry',     d.passport_expiry);

  // Languages
  txt('arabic',  d.arabic);
  txt('english', d.english);
  txt('french',  d.french);

  // Experience
  txt('expPeriod',  d.experience_period  || 'NO EXPERIENCE');
  txt('expCountry', d.experience_country || '—');

  // Contact
  txt('phone',       d.phone);
  txt('familyPhone', d.family_phone);
  txt('broker',      d.broker_name);
  txt('countryDest', d.country);

  // Skills
  skill('elderlyBox',    d.care_elderly);
  skill('babysitterBox', d.babysitter);
  skill('cleaningBox',   d.cleaning);
  skill('cookingBox',    d.cooking);

  // Note
  const noteEl = document.getElementById('noteText');
  if (noteEl) noteEl.textContent = (d.note && d.note.trim()) ? d.note : '—';

  // Portrait (right column)
  const portrait = d.portrait || d.portrait_photo;
  if (portrait) {
    const pImg = document.getElementById('portraitImg');
    if (pImg) pImg.src = portrait;
  }

  // Document photos (bottom grid)
  if (d.id_card)        setImg('idWrap',       d.id_card,        'ID Card');
  if (portrait)         setImg('portraitWrap',  portrait,         'Portrait');
  if (d.passport_photo) setImg('passportWrap',  d.passport_photo, 'Passport');

  // Page title
  document.title = 'CV — ' + fullName;
}

/* ─────────────────────────────────────────────────────────
   EXPORT: PDF via browser print
───────────────────────────────────────────────────────── */
// Triggered by "Download PDF" button → window.print()

/* ─────────────────────────────────────────────────────────
   EXPORT: PNG image via html2canvas
───────────────────────────────────────────────────────── */
function downloadImage() {
  const btn = document.getElementById('imgBtn');
  showToast('Generating image…', 'fa-spinner fa-spin');
  btn.disabled = true;

  const el   = document.getElementById('cvContent');
  const name = (document.getElementById('fullName')?.textContent || 'applicant')
                 .replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '');

  html2canvas(el, {
    scale: 2.5,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
    logging: false,
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = (name || 'applicant') + '_cv.png';
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
    hideToast();
  }).catch(err => {
    hideToast();
    alert('Image export failed. Try "Download PDF" instead.\n\n' + err.message);
  }).finally(() => {
    btn.disabled = false;
  });
}

/* ─────────────────────────────────────────────────────────
   SHARE: WhatsApp
───────────────────────────────────────────────────────── */
function shareWhatsApp() {
  const name    = document.getElementById('fullName')?.textContent  || '—';
  const pos     = document.getElementById('position')?.textContent  || '—';
  const country = document.getElementById('countryDest')?.textContent || '—';
  const appId   = document.getElementById('appId')?.textContent     || '—';

  const msg = encodeURIComponent(
    `📋 *Job Application — AL SEGER*\n` +
    `👤 *Name:* ${name}\n` +
    `💼 *Position:* ${pos}\n` +
    `🌍 *Destination:* ${country}\n` +
    `🔖 *Application:* ${appId}\n\n` +
    `_To see the full profile, contact AL SEGER Recruitment Agency._`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

/* ─────────────────────────────────────────────────────────
   APPROVE (stub — wire to your backend)
───────────────────────────────────────────────────────── */
function approveApplicant() {
  const name = document.getElementById('fullName')?.textContent || 'this applicant';
  if (confirm(`Approve ${name}?`)) {
    showToast('Approved!', 'fa-check-circle');
    setTimeout(hideToast, 2500);
    // TODO: POST to your backend here
  }
}

/* ─────────────────────────────────────────────────────────
   DEMO DATA  (shown when no localStorage data found)
───────────────────────────────────────────────────────── */
const DEMO = {
  first_name: 'Fatuma', middle_name: 'Ali', last_name: 'Hassan',
  application_number: '0001',
  post_applied: 'House Maid',
  monthly_salary: '1000 SAR',
  contract_period: '2 Years',
  nationality: 'Ethiopia',
  religion: 'Muslim',
  dob: '1998-03-25',
  birth_place: 'Addis Ababa',
  age: '26',
  marital_status: 'Single',
  weight: '55',
  height: '160',
  education: 'Grade 10',
  passport_number: 'EP-123456',
  issue_place: 'Ethiopia',
  passport_issue_date: '2022-01-10',
  passport_expiry: '2032-01-09',
  arabic: 'No', english: 'Yes', french: 'No',
  experience_period: 'No Experience',
  experience_country: '—',
  phone: '+251 912 345 678',
  family_phone: '+251 913 123 456',
  broker_name: 'Sample Broker',
  country: 'Saudi Arabia',
  care_elderly: 'Yes',
  babysitter: 'Yes',
  cleaning: 'Yes',
  cooking: 'No',
  note: 'Demo record — fill from your form to see real data.',
};

/* ─────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────── */
document.getElementById('genDate').textContent =
  'Generated: ' + new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

document.addEventListener('DOMContentLoaded', loadApplicant);
</script>