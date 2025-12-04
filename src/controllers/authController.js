const asyncHandler = require('../utils/asyncHandler');
const { generateToken, setAuthCookie } = require('../utils/tokenUtils');
const Admin = require('../models/Admin');
const Student = require('../models/Student');

const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email: email?.toLowerCase() });

  if (!admin || !(await admin.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = generateToken({ id: admin._id, role: 'ADMIN' });
  setAuthCookie(res, token);

  res.json({
    token,
    user: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: 'ADMIN'
    }
  });
});

const studentLogin = asyncHandler(async (req, res) => {
  const { rollNumber, password } = req.body;
  const roll = rollNumber?.toUpperCase();
  const student = await Student.findOne({ roll_number: roll });

  if (!student) {
    return res.status(401).json({ message: 'Student not found' });
  }

  const secret = password || roll;
  if (!(await student.matchPassword(secret))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = generateToken({ id: student._id, role: 'STUDENT' });
  setAuthCookie(res, token);

  res.json({
    token,
    user: {
      id: student._id,
      name: student.student_name,
      roll_number: student.roll_number,
      department: student.department,
      program_type: student.program_type,
      role: 'STUDENT'
    }
  });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

module.exports = {
  adminLogin,
  studentLogin,
  logout
};

