// In routes/medicalAuth.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/medicalOwnerController');

router.get('/signup', controller.renderSignupPage);
router.get('/signin', controller.renderSigninPage);
router.post('/signup', controller.signup);
router.post('/signin', controller.signInAndGetConnectedUsers);
router.get('/dashboard', controller.getDashboard);
router.get('/realtime-chat/:userId', controller.handleGetRealtimeChat);
module.exports = router;