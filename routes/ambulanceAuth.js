const express = require('express');
const router = express.Router();
const ambulanceController = require('../controllers/ambulanceController');
const { checkForAthenticationCookie } = require('../middleware/authetication');

// Public routes
router.get('/signup', ambulanceController.renderSignupPage);
router.post('/signup', ambulanceController.signup);
router.get('/signin', ambulanceController.renderSigninPage);
router.post('/signin', ambulanceController.signin);

// Protected routes
router.get('/dashboard', checkForAthenticationCookie('token', ['ambulance']), ambulanceController.getDashboard);
router.post('/status', checkForAthenticationCookie('token', ['ambulance']), ambulanceController.toggleStatus);
router.get('/live-location/:userId', checkForAthenticationCookie('token', ['ambulance']), ambulanceController.getLiveLocationData);
router.get('/chat/:userId', checkForAthenticationCookie('token', ['ambulance']), ambulanceController.handleGetRealtimeChat);
router.get('/request-history', checkForAthenticationCookie('token', ['ambulance']), ambulanceController.getRequestHistory);

module.exports = router;