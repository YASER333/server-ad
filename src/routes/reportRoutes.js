const express = require('express');
const {
  getSummaryReport,
  downloadSummaryReport,
  getDailyReport,
  getWeeklyTrend
} = require('../controllers/reportController');
const { protectAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protectAdmin);
router.get('/summary', getSummaryReport);
router.get('/summary/download', downloadSummaryReport);
router.get('/daily', getDailyReport);
router.get('/weekly-trend', getWeeklyTrend);

module.exports = router;

