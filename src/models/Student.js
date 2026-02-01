const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema(
  {
    roll_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    student_name: {
      type: String,
      required: true,
      trim: true
    },
    department: {
      type: String,
      required: true,
      trim: true
    },
    program_type: {
      type: String,
      enum: ['UG', 'PG'],
      required: true
    },
    password_hash: {
      type: String,
      required: true
    },
    created_date: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

studentSchema.methods.matchPassword = function matchPassword(plainText) {
  return bcrypt.compare(plainText, this.password_hash);
};

studentSchema.statics.hashPassword = function hashPassword(raw) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(raw, salt);
};

module.exports = mongoose.model('Student', studentSchema);

