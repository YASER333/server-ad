const dayjs = require('dayjs');
const asyncHandler = require('../utils/asyncHandler');
const Attendance = require('../models/Attendance');
const { summaryToCsv, rowsToExcelBuffer, buildDailyPdfBuffer, buildCompanyPdfBuffer, buildCompaniesSummaryPdfBuffer, buildDepartmentPdfBuffer } = require('../utils/reportUtils');
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
      trainer_name: { $first: '$trainer_name' },
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
      trainer_name: doc.trainer_name,
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
  const { date, department, program_type, minPercentage, maxPercentage } = req.query;
  const target = dayjs(date || new Date()).startOf('day').toDate();
  const pipeline = [
    { $match: { date: target } },
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
    $project: {
      student_name: '$student.student_name',
      roll_number: '$student.roll_number',
      department: '$student.department',
      program_type: '$student.program_type',
      am_attendance: '$am_attendance',
      pm_attendance: '$pm_attendance',
      training_event: '$training_event',
      trainer_name: '$trainer_name',
      training_company: '$training_company',
      remarks: '$remarks'
    }
  });

  const rows = await Attendance.aggregate(pipeline);

  let withPercentage = rows.map((r) => ({
    ...r,
    percentage: r.am_attendance && r.pm_attendance ? 100 : (r.am_attendance || r.pm_attendance ? 50 : 0)
  }));

  if (minPercentage != null || maxPercentage != null) {
    const min = minPercentage != null ? Number(minPercentage) : null;
    const max = maxPercentage != null ? Number(maxPercentage) : null;
    withPercentage = withPercentage.filter((r) => {
      if (min != null && r.percentage < min) return false;
      if (max != null && r.percentage > max) return false;
      return true;
    });
  }

  res.json(withPercentage);
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

// Exports moved to bottom after function declarations

// ===== New Handlers =====
const presenceFlag = (doc) => !!(doc.am_attendance || doc.pm_attendance);

const downloadDailyReport = asyncHandler(async (req, res) => {
  const { date, startDate, endDate, training_company, training_event, format = 'excel' } = req.query;
  const match = {};
  const dateMatch = date
    ? { $eq: dayjs(date).startOf('day').toDate() }
    : buildDateMatch(startDate, endDate);
  if (dateMatch) match.date = date ? dayjs(date).startOf('day').toDate() : dateMatch;
  if (training_company) match.training_company = training_company;
  if (training_event) match.training_event = training_event;

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
    {
      $project: {
        student_name: '$student.student_name',
        roll_number: '$student.roll_number',
        department: '$student.department',
        program_type: '$student.program_type',
        am_attendance: 1,
        pm_attendance: 1,
        training_event: 1,
        trainer_name: 1,
        training_company: 1,
        date: 1
      }
    }
  ]);

  const formatted = rows.map((r) => ({
    ...r,
    present: presenceFlag(r),
    dateStr: dayjs(r.date).format('YYYY-MM-DD')
  }));

  if (format === 'pdf') {
    const header = {
      company: training_company || '',
      event: training_event || '',
      dateRange: date
        ? dayjs(date).format('YYYY-MM-DD')
        : `${startDate ? dayjs(startDate).format('YYYY-MM-DD') : ''} ${startDate || endDate ? '-' : ''} ${endDate ? dayjs(endDate).format('YYYY-MM-DD') : ''}`
    };
    const pdf = await buildDailyPdfBuffer({ header, rows: formatted });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="daily-report.pdf"');
    return res.send(pdf);
  }

  const columns = [
    { header: 'Student Name', key: 'student_name' },
    { header: 'Roll Number', key: 'roll_number' },
    { header: 'Department', key: 'department' },
    { header: 'Present', key: 'present' },
    { header: 'Event', key: 'training_event' },
    { header: 'Trainer Name', key: 'trainer_name' },
    { header: 'Company', key: 'training_company' },
    { header: 'Date', key: 'dateStr' }
  ];
  const excel = rowsToExcelBuffer(formatted, columns, 'Daily');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="daily-report.xlsx"');
  return res.send(excel);
});

const downloadCompanyReport = asyncHandler(async (req, res) => {
  const { training_company, startDate, endDate, format = 'excel' } = req.query;
  const match = {};
  if (training_company) match.training_company = training_company;
  const dateMatch = buildDateMatch(startDate, endDate);
  if (dateMatch) match.date = dateMatch;

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
    {
      $group: {
        _id: { company: '$training_company', student_id: '$student._id' },
        company: { $first: '$training_company' },
        student_name: { $first: '$student.student_name' },
        department: { $first: '$student.department' }
      }
    },
    {
      $project: {
        _id: 0,
        company: 1,
        student_name: 1,
        department: 1
      }
    },
    { $sort: { company: 1, student_name: 1 } }
  ]);

  if (format === 'pdf') {
    const header = {
      company: training_company || '',
      dateRange: `${startDate ? dayjs(startDate).format('YYYY-MM-DD') : ''} ${startDate || endDate ? '-' : ''} ${endDate ? dayjs(endDate).format('YYYY-MM-DD') : ''}`
    };
    const pdf = await buildCompanyPdfBuffer({ header, rows });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="company-report.pdf"');
    return res.send(pdf);
  }

  const grouped = rows.reduce((acc, row) => {
    const company = row.company || 'Unknown Company';
    if (!acc[company]) acc[company] = [];
    acc[company].push(row);
    return acc;
  }, {});

  const flattened = [];
  Object.entries(grouped).forEach(([company, students]) => {
    flattened.push({ student_name: `Company: ${company}`, department: '' });
    students.forEach((s) => flattened.push({ student_name: s.student_name, department: s.department }));
    flattened.push({ student_name: 'Total Students', department: String(students.length) });
    flattened.push({ student_name: '', department: '' });
  });

  const columns = [
    { header: 'Student Name', key: 'student_name' },
    { header: 'Department', key: 'department' }
  ];
  const excel = rowsToExcelBuffer(flattened, columns, 'Company');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="company-report.xlsx"');
  return res.send(excel);
});

const downloadDepartmentReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, department, format = 'excel' } = req.query;
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

  pipeline.push({
    $project: {
      _id: 0,
      student_name: '$student.student_name',
      department: '$student.department',
      training_company: '$training_company',
      date: '$date'
    }
  });

  const rows = await Attendance.aggregate(pipeline);
  const formatted = rows.map((r) => ({
    ...r,
    dateStr: dayjs(r.date).format('YYYY-MM-DD')
  })).sort((a, b) => (a.department || '').localeCompare(b.department || '') || a.dateStr.localeCompare(b.dateStr));

  if (format === 'pdf') {
    const header = {
      dateRange: `${startDate ? dayjs(startDate).format('YYYY-MM-DD') : ''} ${startDate || endDate ? '-' : ''} ${endDate ? dayjs(endDate).format('YYYY-MM-DD') : ''}`,
      generatedOn: dayjs().format('YYYY-MM-DD')
    };
    const pdf = await buildDepartmentPdfBuffer({ header, rows: formatted });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="department-report.pdf"');
    return res.send(pdf);
  }

  const grouped = formatted.reduce((acc, row) => {
    const dept = row.department || 'Unknown Department';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(row);
    return acc;
  }, {});

  const flattened = [];
  Object.entries(grouped).forEach(([dept, items]) => {
    flattened.push({ student_name: `Department: ${dept}`, department: '', dateStr: '', training_company: '' });
    items.forEach((r) => {
      flattened.push({
        student_name: r.student_name,
        department: r.department,
        dateStr: r.dateStr,
        training_company: r.training_company || ''
      });
    });
    flattened.push({ student_name: 'Total Students', department: String(items.length), dateStr: '', training_company: '' });
    flattened.push({ student_name: '', department: '', dateStr: '', training_company: '' });
  });

  const columns = [
    { header: 'Student Name', key: 'student_name' },
    { header: 'Department', key: 'department' },
    { header: 'Date', key: 'dateStr' },
    { header: 'Company', key: 'training_company' }
  ];
  const excel = rowsToExcelBuffer(flattened, columns, 'Department');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="department-report.xlsx"');
  return res.send(excel);
});

const downloadCompaniesSummary = asyncHandler(async (req, res) => {
  const { period = 'week', format = 'excel', startDate, endDate } = req.query;
  let start;
  let end;
  if (startDate || endDate) {
    // Manual date range mode
    start = startDate ? dayjs(startDate) : dayjs(endDate);
    end = endDate ? dayjs(endDate) : dayjs(startDate);
  } else {
    // Period mode (week/month/year)
    end = dayjs().endOf('day');
    if (period === 'month') start = end.subtract(1, 'month');
    else if (period === 'year') start = end.subtract(1, 'year');
    else start = end.subtract(1, 'week');
  }

  const rows = await Attendance.aggregate([
    { $match: { date: { $gte: start.startOf('day').toDate(), $lte: end.endOf('day').toDate() } } },
    {
      $group: {
        _id: '$training_company',
        fromDate: { $min: '$date' },
        toDate: { $max: '$date' },
        total_students: {
          $sum: {
            $cond: [{ $or: ['$am_attendance', '$pm_attendance'] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        company: '$_id',
        from_to: {
          $concat: [
            { $dateToString: { format: '%Y-%m-%d', date: '$fromDate' } },
            ' - ',
            { $dateToString: { format: '%Y-%m-%d', date: '$toDate' } }
          ]
        },
        total_students: 1,
        _id: 0
      }
    },
    { $sort: { company: 1 } }
  ]);

  const dateRangeStr = `${dayjs(start).format('YYYY-MM-DD')} - ${dayjs(end).format('YYYY-MM-DD')}`;

  if (format === 'pdf') {
    const header = { dateRange: dateRangeStr };
    const pdf = await buildCompaniesSummaryPdfBuffer({ header, rows });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="companies-summary.pdf"');
    return res.send(pdf);
  }

  const columns = [
    { header: 'Company', key: 'company' },
    { header: 'Date (from - to)', key: 'from_to' },
    { header: 'Total Students', key: 'total_students' }
  ];
  const excel = rowsToExcelBuffer(rows, columns, 'Companies');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="companies-summary.xlsx"');
  return res.send(excel);
});

// Company names suggestions
const getCompanyNames = asyncHandler(async (req, res) => {
  const { search = '' } = req.query;
  const pipeline = [
    { $match: { training_company: { $exists: true, $ne: '' } } },
    { $project: { name: { $trim: { input: '$training_company' } } } },
    ...(search
      ? [{ $match: { name: { $regex: new RegExp(search, 'i') } } }]
      : []),
    { $group: { _id: { $toLower: '$name' }, name: { $first: '$name' } } },
    { $project: { _id: 0, name: 1 } },
    { $sort: { name: 1 } },
    { $limit: 20 }
  ];

  const rows = await Attendance.aggregate(pipeline);
  res.json(rows.map((r) => r.name));
});

module.exports = {
  getSummaryReport,
  downloadSummaryReport,
  getDailyReport,
  getWeeklyTrend,
  downloadDailyReport,
  downloadCompanyReport,
  downloadCompaniesSummary,
  downloadDepartmentReport,
  getCompanyNames
};

