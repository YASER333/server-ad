const express = require('express');
const { adminLogin, studentLogin, logout } = require('../controllers/authController');

const router = express.Router();

router.post('/admin', adminLogin);
router.post('/student', studentLogin);
router.post('/logout', logout);

module.exports = router;

