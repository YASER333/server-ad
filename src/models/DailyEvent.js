const mongoose = require('mongoose');

const dailyEventSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true
    },
    event_name: {
      type: String,
      required: true,
      trim: true
    },
    event_description: {
      type: String,
      trim: true
    },
    completed: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

dailyEventSchema.index({ date: 1, event_name: 1 }, { unique: true });

module.exports = mongoose.model('DailyEvent', dailyEventSchema);

