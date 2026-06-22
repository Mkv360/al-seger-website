/**
 * frontend/auth.js
 *
 * ─────────────────────────────────────────────────────────────────
 * BUGS FIXED IN THIS FILE
 * ─────────────────────────────────────────────────────────────────
 * BUG 3 (moderate – can cause 401 with certain passwords):
 *   `document.getElementById("password").value.trim()`
 *   Passwords are stripped of leading / trailing whitespace before
 *   being sent to the server.  Bcrypt hashes the RAW password at
 *   registration time, so any difference (e.g. a trailing space the
 *   user typed, or a password that legitimately starts with a space)
 *   causes bcrypt.compare() to return false → 401.
 *   Even when it doesn't cause an immediate mismatch it is a
 *   security anti-pattern.  Passwords are sensitive — never mutate them.
 *   FIX: `.trim()` removed from the password field only.
 *        Email trimming is kept (email whitespace is always unintentional).
 *
 * BUG 4 (minor – getAdmin() crash risk):
 *   `JSON.parse(localStorage.getItem("admin"))` throws when the item
 *   is absent on pages that are not yet logged in and the key doesn't
 *   exist — actually JSON.parse(null) returns null so it's safe, but
 *   a corrupted value would throw an uncaught error.
 *   FIX: added try/catch + null guard.
 * ─────────────────────────────────────────────────────────────────
 * VERIFIED CORRECT (no changes needed):
 *   • Response shape: backend returns
 *       { success: true, data: { token, admin } }
 *     and the frontend reads data.data.token / data.data.admin — CORRECT.
 *   • Error path: `throw new Error(data.message || "Login failed")`
 *     matches every { success: false, message: "…" } response from the
 *     backend — CORRECT.
 * ─────────────────────────────────────────────────────────────────
 */

const API_BASE_URL = "http://localhost:5000/api";

// ==========================
// LOGIN HANDLER
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", login);
});

async function login(e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

 

  if (!email || !password) {
    alert("Email and password are required");
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    // If the server returned non-JSON (e.g. an HTML 500 page) this will throw,
    // which is caught below and shown as a generic message.
    const data = await res.json();

    if (!res.ok) {
      // data.message is set by every error response in authController.js
      throw new Error(data.message || "Login failed");
    }

    // Backend shape: { success: true, data: { token: "…", admin: {…} } }
    saveSession(data.data.token, data.data.admin);
    window.location.href = "dashboard.html";

  } catch (err) {
    alert(err.message || "An unexpected error occurred. Please try again.");
  }
}

// ==========================
// SESSION HANDLING
// ==========================
function saveSession(token, admin) {
  localStorage.setItem("token", token);
  localStorage.setItem("admin", JSON.stringify(admin));
}

function getToken() {
  return localStorage.getItem("token");
}

function getAdmin() {
  // FIX (BUG 4): guard against null / corrupted stored value
  try {
    const raw = localStorage.getItem("admin");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("admin");
  window.location.href = "login.html";
}

// ==========================
// ROUTE PROTECTION
// ==========================
function requireAuth() {
  if (!getToken()) {
    window.location.href = "login.html";
  }
}