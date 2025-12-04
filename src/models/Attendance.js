const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    am_attendance: {
      type: Boolean,
      default: false
    },
    pm_attendance: {
      type: Boolean,
      default: false
    },
    training_event: {
      type: String,
      trim: true
    },
    remarks: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

attendanceSchema.index({ student_id: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);

