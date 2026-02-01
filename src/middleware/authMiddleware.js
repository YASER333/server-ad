const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Student = require('../models/Student');

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  return null;
};

const verifyToken = (token) => {
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const protectAdmin = async (req, res, next) => {
  const token = extractToken(req);
  const decoded = verifyToken(token);

  if (!decoded || decoded.role !== 'ADMIN') {
    return res.status(401).json({ message: 'Not authorized as admin' });
  }

  const admin = await Admin.findById(decoded.id).select('-password_hash');
  if (!admin) {
    return res.status(401).json({ message: 'Admin not found' });
  }

  req.user = admin;
  next();
};

const protectStudent = async (req, res, next) => {
  const token = extractToken(req);
  const decoded = verifyToken(token);

  if (!decoded || decoded.role !== 'STUDENT') {
    return res.status(401).json({ message: 'Not authorized as student' });
  }

  const student = await Student.findById(decoded.id).select('-password_hash');
  if (!student) {
    return res.status(401).json({ message: 'Student not found' });
  }

  req.user = student;
  next();
};

module.exports = {
  protectAdmin,
  protectStudent
};

