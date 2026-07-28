const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
    createStation,
    getAllStations,
    getStation,
    updateStation,
    deleteStation,
    getStats,
    getStationBookings
} = require('../controllers/stationController');

// AUTH BYPASSED FOR DEMO
// GET /api/admin/stations/stats
router.get('/stats', getStats);

// GET /api/admin/stations/:id/bookings
router.get('/:id/bookings', getStationBookings);

// POST /api/admin/stations
router.post('/', upload.single('image'), createStation);

// POST /api/admin/stations/upload-image
router.post('/upload-image', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided.' });
        }
        const imageUrl = `/uploads/${req.file.filename}`;
        res.status(200).json({ imageUrl });
    } catch (error) {
        console.error('Upload image error:', error);
        res.status(500).json({ message: 'Failed to upload image.' });
    }
});

// GET /api/admin/stations
router.get('/', getAllStations);

// GET /api/admin/stations/:id
router.get('/:id', getStation);

// PUT /api/admin/stations/:id
router.put('/:id', upload.single('image'), updateStation);

// DELETE /api/admin/stations/:id
router.delete('/:id', deleteStation);

module.exports = router;
