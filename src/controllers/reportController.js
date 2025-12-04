const dayjs = require('dayjs');
const asyncHandler = require('../utils/asyncHandler');
const Attendance = require('../models/Attendance');
const { summaryToCsv } = require('../utils/reportUtils');
const { calculatePercentage } = require('../utils/attendanceUtils');

const buildDateMatch = (startDate, endDate) => {
  if (!startDate && !endDate) return undefined;
  return {
    ...(startDate ? { $gte: dayjs(startDate).startOf('day').toDate() } : {}),
    ...(endDate ? { $lte: dayjs(endDate).endOf('day').toDate() } : {})
  };
};

const buildSummaryPipeline = ({ startDate, endDate, department, program_type }) => {
  const match = {};
  const dateMatch = buildDateMatch(startDate, endDate);
  if (dateMatch) match.date = dateMatch;

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'students',
        localField: 'student_id',
        foreignField: '_id',
        as: 'student'
      }
    },
    { $unwind: '$student' }
  ];

  if (department) pipeline.push({ $match: { 'student.department': department } });
  if (program_type) pipeline.push({ $match: { 'student.program_type': program_type } });

  pipeline.push({
    $group: {
      _id: '$student._id',
      student_name: { $first: '$student.student_name' },
      roll_number: { $first: '$student.roll_number' },
      department: { $first: '$student.department' },
      program_type: { $first: '$student.program_type' },
      totalDays: { $sum: 1 },
      fullDays: {
        $sum: {
          $cond: [{ $and: ['$am_attendance', '$pm_attendance'] }, 1, 0]
        }
      },
      halfDays: {
        $sum: {
          $cond: [
            {
              $and: [
                { $or: ['$am_attendance', '$pm_attendance'] },
                { $not: { $and: ['$am_attendance', '$pm_attendance'] } }
              ]
            },
            1,
            0
          ]
        }
      },
      absentDays: {
        $sum: {
          $cond: [
            { $and: [{ $not: '$am_attendance' }, { $not: '$pm_attendance' }] },
            1,
            0
          ]
        }
      }
    }
  });

  return pipeline;
};

const summarizePipelineResults = (docs) =>
  docs.map((doc) => {
    const presentValue = doc.fullDays + doc.halfDays * 0.5;
    const percentage = doc.totalDays ? Number(((presentValue / doc.totalDays) * 100).toFixed(2)) : 0;
    return {
      student_name: doc.student_name,
      roll_number: doc.roll_number,
      department: doc.department,
      program_type: doc.program_type,
      fullDays: doc.fullDays,
      halfDays: doc.halfDays,
      absentDays: doc.absentDays,
      totalDays: doc.totalDays,
      percentage
    };
  });

const filterByPercentage = (summary, min, max) => {
  if (min == null && max == null) return summary;
  return summary.filter((row) => {
    if (min != null && row.percentage < Number(min)) return false;
    if (max != null && row.percentage > Number(max)) return false;
    return true;
  });
};

const getSummaryReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, department, program_type, minPercentage, maxPercentage } = req.query;
  const pipeline = buildSummaryPipeline({ startDate, endDate, department, program_type });
  const docs = await Attendance.aggregate(pipeline);
  const summary = summarizePipelineResults(docs);
  const filtered = filterByPercentage(summary, minPercentage, maxPercentage);
  res.json(filtered);
});

const downloadSummaryReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, department, program_type, minPercentage, maxPercentage } = req.query;
  const pipeline = buildSummaryPipeline({ startDate, endDate, department, program_type });
  const docs = await Attendance.aggregate(pipeline);
  const summary = filterByPercentage(summarizePipelineResults(docs), minPercentage, maxPercentage);
  const csv = summaryToCsv(summary);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=\"attendance-summary.csv\"');
  res.send(csv);
});

const getDailyReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const target = dayjs(date || new Date()).startOf('day').toDate();
  const rows = await Attendance.aggregate([
    { $match: { date: target } },
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
      $project: {
        student_name: '$student.student_name',
        roll_number: '$student.roll_number',
        department: '$student.department',
        program_type: '$student.program_type',
        am_attendance: '$am_attendance',
        pm_attendance: '$pm_attendance',
        training_event: '$training_event',
        remarks: '$remarks'
      }
    }
  ]);

  res.json(rows);
});

const getWeeklyTrend = asyncHandler(async (req, res) => {
  const { weeks = 4 } = req.query;
  const end = dayjs().endOf('day').toDate();
  const start = dayjs().subtract(Number(weeks), 'week').startOf('day').toDate();

  const rows = await Attendance.aggregate([
    { $match: { date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { $isoWeek: '$date' },
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
        days: { $sum: 1 }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  res.json(rows);
});

module.exports = {
  getSummaryReport,
  downloadSummaryReport,
  getDailyReport,
  getWeeklyTrend
};

