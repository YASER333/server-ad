const express = require('express');
const multer = require('multer');
const {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  importStudents
} = require('../controllers/studentController');
const { protectAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(protectAdmin);

router.get('/', getStudents);
router.post('/', createStudent);
router.put('/:id', updateStudent);
router.delete('/:id', deleteStudent);

// FIELD NAME MUST BE "file"
router.post('/import', upload.single('file'), importStudents);

module.exports = router;
