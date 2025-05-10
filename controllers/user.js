const User = require('../model/user');
const MedicalOwner = require('../model/medical');
const Message = require('../model/message');
const Ambulance = require('../model/ambulance');
const mongoose = require('mongoose');
// Render Login Page
exports.renderSignInPage = (req, res) => {
  res.render('user/login', { error: null });
};

// Handle Login
exports.handleSignIn = async (req, res) => {
  const { email, password } = req.body;
  try {
    const token = await User.matchPasswordAndGenerateToken(email, password);
    res.cookie('token', token).redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.render('user/login', { error: 'Incorrect Email or Password' });
  }
};

// Handle Sign Up
exports.handleSignUp = async (req, res) => {
  const { FullName, email, password, mobileNumber, liveLocation } = req.body;
  
  const profileImagePath = req.file
  ? '/uploads/profiles/' + req.file.filename
  : '/uploads/profiles/default.png'; // or req.file.path if saving full path
  console.log('Received signup data:', req.body);
  console.log('Uploaded file:', req.file);

  try {
    const user = await User.create({ 
      FullName, 
      email, 
      password, 
      mobileNumber, 
      liveLocation,
      profileImage:profileImagePath,
    });
    console.log('User created:', user);
    res.redirect('/user/signin');
  } catch (error) {
    console.error('Signup error:', error);
    res.render('user/login', { error: 'User registration failed. Try again!' });
  }
};

// Logout
exports.handleLogout = (req, res) => {
  res.clearCookie('token').redirect('/');
};




// Route for handling chat and saving messages
exports.handleGetRealtimeChat = async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      console.error('Unauthorized: No currentUser in req.user');
      return res.status(401).send('Unauthorized');
    }
    console.log(`Current user: ${currentUser._id} (${currentUser.role})`);

    const receiverId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      console.error('Invalid receiverId:', receiverId);
      return res.status(400).send('Invalid user ID');
    }

    // Determine sender model
    const currentRole =
      currentUser.role?.toLowerCase() === 'user'
        ? 'User'
        : currentUser.role?.toLowerCase() === 'ambulance'
        ? 'Ambulance'
        : 'MedicalOwner';

    // Find receiver and extract profileImage
    let receiver = await User.findById(receiverId).lean();
    let receiverRole = 'User';
    let receiverProfileImage = receiver?.profileImage || null; // Extract profileImage

    if (!receiver) {
      receiver = await MedicalOwner.findById(receiverId).lean();
      if (receiver) {
        receiverRole = 'MedicalOwner';
        receiverProfileImage = receiver?.profileImage || null; // Extract profileImage
      }
    }

    if (!receiver) {
      receiver = await Ambulance.findById(receiverId).lean();
      if (receiver) {
        receiverRole = 'Ambulance';
        receiverProfileImage = receiver?.profileImage || null; // Extract profileImage
      }
    }

    if (!receiver) {
      console.error('Receiver not found:', receiverId);
      return res.status(404).send('Receiver not found');
    }
    console.log(`Receiver: ${receiver._id} (${receiverRole})`);

    // Generate room name
    const room = [String(currentUser._id), String(receiver._id)].sort().join('_');
    console.log(`Chat room: ${room}`);

    // Fetch messages
    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: receiver._id },
        { sender: receiver._id, receiver: currentUser._id },
      ],
    }).sort('timestamp');

    // Save message if provided
    if (req.body.messageContent) {
      await exports.saveMessage(
        currentUser,
        receiver,
        req.body.messageContent,
        currentRole,
        receiverRole
      );
    }

    // Pass receiverProfileImage to the template
    res.render('user/realtime-chat', {
      receiver,
      receiverRole,
      messages,
      currentUser,
      currentRole,
      room,
      receiverId,
      receiverProfileImage, // Added
    });
  } catch (err) {
    console.error('❌ Error in handleGetRealtimeChat:', err.message);
    res.status(500).send('Something went wrong');
  }
};

exports.getAllUsersExceptCurrent = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const users = await User.find({ _id: { $ne: currentUserId } }); // Exclude current user

    res.render('users', { users });
  } catch (error) {
    console.error('⚠️ Error fetching users:', error.message);
    res.status(500).send('Something went wrong while fetching users.');
  }
};

