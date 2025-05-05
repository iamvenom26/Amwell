const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const { checkForAthenticationCookie } = require('../middleware/authetication');
const multer = require('multer');
const path = require('path');
// Public routes
router.get('/signin', userController.renderSignInPage);
router.post('/signin', userController.handleSignIn);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.resolve('./public/uploads/profiles/')); // Changed path for profile photos
    },
    filename: function (req, file, cb) {
        const filename = `${Date.now()}-${file.originalname}`;
        cb(null, filename);
    },
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image.'), false);
        }
    }
});
router.post('/signup', upload.single('profileImage'), userController.handleSignUp);


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