require('dotenv').config();
const connectDB = require('../config/db');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const DailyEvent = require('../models/DailyEvent');

(async () => {
  await connectDB();
  const students = await Student.countDocuments();
  const start = new Date('2025-01-01T00:00:00Z');
  const end = new Date('2025-12-31T23:59:59Z');
  const attendance = await Attendance.countDocuments({ date: { $gte: start, $lte: end } });
  const events = await DailyEvent.countDocuments({ date: { $gte: start, $lte: end } });
  console.log(JSON.stringify({ students, attendance, events }));
  process.exit(0);
})();
