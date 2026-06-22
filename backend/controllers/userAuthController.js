const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const sanitizeUser = (user) => {
  if (!user) return user;
  const { password_hash, ...safeUser } = user;
  return safeUser;
};

const register = async (req, res) => {
  try {
    const { full_name, phone_or_email, gender, password } = req.body;

    if (!full_name || !phone_or_email || !gender || !password) {
      return res.status(400).json({
        success: false,
        message: 'full_name, phone_or_email, gender, and password are required',
      });
    }

    const existing = await User.findByPhoneOrEmail(phone_or_email);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this phone number or email already exists',
      });
    }

    const password_hash = await User.hashPassword(password);

    const newUser = await User.create({
      full_name,
      phone_or_email,
      gender,
      password_hash,
    });

    const token = await generateToken({
      id: newUser.id,
      phone_or_email: newUser.phone_or_email,
      type: 'user',
    });

    return res.status(201).json({
      success: true,
      data: { token, user: sanitizeUser(newUser) },
    });
  } catch (error) {
  console.error('🔥 REGISTER ERROR:', error);

  return res.status(500).json({
    success: false,
    message: error.message,   // IMPORTANT: expose real error
  });
}
};

const login = async (req, res) => {
  try {
    // accept BOTH naming styles (safe fix)
    const phone_or_email = req.body.phone_or_email || req.body.identifier;
    const password = req.body.password;

    if (!phone_or_email || !password) {
      return res.status(400).json({
        success: false,
        message: 'phone_or_email and password are required',
      });
    }

    const user = await User.findByPhoneOrEmail(phone_or_email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const isMatch = await User.verifyPassword(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = await generateToken({
      id: user.id,
      phone_or_email: user.phone_or_email,
      type: 'user',
    });

    return res.status(200).json({
      success: true,
      token, // IMPORTANT: frontend expects this
      user: {
        id: user.id,
        full_name: user.full_name,
        phone_or_email: user.phone_or_email,
        gender: user.gender
      }
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};
const toPublicUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    full_name: user.full_name,
    phone_or_email: user.phone_or_email,
    gender: user.gender,
  };
};

const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user   // 👈 FLAT RESPONSE (IMPORTANT)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
};
module.exports = { register, login, getMe };