// In controllers/medicalOwnerController.js
const MedicalOwner = require('../model/medical');
const Message = require('../model/message');
const User = require('../model/user');
const { createTokenForUser } = require('../service/authentication');
const mongoose = require('mongoose');
const path = require('path');

exports.renderSignupPage = (req, res) => {
  res.render('medical/signup'); // Ensure 'signup.ejs' exists
};

exports.renderSigninPage = (req, res) => {
  res.render('medical/signin'); // Ensure 'signin.ejs' exists
};

exports.signup = async (req, res) => {
  try {
    const {
      fullName,
      storeName,
      email,
      contactNumber,
      address,
      startedOn,
      password,
      latitude,
      longitude,
    } = req.body;

    if (
      latitude === undefined ||
      longitude === undefined ||
      isNaN(Number(latitude)) ||
      isNaN(Number(longitude))
    ) {
      return res.status(400).json({ message: 'Invalid or missing latitude and longitude' });
    }

    const existing = await MedicalOwner.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const location = {
      type: 'Point',
      coordinates: [Number(longitude), Number(latitude)],
    };
    const profileImage = req.files['profileImage'] ? 
      '/uploads/profiles/' + path.basename(req.files['profileImage'][0].path) : '';
    
    const shopImage = req.files['AmbulanceImage'] ? 
      '/uploads/shops/' + path.basename(req.files['AmbulanceImage'][0].path) : '';

    const newOwner = new MedicalOwner({
      fullName,
      storeName,
      email,
      contactNumber,
      address,
      startedOn,
      password,
      location,
      profileImage,
      AmbulanceImage: shopImage
    });

    await newOwner.save();
    res.redirect('/medical/signin');
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ message: 'Something went wrong during signup' });
  }
};

exports.signInAndGetConnectedUsers = async (req, res) => {
  try {
    const { email, password } = req.body;

    const owner = await MedicalOwner.findOne({ email });
    if (!owner) {
      return res.render('medical/signin', { error: 'No user found' });
    }

    const isMatch = await owner.comparePassword(password); // Assumes bcrypt
    if (!isMatch) {
      return res.render('signin', { error: 'Invalid password' });
    }

    const token = createTokenForUser(owner);
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.redirect('/medical/dashboard');
  } catch (err) {
    console.error('Sign-in error:', err.message);
    res.render('signin', { error: 'Something went wrong during login' });
  }
};
///////////////////////////////////////
exports.getDashboard = async (req, res) => {
  const currentUser = req.user;
  if (!currentUser || currentUser.role !== 'medicalOwner') {
    console.error('Unauthorized dashboard access:', currentUser?._id);
    return res.status(401).render('error', { error: 'Unauthorized access. Please sign in.' });
  }
  try {
    const messages = await Message.find({
      receiver: currentUser._id,
      receiverModel: 'MedicalOwner',
      senderModel: 'User',
      sender: { $ne: currentUser._id }, // Exclude current MedicalOwner
    }).distinct('sender');
    const users = await User.find({
      _id: { $in: messages, $ne: currentUser._id }, // Exclude current MedicalOwner
    }).lean();
    res.render('medical/home', { users, user: currentUser });
  } catch (error) {
    console.error('Error fetching dashboard:', error.message, { stack: error.stack });
    res.render('medical/home', { users: [], user: currentUser });
  }
};
/////////////////////////////////////////////
exports.handleGetRealtimeChat = async (req, res) => {
  try {
    const currentUser = req.user;
    const receiverId = req.params.userId;

    if (String(receiverId) === String(currentUser._id)) {
      return res.status(400).send("Cannot chat with yourself");
    }

    let receiver = await User.findById(receiverId).lean();
    let receiverRole = 'User';
    if (!receiver) {
      receiver = await MedicalOwner.findById(receiverId).lean();
      if (receiver) receiverRole = 'MedicalOwner';
    }
    if (!receiver) return res.status(404).send("Receiver not found");

    const room = [String(currentUser._id), String(receiver._id)].sort().join('_');
    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: receiver._id },
        { sender: receiver._id, receiver: currentUser._id }
      ]
    }).sort('timestamp');

    res.render('medical/realtime-chat', {
      receiver,
      receiverRole,
      messages,
      currentUser,
      currentRole: currentUser.role === 'medical' ? 'MedicalOwner' : 'User',
      room,
      receiverId
    });
  } catch (err) {
    res.status(500).send("Something went wrong");
  }
}; 

