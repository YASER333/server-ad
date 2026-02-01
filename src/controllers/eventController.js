const dayjs = require('dayjs');
const asyncHandler = require('../utils/asyncHandler');
const DailyEvent = require('../models/DailyEvent');

const listEvents = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = {};
  if (startDate || endDate) {
    match.date = {
      ...(startDate ? { $gte: dayjs(startDate).startOf('day').toDate() } : {}),
      ...(endDate ? { $lte: dayjs(endDate).endOf('day').toDate() } : {})
    };
  }
  const events = await DailyEvent.find(match).sort({ date: 1 });
  res.json(events);
});

const createEvent = asyncHandler(async (req, res) => {
  const { date, event_name, event_description, completed } = req.body;
  const event = await DailyEvent.create({
    date: dayjs(date).startOf('day').toDate(),
    event_name,
    event_description,
    completed: Boolean(completed)
  });
  res.status(201).json(event);
});

const updateEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  if (updates.date) {
    updates.date = dayjs(updates.date).startOf('day').toDate();
  }
  const event = await DailyEvent.findByIdAndUpdate(id, updates, { new: true });
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }
  res.json(event);
});

const deleteEvent = asyncHandler(async (req, res) => {
  await DailyEvent.findByIdAndDelete(req.params.id);
  res.json({ message: 'Event deleted' });
});

module.exports = {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent
};

