const dayjs = require('dayjs');
const asyncHandler = require('../utils/asyncHandler');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const { summarizeAttendance, calculatePercentage, getDayValue } = require('../utils/attendanceUtils');
const { parseCsvBuffer } = require('../utils/importUtils');

const parseDateRange = (req) => {
  const { startDate, endDate } = req.query;
  const query = {};
  if (startDate || endDate) {
    query.$gte = startDate ? dayjs(startDate).startOf('day').toDate() : undefined;
    query.$lte = endDate ? dayjs(endDate).endOf('day').toDate() : undefined;
  }
  return query.$gte || query.$lte ? query : undefined;
};

const markAttendance = asyncHandler(async (req, res) => {
  const { date, records = [] } = req.body;
  if (!date || !records.length) {
    return res.status(400).json({ message: 'Date and records are required' });
  }
  const targetDate = dayjs(date).startOf('day').toDate();

  const operations = records.map((record) =>
    Attendance.findOneAndUpdate(
      { student_id: record.student_id, date: targetDate },
      {
        am_attendance: Boolean(record.am_attendance),
        pm_attendance: Boolean(record.pm_attendance),
        training_event: record.training_event,
        remarks: record.remarks
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
  );

  const updated = await Promise.all(operations);
  res.json({ updated: updated.length });
});

const getStudentAttendance = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const match = { student_id: studentId };
  const dateRange = parseDateRange(req);
  if (dateRange) {
    match.date = dateRange;
  }

  const attendance = await Attendance.find(match).sort({ date: 1 });
  res.json(attendance);
});

const getStudentSummary = asyncHandler(async (req, res) => {
  const studentId = req.params.studentId || req.user._id;
  const dateRange = parseDateRange(req);
  const match = { student_id: studentId };
  if (dateRange) match.date = dateRange;

  const records = await Attendance.find(match);
  const summary = summarizeAttendance(records);
  const percentage = calculatePercentage(summary);

  res.json({ ...summary, percentage });
});

const getDashboardStats = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const targetDate = date ? dayjs(date).startOf('day').toDate() : dayjs().startOf('day').toDate();

  const [dailyRecords, totalStudents] = await Promise.all([
    Attendance.find({ date: targetDate }),
    Student.countDocuments()
  ]);

  const presentValue = dailyRecords.reduce(
    (acc, record) => acc + getDayValue(record.am_attendance, record.pm_attendance),
    0
  );

  const departmentStats = await Attendance.aggregate([
    { $match: { date: targetDate } },
    {
      $lookup: {
        from: 'students',
        localField: 'student_id',
        foreignField: '_id',
        as: 'student'
      }
    },
    { $unwind: '$student' },
    {
      $group: {
        _id: '$student.department',
        presentValue: {
          $sum: {
            $cond: [
              { $and: ['$am_attendance', '$pm_attendance'] },
              1,
              {
                $cond: [
                  { $or: ['$am_attendance', '$pm_attendance'] },
                  0.5,
                  0
                ]
              }
            ]
          }
        },
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    totalStudents,
    markedStudents: dailyRecords.length,
    presentValue,
    departmentStats
  });
});

const exportAttendance = asyncHandler(async (req, res) => {
  const { department, program_type, startDate, endDate } = req.query;
  const match = {};
  const dateRange = parseDateRange({ query: { startDate, endDate } });
  if (dateRange) match.date = dateRange;

  const rows = await Attendance.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'students',
        localField: 'student_id',
        foreignField: '_id',
        as: 'student'
      }
    },
    { $unwind: '$student' },
    ...(department ? [{ $match: { 'student.department': department } }] : []),
    ...(program_type ? [{ $match: { 'student.program_type': program_type } }] : []),
    {
      $project: {
        student_name: '$student.student_name',
        roll_number: '$student.roll_number',
        department: '$student.department',
        program_type: '$student.program_type',
        date: '$date',
        am_attendance: '$am_attendance',
        pm_attendance: '$pm_attendance',
        training_event: '$training_event',
        remarks: '$remarks'
      }
    }
  ]);

  res.json(rows);
});

const bulkAttendanceImport = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File is required' });
  }
  const records = parseCsvBuffer(req.file.buffer);
  let saved = 0;

  for (const record of records) {
    const student = await Student.findOne({ roll_number: record['roll number']?.toUpperCase() });
    if (!student) continue;
    const date = dayjs(record.date).startOf('day').toDate();
    await Attendance.findOneAndUpdate(
      { student_id: student._id, date },
      {
        am_attendance: record.am === '1' || record.am === 'true' || record.am === 'TRUE',
        pm_attendance: record.pm === '1' || record.pm === 'true' || record.pm === 'TRUE',
        training_event: record['training event'] || record.training_event,
        remarks: record.remarks
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    saved += 1;
  }

  res.json({ imported: saved });
});

module.exports = {
  markAttendance,
  getStudentAttendance,
  getStudentSummary,
  getDashboardStats,
  exportAttendance,
  bulkAttendanceImport
};

