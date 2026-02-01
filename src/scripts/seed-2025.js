require('dotenv').config();
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

const connectDB = require('../config/db');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const DailyEvent = require('../models/DailyEvent');

const COMPANIES = [
  'rvs training',
  'DCS',
  'TechNova',
  'SkillEdge',
  'CodeForge',
  'DataWorx',
  'SoftLabs'
];

const DEPARTMENTS = ['CSE', 'IT', 'ECE', 'EEE', 'CIVIL', 'MECH', 'MBA', 'MCA'];

const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function ensureStudents(count = 60) {
  const existing = await Student.countDocuments();
  if (existing >= count) return;
  const toCreate = [];
  for (let i = existing + 1; i <= count; i++) {
    const roll = `STU${String(i).padStart(3, '0')}`;
    toCreate.push({
      roll_number: roll,
      student_name: `Student ${i}`,
      department: randomPick(DEPARTMENTS),
      program_type: Math.random() > 0.3 ? 'UG' : 'PG',
      password_hash: Student.hashPassword('password')
    });
  }
  if (toCreate.length) await Student.insertMany(toCreate);
}

async function seedDailyEventsFor2025() {
  const start = dayjs('2025-01-01').startOf('day');
  const end = dayjs('2025-12-31').endOf('day');
  const ops = [];
  for (let d = start; d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
    const company = randomPick(COMPANIES);
    const event = `${company} Training`;
    ops.push({ date: d.toDate(), event_name: event, completed: true });
  }
  // Upsert by date+event
  for (const ev of ops) {
    await DailyEvent.updateOne({ date: ev.date, event_name: ev.event_name }, { $setOnInsert: ev }, { upsert: true });
  }
}

function randomPresent() {
  // ~85% chance present each half
  return Math.random() < 0.85;
}

async function seedAttendanceFor2025() {
  const students = await Student.find({}, { _id: 1 }).lean();
  if (!students.length) throw new Error('No students found to seed attendance');

  const start = dayjs('2025-01-01').startOf('day');
  const end = dayjs('2025-12-31').endOf('day');

  const bulk = [];
  for (let d = start; d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
    const company = randomPick(COMPANIES);
    const event = `${company} Training`;
    const dateObj = d.toDate();
    for (const s of students) {
      const am = randomPresent();
      const pm = randomPresent();
      bulk.push({
        insertOne: {
          document: {
            student_id: s._id,
            date: dateObj,
            am_attendance: am,
            pm_attendance: pm,
            training_event: event,
            training_company: company,
            remarks: am || pm ? 'present' : 'absent'
          }
        }
      });
    }
  }

  // Insert in manageable batches
  const BATCH = 5000;
  for (let i = 0; i < bulk.length; i += BATCH) {
    const slice = bulk.slice(i, i + BATCH);
    await Attendance.bulkWrite(slice, { ordered: false }).catch(() => {});
    console.log(`Inserted ${Math.min(i + BATCH, bulk.length)} / ${bulk.length}`);
  }
}

async function run() {
  await connectDB();
  console.log('Seeding demo data for year 2025...');
  await ensureStudents(60);
  await seedDailyEventsFor2025();
  await seedAttendanceFor2025();
  console.log('✅ Seeding completed');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
