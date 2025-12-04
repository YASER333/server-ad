const { Parser } = require('json2csv');

const attendanceToCsv = (rows = []) => {
  const fields = [
    { label: 'Student Name', value: 'student_name' },
    { label: 'Roll Number', value: 'roll_number' },
    { label: 'Department', value: 'department' },
    { label: 'Program Type', value: 'program_type' },
    { label: 'Date', value: 'date' },
    { label: 'AM', value: 'am_attendance' },
    { label: 'PM', value: 'pm_attendance' },
    { label: 'Training Event', value: 'training_event' },
    { label: 'Remarks', value: 'remarks' }
  ];
  const parser = new Parser({ fields });
  return parser.parse(rows);
};

const summaryToCsv = (rows = []) => {
  const fields = [
    { label: 'Student Name', value: 'student_name' },
    { label: 'Roll Number', value: 'roll_number' },
    { label: 'Department', value: 'department' },
    { label: 'Program Type', value: 'program_type' },
    { label: 'Full Days', value: 'fullDays' },
    { label: 'Half Days', value: 'halfDays' },
    { label: 'Absent Days', value: 'absentDays' },
    { label: 'Attendance %', value: 'percentage' }
  ];
  const parser = new Parser({ fields });
  return parser.parse(rows);
};

module.exports = {
  attendanceToCsv,
  summaryToCsv
};

