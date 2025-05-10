// In routes/medicalAuth.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/medicalOwnerController');
const { checkForAthenticationCookie } = require('../middleware/authetication');

// Existing routes
const medicalUpload = require('../middleware/medicalUpload');
router.get('/signup', controller.renderSignupPage);
// In routes file
router.post('/signup', medicalUpload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'AmbulanceImage', maxCount: 1 }
]), controller.signup);

router.get('/signin', controller.renderSigninPage);
router.get('/logout', controller.handleLogout);

router.post('/signin', controller.signInAndGetConnectedUsers);
router.get('/dashboard', controller.getDashboard);
router.get('/realtime-chat/:userId', controller.handleGetRealtimeChat);

// New route for updating medical owner profile
router.get('/profile', checkForAthenticationCookie('token', ['medicalOwner']), controller.renderProfilePage);
router.post('/profile', checkForAthenticationCookie('token', ['medicalOwner']), controller.updateProfile);
router.get('/customers', checkForAthenticationCookie('token', ['medicalOwner']), controller.getAllCustomers);

module.exports = router;