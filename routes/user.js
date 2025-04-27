const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const { checkForAthenticationCookie } = require('../middleware/authetication');

// Public routes
router.get('/signin', userController.renderSignInPage);
router.post('/signin', userController.handleSignIn);
router.post('/signup', userController.handleSignUp);

// Protected routes
router.get('/logout', checkForAthenticationCookie('token', ['user']), userController.handleLogout);
router.get('/chat', checkForAthenticationCookie('token', ['user']), userController.renderChatPage);
router.post('/chat', checkForAthenticationCookie('token', ['user']), userController.handleGeminiChat);
router.get('/chat/:userId', checkForAthenticationCookie('token', ['user']), userController.handleGetRealtimeChat);
router.get('/users', checkForAthenticationCookie('token', ['user']), userController.getAllUsersExceptCurrent);
router.get('/medical', checkForAthenticationCookie('token', ['user']), userController.getNearMedical);
router.delete('/chatbot', checkForAthenticationCookie('token', ['user']), userController.clearChatbot);
router.get('/ambulances', userController.getAllAmbulances);
router.get('/ambulance/:id', userController.getAmbulanceById);
router.get('/request-history', checkForAthenticationCookie('token', ['user']), userController.getRequestHistory);

module.exports = router;