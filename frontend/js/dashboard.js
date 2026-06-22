// ===============================
// CONFIG
// ===============================

const ME_ENDPOINT = "http://localhost:5000/api/users/me";
const APPLICATIONS_ENDPOINT = "http://localhost:5000/api/applications/my";

// Fields counted toward Profile Completion.
const PROFILE_COMPLETION_FIELDS = ["full_name", "phone_or_email", "gender"];

// ===============================
// DOM ELEMENTS
// ===============================

const loadingState = document.getElementById("loadingState");
const notLoggedInState = document.getElementById("notLoggedInState");
const errorState = document.getElementById("errorState");
const dashboardState = document.getElementById("dashboardState");

const errorMessageEl = document.getElementById("errorMessage");
const retryBtn = document.getElementById("retryBtn");

const welcomeHeading = document.getElementById("welcomeHeading");
const userFullName = document.getElementById("userFullName");
const userContact = document.getElementById("userContact");
const userGender = document.getElementById("userGender");
const userCreatedAt = document.getElementById("userCreatedAt");
const activityCreatedAt = document.getElementById("activityCreatedAt");

const completionFill = document.getElementById("completionFill");
const completionPercent = document.getElementById("completionPercent");

const editProfileBtn = document.getElementById("editProfileBtn");
const actionToast = document.getElementById("actionToast");

const submittedCount = document.getElementById("submittedCount");
const pendingCount = document.getElementById("pendingCount");
const approvedCount = document.getElementById("approvedCount");
const rejectedCount = document.getElementById("rejectedCount");

// Navbar (desktop + mobile)
const logoutBtn = document.getElementById("logoutBtn");
const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");
const dashboardOnlyLinks = document.getElementById("dashboardOnlyLinks");
const mobileDashboardOnlyLinks = document.getElementById("mobileDashboardOnlyLinks");
const navApplyOnline = document.getElementById("navApplyOnline");
const mobileNavApplyOnline = document.getElementById("mobileNavApplyOnline");

// Quick action cards
const qaApplyOnline = document.getElementById("qaApplyOnline");
const qaUpdateProfile = document.getElementById("qaUpdateProfile");

const ALL_PANELS = [loadingState, notLoggedInState, errorState, dashboardState];

// ===============================
// HELPER FUNCTIONS
// ===============================

function getToken() {
    return localStorage.getItem("token");
}

function clearSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
}

/**
 * Safely sets textContent on an element.
 * No-ops if the element does not exist in the DOM.
 */
function setText(el, value) {
    if (el) el.textContent = value;
}

/**
 * Extracts an applications array from any backend response shape.
 *
 * Handles all common patterns:
 *   { data: [...] }
 *   { data: { applications: [...] } }
 *   { applications: [...] }
 *   { data: { data: [...] } }
 *   { items: [...] }
 *
 * Returns an empty array if no array is found — never throws.
 */
function extractArray(data) {
    const candidates = [
        data?.data,
        data?.data?.applications,
        data?.applications,
        data?.data?.data,
        data?.items,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
    }

    console.warn("[dashboard] extractArray: unexpected response shape.", data);
    return [];
}

function showPanel(panelToShow) {
    ALL_PANELS.forEach(panel => {
        if (panel) panel.hidden = panel !== panelToShow;
    });

    const isLoggedIn = panelToShow === dashboardState;

    if (logoutBtn)               logoutBtn.hidden               = !isLoggedIn;
    if (mobileLogoutBtn)         mobileLogoutBtn.hidden         = !isLoggedIn;
    if (dashboardOnlyLinks)      dashboardOnlyLinks.hidden      = !isLoggedIn;
    if (mobileDashboardOnlyLinks) mobileDashboardOnlyLinks.hidden = !isLoggedIn;
}

function formatGender(value) {
    if (!value) return "—";
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function calculateProfileCompletion(user) {
    if (!user || typeof user !== "object") return 0;
    const filled = PROFILE_COMPLETION_FIELDS.filter(field => !!user[field]).length;
    return Math.round((filled / PROFILE_COMPLETION_FIELDS.length) * 100);
}

function showToast(message) {
    if (!actionToast) return;
    actionToast.textContent = message;
    actionToast.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
        actionToast.hidden = true;
    }, 3000);
}

// ===============================
// RENDER
// ===============================

