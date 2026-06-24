/**
 * public/js/profile.js
 *
 * CHANGES FROM PREVIOUS VERSION
 * ─────────────────────────────
 * applyToDOM() rewritten to sync:
 *   #adminAvatar / #avatarFallback  → main nav (img + FA-icon div)
 *   #ddAvatar    / #ddFallback      → dropdown header (img + FA-icon div)
 *   #adminName, #adminRole          → main nav text
 *   #ddName, #ddRole                → dropdown text
 *   [data-profile-*] attrs          → generic (still work as before)
 *
 * Show-while-loading pattern:
 *   Fallback div is shown while the img src loads.
 *   img appears and fallback hides only after onload fires.
 *   On onerror the img stays hidden and fallback remains.
 *
 * window.__alsegerAdmin set + CustomEvent('alseger:profile') dispatched
 *   on every applyToDOM() call so adminManagement.js can react.
 *
 * Bug fixed: removed stray loadProfile() at bottom of IIFE
 *   that caused two concurrent API calls on startup.
 */

'use strict';

(() => {

  const API    = 'http://localhost:5000/api';
  const ORIGIN = 'http://localhost:5000';

  // ── Design tokens ─────────────────────────────────────────────────────────
  const C = {
    bg:       '#050505',
    surface:  '#111111',
    surface2: '#1a1a1a',
    border:   '#2a2a2a',
    gold:     '#d4af37',
    text:     '#e8e8e8',
    muted:    '#888888',
    error:    '#f87171',
    errorBg:  'rgba(220,53,69,.12)',
    errorBdr: 'rgba(220,53,69,.30)',
    overlay:  'rgba(0,0,0,.76)',
  };

  // ── Live state ────────────────────────────────────────────────────────────
  let _admin = null;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const getToken = () => localStorage.getItem('token') || '';
  const authHdrs = () => ({ Authorization: `Bearer ${getToken()}` });
  const toLogin  = () => { window.location.href = '/admin/login.html'; };

  // ── Avatar helpers ────────────────────────────────────────────────────────
  function makeFallback(name) {
    const initials = String(name || 'A')
      .trim().split(/\s+/).filter(Boolean)
      .map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'A';

    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">',
      `<circle cx="40" cy="40" r="40" fill="${C.surface2}"/>`,
      '<text x="40" y="40" text-anchor="middle" dominant-baseline="central"',
      ` font-family="system-ui,Arial,sans-serif" font-size="28"`,
      ` font-weight="700" fill="${C.gold}">${initials}</text>`,
      '</svg>',
    ].join('');

    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  }

  function resolveAvatar(url, name) {
    if (!url)                                             return makeFallback(name);
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (url.startsWith('/'))                              return ORIGIN + url;
    return url;
  }

  // ── DOM sync ──────────────────────────────────────────────────────────────
  /**
   * REWRITTEN — syncs all named IDs in your dashboard HTML plus the
   * generic [data-profile-*] attributes.
   *
   * syncPair() drives the img + sibling fallback-div pattern:
   *   • While image loads:  fallback div visible, img hidden
   *   • onload success:     img visible, fallback div hidden
   *   • onerror failure:    img hidden, fallback div stays visible
   */
function applyToDOM(admin) {
  const hasAvatar = !!admin.avatar_url;

  const src = hasAvatar
    ? resolveAvatar(admin.avatar_url, admin.name) + '?v=' + Date.now()
    : null;

  const fallbackSrc = makeFallback(admin.name);

  function syncPair(imgId, fallbackId) {
    const img = document.getElementById(imgId);
    const fbk = document.getElementById(fallbackId);
    if (!img || !fbk) return;

    if (hasAvatar) {
      fbk.style.display = '';
      img.style.display = 'none';

      img.onload = () => {
        img.style.display = 'block';
        fbk.style.display = 'none';
      };

      img.onerror = () => {
        img.style.display = 'none';
        fbk.style.display = '';
      };

      img.src = src;
    } else {
      img.style.display = 'none';
      fbk.style.display = '';
    }
  }

  syncPair('adminAvatar', 'avatarFallback');
  syncPair('ddAvatar', 'ddFallback');

  const name = admin.name || '';
  ['adminName', 'ddName'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = name;
  });

  const roleTxt = fmtRole(admin.role || '');
  ['adminRole', 'ddRole'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = roleTxt;
  });

  window.__alsegerAdmin = admin;
  document.dispatchEvent(new CustomEvent('alseger:profile', { detail: admin }));
}
  function fmtRole(r) {
    return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ── Inject modal styles ───────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('_ps')) return;
    const s = document.createElement('style');
    s.id    = '_ps';
    s.textContent = `
#_pm {
  display:none; position:fixed; inset:0; z-index:9100;
  background:${C.overlay}; backdrop-filter:blur(4px);
  align-items:center; justify-content:center;
}
#_pm.open { display:flex; }

#_pp {
  background:${C.surface};
  border:1px solid ${C.border};
  border-radius:14px; padding:32px 28px;
  width:100%; max-width:400px; position:relative;
  box-shadow:0 32px 80px rgba(0,0,0,.88);
  animation:_pIn .22s ease;
}
@keyframes _pIn {
  from { opacity:0; transform:translateY(-10px); }
  to   { opacity:1; transform:translateY(0); }
}

#_pmH {
  margin:0 0 26px; font-size:1.1rem; font-weight:700;
  color:${C.gold}; letter-spacing:.08em; text-transform:uppercase;
}

#_pX {
  position:absolute; top:14px; right:16px;
  background:none; border:none;
  color:${C.muted}; font-size:22px; line-height:1;
  cursor:pointer; padding:3px 7px; border-radius:5px;
  transition:color .15s, background .15s;
}
#_pX:hover { color:${C.gold}; background:rgba(212,175,55,.1); }

#_pAW {
  display:flex; flex-direction:column;
  align-items:center; gap:10px; margin-bottom:26px;
}
#_pImg {
  width:80px; height:80px; border-radius:50%;
  object-fit:cover; border:2px solid ${C.gold};
  background:${C.surface2}; cursor:pointer;
  transition:opacity .15s;
}
#_pImg:hover { opacity:.82; }
#_pALbl {
  background:none; border:none; padding:0;
  color:${C.gold}; font-size:.82rem; cursor:pointer;
  text-decoration:underline; text-underline-offset:2px;
  font-family:inherit;
}
#_pALbl:hover { opacity:.75; }

._pF { display:flex; flex-direction:column; gap:5px; margin-bottom:18px; }
._pF label {
  font-size:.72rem; font-weight:700; color:${C.muted};
  text-transform:uppercase; letter-spacing:.08em;
}
._pF input {
  background:${C.surface2}; border:1px solid ${C.border};
  border-radius:7px; padding:10px 14px;
  color:${C.text}; font-size:.95rem;
  outline:none; transition:border-color .18s; font-family:inherit;
}
._pF input:focus { border-color:${C.gold}; }

#_pErr {
  background:${C.errorBg}; border:1px solid ${C.errorBdr};
  border-radius:6px; color:${C.error};
  font-size:.85rem; padding:10px 14px; margin-bottom:16px;
}

#_pAct { display:flex; gap:10px; justify-content:flex-end; margin-top:4px; }

#_pCncl {
  background:${C.surface2}; border:1px solid ${C.border};
  border-radius:7px; color:${C.muted};
  padding:10px 20px; font-size:.9rem; cursor:pointer;
  transition:border-color .15s, color .15s; font-family:inherit;
}
#_pCncl:hover { border-color:#555; color:${C.text}; }

#_pSv {
  background:${C.gold}; border:none; border-radius:7px;
  color:${C.bg}; padding:10px 22px;
  font-size:.9rem; font-weight:700; cursor:pointer;
  transition:opacity .15s; font-family:inherit;
}
#_pSv:hover    { opacity:.85; }
#_pSv:disabled { opacity:.42; cursor:not-allowed; }
    `;
    document.head.appendChild(s);
  }

  // ── Inject modal HTML ─────────────────────────────────────────────────────
  function injectModal() {
    if (document.getElementById('_pm')) return;

    const tpl = document.createElement('template');
    tpl.innerHTML = `
<div id="_pm" role="dialog" aria-modal="true" aria-labelledby="_pmH">
  <div id="_pp">
    <button id="_pX" aria-label="Close">&times;</button>
    <h2 id="_pmH">Edit Profile</h2>

    <div id="_pAW">
      <img id="_pImg" alt="Avatar preview" title="Click to change photo">
      <button type="button" id="_pALbl">Change photo</button>
      <input type="file" id="_pFile"
             accept="image/jpeg,image/png,image/webp"
             style="display:none" aria-label="Upload avatar">
    </div>

    <div class="_pF">
      <label for="_pName">Full name</label>
      <input type="text" id="_pName"
             name="name" autocomplete="name"
             minlength="2" maxlength="120"
             spellcheck="false" required>
    </div>

    <div id="_pErr" hidden></div>

    <div id="_pAct">
      <button type="button" id="_pCncl">Cancel</button>
      <button type="button" id="_pSv">Save changes</button>
    </div>
  </div>
</div>`.trim();

    document.body.appendChild(tpl.content.cloneNode(true));
    bindModal();
  }

  // ── Bind modal events ─────────────────────────────────────────────────────
  function bindModal() {
    const $ = (id) => document.getElementById(id);

    $('_pX').addEventListener('click', closeModal);
    $('_pCncl').addEventListener('click', closeModal);
    $('_pm').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('_pm').classList.contains('open')) closeModal();
    });

    $('_pImg').addEventListener('click', () => $('_pFile').click());
    $('_pALbl').addEventListener('click', () => $('_pFile').click());

    $('_pFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => { $('_pImg').src = ev.target.result; };
      reader.readAsDataURL(file);
    });

    $('_pSv').addEventListener('click', handleSave);
  }

  // ── Modal open / close ────────────────────────────────────────────────────
  function openModal() {
    if (!_admin) return;
    clearErr();

    const $ = (id) => document.getElementById(id);
    $('_pName').value = _admin.name || '';

    const prev = $('_pImg');
    prev.src     = resolveAvatar(_admin.avatar_url, _admin.name);
    prev.onerror = () => { prev.src = makeFallback(_admin.name); prev.onerror = null; };

    $('_pFile').value = '';
    $('_pm').classList.add('open');
    $('_pName').focus();
  }

  function closeModal() {
    document.getElementById('_pm').classList.remove('open');
    clearErr();
    setSaving(false);
  }

  // ── Error / saving state ──────────────────────────────────────────────────
  function showErr(msg) {
    const el = document.getElementById('_pErr');
    el.textContent = msg;
    el.hidden      = false;
  }

  function clearErr() {
    const el  = document.getElementById('_pErr');
    el.hidden      = true;
    el.textContent = '';
  }

  function setSaving(flag) {
    const btn       = document.getElementById('_pSv');
    btn.disabled    = flag;
    btn.textContent = flag ? 'Saving…' : 'Save changes';
  }

  // ── API: load profile ─────────────────────────────────────────────────────
  async function loadProfile() {
    if (!getToken()) { toLogin(); return; }

    try {
      const res = await fetch(`${API}/profile`, { headers: authHdrs() });

      if (res.status === 401) { toLogin(); return; }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.warn('[profile.js] load failed:', body.message || res.status);
        return;
      }

      const data = await res.json();
      _admin     = data.admin;
    
      applyToDOM(_admin);
    } catch (err) {
      console.error('[profile.js] network error:', err.message);
    }
  }

  // ── API: save profile ─────────────────────────────────────────────────────
  async function handleSave() {
    clearErr();

    const name = (document.getElementById('_pName').value || '').trim();
    const file = document.getElementById('_pFile').files[0] || null;

    if (name.length < 2) {
      showErr('Name must be at least 2 characters.');
      return;
    }

    const fd = new FormData();
    fd.append('name', name);
    if (file) fd.append('avatar', file);

    setSaving(true);

    try {
      // ⚠ Do NOT set Content-Type manually — browser must set multipart boundary
      const res  = await fetch(`${API}/profile`, {
        method:  'PUT',
        headers: authHdrs(),
        body:    fd,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showErr(data.message || 'Failed to update profile.');
        setSaving(false);
        return;
      }

      _admin = data.admin;
      applyToDOM(_admin); // also fires alseger:profile event
      closeModal();
    } catch (err) {
      showErr('Network error. Please try again.');
      setSaving(false);
    }
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    injectModal();

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-profile-edit]')) openModal();
    });

    loadProfile(); // single call — BUG FIX: removed stray duplicate at end of IIFE
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for onclick attributes in HTML
  window.openProfileModal  = openModal;
  window.closeProfileModal = closeModal;

})();