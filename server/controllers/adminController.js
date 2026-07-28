const { loginAdmin, verifyToken } = require('../controllers/authController');

// Admin controller just re-exports auth functionality
// and adds any admin-specific operations

module.exports = { loginAdmin, verifyToken };
