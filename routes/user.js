const { Router } = require('express');
const userController = require('../controllers/user');
const multer = require('multer');
const path = require('path');
const User = require('../model/user');
const MedicalOwner = require('../model/medical');
const user = require('../model/user');
const mapController = require('../controllers/maps');

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



router.get('/get-ambulance', userController.getAllAmbulances);
router.get('/get-medical', userController.getNearMedical);



router.post('/clear-chatbot', userController.clearChatbot);


router.post('/update-location', async (req, res) => {
  try {
    console.log('Request User:', req.user); // Debugging
    console.log('Request Body:', req.body); // Debugging

    const userId = req.user._id; // Assuming the user is authenticated and `req.user` is populated
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).send('Invalid location data');
    }

    // Update the user's location in the database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude], // GeoJSON format: [longitude, latitude]
        },
      },
      { new: true } // Return the updated document
    );

    console.log('Updated User Location:', updatedUser.location); // Debugging
    res.status(200).send('Location updated successfully');
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).send('Failed to update location');
  }
});


module.exports = router;
