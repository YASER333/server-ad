const express = require('express');
const {
  getSummaryReport,
  downloadSummaryReport,
  getDailyReport,
  getWeeklyTrend,
  downloadDailyReport,
  downloadCompanyReport,
  downloadCompaniesSummary,
  downloadDepartmentReport,
  getCompanyNames
} = require('../controllers/reportController');
const { protectAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protectAdmin);
router.get('/summary', getSummaryReport);
router.get('/summary/download', downloadSummaryReport);
router.get('/daily', getDailyReport);
router.get('/weekly-trend', getWeeklyTrend);
// New download routes
router.get('/daily/download', downloadDailyReport);
router.get('/company/download', downloadCompanyReport);
router.get('/department/download', downloadDepartmentReport);
router.get('/companies/summary/download', downloadCompaniesSummary);
router.get('/company/names', getCompanyNames);

module.exports = router;

