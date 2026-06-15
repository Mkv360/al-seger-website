/**
 * language.js — AL SEGER Unified i18n System
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HTML ATTRIBUTE CONTRACT (one standard, no exceptions):
 *   data-i18n="key"              → sets textContent
 *                                  (innerHTML ONLY for keys in HTML_KEYS)
 *   data-i18n-placeholder="key"  → sets element.placeholder
 *   data-i18n-title="key"        → sets element.title (tooltip)
 *
 * Single localStorage key : 'al_seger_lang'
 * Single state object     : LanguageSystem  (IIFE, no global leaks)
 * Single boot trigger     : DOMContentLoaded
 * ─────────────────────────────────────────────────────────────────────────────
 */

const LanguageSystem = (() => {

  // ── CONFIGURATION ──────────────────────────────────────────────────────────

  const STORAGE_KEY = 'al_seger_lang';
  const SUPPORTED   = ['en', 'am', 'om'];
  const DEFAULT     = 'en';

  /**
   * SECURITY — innerHTML whitelist.
   * Only keys listed here may inject HTML (e.g. <br> tags).
   * Everything else is written with textContent and is XSS-safe.
   * Add keys here only when the translation genuinely needs markup.
   */
  const HTML_KEYS = new Set([
    'hero.headline'
  ]);

  // ── STATE ──────────────────────────────────────────────────────────────────

  let translations = {};
  let current      = DEFAULT;

  // ── ONE-TIME LEGACY MIGRATION ──────────────────────────────────────────────
  // Moves the old System-B key ('language') into the unified key, then
  // removes it so two competing systems can never coexist in localStorage.

  (function migrateLegacyStorage() {
    const LEGACY_KEY = 'language';
    const legacyVal  = localStorage.getItem(LEGACY_KEY);

    if (legacyVal && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, legacyVal);
    }

    localStorage.removeItem(LEGACY_KEY);
  })();

  // ── PATH RESOLVER ──────────────────────────────────────────────────────────

  function resolvePath(lang) {
    // Works whether the page lives at root or inside /pages/
    const prefix = window.location.pathname.includes('/pages/') ? '../' : './';
    return `${prefix}translations/${lang}.json`;
  }

  // ── LOADER ─────────────────────────────────────────────────────────────────
  // One fetch per language switch. No caching layer needed at this scale;
  // the browser's own HTTP cache handles repeat requests.

  async function load(lang) {
    if (!SUPPORTED.includes(lang)) lang = DEFAULT;

    try {
      const res = await fetch(resolvePath(lang));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      translations = await res.json();
      current      = lang;
      localStorage.setItem(STORAGE_KEY, lang);

    } catch (err) {
      console.warn(`[i18n] Could not load "${lang}":`, err.message);
      if (lang !== DEFAULT) {
        await load(DEFAULT);   // graceful fallback to English
      }
    }
  }

  // ── TRANSLATE ──────────────────────────────────────────────────────────────

  function t(key) {
    if (typeof key !== 'string') return '';

    const parts = key.split('.');
    let   node  = translations;

    for (const part of parts) {
      if (node == null || typeof node !== 'object') return key;
      node = node[part];
    }

    // Return the value if it's a string; otherwise echo the key as fallback.
    return typeof node === 'string' ? node : key;
  }

  // ── DOM UPDATER ────────────────────────────────────────────────────────────

  function apply() {

    // ① data-i18n → textContent, or innerHTML for whitelisted keys only
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key   = el.getAttribute('data-i18n');
      const value = t(key);

      // Key not found in translation file → keep the fallback text in the HTML
      if (value === key) return;

      if (HTML_KEYS.has(key)) {
        el.innerHTML = value;   // ⚠ only for trusted, whitelisted keys
      } else {
        el.textContent = value;
      }
    });

    // ② data-i18n-placeholder → input / textarea placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const value = t(el.getAttribute('data-i18n-placeholder'));
      if (value) el.placeholder = value;
    });

    // ③ data-i18n-title → tooltip / aria title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const value = t(el.getAttribute('data-i18n-title'));
      if (value) el.title = value;
    });

    // ④ Keep <html lang="…"> in sync for accessibility and SEO
    document.documentElement.lang = current;

    // ⑤ Reflect active language in all selector dropdowns
    syncSelectors();
  }

  // ── SELECTOR SYNC ──────────────────────────────────────────────────────────

  function syncSelectors() {
    // Targets both #languageSelector (desktop) and #mobileLanguageSelector
    // via the shared .language-select class — no duplication needed.
    document.querySelectorAll('.language-select').forEach(sel => {
      if (sel.value !== current) sel.value = current;
    });
  }

  // ── LANGUAGE SWITCH ────────────────────────────────────────────────────────

  async function switchTo(lang) {
    if (!SUPPORTED.includes(lang) || lang === current) return;
    await load(lang);
    apply();
  }

  // ── BIND SELECTORS ─────────────────────────────────────────────────────────
  // Called once during init. Attaches a single 'change' listener to every
  // .language-select element. Desktop + mobile both call switchTo() — the
  // same function, the same state, no divergence.

  function bindSelectors() {
    document.querySelectorAll('.language-select').forEach(sel => {
      sel.addEventListener('change', e => switchTo(e.target.value));
    });
  }

  // ── INIT ───────────────────────────────────────────────────────────────────

  async function init() {
    const saved     = localStorage.getItem(STORAGE_KEY);
    const startLang = SUPPORTED.includes(saved) ? saved : DEFAULT;

    await load(startLang);   // single fetch on startup
    apply();                 // paint translations
    bindSelectors();         // wire up dropdowns
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────

  return {
    init,               // call once on DOMContentLoaded (done below)
    t,                  // t('nav.home') → "Home"
    apply,              // re-apply after dynamic DOM changes
    switchTo,           // switchTo('am') from external code
    get current() { return current; }
  };

})();

// ── BOOT ───────────────────────────────────────────────────────────────────
// One listener. One init. Never called twice.
document.addEventListener('DOMContentLoaded', () => LanguageSystem.init());

// ── GLOBALS ────────────────────────────────────────────────────────────────
// Keep window.t() available for inline scripts and dynamic content.
window.LanguageSystem = LanguageSystem;
window.t              = key => LanguageSystem.t(key);
const languageBtn = document.getElementById("languageBtn");
const languageMenu = document.getElementById("languageMenu");

if(languageBtn && languageMenu){

    languageBtn.addEventListener("click", (e)=>{
        e.stopPropagation();
        languageMenu.classList.toggle("show");
    });

    document.addEventListener("click", ()=>{
        languageMenu.classList.remove("show");
    });

    document.querySelectorAll(".lang-option").forEach(option=>{

        option.addEventListener("click", async ()=>{

            const lang = option.dataset.lang;

            await LanguageSystem.switchTo(lang);

            languageMenu.classList.remove("show");

        });

    });

}
document.getElementById("currentLang").textContent =
    lang.toUpperCase();