const { Router } = require('express');
const userController = require('../controllers/user');
const multer = require('multer');
const path = require('path');
const User = require('../model/user');
const MedicalOwner = require('../model/medical');
const user = require('../model/user');

const router = Router();

///////////////////////
// 📁 Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.resolve('./public/uploads/profiles/')); // Profile photo upload location
  },
  filename: function (req, file, cb) {
    const filename = `${Date.now()}-${file.originalname}`;
    cb(null, filename);
  }
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

///////////////////////
// 🛡️ Auth Routes
router.get('/signin', userController.renderSignInPage);
router.post('/signin', userController.handleSignIn);
router.post('/signup', userController.handleSignUp);
router.get('/logout', userController.handleLogout);



router.get('/realtime-chat/:userId',userController.handleGetRealtimeChat);
router.get('/show-chat', userController.getAllUsersExceptCurrent);
router.post('/chatbot', userController.handleGeminiChat);
router.get('/get-chat', userController.renderChatPage);
router.get('/get-map',userController.getLiveMap);
router.get('/get-medical', userController.getNearMedical);
router.post('/clear-chatbot', userController.clearChatbot);
///////////////////////
// 💬 Realtime Chat Route

///////////////////////
module.exports = router;
