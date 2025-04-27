const express = require('express');
const router = express.Router();
const controller = require('../controllers/ambulanceController');
const { checkForAthenticationCookie } = require('../middleware/authetication');

// Public routes
router.get('/signup', (req, res) => {
  res.render('ambulance/signup');
});

router.get('/signin', (req, res) => {
  res.render('ambulance/signin');
});

router.post('/signup', controller.signup);
router.post('/signin', controller.signin);

// Protected routes
router.get('/dashboard', checkForAthenticationCookie('token', ['ambulance']), controller.getDashboard);
router.post('/toggle-status', checkForAthenticationCookie('token', ['ambulance']), controller.toggleStatus);
router.get(
  '/live-location/:userId',
  checkForAthenticationCookie('token', ['ambulance']),
  controller.getLiveLocationData
);
router.get('/realtime-chat/:userId',checkForAthenticationCookie('token', ['ambulance']),controller.handleGetRealtimeChat);

module.exports = router;