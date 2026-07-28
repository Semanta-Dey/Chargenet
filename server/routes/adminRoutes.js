const express = require('express');
const router = express.Router();
const { loginAdmin, verifyToken } = require('../controllers/authController');
const { adminAuth } = require('../middleware/auth');

// POST /api/admin/login
router.post('/login', loginAdmin);

// GET /api/admin/verify
router.get('/verify', adminAuth, verifyToken);

module.exports = router;
