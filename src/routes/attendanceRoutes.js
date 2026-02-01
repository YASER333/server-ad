const express = require('express');
const multer = require('multer');
const {
  markAttendance,
  getStudentAttendance,
  getStudentSummary,
  getDashboardStats,
  exportAttendance,
  bulkAttendanceImport
} = require('../controllers/attendanceController');
const { protectAdmin, protectStudent } = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/mark', protectAdmin, markAttendance);
router.get('/dashboard', protectAdmin, getDashboardStats);
router.get('/export', protectAdmin, exportAttendance);
router.post('/bulk-import', protectAdmin, upload.single('file'), bulkAttendanceImport);
router.get('/student/:studentId', protectAdmin, getStudentAttendance);
router.get('/student/:studentId/summary', protectAdmin, getStudentSummary);
router.get('/me/history', protectStudent, (req, res, next) => {
  req.params.studentId = req.user._id;
  return getStudentAttendance(req, res, next);
});
router.get('/me/summary', protectStudent, getStudentSummary);

module.exports = router;

