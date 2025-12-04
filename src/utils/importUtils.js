const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');

// Allow a few variations of column names
const HEADER_ALIASES = {
  student_name: ['student name', 'name', 'student_name'],
  roll_number: ['roll number', 'roll no', 'roll_no', 'reg no', 'regno'],
  department: ['department', 'dept'],
  program_type: ['program type', 'program', 'program_type'],
};

const normalizeHeader = (header) => header.trim().toLowerCase();

const findColumnKey = (normalizedHeaders, aliases) => {
  return Object.keys(normalizedHeaders).find((key) =>
    aliases.includes(normalizedHeaders[key])
  );
};

const validateAndMapHeaders = (headers) => {
  const normalizedHeaders = {};
  headers.forEach((h) => {
    normalizedHeaders[h] = normalizeHeader(h);
  });

  const mapped = {};

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const key = findColumnKey(normalizedHeaders, aliases);
    if (!key) {
      throw new Error(
        `Missing required column for "${field}". Expected one of: ${aliases.join(
          ', '
        )}`
      );
    }
    mapped[field] = key;
  }

  return mapped; // { student_name: 'Student Name', roll_number: 'Roll No', ... }
};

const mapRecord = (record, headerMap) => ({
  student_name: record[headerMap.student_name],
  roll_number: record[headerMap.roll_number],
  department: record[headerMap.department],
  program_type: record[headerMap.program_type],
});

const parseCsvBuffer = (buffer) => {
  const text = buffer.toString('utf-8');
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (!records.length) {
    throw new Error('CSV has no rows');
  }

  const headers = Object.keys(records[0]);
  const headerMap = validateAndMapHeaders(headers);

  return records.map((rec) => mapRecord(rec, headerMap));
};

const parseExcelBuffer = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const [sheetName] = workbook.SheetNames;
  const worksheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (!json.length) {
    throw new Error('Excel has no rows');
  }

  const headers = Object.keys(json[0]);
  const headerMap = validateAndMapHeaders(headers);

  return json.map((row) => mapRecord(row, headerMap));
};

module.exports = {
  parseCsvBuffer,
  parseExcelBuffer,
};