function renderDashboard(user) {
    if (!user || typeof user !== "object") {
        console.error("[dashboard] renderDashboard: invalid user object.", user);
        return;
    }

    const firstName = (user.full_name || "").split(" ")[0] || "";

    setText(welcomeHeading, `Welcome Back, ${firstName}`);
    setText(userFullName, user.full_name || "—");
    setText(userContact, user.phone_or_email || "—");
    setText(userGender, formatGender(user.gender));
    setText(userCreatedAt, formatDate(user.created_at));
    setText(activityCreatedAt, formatDate(user.created_at));

    const completion = calculateProfileCompletion(user);
    setText(completionPercent, `${completion}%`);
    if (completionFill) completionFill.style.width = `${completion}%`;
}

/**
 * Writes application counts to the summary stat cards.
 * Receives a guaranteed array — no .filter() guard needed here
 * because extractArray() already ensures it.
 */
function renderApplicationStats(applications) {
    setText(submittedCount, applications.length);
    setText(pendingCount,   applications.filter(a => a.status === "pending").length);
    setText(approvedCount,  applications.filter(a => a.status === "approved").length);
    setText(rejectedCount,  applications.filter(a => a.status === "rejected").length);
}

// ===============================
// API
// ===============================

async function loadApplicationStats() {
    const token = getToken();
    if (!token) return; // already handled upstream in loadDashboard

    try {
        const response = await fetch(APPLICATIONS_ENDPOINT, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            console.warn("[dashboard] loadApplicationStats: HTTP", response.status);
            return; // stat cards stay at their HTML default ("0")
        }

        const data = await response.json();

        // ── MAIN FIX ──────────────────────────────────────────────────────────
        // data.data might be an array, an object, null, or undefined depending
        // on the server. extractArray() walks the common shapes and always
        // returns a real array, so .filter() can never throw here.
        // ─────────────────────────────────────────────────────────────────────
        const applications = extractArray(data);
        renderApplicationStats(applications);

    } catch (error) {
        console.error("[dashboard] Failed to load application stats:", error);
        // Non-fatal: stat cards show "0"; the rest of the dashboard is fine.
    }
}

async function loadDashboard() {
    const token = getToken();

    if (!token) {
        showPanel(notLoggedInState);
        return;
    }

    showPanel(loadingState);

    try {
        const response = await fetch(ME_ENDPOINT, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
            clearSession();
            showPanel(notLoggedInState);
            return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
            setText(errorMessageEl, data.message || "Check your connection and try again.");
            showPanel(errorState);
            return;
        }

        // Support both { data: { user: {...} } } and { data: {...} } shapes.
        const user = data?.user ?? data?.data?.user ?? data?.data ?? null;

        if (!user) {
            setText(errorMessageEl, "Could not read user data from the server response.");
            showPanel(errorState);
            return;
        }

        renderDashboard(user);
        await loadApplicationStats();
        showPanel(dashboardState);

    } catch (error) {
        console.error("[dashboard] Failed to load dashboard:", error);
        setText(errorMessageEl, "Check your connection and try again.");
        showPanel(errorState);
    }
}

// ===============================
// ACTIONS
// ===============================

function handleLogout() {
    clearSession();
    window.location.href = "index.html";
}

function handleEditProfile() {
    showToast("Profile editing is coming soon.");
}

function handleApplyOnline(e) {
    e.preventDefault();
    window.location.href = "apply.html";
}

// ===============================
// EVENT LISTENERS (registered once)
// ===============================

if (logoutBtn)              logoutBtn.addEventListener("click", handleLogout);
if (mobileLogoutBtn)        mobileLogoutBtn.addEventListener("click", handleLogout);

if (retryBtn)               retryBtn.addEventListener("click", loadDashboard);

if (editProfileBtn)         editProfileBtn.addEventListener("click", handleEditProfile);
if (qaUpdateProfile)        qaUpdateProfile.addEventListener("click", handleEditProfile);

if (navApplyOnline)         navApplyOnline.addEventListener("click", handleApplyOnline);
if (mobileNavApplyOnline)   mobileNavApplyOnline.addEventListener("click", handleApplyOnline);
if (qaApplyOnline)          qaApplyOnline.addEventListener("click", handleApplyOnline);

// ===============================
// INIT
// ===============================

loadDashboard();