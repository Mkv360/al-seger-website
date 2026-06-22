'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
      return res.status(401).json({ success: false, message: 'Bad token format' });
    }
    const token = parts[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.type !== 'user' || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    const user = await User.findById(decoded.id);

    // Guard before destructuring — if findById ever returns an array,
    // undefined, or anything that isn't a plain row object, this stops
    // it from reaching the spread below instead of throwing a 500.
    if (!user || typeof user !== 'object' || Array.isArray(user)) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const { password_hash, ...safeUser } = user;

    req.user = safeUser;

    next();

  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('AUTH ERROR:', err.message);
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

module.exports = { authenticateUser };