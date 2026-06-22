/**
 * apply.js — AL SEGER TRADING PLC
 * User Application Form: auth gate + dynamic multi-section submission
 *
 * Architecture: IIFE module, no global pollution
 * Dependencies: fetch API, JWT in localStorage
 *
 * v3 — fixed dead nested init() bug, wired up nationality uppercase
 * formatting, single clean init() path. No old UI element references.
 */

(function () {
  'use strict';

  /* ================================================================
     CONSTANTS
  ================================================================ */
  const API = {
    PROFILE : 'http://localhost:5000/api/users/me',
    APPLY   : 'http://localhost:5000/api/applications/create',
  };

  /* ================================================================
     STATE
  ================================================================ */
  const state = {
    submitting  : false,
    currentUser : null, // populated if profile fetch succeeds; optional
  };

  /* ================================================================
     DOM CACHE
     Every lookup is defensive — a missing element never throws here,
     it just leaves dom[key] as null and downstream code checks for it.
  ================================================================ */
  const dom = {};

  function cacheDOM () {
    Object.assign(dom, {
      // State panels
      loadingState : document.getElementById('loadingState'),
      authState    : document.getElementById('authState'),
      formState    : document.getElementById('formState'),
      successState : document.getElementById('successState'),

      // Form
      form         : document.getElementById('applicationForm'),

      // Error banner
      errorBanner  : document.getElementById('errorBanner'),
      errorText    : document.getElementById('errorText'),
      errorClose   : document.getElementById('errorClose'),

      // Success screen
      applyAgainBtn: document.getElementById('applyAgainBtn'),
    });

    // No id on the submit button in the markup — find it relative to the form.
    dom.submitBtn = dom.form ? dom.form.querySelector('button[type="submit"]') : null;

    // Fields needing input formatting (only resolved if the form exists).
    dom.nameFields = dom.form
      ? dom.form.querySelectorAll(
          'input[name="first_name"], input[name="middle_name"], input[name="last_name"]'
        )
      : [];
    dom.nationalityField = dom.form
      ? dom.form.querySelector('input[name="nationality"]')
      : null;
  }

  /* ================================================================
     STATE PANEL MANAGEMENT
  ================================================================ */
  const STATE_IDS = ['loadingState', 'authState', 'formState', 'successState'];

  function showState (id) {
    STATE_IDS.forEach(sid => {
      const el = dom[sid];
      if (el) el.hidden = (sid !== id);
    });
  }

  /* ================================================================
     ERROR BANNER
     This element is shown/hidden via inline style.display in the
     markup (style="display:none;"), not the `hidden` attribute — so
     we toggle style.display here to match, not .hidden.
  ================================================================ */
  function showError (msg) {
    if (dom.errorText) dom.errorText.textContent = msg;
    if (dom.errorBanner) {
      dom.errorBanner.style.display = 'flex';
      dom.errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function hideError () {
    if (dom.errorBanner) dom.errorBanner.style.display = 'none';
    if (dom.errorText) dom.errorText.textContent = '';
  }

  /* ================================================================
     SUBMIT BUTTON LOADING STATE
     No dedicated text/spinner sub-elements exist — swap the button's
     own content and restore it afterward.
  ================================================================ */
  function setSubmitting (loading) {
    state.submitting = loading;
    if (!dom.submitBtn) return;

    dom.submitBtn.disabled = loading;

    if (loading) {
      if (dom.submitBtn.dataset.originalText === undefined) {
        dom.submitBtn.dataset.originalText = dom.submitBtn.innerHTML;
      }
      dom.submitBtn.innerHTML = 'Submitting…';
    } else if (dom.submitBtn.dataset.originalText !== undefined) {
      dom.submitBtn.innerHTML = dom.submitBtn.dataset.originalText;
    }
  }

  /* ================================================================
     INPUT FORMATTING HELPERS (pure functions, no DOM dependency)
  ================================================================ */
  function capitalizeFirst (str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function forceUppercase (str) {
    return str ? str.toUpperCase() : '';
  }

  /**
   * Wires live-formatting listeners for name fields and nationality.
   * Must run after cacheDOM() — guarded internally so it's also safe
   * to call even if the form or specific fields are missing.
   */
  function wireFieldFormatting () {
    dom.nameFields.forEach(input => {
      input.addEventListener('input', (e) => {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = capitalizeFirst(e.target.value);
        e.target.setSelectionRange(start, end);
      });
    });

    if (dom.nationalityField) {
      dom.nationalityField.addEventListener('input', (e) => {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = forceUppercase(e.target.value);
        e.target.setSelectionRange(start, end);
      });
    }
  }

  /* ================================================================
     LOAD USER PROFILE
     Purely an auth check — no prefill UI to populate.
     Rules:
       - no token            → authState
       - 401 / 403           → invalid token, clear it, authState
       - any other failure   → fail safe, still show formState
       - success             → store user (optional, used for user_id)
  ================================================================ */
  async function loadUserProfile () {
    const token = localStorage.getItem('token');

    if (!token) {
      showState('authState');
      return;
    }

    showState('loadingState');

    try {
      const res = await fetch(API.PROFILE, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        showState('authState');
        return;
      }

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.user) {
          state.currentUser = data.user;
        }
      }
      // Any other non-auth failure: don't block the form, fall through below.

    } catch (err) {
      console.warn('[apply.js] Profile check failed, continuing to form:', err.message);
    }

    showState('formState');
  }

  /* ================================================================
     VALIDATION
     Dynamic — walks every [required] field currently in the form.
     checkValidity() works uniformly across text/number/date inputs,
     selects, textareas, and file inputs, so no per-type branching
     is needed here regardless of what type "religion" ends up being.
  ================================================================ */
  function getFieldLabel (field) {
    const group = field.closest('.form-group');
    const label = group ? group.querySelector('label') : null;
    if (label) return label.textContent.replace('*', '').trim();
    return field.name || 'This field';
  }

  function validateForm () {
    if (!dom.form) return true; // nothing to validate against

    const requiredFields = Array.from(dom.form.querySelectorAll('[required]'));

    for (const field of requiredFields) {
      if (!field.checkValidity()) {
        showError(`Please complete "${getFieldLabel(field)}" before submitting.`);
        field.focus();
        if (typeof field.scrollIntoView === 'function') {
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return false;
      }
    }

    return true;
  }

  /* ================================================================
     FORM SUBMIT HANDLER
     Sends the entire form as multipart FormData — required because
     the form includes file inputs (id_card, portrait, passport_photo).
  ================================================================ */
  async function handleSubmit (e) {
    e.preventDefault();

    if (state.submitting) return;
    if (!dom.form) return;

    hideError();

    const token = localStorage.getItem('token');
    if (!token) {
      showError('Your session has expired. Please log in again.');
      setTimeout(() => showState('authState'), 1800);
      return;
    }

    if (!validateForm()) return;

    setSubmitting(true);

    const formData = new FormData(dom.form);

    // Optional: link this submission to the logged-in account, if known.
    if (state.currentUser && state.currentUser.id) {
      formData.append('user_id', state.currentUser.id);
    }

    try {
      const res = await fetch(API.APPLY, {
        method  : 'POST',
        headers : {
          'Authorization': `Bearer ${token}`,
          // Deliberately NOT setting Content-Type — the browser sets
          // multipart/form-data with the correct boundary automatically.
        },
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.message ||
          errBody.error   ||
          `Submission failed — please try again (HTTP ${res.status}).`
        );
      }

      resetForm();
      showState('successState');
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      console.error('SUBMIT ERROR:', err);
      showError(err.message || 'Something went wrong. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  /* ================================================================
     RESET FORM
  ================================================================ */
  function resetForm () {
    if (dom.form) dom.form.reset();
    hideError();
  }

  /* ================================================================
     "APPLY AGAIN" — back to form from success screen
  ================================================================ */
function handleApplyAgain() {

    resetForm();

    showState('formState');

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });

    loadUserProfile();
}
  /* ================================================================
     INIT — single, clean path. Every listener registration is
     guarded so a missing element skips its wiring instead of
     throwing and halting the rest of init().
  ================================================================ */
  function init () {
    cacheDOM();

    wireFieldFormatting();

    if (dom.form) {
      dom.form.addEventListener('submit', handleSubmit);
    } else {
      console.warn('[apply.js] #applicationForm not found — submit disabled.');
    }

    if (dom.errorClose) {
      dom.errorClose.addEventListener('click', hideError);
    }

    if (dom.applyAgainBtn) {
      dom.applyAgainBtn.addEventListener('click', handleApplyAgain);
    }

    // Bootstrap: resolves to authState or formState, never gets stuck.
    loadUserProfile();
  }

  /* ================================================================
     ENTRY POINT
  ================================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();