exports.renderProfilePage = async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'medicalOwner') {
      return res.status(401).render('error', { error: 'Unauthorized access. Please sign in.' });
    }

    const medicalOwner = await MedicalOwner.findById(currentUser._id).lean();
    if (!medicalOwner) {
      return res.status(404).render('error', { error: 'Medical owner not found.' });
    }

    // Pass success and error variables to the template
    res.render('medical/profile', { medicalOwner, success: null, error: null });
  } catch (err) {
    console.error('Error rendering profile page:', err.message);
    res.status(500).render('error', { error: 'Something went wrong.' });
  }
};

// exports.updateProfile = async (req, res) => {
//   try {
//     const currentUser = req.user;
//     if (!currentUser || currentUser.role !== 'medicalOwner') {
//       return res.status(401).render('error', { error: 'Unauthorized access. Please sign in.' });
//     }

//     const { fullName, storeName, email, contactNumber, address } = req.body;

//     const updatedData = {
//       fullName,
//       storeName,
//       email,
//       contactNumber,
//       address,
//     };

//     const updatedMedicalOwner = await MedicalOwner.findByIdAndUpdate(
//       currentUser._id,
//       updatedData,
//       { new: true, runValidators: true }
//     );

//     // Pass success message to the template
//     res.render('medical/profile', { medicalOwner: updatedMedicalOwner, success: 'Profile updated successfully.', error: null });
//   } catch (err) {
//     console.error('Error updating profile:', err.message);
//     res.status(500).render('medical/profile', { medicalOwner: req.user, success: null, error: 'Something went wrong while updating the profile.' });
//   }
// };
exports.handleLogout = (req, res) => {
  try {
    // Clear the authentication cookie
    res.clearCookie('token');
    res.redirect('/medical/signin'); // Redirect to the signin page
  } catch (err) {
    console.error('Error during logout:', err.message);
    res.status(500).send('Something went wrong during logout.');
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { fullName, storeName, email, contactNumber, address, latitude, longitude } = req.body;
    const medicalOwner = await MedicalOwner.findById(req.user.id);
    if (!medicalOwner) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Update fields
    medicalOwner.fullName = fullName || medicalOwner.fullName;
    medicalOwner.storeName = storeName || medicalOwner.storeName;
    medicalOwner.email = email || medicalOwner.email;
    medicalOwner.contactNumber = contactNumber || medicalOwner.contactNumber;
    medicalOwner.address = address || medicalOwner.address;
    medicalOwner.latitude = latitude || medicalOwner.latitude;
    medicalOwner.longitude = longitude || medicalOwner.longitude;

    // Handle profile image
    if (req.files?.profileImage) {
      if (medicalOwner.profileImage) {
        const oldImagePath = path.join(__dirname, '..', 'Uploads', medicalOwner.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      medicalOwner.profileImage = req.files.profileImage[0].filename;
    }

    // Handle ambulance image
    if (req.files?.AmbulanceImage) {
      if (medicalOwner.AmbulanceImage) {
        const oldImagePath = path.join(__dirname, '..', 'Uploads', medicalOwner.AmbulanceImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      medicalOwner.AmbulanceImage = req.files.AmbulanceImage[0].filename;
    }

    await medicalOwner.save();

    res.render('medicalProfile', {
      medicalOwner,
      error: null,
      success: 'Profile updated successfully!'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.render('medicalProfile', {
      medicalOwner: req.user,
      error: 'Failed to update profile',
      success: null
    });
  }
};


exports.getAllCustomers = async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'medicalOwner') {
      return res.status(401).render('error', { error: 'Unauthorized access. Please sign in.' });
    }  
    const customers = await User.find({}).lean();
    res.render('medical/customers', { customers, user: currentUser });      
  }    
  catch (error) {
    console.error('Error fetching customers:', error.message);
    res.status(500).render('error', { error: 'Something went wrong.' });
  }  
}