exports.renderChatPage = (req, res) => {
  res.render('user/chat', { userMessage: null, botResponse: null });
};

// Handle Chatbot Interaction with Gemini API
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Hardcoded bot ID (replace with your own valid ObjectId)
const BOT_ID = '68054983ad610e5b2891cdc8'; // Example ObjectId

exports.handleGeminiChat = async (req, res) => {
  const userMessage = req.body.message;
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).send('Unauthorized');
  }

  try {
    // Save user's message
    if (userMessage) {
      await Message.create({
        sender: currentUser._id,
        senderModel: 'User',
        receiver: BOT_ID,
        receiverModel: 'MedicalOwner',
        message: userMessage,
      });
    }

    // Get bot response
    let botResponse = '';
    if (userMessage) {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
      const result = await model.generateContent(userMessage);
      botResponse = result.response.text();

      // Clean and sanitize
      botResponse = botResponse.replace(/\n{3,}/g, '\n\n').trim();
      const htmlResponse = marked(botResponse);
      botResponse = sanitizeHtml(htmlResponse, {
        allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'strong', 'em', 'a', 'code', 'pre', 'blockquote', 'span', 'div'],
        allowedAttributes: { a: ['href', 'target', 'rel'], code: ['class'] },
        allowedClasses: { code: ['language-*'] },
        selfClosing: ['br'],
        allowedSchemes: ['http', 'https'],
        transformTags: {
          a: (tagName, attribs) => ({
            tagName: 'a',
            attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
          }),
        },
      });

      // Save bot's response
      await Message.create({
        sender: BOT_ID,
        senderModel: 'MedicalOwner',
        receiver: currentUser._id,
        receiverModel: 'User',
        message: botResponse,
      });
    }

    // Fetch conversation history
    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: BOT_ID },
        { sender: BOT_ID, receiver: currentUser._id },
      ],
    }).sort('timestamp');

    res.render('user/chat', {
      userMessage,
      botResponse,
      messages,
      currentUser,
      bot: { fullName: 'Amwell Bot', _id: BOT_ID },
    });

  } catch (error) {
    console.error('⚠️ Error in handleGeminiChat:', error.message);
    res.render('user/chat', {
      userMessage,
      botResponse: '<p>⚠️ Something went wrong.</p>',
      messages: [],
      currentUser,
      bot: { fullName: 'Amwell Bot', _id: BOT_ID },
    });
  }
};

exports.renderChatPage = async (req, res) => {
  const currentUser = req.user;
  const profileImagePath = currentUser.profileImage || '/uploads/profiles/default.png'; // Default image path
  if (!currentUser) {
    return res.status(401).send('Unauthorized');
  }

  try {
    // Fetch conversation history
    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: BOT_ID },
        { sender: BOT_ID, receiver: currentUser._id },
      ],
    }).sort('timestamp');

    res.render('user/chat', {
      userMessage: null,
      botResponse: null,
      messages,
      currentUser,
      bot: { fullName: 'Amwell Bot', _id: BOT_ID },
      profileImage:profileImagePath,
    });
  } catch (error) {
    console.error('⚠️ Error rendering chat page:', error.message);
    res.render('user/chat', {
      userMessage: null,
      botResponse: null,
      messages: [],
      currentUser,
      bot: { fullName: 'Amwell Bot', _id: BOT_ID },
    });
  }
};




