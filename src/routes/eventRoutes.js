const express = require('express');
const {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent
} = require('../controllers/eventController');
const { protectAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', listEvents);
router.use(protectAdmin);
router.post('/', createEvent);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);

module.exports = router;

