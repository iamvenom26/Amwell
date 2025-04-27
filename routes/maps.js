const express = require('express');
const router = express.Router();
const mapsController = require('../controllers/maps');

// Route to get coordinates from an address
router.post('/get-coordinates', mapsController.getCoordinatesFromAddress);

// Route to get the nearest ambulance driver
router.get('/nearest-ambulance',mapsController.getNearestAmbulanceDriver);

module.exports = router;