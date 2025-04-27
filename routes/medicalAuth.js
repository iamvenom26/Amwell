// In routes/medicalAuth.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/medicalOwnerController');
const { checkForAthenticationCookie } = require('../middleware/authetication');

// Existing routes
router.get('/signup', controller.renderSignupPage);
router.get('/signin', controller.renderSigninPage);
router.get('/logout', controller.handleLogout);
router.post('/signup', controller.signup);
router.post('/signin', controller.signInAndGetConnectedUsers);
router.get('/dashboard', controller.getDashboard);
router.get('/realtime-chat/:userId', controller.handleGetRealtimeChat);

// New route for updating medical owner profile
router.get('/profile', checkForAthenticationCookie('token', ['medicalOwner']), controller.renderProfilePage);
router.post('/profile', checkForAthenticationCookie('token', ['medicalOwner']), controller.updateProfile);

module.exports = router;