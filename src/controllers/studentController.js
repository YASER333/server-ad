const asyncHandler = require('../utils/asyncHandler');
const Student = require('../models/Student');
const { parseCsvBuffer, parseExcelBuffer } = require('../utils/importUtils');

const getStudents = asyncHandler(async (req, res) => {
  const { department, program_type, search } = req.query;
  const query = {};

  if (department) query.department = department;
  if (program_type) query.program_type = program_type;

  if (search) {
    query.$or = [
      { student_name: new RegExp(search, 'i') },
      { roll_number: new RegExp(search, 'i') },
    ];
  }

  const students = await Student.find(query)
    .sort({ department: 1, student_name: 1 })
    .select('-password_hash');

  res.json(students);
});

const createStudent = asyncHandler(async (req, res) => {
  const { student_name, roll_number, department, program_type } = req.body;

  const normalizedRoll = roll_number.toUpperCase();

  const exists = await Student.findOne({ roll_number: normalizedRoll });
  if (exists) {
    return res.status(400).json({ message: 'Roll number already exists' });
  }

  const student = await Student.create({
    student_name,
    roll_number: normalizedRoll,
    department,
    program_type,
    password_hash: Student.hashPassword(normalizedRoll),
  });

  res.status(201).json({
    id: student._id,
    student_name: student.student_name,
    roll_number: student.roll_number,
    department: student.department,
    program_type: student.program_type,
  });
});

const updateStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };

  // These must not be updated directly
  delete updates.roll_number;
  delete updates.password_hash;

  const student = await Student.findByIdAndUpdate(id, updates, {
    new: true,
  }).select('-password_hash');

  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  res.json(student);
});

const deleteStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await Student.findByIdAndDelete(id);
  res.json({ message: 'Student deleted' });
});

const importStudents = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File is required' });
  }

  console.log('📁 Received import file:', {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });

  const mime = req.file.mimetype;
  let parsed;

  try {
    if (mime === 'text/csv' || req.file.originalname.toLowerCase().endsWith('.csv')) {
      parsed = parseCsvBuffer(req.file.buffer);
    } else if (
      mime === 'application/vnd.ms-excel' ||
      mime ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      req.file.originalname.toLowerCase().endsWith('.xlsx') ||
      req.file.originalname.toLowerCase().endsWith('.xls')
    ) {
      parsed = parseExcelBuffer(req.file.buffer);
    } else {
      return res.status(400).json({ message: 'Unsupported file format' });
    }
  } catch (err) {
    console.error('❌ Error while parsing import file:', err);
    return res
      .status(400)
      .json({ message: err.message || 'Failed to parse import file' });
  }

  console.log(`✅ Parsed ${parsed.length} records from file`);

  const results = [];
  for (const record of parsed) {
    const roll = record.roll_number?.toUpperCase();
    if (!roll) continue;

    const payload = {
      student_name: record.student_name,
      department: record.department,
      program_type: record.program_type,
      password_hash: Student.hashPassword(roll),
    };

    const existing = await Student.findOneAndUpdate(
      { roll_number: roll },
      payload,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    results.push(existing);
  }

  console.log(`✅ Upserted ${results.length} students`);

  return res.json({
    imported: results.length,
    message: `Successfully imported ${results.length} students`,
  });
});

module.exports = {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  importStudents,
};
