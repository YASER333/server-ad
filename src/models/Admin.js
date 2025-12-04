const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    password_hash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['ADMIN'],
      default: 'ADMIN'
    }
  },
  { timestamps: true }
);

adminSchema.methods.matchPassword = function matchPassword(plainText) {
  return bcrypt.compare(plainText, this.password_hash);
};

adminSchema.statics.hashPassword = function hashPassword(raw) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(raw, salt);
};

module.exports = mongoose.model('Admin', adminSchema);

