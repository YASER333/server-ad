const jwt = require('jsonwebtoken');

const generateToken = (payload, expiresIn = '8h') => {
  if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET');
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const setAuthCookie = (res, token) => {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'strict' : 'lax',
    maxAge: 8 * 60 * 60 * 1000
  });
};

module.exports = {
  generateToken,
  setAuthCookie
};