exports.getNearMedical = async (req, res) => {
  const { lat = 21.25, lng = 78.27 } = req.query; // fallback to Amravati

  try {
    const stores = await MedicalOwner.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
         // $maxDistance: 50000 // within 50 km
        }
      }
    }).lean(); // Use lean() for better performance

    // Get the authenticated user from req.user
    const user = req.user;

    // Pass both stores and user to the template
    res.render('user/medical-list', { 
      stores,
      user,
      userLocation: {
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      }
    });

  } catch (err) {
    console.error('GeoQuery error:', err);
    res.status(500).send('Something went wrong.');
  }
};
// In user.js (add after handleGeminiChat)
exports.clearChatbot = async (req, res) => {
  const currentUser = req.user;
  const BOT_ID = '68054983ad610e5b2891cdc8'; // Match your BOT_ID

  if (!currentUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await Message.deleteMany({
      $or: [
        { sender: currentUser._id, receiver: BOT_ID },
        { sender: BOT_ID, receiver: currentUser._id },
      ],
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('⚠️ Error clearing chatbot history:', error.message);
    res.status(500).json({ error: 'Failed to clear chat' });
  }
};


exports.getAllAmbulances = async (req, res) => {
  try {
    // Fetch all ambulances
    const ambulances = await Ambulance.find({}).lean();

    // Pass the ambulances variable to the view
    res.render('user/ambulance-list', { ambulances ,user:req.user});  // Pass user to the view for authentication check});
  } catch (err) {
    console.error('Error fetching ambulances:', err);
    res.status(500).send('Something went wrong.');
  }
};

exports.getAmbulanceById = async (req, res) => {
  const ambulanceId = req.params.id;
  try {
    if (!req.user) {
      console.log(`[getAmbulanceById] No user authenticated, redirecting to signin`);
      return res.redirect('/user/signin');
    }

    const ambulance = await Ambulance.findById(ambulanceId).lean();
    if (!ambulance) {
      console.log(`[getAmbulanceById] Ambulance not found: ${ambulanceId}`);
      return res.status(404).send('Ambulance not found');
    }
console.log(req.user);
    // Check if the user is authenticated and has a valid _id
    const userName = req.user.FullName?.trim() || req.user.fullName?.trim() || req.user.name?.trim() || 'Unknown User';


    console.log(`[getAmbulanceById] Rendering ambulance page for user: ${req.user._id}, ambulance: ${ambulanceId}`);
    res.render('user/ambulance', {
      ambulance,
      user: req.user,
      userId: req.user._id.toString(),
      userName,
    });
  } catch (error) {
    console.error(`[getAmbulanceById] Error fetching ambulance: ${ambulanceId}`, error);
    res.status(500).send('Something went wrong.');
  }
};
const axios = require('axios');
const user = require('../model/user');


exports.getAddressFromCoordinates = async (req, res) => {
  const { latitude, longitude } = req.query;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  console.log('Debug Info:');
  console.log('Latitude:', latitude);
  console.log('Longitude:', longitude);
  console.log('Google Maps API Key:', apiKey ? 'Loaded' : 'NOT LOADED');

  if (!latitude || !longitude) {
    console.error('Latitude and longitude are required.');
    return res.status(400).send('Latitude and longitude are required.');
  }

  try {
    const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
      params: {
        latlng: `${latitude},${longitude}`,
        key: apiKey,
      },
    });

    if (response.data.status !== 'OK') {
      console.error('Google API Response:', response.data);
      throw new Error(response.data.error_message || 'Failed to fetch address.');
    }

    const address = response.data.results[0]?.formatted_address || 'Address not found';
    res.json({ address });
  } catch (error) {
    console.error('Error fetching address from Google Maps API:', error.response?.data || error.message);
    res.status(500).send('Failed to fetch address.');
  }
};

exports.getRequestHistory = async (req, res) => {
  try {
      const userId = req.user._id;
      const requests = await Request.find({ userId })
          .populate('ambulanceId', 'driverName vehicleNumber')
          .sort({ createdAt: -1 })
          .lean();
      res.render('user/request-history', { requests });
  } catch (err) {
      console.error('Error fetching request history:', err);
      res.status(500).send('Something went wrong.');
  }
};




const path = require('path');
const fs = require('fs');

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found yaaar' });
    }
    res.render('user/profile', { user, error: null, success: null });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).render('user/profile', { user: null, error: 'Server error', success: null });
  }
};


exports.updateProfile = async (req, res) => {
  try {
    const { fullName, email, contactNumber, latitude, longitude } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update fields
    user.fullName = fullName || user.fullName;
    user.email = email || user.email;
    user.contactNumber = contactNumber || user.contactNumber;
    user.latitude = latitude || user.latitude;
    user.longitude = longitude || user.longitude;

    // Handle profile image
    if (req.file) {
      // Delete old image if exists
      if (user.profileImage) {
        const oldImagePath = path.join(__dirname, '..', 'uploads', user.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      user.profileImage = req.file.filename;
    }

    await user.save();

    res.render('profile', {
      user,
      error: null,
      success: 'Profile updated successfully!'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.render('profile', {
      user: req.user,
      error: 'Failed to update profile',
      success: null
    });
  }
};