/**
 * CORS configuration for app.js / server.js
 * ─────────────────────────────────────────────────────────────────
 * BUG 5 (CRITICAL – "fails silently" in the browser):
 *   If the Express app does not include CORS middleware, the browser
 *   blocks every cross-origin fetch() call BEFORE the request even
 *   reaches the server. The browser shows a CORS error in DevTools
 *   and the fetch() promise rejects with a generic TypeError
 *   ("Failed to fetch"), which appears as "fails silently" because
 *   no HTTP status code is returned.
 *
 *   This is the second most likely root cause alongside BUG 1.
 *
 * FIX: Add the lines below to your app.js / server.js, BEFORE any
 *      route registration.
 * ─────────────────────────────────────────────────────────────────
 *
 * npm install cors
 */

const cors    = require('cors');
const express = require('express');
const app     = express();

// ── CORS ──────────────────────────────────────────────────────────
// Place this BEFORE any router registration.
app.use(cors({
  // For development: allow the port your HTML is served from.
  // Replace with your actual origin in production (e.g. 'https://admin.yoursite.com').
  origin: [
    'http://localhost:3000',
    'http://localhost:5500',   // VS Code Live Server default
    'http://127.0.0.1:5500',  // Live Server alternate
    'null',                    // file:// opened directly in browser
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,           // needed if you add cookie support later
}));

// ── Body parsing ────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Routes ──────────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// ── Global error handler ─────────────────────────────────────────────
// Catches anything passed to next(err) from controllers.
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

module.exports = app;