/**
 * public/js/adminManagement.js
 * Super-admin-only admin CRUD modal.
 *
 * DROP-IN — add AFTER profile.js:
 *   <script src="/js/adminManagement.js"></script>
 *
 * Activates automatically when profile.js fires the
 * 'alseger:profile' event and the logged-in role is 'super_admin'.
 *
 * Injects a "Manage Admins" button into #profileDropdown.
 * No other HTML changes needed.
 */

'use strict';

(() => {

  const API = 'http://localhost:5000/api';

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

  const ROLE_META = {
    super_admin: { label: 'Super Admin', color: '#d4af37', bg: 'rgba(212,175,55,.12)', bd: 'rgba(212,175,55,.3)' },
    admin:       { label: 'Admin',       color: '#60a5fa', bg: 'rgba(96,165,250,.12)',  bd: 'rgba(96,165,250,.3)' },
    viewer:      { label: 'Viewer',      color: '#9ca3af', bg: 'rgba(156,163,175,.12)', bd: 'rgba(156,163,175,.3)' },
  };

  // ── State ──────────────────────────────────────────────────────────────────
  let _admins       = [];
  let _editingId    = null;
  let _selfId       = null;
  let _pendingDelId = null;

  // ── Auth / fetch helpers ──────────────────────────────────────────────────
  const getToken = () => localStorage.getItem('token') || '';
  const authHdrs = (extra = {}) => ({ Authorization: `Bearer ${getToken()}`, ...extra });

  async function apiReq(method, path, body = null) {
    const opts = {
      method,
      headers: authHdrs(body ? { 'Content-Type': 'application/json' } : {}),
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res  = await fetch(`${API}${path}`, opts);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { message: 'Network error.' } };
    }
  }

  // ── Misc utils ────────────────────────────────────────────────────────────
  function escHtml(str) {
    const el = document.createElement('div');
    el.appendChild(document.createTextNode(String(str ?? '')));
    return el.innerHTML;
  }

  function getInitials(name) {
    return String(name || '').trim()
      .split(/\s+/).filter(Boolean)
      .map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  function rm(role) { return ROLE_META[role] || ROLE_META.viewer; }

  // ── Style injection ───────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('_ams')) return;
    const s = document.createElement('style');
    s.id = '_ams';
    s.textContent = `
/* ── Overlay ── */
#_am {
  display:none; position:fixed; inset:0; z-index:9200;
  background:${C.overlay}; backdrop-filter:blur(4px);
  align-items:center; justify-content:center;
}
#_am.open { display:flex; }

/* ── Panel ── */
#_amp {
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:14px; padding:28px 24px;
  width:100%; max-width:640px; max-height:88vh;
  overflow-y:auto; position:relative;
  box-shadow:0 32px 80px rgba(0,0,0,.88);
  animation:_amIn .22s ease;
  scrollbar-width:thin; scrollbar-color:${C.border} transparent;
}
#_amp::-webkit-scrollbar { width:5px; }
#_amp::-webkit-scrollbar-thumb { background:${C.border}; border-radius:3px; }
@keyframes _amIn {
  from { opacity:0; transform:translateY(-10px); }
  to   { opacity:1; transform:translateY(0); }
}

/* ── Panel header ── */
#_amMH {
  margin:0 0 20px; font-size:1.05rem; font-weight:700;
  color:${C.gold}; letter-spacing:.08em; text-transform:uppercase;
}
#_amX {
  position:absolute; top:14px; right:16px;
  background:none; border:none; color:${C.muted};
  font-size:22px; line-height:1; cursor:pointer;
  padding:3px 7px; border-radius:5px;
  transition:color .15s, background .15s;
}
#_amX:hover { color:${C.gold}; background:rgba(212,175,55,.1); }

/* ── List view header ── */
#_amLH {
  display:flex; align-items:center;
  justify-content:space-between; margin-bottom:14px;
}
#_amCnt { color:${C.muted}; font-size:.84rem; }
#_amAdd {
  background:${C.gold}; border:none; border-radius:7px;
  color:${C.bg}; padding:8px 16px;
  font-size:.84rem; font-weight:700; cursor:pointer;
  transition:opacity .15s; font-family:inherit;
}
#_amAdd:hover { opacity:.85; }

/* ── Admin row ── */
._amRw {
  display:flex; align-items:center; gap:10px;
  background:${C.surface2}; border:1px solid ${C.border};
  border-radius:9px; padding:11px 13px;
  margin-bottom:7px; transition:border-color .18s;
}
._amRw:hover { border-color:#3d3d3d; }

._amIni {
  width:38px; height:38px; border-radius:50%;
  background:rgba(212,175,55,.1); border:1px solid rgba(212,175,55,.22);
  color:${C.gold}; font-size:.84rem; font-weight:700;
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0; user-select:none; letter-spacing:.02em;
}

._amRI  { flex:1; min-width:0; }
._amRN  {
  font-size:.86rem; font-weight:600; color:${C.text};
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
._amRE  {
  font-size:.75rem; color:${C.muted};
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
._amSelf { font-size:.68rem; color:${C.gold}; margin-left:5px; font-weight:700; }

._amRB { display:flex; gap:5px; flex-shrink:0; flex-wrap:wrap; }
._amBdg {
  display:inline-block; padding:2px 7px;
  border-radius:20px; font-size:.68rem; font-weight:700;
  border:1px solid; white-space:nowrap;
}

._amRA { display:flex; gap:5px; flex-shrink:0; }
._amRA button {
  background:none; border:1px solid ${C.border};
  border-radius:5px; padding:4px 9px;
  font-size:.73rem; cursor:pointer; color:${C.muted};
  transition:color .15s, border-color .15s; font-family:inherit;
}
._amBE:hover { color:${C.gold};  border-color:rgba(212,175,55,.4) !important; }
._amBT:hover { color:#60a5fa;    border-color:rgba(96,165,250,.4) !important; }
._amBD:hover { color:${C.error}; border-color:rgba(248,113,113,.4) !important; }

._amMsg { text-align:center; color:${C.muted}; padding:36px 0; font-size:.88rem; }

/* ── Form view ── */
#_amBk {
  background:none; border:none; padding:0;
  color:${C.muted}; font-size:.81rem; cursor:pointer;
  margin-bottom:16px; display:inline-flex;
  align-items:center; gap:4px;
  font-family:inherit; transition:color .15s;
}
#_amBk:hover { color:${C.text}; }

#_amFTl { margin:0 0 18px; font-size:.94rem; font-weight:700; color:${C.text}; }

._amFG { display:flex; flex-direction:column; gap:5px; margin-bottom:14px; }
._amFG label {
  font-size:.69rem; font-weight:700; color:${C.muted};
  text-transform:uppercase; letter-spacing:.08em;
}
._amFG input, ._amFG select {
  background:${C.surface2}; border:1px solid ${C.border};
  border-radius:7px; padding:9px 13px;
  color:${C.text}; font-size:.9rem; outline:none;
  transition:border-color .18s; font-family:inherit;
}
._amFG input:focus, ._amFG select:focus { border-color:${C.gold}; }
._amFG select option { background:${C.surface2}; }
._amFG small { color:${C.muted}; font-size:.73rem; margin-top:2px; }

#_amFEr {
  background:${C.errorBg}; border:1px solid ${C.errorBdr};
  border-radius:6px; color:${C.error};
  font-size:.84rem; padding:9px 13px; margin-bottom:14px;
}
#_amFAc { display:flex; gap:10px; justify-content:flex-end; margin-top:6px; }
#_amFCn {
  background:${C.surface2}; border:1px solid ${C.border};
  border-radius:7px; color:${C.muted};
  padding:9px 20px; font-size:.88rem; cursor:pointer;
  transition:border-color .15s, color .15s; font-family:inherit;
}
#_amFCn:hover { border-color:#555; color:${C.text}; }
#_amFSv {
  background:${C.gold}; border:none; border-radius:7px;
  color:${C.bg}; padding:9px 22px;
  font-size:.88rem; font-weight:700; cursor:pointer;
  transition:opacity .15s; font-family:inherit;
}
#_amFSv:hover { opacity:.85; }
#_amFSv:disabled { opacity:.42; cursor:not-allowed; }

/* ── Delete confirm overlay ── */
#_amCf {
  display:none; position:absolute; inset:0; z-index:10;
  background:rgba(5,5,5,.93); border-radius:14px;
  flex-direction:column; align-items:center;
  justify-content:center; gap:20px; padding:32px; text-align:center;
}
#_amCf.open { display:flex; }
#_amCfMsg { color:${C.text}; font-size:.9rem; line-height:1.65; max-width:360px; }
#_amCfAc  { display:flex; gap:10px; }
#_amCfNo {
  background:${C.surface2}; border:1px solid ${C.border};
  border-radius:7px; color:${C.muted};
  padding:9px 20px; font-size:.88rem; cursor:pointer; font-family:inherit;
}
#_amCfYs {
  background:#ef4444; border:none; border-radius:7px;
  color:#fff; padding:9px 22px;
  font-size:.88rem; font-weight:700; cursor:pointer;
  font-family:inherit; transition:opacity .15s;
}
#_amCfYs:hover { opacity:.85; }
    `;
    document.head.appendChild(s);
  }

  // ── Modal HTML injection ──────────────────────────────────────────────────
  function injectModal() {
    if (document.getElementById('_am')) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = `
<div id="_am" role="dialog" aria-modal="true" aria-labelledby="_amMH">
  <div id="_amp">
    <button id="_amX" type="button" aria-label="Close">&times;</button>
    <h2 id="_amMH">Manage Admins</h2>

    <!-- List view (default) -->
    <div id="_amLV">
      <div id="_amLH">
        <span id="_amCnt">Loading…</span>
        <button id="_amAdd" type="button">+ Add Admin</button>
      </div>
      <div id="_amTbl"><div class="_amMsg">Loading…</div></div>
    </div>

    <!-- Form view (create / edit) -->
    <div id="_amFV" hidden>
      <button id="_amBk" type="button">&#8592; Back to list</button>
      <h3 id="_amFTl">Add New Admin</h3>

      <div class="_amFG">
        <label for="_amFNm">Full name <span style="color:${C.error}">*</span></label>
        <input type="text" id="_amFNm" autocomplete="off" maxlength="120"
               placeholder="e.g. Ahmad Mansour">
      </div>
      <div class="_amFG">
        <label for="_amFEm">Email <span style="color:${C.error}">*</span></label>
        <input type="email" id="_amFEm" autocomplete="off"
               placeholder="admin@alseger.com">
      </div>
      <div class="_amFG">
        <label for="_amFPw">
          Password <span id="_amPwR" style="color:${C.error}">*</span>
        </label>
        <input type="password" id="_amFPw" autocomplete="new-password"
               placeholder="Min. 8 characters">
        <small id="_amPwN" hidden>Leave empty to keep the current password</small>
      </div>
      <div class="_amFG">
        <label for="_amFRl">Role <span style="color:${C.error}">*</span></label>
        <select id="_amFRl">
          <option value="viewer">Viewer — read-only access</option>
          <option value="admin" selected>Admin — full access</option>
          <option value="super_admin">Super Admin — full access + admin management</option>
        </select>
      </div>
      <div class="_amFG" id="_amFAS" hidden>
        <label for="_amFAct">Account status</label>
        <select id="_amFAct">
          <option value="1">Active</option>
          <option value="0">Inactive — cannot log in</option>
        </select>
      </div>

      <div id="_amFEr" hidden></div>

      <div id="_amFAc">
        <button type="button" id="_amFCn">Cancel</button>
        <button type="button" id="_amFSv">Create admin</button>
      </div>
    </div>

    <!-- Delete confirmation (absolute overlay over panel) -->
    <div id="_amCf">
      <p id="_amCfMsg"></p>
      <div id="_amCfAc">
        <button type="button" id="_amCfNo">Cancel</button>
        <button type="button" id="_amCfYs">Delete</button>
      </div>
    </div>
  </div>
</div>`.trim();
    document.body.appendChild(tpl.content.cloneNode(true));
    bindModal();
  }

  // ── Event bindings ────────────────────────────────────────────────────────
  function bindModal() {
    const $ = id => document.getElementById(id);

    $('_amX').addEventListener('click', closeModal);
    $('_am').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!$('_am').classList.contains('open')) return;
      if ($('_amCf').classList.contains('open'))  { closeConfirm(); return; }
      if (!$('_amFV').hidden)                      { showList();     return; }
      closeModal();
    });

    $('_amAdd').addEventListener('click', () => showForm(null));
    $('_amBk').addEventListener('click',  showList);
    $('_amFCn').addEventListener('click', showList);
    $('_amFSv').addEventListener('click', handleSave);
    $('_amTbl').addEventListener('click', handleTableClick);
    $('_amCfNo').addEventListener('click', closeConfirm);
  }

  // ── View switching ────────────────────────────────────────────────────────
  function showList() {
    document.getElementById('_amLV').hidden = false;
    document.getElementById('_amFV').hidden = true;
    _editingId = null;
    clearFErr();
    renderTable();
  }

  function showForm(admin) {
    const $ = id => document.getElementById(id);
    _editingId  = admin?.id ?? null;
    const isEdit = _editingId !== null;

    $('_amFTl').textContent  = isEdit ? 'Edit Admin' : 'Add New Admin';
    $('_amFNm').value        = admin?.name  ?? '';
    $('_amFEm').value        = admin?.email ?? '';
    $('_amFPw').value        = '';
    $('_amFRl').value        = admin?.role  ?? 'admin';

    $('_amPwR').hidden       = isEdit;   // hide * for edit
    $('_amPwN').hidden       = !isEdit;  // show hint for edit
    $('_amFPw').placeholder  = isEdit ? '(leave blank to keep current)' : 'Min. 8 characters';

    $('_amFAS').hidden = !isEdit;
    if (isEdit) $('_amFAct').value = admin.is_active ? '1' : '0';

    $('_amFSv').textContent = isEdit ? 'Save changes' : 'Create admin';

    clearFErr();
    $('_amLV').hidden = true;
    $('_amFV').hidden = false;
    $('_amFNm').focus();
  }

  // ── Table render ──────────────────────────────────────────────────────────
  function renderTable() {
    const tbl = document.getElementById('_amTbl');
    const cnt = document.getElementById('_amCnt');

    if (!_admins.length) {
      tbl.innerHTML      = '<div class="_amMsg">No admins found.</div>';
      cnt.textContent    = '0 admins';
      return;
    }

    cnt.textContent = `${_admins.length} admin${_admins.length !== 1 ? 's' : ''}`;
    tbl.innerHTML   = _admins.map(renderRow).join('');
  }

  function renderRow(a) {
    const isSelf = a.id === _selfId;
    const meta   = rm(a.role);
    const active = !!a.is_active;
    const sc     = active
      ? { c: '#4ade80', bg: 'rgba(74,222,128,.1)',  bd: 'rgba(74,222,128,.3)'  }
      : { c: '#f87171', bg: 'rgba(248,113,113,.1)', bd: 'rgba(248,113,113,.3)' };

    return `<div class="_amRw">
  <div class="_amIni">${escHtml(getInitials(a.name))}</div>
  <div class="_amRI">
    <div class="_amRN">${escHtml(a.name)}${isSelf ? '<span class="_amSelf">(you)</span>' : ''}</div>
    <div class="_amRE">${escHtml(a.email)}</div>
  </div>
  <div class="_amRB">
    <span class="_amBdg" style="color:${meta.color};background:${meta.bg};border-color:${meta.bd}">${escHtml(meta.label)}</span>
    <span class="_amBdg" style="color:${sc.c};background:${sc.bg};border-color:${sc.bd}">${active ? 'Active' : 'Inactive'}</span>
  </div>
  <div class="_amRA">
    <button class="_amBE" data-id="${a.id}">Edit</button>
    ${!isSelf ? `
    <button class="_amBT" data-id="${a.id}" data-active="${active ? '1' : '0'}">${active ? 'Deactivate' : 'Activate'}</button>
    <button class="_amBD" data-id="${a.id}">Delete</button>` : ''}
  </div>
</div>`;
  }

  // ── Row action delegation ─────────────────────────────────────────────────
  async function handleTableClick(e) {
    const editBtn = e.target.closest('._amBE');
    const togBtn  = e.target.closest('._amBT');
    const delBtn  = e.target.closest('._amBD');

    if (editBtn) {
      const id    = parseInt(editBtn.dataset.id, 10);
      const admin = _admins.find(a => a.id === id);
      if (admin) showForm(admin);
    }
    if (togBtn) {
      const id     = parseInt(togBtn.dataset.id, 10);
      const active = togBtn.dataset.active === '1';
      await handleToggle(id, active);
    }
    if (delBtn) {
      const id    = parseInt(delBtn.dataset.id, 10);
      const admin = _admins.find(a => a.id === id);
      if (admin) openConfirm(admin);
    }
  }

  // ── Toggle active/inactive ────────────────────────────────────────────────
  async function handleToggle(id, currentlyActive) {
    const r = await apiReq('PUT', `/admin-management/${id}`, {
      is_active: currentlyActive ? 0 : 1,
    });
    if (!r.ok) { alert(r.data.message || 'Could not update status.'); return; }
    const idx = _admins.findIndex(a => a.id === id);
    if (idx !== -1) _admins[idx] = r.data.data;
    renderTable();
  }

  // ── Delete confirmation ───────────────────────────────────────────────────
  function openConfirm(admin) {
    _pendingDelId = admin.id;
    document.getElementById('_amCfMsg').textContent =
      `Permanently delete "${admin.name}" (${admin.email})? This cannot be undone.`;
    document.getElementById('_amCfYs').onclick = handleDeleteConfirmed;
    document.getElementById('_amCf').classList.add('open');
  }

  function closeConfirm() {
    document.getElementById('_amCf').classList.remove('open');
    _pendingDelId = null;
  }

  async function handleDeleteConfirmed() {
    if (!_pendingDelId) return;
    const id = _pendingDelId;
    closeConfirm();
    const r = await apiReq('DELETE', `/admin-management/${id}`);
    if (!r.ok) { alert(r.data.message || 'Could not delete admin.'); return; }
    _admins = _admins.filter(a => a.id !== id);
    renderTable();
  }

  // ── Form save (create / edit) ─────────────────────────────────────────────
  async function handleSave() {
    clearFErr();

    const name     = (document.getElementById('_amFNm').value  || '').trim();
    const email    = (document.getElementById('_amFEm').value  || '').trim();
    const password =  document.getElementById('_amFPw').value;
    const role     =  document.getElementById('_amFRl').value;
    const isActive =  document.getElementById('_amFAct').value;

    // Client-side validation (backend will also validate)
    if (name.length < 2)                         return showFErr('Name must be at least 2 characters.');
    if (!email || !/\S+@\S+\.\S+/.test(email))   return showFErr('A valid email address is required.');
    if (!_editingId && password.length < 8)       return showFErr('Password must be at least 8 characters.');
    if (_editingId && password && password.length < 8)
                                                  return showFErr('New password must be at least 8 characters.');

    const btn       = document.getElementById('_amFSv');
    btn.disabled    = true;
    btn.textContent = 'Saving…';

    let r;
    if (_editingId) {
      const body = { name, email, role, is_active: parseInt(isActive, 10) };
      if (password) body.password = password;
      r = await apiReq('PUT', `/admin-management/${_editingId}`, body);
    } else {
      r = await apiReq('POST', '/admin-management', { name, email, password, role });
    }

    btn.disabled    = false;
    btn.textContent = _editingId ? 'Save changes' : 'Create admin';

    if (!r.ok) {
      showFErr(r.data.message || 'Failed to save. Please try again.');
      return;
    }

    if (_editingId) {
      const idx = _admins.findIndex(a => a.id === _editingId);
      if (idx !== -1) _admins[idx] = r.data.data;
    } else {
      _admins.unshift(r.data.data);
    }

    showList();
  }

  function showFErr(msg) {
    const el = document.getElementById('_amFEr');
    el.textContent = msg;
    el.hidden = false;
  }

  function clearFErr() {
    const el = document.getElementById('_amFEr');
    el.hidden = true;
    el.textContent = '';
  }

  // ── Modal open / close ────────────────────────────────────────────────────
  async function openModal() {
    const modal = document.getElementById('_am');
    modal.classList.add('open');

    // Reset to list view, show loading state
    document.getElementById('_amLV').hidden  = false;
    document.getElementById('_amFV').hidden  = true;
    document.getElementById('_amCnt').textContent = 'Loading…';
    document.getElementById('_amTbl').innerHTML   = '<div class="_amMsg">Loading…</div>';

    const r = await apiReq('GET', '/admin-management');
    if (!r.ok) {
      document.getElementById('_amTbl').innerHTML =
        `<div class="_amMsg">Failed to load: ${escHtml(r.data.message || 'Network error.')}</div>`;
      return;
    }

    _admins = r.data.data || [];
    renderTable();
  }

  function closeModal() {
    document.getElementById('_am').classList.remove('open');
    closeConfirm();
    _editingId = null;
  }

  // ── Inject "Manage Admins" button into dropdown ───────────────────────────
  function injectManageButton() {
    if (document.getElementById('_amBtn')) return; // idempotent
    const dropdown = document.getElementById('profileDropdown');
    if (!dropdown) return;

    const btn = document.createElement('button');
    btn.id          = '_amBtn';
    btn.type        = 'button';
    btn.textContent = 'Manage Admins';
    btn.addEventListener('click', openModal);

    // Insert right after the first dropdown button ("My Profile")
    const first = dropdown.querySelector('button');
    if (first) first.insertAdjacentElement('afterend', btn);
    else        dropdown.insertBefore(btn, dropdown.firstChild);
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function setup(adminData) {
    _selfId = adminData.id;
    if (adminData.role !== 'super_admin') return;
    injectStyles();
    injectModal();
    injectManageButton();
  }

  // Primary trigger: profile.js fires this after every load/save
  document.addEventListener('alseger:profile', e => setup(e.detail));

  // Fallback: if profile.js already ran before this script loaded
  if (window.__alsegerAdmin) setup(window.__alsegerAdmin);

  // Global access if needed
  window.openAdminManagementModal  = openModal;
  window.closeAdminManagementModal = closeModal;

})();